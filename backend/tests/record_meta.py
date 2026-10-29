"""Re-record the Meta responses that tests and e2e replay: `uv run python -m tests.record_meta`.

Runs the real ingest pipeline (Spark-alone baseline and wrist track) against the Meta API on the
e2e fixture Episodes, then boxes each one with E2E_BOX in each exterior view in turn and runs what
a saved box queues (exterior track and target box), writing every reply to RECORDINGS. Costs
about $0.25, which is added to the main cost log. Re-record after changing a prompt, a schema or
the fixture Episodes.
"""

import asyncio
import shutil
import sys
import tempfile
from pathlib import Path
from typing import get_args

from winnow.boxes.models import BoxDraw, ExteriorCamera
from winnow.core.context import AppContext, build_context
from winnow.core.settings import Settings, get_settings
from winnow.episodes.fixtures import write_fixture_source
from winnow.episodes.service import ingest_items
from winnow.episodes.store import episode_id
from winnow.jobs.models import WorkItem
from winnow.meta.openai_transport import OpenAITransport
from winnow.meta.replay import RecordingTransport
from winnow.tracking.exterior import box_items

RECORDINGS = Path(__file__).parent / "recordings" / "fixture_episodes.jsonl"
E2E_EPISODES = 5  # what scripts/e2e-server.ts writes
# The box e2e draws (a drag from 40% to 60% of each side of the 320x180 frame) and puts.
E2E_BOX = {"x1": 128, "y1": 72, "x2": 192, "y2": 108}


async def _run(ctx: AppContext, kind: str, items: list[WorkItem]) -> int:
    job_id = ctx.jobs.create(kind, items)
    await ctx.runner.run(job_id)
    job = ctx.jobs.get(job_id)
    assert job is not None
    for item in job.items:
        sys.stdout.write(f"{item.label} {item.step}: {item.status} {item.detail or ''}\n")
    return job.failed


async def _record(settings: Settings) -> int:
    key = settings.model_api_key
    if key is None:
        raise SystemExit("Set MODEL_API_KEY in .env to record")
    inner = OpenAITransport(settings.meta_base_url, key.get_secret_value())
    RECORDINGS.unlink(missing_ok=True)
    ctx = build_context(settings, RecordingTransport(inner, RECORDINGS))
    try:
        indices = list(range(E2E_EPISODES))
        failed = await _run(ctx, "ingest", ingest_items("droid_100", indices, with_meta=True))
        for camera in get_args(ExteriorCamera):
            ids = [episode_id("droid_100", i) for i in indices]
            for boxed in ids:
                ctx.boxes.save(boxed, BoxDraw(camera=camera, **E2E_BOX), (320, 180))
            failed += await _run(ctx, "box", [item for e in ids for item in box_items(e)])
        return failed
    finally:
        ctx.db.close()


def main() -> int:
    main_settings = get_settings()
    with tempfile.TemporaryDirectory() as tmp:
        root = write_fixture_source(Path(tmp) / "droid_100", episodes=E2E_EPISODES)
        settings = main_settings.model_copy(
            update={"data_dir": Path(tmp) / "data", "droid100_root": root, "meta_replay": None}
        )
        failed = asyncio.run(_record(settings))
        spent = settings.cost_log_path.read_text() if settings.cost_log_path.exists() else ""
        with main_settings.cost_log_path.open("a") as log:
            log.write(spent)
        shutil.rmtree(Path(tmp) / "data", ignore_errors=True)
    sys.stdout.write(f"recorded {len(RECORDINGS.read_text().splitlines())} replies\n")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
