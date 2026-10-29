"""Gathers each Episode's facts and scores it against the latest Rubric version, on every read."""

from winnow.core.context import AppContext
from winnow.criteria.facts import EpisodeFacts
from winnow.episodes.models import Episode
from winnow.rubric.models import RubricVersion
from winnow.triage.models import EpisodeTriage, TriageList, TriageRow
from winnow.triage.scoring import score


def episode_facts(ctx: AppContext, episode: Episode) -> EpisodeFacts:
    return EpisodeFacts(ctx.episodes.load_signals(episode))


def _triage(ctx: AppContext, version: RubricVersion, episode: Episode) -> EpisodeTriage:
    triage = score(version.rubric, episode_facts(ctx, episode))  # no labels until Review
    return EpisodeTriage(
        **triage.model_dump(), episode_id=episode.id, rubric_version=version.version
    )


def episode_triage(ctx: AppContext, episode: Episode) -> EpisodeTriage:
    return _triage(ctx, ctx.rubrics.latest(), episode)


def triage_list(ctx: AppContext, episodes: list[Episode]) -> TriageList:
    version = ctx.rubrics.latest()
    rows = [
        TriageRow(
            episode_id=t.episode_id,
            decision=t.decision,
            reason="".join(span.text for span in t.reason),
        )
        for t in (_triage(ctx, version, e) for e in episodes)
    ]
    return TriageList(rubric_version=version.version, rows=rows)
