"""Ingested Episodes: a row each in SQLite, and their robot data and clips under the data dir."""

import sqlite3
from datetime import UTC, datetime
from pathlib import Path

import numpy as np

from winnow.episodes.models import Episode, EpisodeSignals, SourceEpisode

SCHEMA = """
CREATE TABLE IF NOT EXISTS episodes (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    source_index INTEGER NOT NULL,
    instruction TEXT,
    dataset_outcome INTEGER,
    frames INTEGER NOT NULL,
    fps REAL NOT NULL,
    duration_s REAL NOT NULL,
    ingested_at TEXT NOT NULL
);
"""


def episode_id(source: str, index: int) -> str:
    return f"{source}:{index}"


def clip_path(folder: Path, camera: str) -> Path:
    return folder / f"{camera}.mp4"


def sam_clip_path(folder: Path, camera: str) -> Path:
    return folder / f"{camera}.5fps.mp4"


def save_signals(folder: Path, signals: EpisodeSignals) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    np.savez(
        folder / "signals.npz",
        timestamps=signals.timestamps,
        position=signals.position,
        gripper=signals.gripper,
    )


class EpisodeStore:
    def __init__(self, db: sqlite3.Connection, data_dir: Path) -> None:
        self._db = db
        self._root = data_dir / "episodes"
        db.executescript(SCHEMA)

    def folder(self, source: str, index: int) -> Path:
        return self._root / source / f"{index:06d}"

    def is_ingested(self, source: str, index: int, cameras: tuple[str, ...]) -> bool:
        row = self._db.execute(
            "SELECT 1 FROM episodes WHERE id = ?", (episode_id(source, index),)
        ).fetchone()
        folder = self.folder(source, index)
        files = [folder / "signals.npz"]
        files += [clip_path(folder, c) for c in cameras] + [
            sam_clip_path(folder, c) for c in cameras
        ]
        return row is not None and all(f.exists() for f in files)

    def save(self, source: str, index: int, episode: SourceEpisode) -> None:
        s = episode.signals
        duration = float(s.timestamps[-1] - s.timestamps[0]) + 1 / s.fps if len(s.timestamps) else 0
        self._db.execute(
            "INSERT OR REPLACE INTO episodes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                episode_id(source, index),
                source,
                index,
                episode.instruction,
                s.dataset_outcome,
                len(s.timestamps),
                s.fps,
                round(duration, 3),
                datetime.now(UTC).isoformat(),
            ),
        )

    def list(self) -> list[Episode]:
        rows = self._db.execute("SELECT * FROM episodes ORDER BY source, source_index")
        return [_episode(row) for row in rows]

    def count_by_source(self) -> dict[str, int]:
        rows = self._db.execute("SELECT source, COUNT(*) AS n FROM episodes GROUP BY source")
        return {str(r["source"]): int(r["n"]) for r in rows}


def _episode(row: sqlite3.Row) -> Episode:
    outcome = row["dataset_outcome"]
    return Episode(
        id=row["id"],
        source=row["source"],
        index=row["source_index"],
        instruction=row["instruction"],
        dataset_outcome=None if outcome is None else bool(outcome),
        frames=row["frames"],
        fps=row["fps"],
        duration_s=row["duration_s"],
    )
