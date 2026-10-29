"""The `ingest` step: one Episode from its source into the Dataset."""

import asyncio
from collections.abc import Mapping
from pathlib import Path

from winnow.episodes.clips import to_h264, to_sam_fps
from winnow.episodes.models import SourceEpisode
from winnow.episodes.sources import Source
from winnow.episodes.store import (
    EpisodeStore,
    clip_path,
    episode_id,
    sam_clip_path,
    save_signals,
)
from winnow.jobs.models import Step, WorkItem


def _write_files(source: Source, index: int, folder: Path) -> SourceEpisode:
    """Blocking work (parquet, ffmpeg), run off the event loop."""
    episode = source.load(index)
    save_signals(folder, episode.signals)
    for camera in source.cameras:
        h264 = clip_path(folder, camera)
        to_h264(source.clip(index, camera), h264)
        to_sam_fps(h264, sam_clip_path(folder, camera))
    return episode


async def ingest(store: EpisodeStore, source: Source, index: int) -> str | None:
    """Idempotent: an Episode whose row and files already exist is left alone."""
    if store.is_ingested(source.name, index, source.cameras):
        return "already ingested"
    folder = store.folder(source.name, index)
    episode = await asyncio.to_thread(_write_files, source, index, folder)
    store.save(source.name, index, episode)  # last, so a row always means complete files
    return None


def ingest_step(store: EpisodeStore, sources: Mapping[str, Source]) -> Step:
    async def step(args: Mapping[str, object]) -> str | None:
        source = sources[str(args["source"])]
        return await ingest(store, source, int(str(args["index"])))

    return step


def ingest_items(source: str, indices: list[int]) -> list[WorkItem]:
    """One work item per Episode, each Episode once, in the order given."""
    return [
        WorkItem("ingest", {"source": source, "index": i}, episode_id(source, i))
        for i in dict.fromkeys(indices)
    ]
