"""lerobot/droid_100: robot data from the v3.0 parquet, per-Episode clips from the v2.0 branch."""

import subprocess
from collections.abc import Callable
from pathlib import Path
from typing import cast

import huggingface_hub
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
from numpy.typing import NDArray

from winnow.episodes.models import EpisodeSignals

REPO_ID = "lerobot/droid_100"
FPS = 15.0
CAMERAS = ("exterior_image_1_left", "exterior_image_2_left", "wrist_image_left")


# huggingface_hub's overloads are partially untyped; pin the one signature we use.
_hf_download = cast(Callable[..., str], huggingface_hub.hf_hub_download)  # pyright: ignore[reportUnknownMemberType]


def _download(path: str, revision: str, local_dir: Path) -> Path:
    return Path(
        _hf_download(
            REPO_ID, path, repo_type="dataset", revision=revision, local_dir=local_dir / revision
        )
    )


def _column(table: pa.Table, name: str, rows: NDArray[np.bool_]) -> NDArray[np.float64]:
    values = np.asarray(table.column(name).to_pylist(), dtype=np.float64)
    return values[rows]


def load_signals(episode_index: int, data_dir: Path) -> EpisodeSignals:
    path = _download("data/chunk-000/file-000.parquet", "main", data_dir)
    table = pq.read_table(path)  # pyright: ignore[reportUnknownMemberType]
    rows = np.asarray(table.column("episode_index").to_pylist()) == episode_index
    if not rows.any():
        raise ValueError(f"droid_100 has no Episode {episode_index}")
    state = _column(table, "observation.state", rows)
    return EpisodeSignals(
        episode_index=episode_index,
        fps=FPS,
        timestamps=_column(table, "timestamp", rows),
        position=state[:, 0:3],
        gripper=state[:, 6],
        success_label=bool(_column(table, "next.reward", rows).sum() > 0),
    )


def h264_clip(episode_index: int, camera: str, data_dir: Path) -> Path:
    """Download one Episode's clip for one camera and transcode AV1 -> H.264 (cached)."""
    out = data_dir / "h264" / camera / f"episode_{episode_index:06d}.mp4"
    if out.exists():
        return out
    source = _download(
        f"videos/chunk-000/observation.images.{camera}/episode_{episode_index:06d}.mp4",
        "v2.0",
        data_dir,
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(source),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(out),
        ],
        check=True,
    )
    return out


def av1_clip(episode_index: int, camera: str, data_dir: Path) -> Path:
    return _download(
        f"videos/chunk-000/observation.images.{camera}/episode_{episode_index:06d}.mp4",
        "v2.0",
        data_dir,
    )
