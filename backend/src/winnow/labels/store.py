import sqlite3

from winnow.labels.models import StoredLabel

# Append-only: a new answer for a Phrase supersedes the last one but never erases it, so every
# label stays in history.
SCHEMA = """
CREATE TABLE IF NOT EXISTS labels (
    id INTEGER PRIMARY KEY,
    episode_id TEXT NOT NULL REFERENCES episodes(id),
    phrase TEXT NOT NULL,
    source TEXT NOT NULL,
    value TEXT NOT NULL,
    rubric_version INTEGER,
    labelled_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS labels_by_episode ON labels (episode_id, phrase);
CREATE TRIGGER IF NOT EXISTS labels_no_update BEFORE UPDATE ON labels
BEGIN SELECT RAISE(ABORT, 'Labels are kept as history'); END;
CREATE TRIGGER IF NOT EXISTS labels_no_delete BEFORE DELETE ON labels
BEGIN SELECT RAISE(ABORT, 'Labels are kept as history'); END;
"""


class LabelStore:
    def __init__(self, db: sqlite3.Connection) -> None:
        self._db = db
        db.executescript(SCHEMA)

    def add(self, label: StoredLabel) -> None:
        self._db.execute(
            "INSERT INTO labels (episode_id, phrase, source, value, rubric_version, labelled_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                label.episode_id,
                label.phrase,
                label.source,
                label.value,
                label.rubric_version,
                label.labelled_at,
            ),
        )

    def history(self, episode_id: str) -> list[StoredLabel]:
        """Every label the Episode was ever given, oldest first."""
        rows = self._db.execute(
            "SELECT * FROM labels WHERE episode_id = ? ORDER BY id", (episode_id,)
        )
        return [self._label(row) for row in rows]

    def in_force(self, episode_id: str) -> list[StoredLabel]:
        """The newest label for each Phrase, whatever its source: the ones scoring applies."""
        rows = self._db.execute(
            "SELECT * FROM labels WHERE id IN "
            "(SELECT MAX(id) FROM labels WHERE episode_id = ? GROUP BY phrase) ORDER BY id",
            (episode_id,),
        )
        return [self._label(row) for row in rows]

    def _label(self, row: sqlite3.Row) -> StoredLabel:
        return StoredLabel(
            episode_id=row["episode_id"],
            phrase=row["phrase"],
            source=row["source"],
            value=row["value"],
            rubric_version=row["rubric_version"],
            labelled_at=row["labelled_at"],
        )
