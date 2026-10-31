"""Write the scripted Meta replies for e2e's interview specs:
`uv run python -m tests.record_interview`. Free: no call reaches the Meta API.

The recorded compile of the frozen Description gives each Phrase one Criterion, so its Criteria
never disagree. e2e's disagree spec compiles DISAGREE instead, whose compile is scripted here
(disagree_compile): a Phrase whose two Criteria disagree on e2e's Dev set Episode, which grasps
once but keeps the arm moving well over a second. This replays RECORDINGS to ingest that Episode
into e2e's Dev set, then runs the real compile once, keeping the replies RECORDINGS doesn't have.
Rerun after changing the compile prompt or schema, or the anchor pool's capabilities manifest;
e2e then fails with UnrecordedCallError until you do.
"""

import asyncio
import json
import sys
import tempfile
from pathlib import Path

from tests.meta.fakes import NoTranscribe
from tests.record_meta import E2E_DEV_SET, E2E_EPISODES, RECORDINGS
from tests.rubric.scripted import criterion, phrase
from winnow.core.context import AppContext, build_context
from winnow.core.settings import get_settings
from winnow.episodes.fixtures import write_fixture_source
from winnow.episodes.service import ingest_items
from winnow.episodes.store import episode_id
from winnow.meta.models import MetaContent
from winnow.meta.replay import RecordingTransport, ReplayTransport
from winnow.meta.transport import Reply
from winnow.rubric.service import compile_draft

INTERVIEW_ANSWERS = Path(__file__).parent / "recordings" / "interview_answers.jsonl"
CAREFUL = "grasps it once and quickly"
DISAGREE = f"Careful pick: {CAREFUL}."  # e2e/describe-interview-disagree.spec.ts compiles it
USAGE = {"input_tokens": 6000, "output_tokens": 400}


def disagree_compile() -> dict[str, object]:
    """One grasp attempt passes; the arm moving under a second fails."""
    once = criterion("grasp_attempts", "<=", 1)
    quickly = criterion("active_duration_s", "<", 1)
    return {
        "phrases": [
            phrase("Careful pick", "context", reason="Names the task."),
            phrase(CAREFUL, criteria=[once, quickly]),
        ]
    }


class ScriptedInterview(NoTranscribe):
    """Replays RECORDINGS; compiles DISAGREE as `disagree_compile`."""

    def __init__(self, replay: ReplayTransport) -> None:
        self._replay = replay

    async def upload(self, path: Path) -> str:
        return await self._replay.upload(path)

    async def count_tokens(self, model: str, content: MetaContent) -> int:
        return await self._replay.count_tokens(model, content)

    async def respond(self, model: str, content: MetaContent, options: dict[str, object]) -> Reply:
        text_format = options.get("text")
        if not isinstance(text_format, dict) or text_format["format"]["name"] != "rubric":
            return await self._replay.respond(model, content, options)
        if not any(DISAGREE in str(part.get("text")) for part in content):
            return await self._replay.respond(model, content, options)
        return Reply(json.dumps(disagree_compile()), USAGE)


async def _record(ctx: AppContext) -> None:
    job_id = ctx.jobs.create("ingest", ingest_items("droid_100", list(E2E_DEV_SET), with_meta=True))
    await ctx.runner.run(job_id)
    ctx.sets.add("dev", [episode_id("droid_100", i) for i in E2E_DEV_SET])
    draft = await compile_draft(ctx, DISAGREE, fresh=True)
    sys.stdout.write(f"compile: {[(c.phrase, c.id) for c in draft.criteria]}\n")


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        root = write_fixture_source(Path(tmp) / "droid_100", episodes=E2E_EPISODES)
        settings = get_settings().model_copy(
            update={
                "data_dir": Path(tmp) / "data",
                "droid100_root": root,
                "meta_replay": None,
                "model_api_key": None,
            }
        )
        everything = Path(tmp) / "replies.jsonl"
        transport = RecordingTransport(ScriptedInterview(ReplayTransport(RECORDINGS)), everything)
        ctx = build_context(settings, transport)
        try:
            asyncio.run(_record(ctx))
        finally:
            ctx.db.close()
        recorded = {json.loads(line)["key"] for line in RECORDINGS.read_text().splitlines()}
        lines = [
            line
            for line in everything.read_text().splitlines()
            if json.loads(line)["key"] not in recorded
        ]
    INTERVIEW_ANSWERS.write_text("".join(line + "\n" for line in lines))
    sys.stdout.write(f"wrote {len(lines)} scripted interview replies to {INTERVIEW_ANSWERS.name}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
