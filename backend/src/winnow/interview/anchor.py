"""What the interview may show of the anchor pool: each Criterion's measured value on each anchor
Episode with a Reference label (the rest stay blind), and the stretch it was measured over."""

from dataclasses import dataclass

from winnow.core.context import AppContext
from winnow.interview.models import Clip
from winnow.reference_labels.gate import revealed_ids
from winnow.rubric.anchor_pool import anchor_episodes
from winnow.rubric.models import RubricDraft
from winnow.triage.models import CriterionResult
from winnow.triage.scoring import score
from winnow.triage.service import episode_facts

PAD_S = 1.0  # shown either side of the measured moments


@dataclass(frozen=True)
class AnchorResult:
    episode_id: str
    value: float
    measurement: str
    camera: str | None
    clip: Clip


def _clip(result: CriterionResult, duration: float) -> Clip:
    """Around the moments the measurement marks, else its window, else the whole Episode."""
    times = [m.t for m in result.moments]
    if times:
        return Clip(start=max(0.0, min(times) - PAD_S), end=min(duration, max(times) + PAD_S))
    if result.window is not None:
        return Clip(start=result.window.start, end=result.window.end)
    return Clip(start=0.0, end=duration)


def anchor_results(ctx: AppContext, draft: RubricDraft) -> dict[str, list[AnchorResult]]:
    """By Criterion id, the anchor Episodes it measured a value on."""
    revealed = revealed_ids(ctx)
    everything = draft.rubric().model_copy(update={"criteria": draft.criteria})
    found: dict[str, list[AnchorResult]] = {c.id: [] for c in draft.criteria}
    for episode in anchor_episodes(ctx):
        if episode.id not in revealed:
            continue
        facts = episode_facts(ctx, episode)
        duration = float(facts.t[-1]) if len(facts.t) else 0.0
        for result in score(everything, facts).criteria:
            if result.value is None:
                continue
            camera = result.camera or (episode.cameras[0] if episode.cameras else None)
            found[result.criterion_id].append(
                AnchorResult(
                    episode.id, result.value, result.measurement, camera, _clip(result, duration)
                )
            )
    return found
