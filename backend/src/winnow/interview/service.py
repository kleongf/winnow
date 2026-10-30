"""The Describe interview on the Rubric draft: code picks each question, an answer changes the
draft and leaves an interview label, and undo puts both back. No model call anywhere."""

from dataclasses import dataclass
from datetime import UTC, datetime

from winnow.core.context import AppContext
from winnow.interview.anchor import AnchorResult, anchor_results
from winnow.interview.apply import (
    criterion,
    mark_context,
    restore_criterion,
    restore_phrase,
    settle,
)
from winnow.interview.bisection import Answered, Point, next_point, resolve
from winnow.interview.models import (
    AnswerDraw,
    AnswerValue,
    Interview,
    PhraseQuestion,
    QuestionKind,
    StoredAnswer,
    ThresholdQuestion,
)
from winnow.interview.questions import asked_on, phrase_questions, threshold_questions
from winnow.interview.wording import label_effect, phrase_effect, resolution_effect
from winnow.labels.models import LabelDraw
from winnow.labels.service import save_draft_label
from winnow.rubric.models import RubricDraft
from winnow.rubric.service import current_draft


class StaleQuestionError(ValueError):
    """The answer isn't to the question code is asking now."""


class UnknownAnswerError(LookupError):
    pass


@dataclass(frozen=True)
class _State:
    draft: RubricDraft
    answers: list[StoredAnswer]
    anchor: dict[str, list[AnchorResult]]  # by Criterion id
    phrases: list[PhraseQuestion]
    thresholds: list[ThresholdQuestion]

    @property
    def asking(self) -> PhraseQuestion | ThresholdQuestion | None:
        return next(iter([*self.phrases, *self.thresholds]), None)


def _state(ctx: AppContext) -> _State:
    """The draft scored on the anchor pool once, and every question still open."""
    draft = current_draft(ctx)
    answers = ctx.interview.answers(draft.compiled_at)
    anchor = anchor_results(ctx, draft)
    phrases = phrase_questions(draft, {a.key for a in answers})
    return _State(draft, answers, anchor, phrases, threshold_questions(draft, anchor, answers))


def current(ctx: AppContext) -> Interview:
    state = _state(ctx)
    return Interview(
        answered=list(state.answers),
        question=state.asking,
        covered=not state.phrases,
        phrases_left=len(state.phrases),
        thresholds_left=len(state.thresholds),
    )


def _stored(
    key: str, kind: QuestionKind, subject: str, answer: AnswerValue, effect: str
) -> StoredAnswer:
    """An answer that changed nothing yet; callers add what it did."""
    return StoredAnswer(
        id=0,
        key=key,
        kind=kind,
        subject=subject,
        episode_id=None,
        measurement=None,
        answer=answer,
        effect=effect,
        changed_criterion=None,
        label_id=None,
        resolution=None,
        answered_at=datetime.now(UTC).isoformat(),
    )


def _answer_phrase(
    ctx: AppContext, draft: RubricDraft, q: PhraseQuestion, value: AnswerValue
) -> StoredAnswer:
    stored = _stored(q.key, q.kind, q.text, value, phrase_effect(value, q.text))
    if value != "context":
        return stored
    ctx.drafts.save(mark_context(draft, q.start, q.end))
    before = next((p for p in draft.phrases if p.start == q.start), None)
    return stored.model_copy(update={"context_at": q.start, "phrase_before": before})


def _answer_threshold(
    ctx: AppContext, state: _State, q: ThresholdQuestion, answer: AnswerValue
) -> StoredAnswer:
    if answer == "skip":
        return _stored(
            q.key, "threshold", q.phrase, answer, "Skipped: the threshold stays assumed."
        )
    value = "pass" if answer == "pass" else "fail"  # its options are pass, fail and skip
    label = save_draft_label(
        ctx, q.episode_id, LabelDraw(phrase=q.phrase, value=value, source="interview")
    )
    asked = [*asked_on(state.answers, q.key), Answered(q.episode_id, q.value, value == "pass")]
    found = criterion(state.draft, q.criterion_id)
    points = [Point(r.episode_id, r.value) for r in state.anchor[found.id]]
    stored = _stored(
        q.key, "threshold", q.phrase, answer, label_effect(q.episode_id, value, q.phrase)
    )
    stored = stored.model_copy(
        update={
            "episode_id": q.episode_id,
            "measurement": q.measurement,
            "value": q.value,
            "label_id": label.id,
        }
    )
    if next_point(points, asked, found.threshold, found.comparator) is not None:
        return stored  # bisection goes on
    resolution = resolve(asked, found.threshold, found.comparator)
    ctx.drafts.save(settle(state.draft, found.id, resolution))
    changed = resolution.outcome != "unbracketed"
    return stored.model_copy(
        update={
            "effect": f"{stored.effect} {resolution_effect(resolution, found)}",
            "changed_criterion": found.id if changed else None,
            "resolution": resolution.outcome,
            "criterion_before": found,
        }
    )


def answer(ctx: AppContext, draw: AnswerDraw) -> Interview:
    """Raises StaleQuestionError unless `draw` answers the question being asked, with one of
    its options."""
    state = _state(ctx)
    asking = state.asking
    if asking is None or asking.key != draw.key:
        raise StaleQuestionError("That question isn't the one being asked")
    if draw.answer not in {o.answer for o in asking.options}:
        raise StaleQuestionError(f"“{draw.answer}” doesn't answer this question")
    if isinstance(asking, PhraseQuestion):
        stored = _answer_phrase(ctx, state.draft, asking, draw.answer)
    elif draw.episode_id != asking.episode_id:
        raise StaleQuestionError(f"The question is about {asking.episode_id} now")
    else:
        stored = _answer_threshold(ctx, state, asking, draw.answer)
    ctx.interview.add(state.draft.compiled_at, stored)
    return current(ctx)


def undo(ctx: AppContext, answer_id: int) -> Interview:
    """Undoes an answer and every later one on the same question: the draft gets back what they
    changed, and their labels are withdrawn."""
    draft = current_draft(ctx)
    answers = ctx.interview.answers(draft.compiled_at)
    target = next((a for a in answers if a.id == answer_id), None)
    if target is None:
        raise UnknownAnswerError(f"No answer {answer_id} in this interview")
    undone = [a for a in answers if a.key == target.key and a.id >= target.id]
    for a in reversed(undone):
        if a.criterion_before is not None:
            draft = restore_criterion(draft, a.criterion_before)
        if a.context_at is not None:
            draft = restore_phrase(draft, a.context_at, a.phrase_before)
        if a.label_id is not None:
            ctx.labels.withdraw(a.label_id)
    ctx.drafts.save(draft)
    ctx.interview.remove([a.id for a in undone])
    return current(ctx)
