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


def restore(
    draft: RubricDraft, before: Criterion | None, phrases: list[DraftPhrase] | None
) -> RubricDraft:
    """The draft with an answer's Criterion and Phrases put back as they were before it."""
    if before is not None and any(c.id == before.id for c in draft.criteria):
        draft = _replace(draft, before)
    if phrases is not None:
        draft = draft.model_copy(update={"phrases": phrases})
    return draft
