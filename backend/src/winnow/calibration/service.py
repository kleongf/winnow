"""Calibrating the latest Rubric version on the anchor pool's labels, and accepting a threshold
they suggest.

Only anchor-pool Episodes with a Reference label take part (the Dev set, never the Test set),
with only their interview and review labels: audit labels measure Keep precision alone. Each is
scored with no label applied, so the labels judge Winnow's own results. Everything is the pure
scoring function over stored facts, so calibrating makes no model call.
"""

from winnow.calibration.labelled import LabelledEpisode, patterns, suggestions
from winnow.calibration.models import Calibration
from winnow.calibration.scan import CONFIDENCE, GRID, MAX_ERROR_RATE, scan, unstable
from winnow.core.context import AppContext
from winnow.criteria.models import Criterion
from winnow.rubric.models import RubricVersion
from winnow.rubric.preview import anchor_labels, revealed_anchor_facts


class NoLabelsError(ValueError):
    pass


class NoSuggestionError(LookupError):
    pass


def _labelled(ctx: AppContext) -> list[LabelledEpisode]:
    facts = revealed_anchor_facts(ctx)
    labels = anchor_labels(ctx, list(facts))
    return [LabelledEpisode(id_, f, labels[id_]) for id_, f in facts.items() if labels[id_]]


def _calibration(
    ctx: AppContext, version: RubricVersion, episodes: list[LabelledEpisode]
) -> Calibration:
    s = ctx.calibrations.s_for(version.version)
    return Calibration(
        rubric_version=version.version,
        s=s,
        record=ctx.calibrations.latest(version.version),
        labelled=len(patterns(version.rubric, episodes)),
        grid=list(GRID),
        max_error_rate=MAX_ERROR_RATE,
        confidence=CONFIDENCE,
        suggestions=suggestions(version.rubric, episodes, s),
    )


def calibration(ctx: AppContext) -> Calibration:
    return _calibration(ctx, ctx.rubrics.latest(), _labelled(ctx))


def calibrate(ctx: AppContext) -> Calibration:
    """Scans s for the latest Rubric version and stores it, with the leave-one-out check.
    Raises NoLabelsError when no label is on a Phrase the version checks."""
    version = ctx.rubrics.latest()
    episodes = _labelled(ctx)
    pairs = patterns(version.rubric, episodes)
    if not pairs:
        raise NoLabelsError(
            "No interview or review label on the anchor pool yet: label some Phrases first"
        )
    found = scan(pairs)
    ctx.calibrations.add(
        version.version, found.s, found.n, found.errors, found.bound_met, unstable(pairs)
    )
    return _calibration(ctx, version, episodes)


def _settled(
    criteria: list[Criterion], criterion_id: str, changes: dict[str, object]
) -> list[Criterion]:
    return [c.model_copy(update=changes) if c.id == criterion_id else c for c in criteria]


def accept_suggestion(ctx: AppContext, criterion_id: str) -> RubricVersion:
    """Freezes the latest Rubric version with the threshold and margin labels suggest for
    `criterion_id` as the next version, which starts at s = 1, and carries them into the draft
    so the next Run keeps them. The suggested value is no longer an assumption. Raises
    NoSuggestionError when labels suggest nothing for it now."""
    version = ctx.rubrics.latest()
    found = next((x for x in calibration(ctx).suggestions if x.criterion_id == criterion_id), None)
    if found is None:
        raise NoSuggestionError(
            f"Labels suggest no threshold for {criterion_id} on v{version.version}"
        )
    changes: dict[str, object] = {
        "threshold": found.suggested_threshold,
        "margin": found.suggested_margin,
        "assumptions": [],
    }
    draft = ctx.drafts.get()
    if draft is not None and any(c.id == criterion_id for c in draft.criteria):
        criteria = _settled(draft.criteria, criterion_id, changes)
        ctx.drafts.save(draft.model_copy(update={"criteria": criteria}))
    rubric = version.rubric
    criteria = _settled(rubric.criteria, criterion_id, changes)
    return ctx.rubrics.add(rubric.model_copy(update={"criteria": criteria}))
