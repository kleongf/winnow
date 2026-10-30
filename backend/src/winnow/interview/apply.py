"""What interview answers change in the Rubric draft, and how undo puts it back. Pure: the service
saves the result."""

from winnow.criteria.models import Criterion
from winnow.interview.bisection import Resolution
from winnow.rubric.models import DraftPhrase, RubricDraft

CONTEXT_REASON = "Marked Context in the interview."


def mark_context(draft: RubricDraft, start: int, end: int) -> RubricDraft:
    """The Phrase at `start` becomes Context; words in no Phrase become a Context Phrase."""
    text = draft.description[start:end]
    others = [p for p in draft.phrases if p.start != start]
    phrase = DraftPhrase(
        text=text,
        start=start,
        end=end,
        restatement=next(
            (p.restatement for p in draft.phrases if p.start == start), f"Context: {text}."
        ),
        status="context",
        reason=CONTEXT_REASON,
    )
    return draft.model_copy(update={"phrases": sorted([*others, phrase], key=lambda p: p.start)})


def criterion(draft: RubricDraft, criterion_id: str) -> Criterion:
    return next(c for c in draft.criteria if c.id == criterion_id)


def _replace(draft: RubricDraft, changed: Criterion) -> RubricDraft:
    return draft.model_copy(
        update={"criteria": [changed if c.id == changed.id else c for c in draft.criteria]}
    )


def settle(draft: RubricDraft, criterion_id: str, resolution: Resolution) -> RubricDraft:
    """A bracketed threshold moves and takes its margin; a confirmed one keeps both. Either way
    its value is no longer an assumption. An unbracketed one stays as it is."""
    if resolution.outcome == "unbracketed":
        return draft
    found = criterion(draft, criterion_id)
    changes: dict[str, object] = {"assumptions": []}
    if resolution.outcome == "set":
        changes |= {"threshold": resolution.threshold, "margin": resolution.margin}
    return _replace(draft, found.model_copy(update=changes))


def restore_criterion(draft: RubricDraft, before: Criterion) -> RubricDraft:
    """Puts back what settling changed (threshold, margin, assumptions), keeping later edits."""
    current = next((c for c in draft.criteria if c.id == before.id), None)
    if current is None:
        return draft
    settled = {"threshold", "margin", "assumptions"}
    return _replace(draft, current.model_copy(update=before.model_dump(include=settled)))


def restore_phrase(draft: RubricDraft, start: int, before: DraftPhrase | None) -> RubricDraft:
    """Puts back the Phrase made Context at `start`: as it was, or gone when it was words in no
    Phrase. Every other Phrase stays as it is now."""
    others = [p for p in draft.phrases if p.start != start]
    phrases = others if before is None else sorted([*others, before], key=lambda p: p.start)
    return draft.model_copy(update={"phrases": phrases})
