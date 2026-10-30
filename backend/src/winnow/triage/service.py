"""Gathers each Episode's facts and labels and scores it against the latest Rubric version, on
every read."""

from winnow.core.context import AppContext
from winnow.criteria.facts import EpisodeFacts
from winnow.episodes.models import Episode
from winnow.rubric.models import RubricVersion
from winnow.tracking.exterior import current_exterior_track
from winnow.tracking.target import chosen_target_box
from winnow.triage.models import EpisodeTriage, PhraseChip, TriageList, TriageRow
from winnow.triage.scoring import score


def episode_facts(ctx: AppContext, episode: Episode) -> EpisodeFacts:
    """Robot data, SAM's tracks so far, and the target box, as they stand for the object's box
    now."""
    tracks = ctx.tracks.for_episode(episode.id)
    box = ctx.boxes.get(episode.id)
    return EpisodeFacts(
        ctx.episodes.load_signals(episode),
        wrist=next((t for t in tracks if t.kind == "wrist"), None),
        exterior=current_exterior_track(tracks, box),
        target=None if box is None else chosen_target_box(ctx.targets, box),
    )


def _triage(ctx: AppContext, version: RubricVersion, episode: Episode) -> EpisodeTriage:
    triage = score(version.rubric, episode_facts(ctx, episode), ctx.labels.in_force(episode.id))
    return EpisodeTriage(
        **triage.model_dump(), episode_id=episode.id, rubric_version=version.version
    )


def episode_triage(ctx: AppContext, episode: Episode) -> EpisodeTriage:
    return _triage(ctx, ctx.rubrics.latest(), episode)


def scored(ctx: AppContext, episodes: list[Episode]) -> tuple[RubricVersion, list[EpisodeTriage]]:
    """Every one of `episodes` scored against the latest Rubric version, with its labels."""
    version = ctx.rubrics.latest()
    return version, [_triage(ctx, version, e) for e in episodes]


def triage_list(ctx: AppContext, episodes: list[Episode]) -> TriageList:
    version, triages = scored(ctx, episodes)
    return TriageList(rubric_version=version.version, rows=[_row(t) for t in triages])


def plain_reason(triage: EpisodeTriage) -> str:
    return "".join(span.text for span in triage.reason)


def _row(triage: EpisodeTriage) -> TriageRow:
    return TriageRow(
        episode_id=triage.episode_id,
        decision=triage.decision,
        reason=plain_reason(triage),
        confidence=triage.confidence,
        not_passed=[
            PhraseChip(phrase=p.phrase, status=p.status)
            for p in triage.phrases
            if p.status is not None and p.status != "pass"
        ],
        uncertainty=list(dict.fromkeys(r.uncertainty for r in triage.criteria if r.uncertainty)),
    )
