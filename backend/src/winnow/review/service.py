"""The Review queue, scored like every other read: a review label recomputes the Triage decision,
so an Episode it decides drops out on the next read."""

from winnow.core.context import AppContext
from winnow.episodes.models import Episode
from winnow.review.models import ReviewItem, ReviewQueue, UnsurePhrase
from winnow.triage.models import EpisodeTriage
from winnow.triage.reason import signal_text, undecided
from winnow.triage.service import plain_reason, scored


def review_queue(ctx: AppContext, episodes: list[Episode]) -> ReviewQueue:
    version, triages = scored(ctx, episodes)
    waiting = [t for t in triages if t.decision == "needs_review"]
    reviewed = {
        label.episode_id
        for t in triages
        if t.decision != "needs_review"
        for label in ctx.labels.in_force(t.episode_id)
        if label.source == "review"
    }
    return ReviewQueue(
        rubric_version=version.version,
        reviewed=len(reviewed),
        # sorted() is stable: equally confident Episodes keep the Dataset's order.
        items=[_item(t) for t in sorted(waiting, key=lambda t: t.confidence)],
    )


def _item(triage: EpisodeTriage) -> ReviewItem:
    return ReviewItem(
        episode_id=triage.episode_id,
        confidence=triage.confidence,
        reason=plain_reason(triage),
        unsure=[
            UnsurePhrase(
                phrase=p.phrase,
                signals=list(
                    dict.fromkeys(signal_text(r) for r in undecided(triage.criteria, p.phrase))
                ),
            )
            for p in triage.phrases
            if p.hard and p.status == "unsure"
        ],
    )
