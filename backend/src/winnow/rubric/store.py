"""Rubric versions: numbered, append-only and immutable once written."""

import sqlite3
from datetime import UTC, datetime

from winnow.rubric.models import Rubric, RubricVersion

# The triggers keep a written version unchangeable even for a writer that skips this store.
SCHEMA = """
CREATE TABLE IF NOT EXISTS rubric_versions (
    version INTEGER PRIMARY KEY,
    rubric TEXT NOT NULL,  -- JSON Rubric
    created_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS rubric_versions_no_update BEFORE UPDATE ON rubric_versions
BEGIN SELECT RAISE(ABORT, 'Rubric versions are immutable'); END;
CREATE TRIGGER IF NOT EXISTS rubric_versions_no_delete BEFORE DELETE ON rubric_versions
BEGIN SELECT RAISE(ABORT, 'Rubric versions are immutable'); END;
"""


class RubricStore:
    def __init__(self, db: sqlite3.Connection, seed: Rubric) -> None:
        """Writes `seed` as version 1 when there is no version yet."""
        self._db = db
        db.executescript(SCHEMA)
        if db.execute("SELECT 1 FROM rubric_versions").fetchone() is None:
            self.add(seed)

    def add(self, rubric: Rubric) -> RubricVersion:
        """Freezes `rubric` as the next version."""
        cursor = self._db.execute(
            "INSERT INTO rubric_versions (version, rubric, created_at) "
            "SELECT COALESCE(MAX(version), 0) + 1, ?, ? FROM rubric_versions",
            (rubric.model_dump_json(), datetime.now(UTC).isoformat()),
        )
        version = self.get(int(cursor.lastrowid or 0))
        assert version is not None
        return version

    def get(self, version: int) -> RubricVersion | None:
        row = self._db.execute(
            "SELECT * FROM rubric_versions WHERE version = ?", (version,)
        ).fetchone()
        return None if row is None else self._version(row)

    def latest(self) -> RubricVersion:
        row = self._db.execute(
            "SELECT * FROM rubric_versions ORDER BY version DESC LIMIT 1"
        ).fetchone()
        return self._version(row)

    def _version(self, row: sqlite3.Row) -> RubricVersion:
        return RubricVersion(
            version=row["version"],
            created_at=row["created_at"],
            rubric=Rubric.model_validate_json(row["rubric"]),
        )
