"""A threshold drag re-sorts the anchor pool with zero Meta calls, against the replay transport
serving Spark's recorded compile of the frozen Description."""

from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from tests.helpers import reference_label, wait_for_job
from tests.record_meta import RECORDINGS
from winnow.app import create_app
from winnow.baseline.prompts import FROZEN
from winnow.core.settings import Settings
from winnow.meta.models import MetaContent
from winnow.meta.replay import ReplayTransport
from winnow.meta.transport import Reply

ANCHOR = "droid_100:0"  # the robot data of e2e's Dev set, which compile was recorded against


@dataclass
class CountingReplay:
    """The replay transport, counting every call that reaches it."""

    replay: ReplayTransport
    calls: int = 0

    async def upload(self, path: Path) -> str:
        self.calls += 1
        return await self.replay.upload(path)

    async def count_tokens(self, model: str, content: MetaContent) -> int:
        self.calls += 1
        return await self.replay.count_tokens(model, content)

    async def respond(self, model: str, content: MetaContent, options: dict[str, object]) -> Reply:
        self.calls += 1
        return await self.replay.respond(model, content, options)


@pytest.fixture
def transport() -> CountingReplay:
    return CountingReplay(ReplayTransport(RECORDINGS))


@pytest.fixture
def compiled(settings: Settings, transport: CountingReplay) -> Iterator[TestClient]:
    with TestClient(create_app(settings, transport=transport)) as client:
        job = client.post("/api/episodes/ingest", json={"source": "droid_100", "indices": [0]})
        wait_for_job(client, job.json()["job_id"])
        client.post("/api/sets/dev/episodes", json={"episode_ids": [ANCHOR]})
        reference_label(client, ANCHOR)
        response = client.post("/api/rubric/draft/compile", json={"description": FROZEN.text})
        assert response.status_code == 200, response.text
        yield client


def test_dragging_a_threshold_changes_the_counts_with_zero_meta_calls(
    compiled: TestClient, transport: CountingReplay, settings: Settings
):
    draft = compiled.get("/api/rubric/draft").json()
    pauses = next(c for c in draft["criteria"] if c["primitive"] == "longest_still_s")
    calls, costs = transport.calls, settings.cost_log_path.read_text()
    assert calls > 0  # ingest and compile went through it

    def pause_counts(threshold: float) -> tuple[int, int, int]:
        edit = {"criteria": {pauses["id"]: {"threshold": threshold}}}
        preview = compiled.post("/api/rubric/draft/preview", json=edit).json()
        found = next(c for c in preview["criteria"] if c["criterion_id"] == pauses["id"])
        return found["passing"], found["failing"], found["unsure"]

    # The anchor Episode's arm is never still, so a threshold dragged to 0 s makes it unsure.
    dragged = [pause_counts(t) for t in (5.0, 2.0, 1.0, 0.5, 0.0)]
    compiled.patch("/api/rubric/draft", json={"criteria": {pauses["id"]: {"threshold": 0.0}}})
    compiled.post("/api/rubric/draft/run")

    assert dragged[0] == (1, 0, 0)
    assert dragged[-1] == (0, 0, 1)  # near threshold
    assert (transport.calls, settings.cost_log_path.read_text()) == (calls, costs)
