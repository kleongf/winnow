"""Re-record the Meta responses that tests and e2e replay: `uv run python -m tests.record_meta`.

Runs the real ingest pipeline (Spark-alone baseline and wrist track) against the Meta API on the
e2e fixture Episodes, writing every reply to RECORDINGS. Costs about $0.10, which is added to the
main cost log. Re-record after changing a prompt, a schema or the fixture Episodes.
"""

import asyncio
import shutil
import sys
import tempfile
from pathlib import Path

from winnow.core.context import build_context
from winnow.core.settings import Settings, get_settings
from winnow.episodes.fixtures import write_fixture_source
from winnow.episodes.service import ingest_items
from winnow.meta.openai_transport import OpenAITransport
from winnow.meta.replay import RecordingTransport

RECORDINGS = Path(__file__).parent / "recordings" / "fixture_episodes.jsonl"
E2E_EPISODES = 5  # what scripts/e2e-server.ts writes


async def _record(settings: Settings) -> int:
    key = settings.model_api_key
    if key is None:
        raise SystemExit("Set MODEL_API_KEY in .env to record")
    inner = OpenAITransport(settings.meta_base_url, key.get_secret_value())
    RECORDINGS.unlink(missing_ok=True)
    ctx = build_context(settings, RecordingTransport(inner, RECORDINGS))
    try:
        items = ingest_items("droid_100", list(range(E2E_EPISODES)), with_meta=True)
        job_id = ctx.jobs.create("ingest", items)
        await ctx.runner.run(job_id)
        job = ctx.jobs.get(job_id)
        assert job is not None
        for item in job.items:
            sys.stdout.write(f"{item.label} {item.step}: {item.status} {item.detail or ''}\n")
        return job.failed
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
