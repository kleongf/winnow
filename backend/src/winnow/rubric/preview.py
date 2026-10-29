"""Scoring a Rubric on the anchor pool, for the Describe page's histograms and counts.

Only anchor Episodes with a Reference label take part: the rest stay blind (the gate in
`reference_labels.gate`), and no Test set Episode is ever in the anchor pool. Everything is the
pure scoring function over stored facts, so a preview makes no model call.
"""

from winnow.core.context import AppContext
from winnow.criteria.english import english
from winnow.criteria.facts import EpisodeFacts
from winnow.criteria.models import Criterion
from winnow.reference_labels.gate import revealed_ids
from winnow.rubric.anchor_pool import anchor_episodes
from winnow.rubric.models import (
    AnchorEpisode,
    AnchorPreview,
    AnchorValue,
    CriterionPreview,
    Rubric,
)
from winnow.triage.confidence import effective_margin
from winnow.triage.models import CriterionResult, Triage
from winnow.triage.scoring import score
from winnow.triage.service import episode_facts


def revealed_anchor_facts(ctx: AppContext) -> dict[str, EpisodeFacts]:
    """The facts of each anchor Episode whose outputs may be shown, by id."""
    revealed = revealed_ids(ctx)
    return {e.id: episode_facts(ctx, e) for e in anchor_episodes(ctx) if e.id in revealed}


def _criterion(criterion: Criterion, results: dict[str, CriterionResult]) -> CriterionPreview:
    statuses = [r.status for r in results.values()]
    return CriterionPreview(
        criterion_id=criterion.id,
        english=english(criterion),
        threshold=criterion.threshold,
        margin=effective_margin(criterion),
        unit=criterion.unit,
        passing=statuses.count("pass"),
        failing=statuses.count("fail"),
        unsure=statuses.count("unsure"),
        values=[
            AnchorValue(episode_id=id_, value=r.value, status=r.status)
            for id_, r in results.items()
        ],
    )


def anchor_preview(
    facts: dict[str, EpisodeFacts],
    rubric: Rubric,
    shown: list[Criterion],
    version: int | None,
) -> AnchorPreview:
    """`rubric` decides each Episode; `shown` are the Criteria to histogram, a superset of the
    Rubric's when some are switched off."""
    everything = rubric.model_copy(update={"criteria": shown})
    triages: dict[str, Triage] = {id_: score(rubric, f) for id_, f in facts.items()}
    results = {
        id_: {r.criterion_id: r for r in score(everything, f).criteria} for id_, f in facts.items()
    }
    decisions = [t.decision for t in triages.values()]
    episodes = [
        AnchorEpisode(episode_id=id_, decision=t.decision, confidence=t.confidence)
        for id_, t in triages.items()
    ]
    return AnchorPreview(
        rubric_version=version,
        keep=decisions.count("keep"),
        reject=decisions.count("reject"),
        needs_review=decisions.count("needs_review"),
        episodes=sorted(episodes, key=lambda e: e.confidence),
        criteria=[
            _criterion(c, {id_: found[c.id] for id_, found in results.items()}) for c in shown
        ],
    )
