"""Synthetic droid_100-layout Episodes for tests and e2e, so neither depends on the Hub.

Writes the same files the droid_100 adapter reads (the v3.0 parquet and tasks on `main`, one mp4
per Episode per camera on `v2.0`), with a simple pick-and-place motion: reach, close, lift,
carry, release. Deterministic, so recorded Meta responses keyed by file content stay valid.
"""

import subprocess
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

from winnow.episodes.droid100 import CAMERAS, FPS

INSTRUCTIONS = ("Put the marker in the pot", "Move the black remote control to the left", "")


def _state(frames: int) -> np.ndarray:
    """End-effector xyz + roll/pitch/yaw + gripper per frame (droid_100's `observation.state`)."""
    t = np.linspace(0.0, 1.0, frames)
    x = 0.4 + 0.2 * t
    z = 0.25 - 0.15 * np.sin(np.pi * np.clip(t * 2, 0, 1))  # dip to the object, then lift
    z = np.where(t > 0.5, 0.10 + 0.10 * (t - 0.5), z)
    gripper = ((t > 0.3) & (t < 0.8)).astype(np.float64)  # closed while carrying
    state = np.zeros((frames, 7))
    state[:, 0], state[:, 1], state[:, 2], state[:, 6] = x, 0.0, z, gripper
    return state


def _write_parquet(root: Path, episodes: int, frames: int) -> None:
    states = [_state(frames) for _ in range(episodes)]
    rows = episodes * frames
    episode_index = np.repeat(np.arange(episodes), frames)
    frame_index = np.tile(np.arange(frames), episodes)
    reward = np.zeros(rows)
    reward[frames - 1 :: frames] = [1.0 if i % 3 != 2 else 0.0 for i in range(episodes)]
    table = pa.table(  # pyright: ignore[reportUnknownMemberType]
        {
            "observation.state": [list(map(float, r)) for s in states for r in s],
            "timestamp": (frame_index / FPS).astype(np.float32),
            "episode_index": episode_index,
            "frame_index": frame_index,
            "next.reward": reward.astype(np.float32),
            "task_index": np.array([i % len(INSTRUCTIONS) for i in episode_index]),
        }
    )
    data = root / "main" / "data" / "chunk-000"
    data.mkdir(parents=True, exist_ok=True)
    pq.write_table(table, data / "file-000.parquet")  # pyright: ignore[reportUnknownMemberType]
    tasks = pa.table(  # pyright: ignore[reportUnknownMemberType]
        {"task_index": list(range(len(INSTRUCTIONS))), "__index_level_0__": list(INSTRUCTIONS)}
    )
    meta = root / "main" / "meta"
    meta.mkdir(parents=True, exist_ok=True)
    pq.write_table(tasks, meta / "tasks.parquet")  # pyright: ignore[reportUnknownMemberType]


def _write_clip(path: Path, frames: int, pattern: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    source = f"{pattern}=size=320x180:rate={FPS:g}"
    subprocess.run(
        [
            *("ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", source),
            *("-frames:v", str(frames), "-c:v", "libx264", "-pix_fmt", "yuv420p"),
            *("-bitexact", "-map_metadata", "-1", str(path)),
        ],
        check=True,
    )


def clip_path(root: Path, index: int, camera: str) -> Path:
    name = f"episode_{index:06d}.mp4"
    return root / "v2.0" / "videos" / "chunk-000" / f"observation.images.{camera}" / name


def write_fixture_source(
    root: Path, episodes: int = 3, frames: int = 45, corrupt: tuple[int, ...] = ()
) -> Path:
    """Write synthetic Episodes under `root`; those in `corrupt` get unreadable video."""
    _write_parquet(root, episodes, frames)
    patterns = ("testsrc", "testsrc2", "smptebars")
    for index in range(episodes):
        for camera, pattern in zip(CAMERAS, patterns, strict=True):
            path = clip_path(root, index, camera)
            if index in corrupt:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(b"not a video")
            else:
                _write_clip(path, frames, pattern)
    return root
