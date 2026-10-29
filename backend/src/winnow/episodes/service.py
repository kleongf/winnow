"""The `ingest` step: one Episode from its source into the Dataset."""

import asyncio
from collections import defaultdict
from collections.abc import Mapping
from pathlib import Path

import numpy as np

from winnow.episodes.clips import first_frame, to_h264, to_sam_fps
from winnow.episodes.models import Episode, EpisodeSignals, Signals, SourceEpisode
from winnow.episodes.sources import Source
from winnow.episodes.store import (
    EpisodeStore,
    clip_path,
    episode_id,
    frame0_path,
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
    # Two jobs may ask for the same Episode at once: the second waits, then finds it ingested.
    locks: defaultdict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    async def step(args: Mapping[str, object]) -> str | None:
        source = sources[str(args["source"])]
        index = int(str(args["index"]))
        async with locks[episode_id(source.name, index)]:
            return await ingest(store, source, index)

    return step


def ingest_items(source: str, indices: list[int], with_baseline: bool) -> list[WorkItem]:
    """Per Episode (each once, in the order given): ingest it, then, once that has succeeded,
    run the Spark-alone baseline on it if Meta is configured."""
    items: list[WorkItem] = []
    for i in dict.fromkeys(indices):
        label = episode_id(source, i)
        items.append(WorkItem("ingest", {"source": source, "index": i}, label))
        if with_baseline:
            items.append(WorkItem("baseline", {"episode_id": label}, label, after=len(items) - 1))
    return items


SPEED_SMOOTHING_FRAMES = 5  # a third of a second at 15 Hz


def workstation_signals(signals: EpisodeSignals) -> Signals:
    t = signals.timestamps - signals.timestamps[0]
    step = np.linalg.norm(np.diff(signals.position, axis=0), axis=1) * signals.fps
    speed = np.concatenate([step[:1], step]) if len(step) else np.zeros(len(t))
    kernel = np.ones(SPEED_SMOOTHING_FRAMES) / SPEED_SMOOTHING_FRAMES
    padded = np.pad(speed, SPEED_SMOOTHING_FRAMES // 2, mode="edge")
    smoothed = np.convolve(padded, kernel, mode="valid")
    return Signals(
        t=_rounded(t),
        gripper=_rounded(signals.gripper),
        z=_rounded(signals.position[:, 2]),
        speed=_rounded(smoothed),
    )


def _rounded(values: np.ndarray) -> list[float]:
    return [round(float(v), 4) for v in values]


async def frame_zero(store: EpisodeStore, episode: Episode, camera: str) -> Path:
    """Frame 0 of a camera's clip as a JPEG, extracted on first request and kept."""
    folder = store.episode_folder(episode)
    still = frame0_path(folder, camera)
    if not still.exists():
        await asyncio.to_thread(first_frame, clip_path(folder, camera), still)
    return still
