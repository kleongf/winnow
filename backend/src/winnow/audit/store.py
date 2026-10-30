import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime

from winnow.audit.models import AuditKind

# One row per sampled Episode. A Rubric version's sample is written once, whole, and then only
# read: drawing again returns it.
SCHEMA = """
CREATE TABLE IF NOT EXISTS audit_samples (
    rubric_version INTEGER NOT NULL,
    seed INTEGER NOT NULL,
    episode_id TEXT NOT NULL REFERENCES episodes(id),
    kind TEXT NOT NULL,  -- 'keep' or 'reject': its Triage decision when drawn
    created_at TEXT NOT NULL,
    PRIMARY KEY (rubric_version, episode_id)
);
"""


@dataclass(frozen=True)
class Pick:
    episode_id: str
    kind: AuditKind


@dataclass(frozen=True)
class StoredSample:
    rubric_version: int
    seed: int
    created_at: str
    picks: list[Pick]  # in the order drawn


class AuditStore:
    def __init__(self, db: sqlite3.Connection) -> None:
        self._db = db
        db.executescript(SCHEMA)

    def get(self, rubric_version: int) -> StoredSample | None:
        rows = self._db.execute(
            "SELECT * FROM audit_samples WHERE rubric_version = ? ORDER BY rowid",
            (rubric_version,),
        ).fetchall()
        if not rows:
            return None
        return StoredSample(
            rubric_version=rubric_version,
            seed=rows[0]["seed"],
            created_at=rows[0]["created_at"],
            picks=[Pick(row["episode_id"], row["kind"]) for row in rows],
        )

    def save(self, rubric_version: int, seed: int, picks: list[Pick]) -> StoredSample:
        """Writes the sample unless the version has one; returns whichever is stored."""
        with self._db:
            self._db.execute("BEGIN IMMEDIATE")
            if self.get(rubric_version) is None:
                at = datetime.now(UTC).isoformat()
                self._db.executemany(
                    "INSERT INTO audit_samples (rubric_version, seed, episode_id, kind, "
                    "created_at) VALUES (?, ?, ?, ?, ?)",
                    [(rubric_version, seed, p.episode_id, p.kind, at) for p in picks],
                )
        stored = self.get(rubric_version)
        assert stored is not None, "an empty sample isn't stored"
        return stored
