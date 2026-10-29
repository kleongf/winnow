"""App-level wiring shared by the API and the CLI: one database, the stores, the job runner."""

import sqlite3
from dataclasses import dataclass
from typing import cast

from fastapi import Request

from winnow.core.db import open_db
from winnow.core.settings import Settings
from winnow.episodes.service import ingest_step
from winnow.episodes.sources import Source, sources_from
from winnow.episodes.store import EpisodeStore
from winnow.jobs.runner import JobRunner
from winnow.jobs.store import JobStore


@dataclass(frozen=True)
class AppContext:
    settings: Settings
    db: sqlite3.Connection
    sources: dict[str, Source]
    episodes: EpisodeStore
    jobs: JobStore
    runner: JobRunner


def build_context(settings: Settings) -> AppContext:
    db = open_db(settings.db_path)
    sources = sources_from(settings)
    episodes = EpisodeStore(db, settings.data_dir)
    jobs = JobStore(db)
    steps = {"ingest": ingest_step(episodes, sources)}
    runner = JobRunner(jobs, steps, concurrency=settings.ingest_concurrency)
    return AppContext(settings, db, sources, episodes, jobs, runner)


def get_context(request: Request) -> AppContext:
    """FastAPI dependency: the context `create_app`'s lifespan built."""
    return cast(AppContext, request.app.state.context)
