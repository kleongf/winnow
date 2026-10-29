"""The Describe interview on the Rubric draft: code picks each question, an answer changes the
draft and leaves an interview label, and undo puts both back. No model call anywhere."""

from datetime import UTC, datetime

from winnow.core.context import AppContext
from winnow.interview.anchor import anchor_results
from winnow.interview.apply import criterion, mark_context, restore, settle
from winnow.interview.bisection import Asked, Point, next_point, resolve
from winnow.interview.models import (
    AnswerDraw,
    Interview,
    PhraseQuestion,
    StoredAnswer,
    ThresholdQuestion,
)
from winnow.interview.questions import asked_on, phrase_questions, threshold_questions
from winnow.interview.wording import label_effect, phrase_effect, resolution_effect
from winnow.labels.models import LabelDraw
from winnow.labels.service import save_draft_label
from winnow.rubric.models import RubricDraft
from winnow.rubric.service import NoDraftError


class StaleQuestionError(ValueError):
    """The answer isn't to the question code is asking now."""


class UnknownAnswerError(LookupError):
    pass


def _draft(ctx: AppContext) -> RubricDraft:
    draft = ctx.drafts.get()
    if draft is None:
        raise NoDraftError("There's no Rubric draft yet: compile a Description first")
    return draft


def _questions(
    ctx: AppContext, draft: RubricDraft, answers: list[StoredAnswer]
) -> tuple[list[PhraseQuestion], list[ThresholdQuestion]]:
    phrases = phrase_questions(draft, {a.key for a in answers})
    return phrases, threshold_questions(draft, anchor_results(ctx, draft), answers)


def current(ctx: AppContext) -> Interview:
    draft = _draft(ctx)
    answers = ctx.interview.answers(draft.compiled_at)
    phrases, thresholds = _questions(ctx, draft, answers)
    asking: list[PhraseQuestion | ThresholdQuestion] = [*phrases, *thresholds]
    return Interview(
        answered=list(answers),
        question=asking[0] if asking else None,
        covered=not phrases,
        phrases_left=len(phrases),
        thresholds_left=len(thresholds),
    )


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _answer_phrase(
    ctx: AppContext, draft: RubricDraft, q: PhraseQuestion, draw: AnswerDraw
) -> StoredAnswer:
    before = None
    if draw.answer == "context":
        before = draft.phrases
        ctx.drafts.save(mark_context(draft, q.start, q.end))
    return StoredAnswer(
        id=0,
        key=q.key,
        kind=q.kind,
        subject=q.text,
        episode_id=None,
        measurement=None,
        answer=draw.answer,
        effect=phrase_effect(draw.answer, q.text),
        changed_criterion=None,
        label_id=None,
        resolution=None,
        answered_at=_now(),
        phrases_before=before,
    )


def _skipped(q: ThresholdQuestion) -> StoredAnswer:
    return StoredAnswer(
        id=0,
        key=q.key,
        kind="threshold",
        subject=q.phrase,
        episode_id=None,
        measurement=None,
        answer="skip",
        effect="Skipped: the threshold stays assumed.",
        changed_criterion=None,
        label_id=None,
        resolution=None,
        answered_at=_now(),
    )


def _answer_threshold(
    ctx: AppContext,
    draft: RubricDraft,
    q: ThresholdQuestion,
    draw: AnswerDraw,
    answers: list[StoredAnswer],
) -> StoredAnswer:
    if draw.answer == "skip":
        return _skipped(q)
    value = "pass" if draw.answer == "pass" else "fail"  # its options are pass, fail and skip
    label = save_draft_label(
        ctx, q.episode_id, LabelDraw(phrase=q.phrase, value=value, source="interview")
    )
    asked = [*asked_on(answers, q.key), Asked(q.episode_id, q.value, value == "pass")]
    found = criterion(draft, q.criterion_id)
    points = [Point(r.episode_id, r.value) for r in anchor_results(ctx, draft)[found.id]]
    effect = label_effect(q.episode_id, value, q.phrase)
    settled = next_point(points, asked, found.threshold, found.comparator) is None
    resolution = resolve(asked, found.threshold, found.comparator) if settled else None
    if resolution is not None:
        ctx.drafts.save(settle(draft, found.id, resolution))
        effect = f"{effect} {resolution_effect(resolution, found)}"
    changed = resolution is not None and resolution.outcome != "unbracketed"
    return StoredAnswer(
        id=0,
        key=q.key,
        kind="threshold",
        subject=q.phrase,
        episode_id=q.episode_id,
        measurement=q.measurement,
        answer=draw.answer,
        effect=effect,
        changed_criterion=found.id if changed else None,
        label_id=label.id,
        resolution=resolution.outcome if resolution else None,
        answered_at=_now(),
        value=q.value,
        criterion_before=found if resolution is not None else None,
    )


def answer(ctx: AppContext, draw: AnswerDraw) -> Interview:
    """Raises StaleQuestionError unless `draw` answers the question being asked, with one of
    its options."""
    draft = _draft(ctx)
    answers = ctx.interview.answers(draft.compiled_at)
    asking = current(ctx).question
    if asking is None or asking.key != draw.key:
        raise StaleQuestionError("That question isn't the one being asked")
    if draw.answer not in {o.answer for o in asking.options}:
        raise StaleQuestionError(f"“{draw.answer}” doesn't answer this question")
    if isinstance(asking, PhraseQuestion):
        stored = _answer_phrase(ctx, draft, asking, draw)
    elif draw.episode_id != asking.episode_id:
        raise StaleQuestionError(f"The question is about {asking.episode_id} now")
    else:
        stored = _answer_threshold(ctx, draft, asking, draw, answers)
    ctx.interview.add(draft.compiled_at, stored)
    return current(ctx)


def undo(ctx: AppContext, answer_id: int) -> Interview:
    """Undoes an answer and every later one on the same question: the draft gets back what they
    changed, and their labels are withdrawn."""
    draft = _draft(ctx)
    answers = ctx.interview.answers(draft.compiled_at)
    target = next((a for a in answers if a.id == answer_id), None)
    if target is None:
        raise UnknownAnswerError(f"No answer {answer_id} in this interview")
    undone = [a for a in answers if a.key == target.key and a.id >= target.id]
    for a in reversed(undone):
        draft = restore(draft, a.criterion_before, a.phrases_before)
        if a.label_id is not None:
            ctx.labels.withdraw(a.label_id)
    ctx.drafts.save(draft)
    ctx.interview.remove([a.id for a in undone])
    return current(ctx)
