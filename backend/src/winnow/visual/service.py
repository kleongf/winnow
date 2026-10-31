"""Asking a Rubric version's visual Criteria of the Dataset's Episodes, in the background."""

from pathlib import Path

from winnow.core.context import AppContext
from winnow.rubric.models import RubricVersion
from winnow.triage.reason_service import queue_reasons
from winnow.visual.crop import clips_folder
from winnow.visual.steps import visual_items


class MetaUnavailableError(RuntimeError):
    pass


def ask_visual(
    ctx: AppContext, version: RubricVersion, episode_ids: list[str] | None = None
) -> int | None:
    """Queues the crop and visual steps for every visual Criterion of `version` on each Episode
    (every ingested one by default); returns the job's id, or None when there's nothing to
    ask. Asking again pays only for what the Meta cache hasn't seen. Once the answers are in,
    Spark's Reasons are queued for the Episodes they changed."""
    if ctx.meta is None:
        raise MetaUnavailableError("Asking Spark needs the Meta API: set MODEL_API_KEY in .env")
    ids = episode_ids if episode_ids is not None else [e.id for e in ctx.episodes.list()]
    items = visual_items(version, ids)
    if not items:
        return None
    return ctx.runner.submit("visual", items, then=lambda: queue_reasons(ctx))


def visual_clip(ctx: AppContext, episode_id: str, name: str) -> Path | None:
    episode = ctx.episodes.get(episode_id)
    if episode is None:
        return None
    path = clips_folder(ctx.episodes.episode_folder(episode)) / name
    return path if path.is_file() else None
