"""Gathers each Episode's facts and scores it against the latest Rubric version, on every read."""

from winnow.core.context import AppContext
from winnow.criteria.facts import EpisodeFacts
from winnow.episodes.models import Episode
from winnow.rubric.models import RubricVersion
from winnow.tracking.target import chosen_target_box
from winnow.triage.models import EpisodeTriage, PhraseChip, TriageList, TriageRow
from winnow.triage.scoring import score


def episode_facts(ctx: AppContext, episode: Episode) -> EpisodeFacts:
    """Robot data, SAM's tracks so far, and the target box. The exterior track and target box
    count only on the view the object is boxed in now: a redrawn box makes them stale until the
    work it queued replaces them."""
    tracks = {t.kind: t for t in ctx.tracks.for_episode(episode.id)}
    box = ctx.boxes.get(episode.id)
    exterior = tracks.get("exterior")
    if box is None or (exterior is not None and exterior.camera != box.camera):
        exterior = None
    return EpisodeFacts(
        ctx.episodes.load_signals(episode),
        wrist=tracks.get("wrist"),
        exterior=exterior,
        target=None if box is None else chosen_target_box(ctx.targets, box),
    )


def _triage(ctx: AppContext, version: RubricVersion, episode: Episode) -> EpisodeTriage:
    triage = score(version.rubric, episode_facts(ctx, episode))  # no labels until Review
    return EpisodeTriage(
        **triage.model_dump(), episode_id=episode.id, rubric_version=version.version
    )


def episode_triage(ctx: AppContext, episode: Episode) -> EpisodeTriage:
    return _triage(ctx, ctx.rubrics.latest(), episode)


def triage_list(ctx: AppContext, episodes: list[Episode]) -> TriageList:
    version = ctx.rubrics.latest()
    rows = [_row(_triage(ctx, version, e)) for e in episodes]
    return TriageList(rubric_version=version.version, rows=rows)


def _row(triage: EpisodeTriage) -> TriageRow:
    return TriageRow(
        episode_id=triage.episode_id,
        decision=triage.decision,
        reason="".join(span.text for span in triage.reason),
        confidence=triage.confidence,
        not_passed=[
            PhraseChip(phrase=p.phrase, status=p.status)
            for p in triage.phrases
            if p.status is not None and p.status != "pass"
        ],
        uncertainty=list(dict.fromkeys(r.uncertainty for r in triage.criteria if r.uncertainty)),
    )
