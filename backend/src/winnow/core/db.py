"""The app's one SQLite file (WAL, stdlib sqlite3, no ORM). Each feature creates its own tables."""

import sqlite3
from pathlib import Path


def open_db(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, isolation_level=None)  # autocommit; wrap multi-row writes yourself
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA busy_timeout=5000")  # the CLI and the app may write at once
    db.execute("PRAGMA foreign_keys=ON")
    return db
