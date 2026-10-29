"""App-level wiring shared by the API and the CLI: one database, the stores, the job runner."""

import sqlite3
from dataclasses import dataclass
from typing import cast

from fastapi import Request

from winnow.baseline.service import baseline_step
from winnow.baseline.store import BaselineStore
from winnow.boxes.store import BoxStore
from winnow.core.db import open_db
from winnow.core.settings import Settings
from winnow.episodes.service import ingest_step
from winnow.episodes.sources import Source, sources_from
from winnow.episodes.store import EpisodeStore
from winnow.jobs.models import Step
from winnow.jobs.runner import JobRunner
from winnow.jobs.store import JobStore
from winnow.meta.client import MetaClient
from winnow.meta.costs import CostLog
from winnow.meta.transport import Transport


@dataclass(frozen=True)
class AppContext:
    settings: Settings
    db: sqlite3.Connection
    sources: dict[str, Source]
    episodes: EpisodeStore
    boxes: BoxStore
    baseline: BaselineStore
    jobs: JobStore
    runner: JobRunner
    meta: MetaClient | None  # None without a Meta API key: no step that calls Meta runs


def _meta(
    settings: Settings, db: sqlite3.Connection, transport: Transport | None
) -> MetaClient | None:
    if transport is not None:  # tests script the Meta API here
        return MetaClient(transport, db, CostLog(settings.cost_log_path, settings.meta_budget_usd))
    if settings.model_api_key is None:
        return None
    return MetaClient.from_settings(settings, db)


def build_context(settings: Settings, transport: Transport | None = None) -> AppContext:
    db = open_db(settings.db_path)
    sources = sources_from(settings)
    episodes = EpisodeStore(db, settings.data_dir)
    boxes = BoxStore(db)
    baseline = BaselineStore(db)
    jobs = JobStore(db)
    meta = _meta(settings, db, transport)
    steps: dict[str, Step] = {"ingest": ingest_step(episodes, sources)}
    if meta is not None:
        steps["baseline"] = baseline_step(meta, baseline, episodes)
    runner = JobRunner(jobs, steps, concurrency=settings.ingest_concurrency)
    return AppContext(settings, db, sources, episodes, boxes, baseline, jobs, runner, meta)


def get_context(request: Request) -> AppContext:
    """FastAPI dependency: the context `create_app`'s lifespan built."""
    return cast(AppContext, request.app.state.context)
