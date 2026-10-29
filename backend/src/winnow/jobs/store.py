import json
import sqlite3
from collections import Counter
from datetime import UTC, datetime

from winnow.core.db import ensure_column
from winnow.jobs.models import Job, JobItem, Status, WorkItem

SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS job_items (
    job_id INTEGER NOT NULL REFERENCES jobs(id),
    position INTEGER NOT NULL,
    step TEXT NOT NULL,
    args TEXT NOT NULL,
    label TEXT NOT NULL,
    status TEXT NOT NULL,
    detail TEXT,
    updated_at TEXT NOT NULL,
    after_position INTEGER,
    PRIMARY KEY (job_id, position)
);
"""


def _now() -> str:
    return datetime.now(UTC).isoformat()


class JobStore:
    def __init__(self, db: sqlite3.Connection) -> None:
        self._db = db
        db.executescript(SCHEMA)
        ensure_column(db, "job_items", "after_position", "INTEGER")

    def create(self, kind: str, items: list[WorkItem]) -> int:
        with self._db:
            self._db.execute("BEGIN")
            cursor = self._db.execute(
                "INSERT INTO jobs (kind, created_at) VALUES (?, ?)", (kind, _now())
            )
            job_id = int(cursor.lastrowid or 0)
            self._db.executemany(
                "INSERT INTO job_items (job_id, position, step, args, label, status, "
                "updated_at, after_position) VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)",
                [
                    (
                        job_id,
                        i,
                        item.step,
                        json.dumps(dict(item.args)),
                        item.label,
                        _now(),
                        item.after,
                    )
                    for i, item in enumerate(items)
                ],
            )
        return job_id

    def queued(self, job_id: int) -> list[tuple[int, WorkItem]]:
        rows = self._db.execute(
            "SELECT * FROM job_items WHERE job_id = ? AND status = 'queued' ORDER BY position",
            (job_id,),
        )
        return [
            (
                int(r["position"]),
                WorkItem(r["step"], json.loads(r["args"]), r["label"], r["after_position"]),
            )
            for r in rows
        ]

    def set_status(self, job_id: int, position: int, status: Status, detail: str | None) -> None:
        self._db.execute(
            "UPDATE job_items SET status = ?, detail = ?, updated_at = ? "
            "WHERE job_id = ? AND position = ?",
            (status, detail, _now(), job_id, position),
        )

    def fail_interrupted(self) -> None:
        """Items a previous process left queued or running will never finish: say so."""
        self._db.execute(
            "UPDATE job_items SET status = 'failed', detail = 'interrupted; run it again' "
            "WHERE status IN ('queued', 'running')"
        )

    def get(self, job_id: int) -> Job | None:
        row = self._db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        return None if row is None else self._job(row)

    def latest(self, kind: str) -> Job | None:
        row = self._db.execute(
            "SELECT * FROM jobs WHERE kind = ? ORDER BY id DESC LIMIT 1", (kind,)
        ).fetchone()
        return None if row is None else self._job(row)

    def _job(self, row: sqlite3.Row) -> Job:
        items = [
            JobItem(
                position=r["position"],
                step=r["step"],
                label=r["label"],
                status=r["status"],
                detail=r["detail"],
            )
            for r in self._db.execute(
                "SELECT * FROM job_items WHERE job_id = ? ORDER BY position", (row["id"],)
            )
        ]
        counts = Counter(item.status for item in items)
        return Job(
            id=row["id"],
            kind=row["kind"],
            created_at=row["created_at"],
            total=len(items),
            queued=counts["queued"],
            running=counts["running"],
            done=counts["done"],
            failed=counts["failed"],
            finished=counts["queued"] + counts["running"] == 0,
            items=items,
        )
