"""Compile: one contributor Spark call turns a Description into a Rubric draft.

Every Phrase in the answer goes through code's checks (`rubric.answer`). Those that fail get one
repair turn; a Phrase that still fails becomes Unsupported with the error as its reason, or, when
it isn't even in the Description, is rejected and listed.
"""

from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime

from winnow.criteria.models import Criterion, RubricSettings
from winnow.meta.client import MetaClient
from winnow.meta.models import SparkRequest, Text
from winnow.meta.pricing import SPARK_CONTRIBUTOR
from winnow.rubric.answer import (
    AnswerPhrase,
    CheckedPhrase,
    PhraseError,
    answer_schema,
    check_phrase,
    parse_answer,
)
from winnow.rubric.models import DraftPhrase, RejectedPhrase, RubricDraft
from winnow.rubric.phrases import locate
from winnow.rubric.prompt import compile_prompt, repair_prompt

MAX_OUTPUT_TOKENS = 16000  # effort `high` reasons at length before a long structured answer


class CompileError(RuntimeError):
    """Spark's answer couldn't be read even after the repair turn."""


@dataclass(frozen=True)
class _Failure:
    answer: AnswerPhrase
    error: str


async def _ask(meta: MetaClient, *parts: str) -> str:
    request = SparkRequest(
        SPARK_CONTRIBUTOR,
        tuple(Text(p) for p in parts),
        answer_schema(),
        "compile",
        effort="high",
        max_output_tokens=MAX_OUTPUT_TOKENS,
        schema_name="rubric",
    )
    return (await meta.spark(request)).text


def _check_all(
    answers: list[AnswerPhrase], description: str, accepted: list[CheckedPhrase]
) -> list[_Failure]:
    """Appends each answer that passes to `accepted`; returns the rest with their errors."""
    failures: list[_Failure] = []
    for answer in answers:
        taken = [(c.phrase.start, c.phrase.end) for c in accepted]
        try:
            accepted.append(check_phrase(answer, description, taken))
        except PhraseError as error:
            failures.append(_Failure(answer, str(error)))
    return failures


async def compile_rubric(
    meta: MetaClient, description: str, manifest: str, settings: RubricSettings
) -> RubricDraft:
    prompt = compile_prompt(description, manifest)
    first = await _ask(meta, prompt)
    accepted: list[CheckedPhrase] = []
    try:
        answer = parse_answer(first)
    except PhraseError as error:
        retry = await _ask(meta, prompt, first, repair_prompt([str(error)], whole=True))
        try:
            answer = parse_answer(retry)
        except PhraseError as again:
            raise CompileError(f"Spark's answer couldn't be read: {again}") from again
        failures = _check_all(answer.phrases, description, accepted)
        return _draft(description, settings, accepted, failures)
    failures = _check_all(answer.phrases, description, accepted)
    if failures:
        failures = await _repair(meta, (prompt, first), description, accepted, failures)
    return _draft(description, settings, accepted, failures)


async def _repair(
    meta: MetaClient,
    asked: tuple[str, str],
    description: str,
    accepted: list[CheckedPhrase],
    failures: list[_Failure],
) -> list[_Failure]:
    """The one repair turn: Spark sees its answer and the errors, and answers again for the
    failing Phrases only. Returns those still failing."""
    errors = [f"Phrase {f.answer.text!r}: {f.error}" for f in failures]
    reply = await _ask(meta, *asked, repair_prompt(errors, whole=False))
    try:
        repaired = parse_answer(reply).phrases[: len(failures)]
    except PhraseError:
        return failures
    return [*_check_all(repaired, description, accepted), *failures[len(repaired) :]]


def _numbered(criteria: list[Criterion]) -> list[Criterion]:
    """Ids from the primitive, numbered from the second of a kind: stable while a Criterion's
    Phrase and primitive don't change."""
    seen: Counter[str] = Counter()
    numbered: list[Criterion] = []
    for criterion in criteria:
        slug = criterion.primitive.replace("_", "-")
        seen[slug] += 1
        suffix = f"-{seen[slug]}" if seen[slug] > 1 else ""
        numbered.append(criterion.model_copy(update={"id": slug + suffix}))
    return numbered


def _draft(
    description: str,
    settings: RubricSettings,
    accepted: list[CheckedPhrase],
    failures: list[_Failure],
) -> RubricDraft:
    phrases = [c.phrase for c in accepted]
    rejected: list[RejectedPhrase] = []
    for failure in failures:
        answer = failure.answer
        try:
            start, end = locate(description, answer.text, [(p.start, p.end) for p in phrases])
        except ValueError:
            rejected.append(RejectedPhrase(text=answer.text, reason=failure.error))
            continue
        phrases.append(
            DraftPhrase(
                text=answer.text,
                start=start,
                end=end,
                restatement=answer.restatement,
                status="unsupported",
                reason=failure.error,
            )
        )
    order = sorted(phrases, key=lambda p: p.start)
    rank = {p.text: i for i, p in enumerate(order)}
    criteria = sorted(
        (c for checked in accepted for c in checked.criteria), key=lambda c: rank[c.phrase]
    )
    return RubricDraft(
        description=description,
        phrases=order,
        settings=settings,
        criteria=_numbered(criteria),
        rejected=rejected,
        compiled_at=datetime.now(UTC).isoformat(),
    )
