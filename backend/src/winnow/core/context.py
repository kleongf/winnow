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
from winnow.episodes.droid101 import Droid101
from winnow.episodes.service import ingest_step
from winnow.episodes.sources import Source, sources_from
from winnow.episodes.store import EpisodeStore
from winnow.jobs.models import Step
from winnow.jobs.runner import JobRunner
from winnow.jobs.store import JobStore
from winnow.meta.client import MetaClient
from winnow.meta.costs import CostLog
from winnow.meta.replay import ReplayTransport
from winnow.meta.transport import Transport
from winnow.reference_labels.store import ReferenceLabelStore
from winnow.rubric.seed import SEEDED
from winnow.rubric.store import RubricStore
from winnow.selection.service import select_step
from winnow.selection.store import SelectionStore
from winnow.sets.store import SetStore
from winnow.tracking.store import TrackStore
from winnow.tracking.wrist import track_wrist_step


@dataclass(frozen=True)
class AppContext:
    settings: Settings
    db: sqlite3.Connection
    sources: dict[str, Source]
    episodes: EpisodeStore
    boxes: BoxStore
    baseline: BaselineStore
    selection: SelectionStore
    sets: SetStore
    tracks: TrackStore
    rubrics: RubricStore
    reference_labels: ReferenceLabelStore  # never read by scoring
    jobs: JobStore
    runner: JobRunner
    meta: MetaClient | None  # None without a Meta API key: no step that calls Meta runs


def _meta(
    settings: Settings, db: sqlite3.Connection, transport: Transport | None
) -> MetaClient | None:
    if transport is None and settings.meta_replay is not None:
        transport = ReplayTransport(settings.meta_replay)
    if transport is not None:  # tests script or replay the Meta API here
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
    selection = SelectionStore(db)
    sets = SetStore(db)
    tracks = TrackStore(db)
    rubrics = RubricStore(db, SEEDED)
    reference_labels = ReferenceLabelStore(db)
    jobs = JobStore(db)
    meta = _meta(settings, db, transport)
    steps: dict[str, Step] = {"ingest": ingest_step(episodes, sources)}
    droid101 = sources.get("droid_1.0.1")
    if meta is not None:
        steps["baseline"] = baseline_step(meta, baseline, episodes)
        steps["track_wrist"] = track_wrist_step(meta, tracks, episodes)
        if isinstance(droid101, Droid101):
            steps["select"] = select_step(meta, selection, droid101, settings.data_dir)
    runner = JobRunner(jobs, steps, concurrency=settings.ingest_concurrency)
    return AppContext(
        settings,
        db,
        sources,
        episodes,
        boxes,
        baseline,
        selection,
        sets,
        tracks,
        rubrics,
        reference_labels,
        jobs,
        runner,
        meta,
    )


def get_context(request: Request) -> AppContext:
    """FastAPI dependency: the context `create_app`'s lifespan built."""
    return cast(AppContext, request.app.state.context)
