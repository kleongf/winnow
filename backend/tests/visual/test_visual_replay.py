"""The seeded placement question under the replay transport, scored from the answers e2e replays
(written by `tests.record_visual`), with the real `meta/` code underneath."""

from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from tests.helpers import ask_visual, reference_label, wait_for_job
from tests.record_meta import RECORDINGS
from tests.record_visual import VISUAL_ANSWERS
from winnow.app import create_app
from winnow.core.settings import Settings
from winnow.meta.models import MetaContent
from winnow.meta.replay import ReplayTransport
from winnow.meta.transport import Reply


@dataclass
class CountingReplay:
    replay: ReplayTransport
    responses: int = 0

    async def upload(self, path: Path) -> str:
        return await self.replay.upload(path)

    async def count_tokens(self, model: str, content: MetaContent) -> int:
        return await self.replay.count_tokens(model, content)

    async def respond(self, model: str, content: MetaContent, options: dict[str, object]) -> Reply:
        self.responses += 1
        return await self.replay.respond(model, content, options)


@pytest.fixture
def replay(tmp_path: Path) -> CountingReplay:
    replies = tmp_path / "replies.jsonl"
    replies.write_text(RECORDINGS.read_text() + VISUAL_ANSWERS.read_text())
    return CountingReplay(ReplayTransport(replies))


@pytest.fixture
def replay_api(settings: Settings, replay: CountingReplay) -> Iterator[TestClient]:
    with TestClient(create_app(settings, transport=replay)) as client:
        job = client.post("/api/episodes/ingest", json={"source": "droid_100", "indices": [0, 1]})
        wait_for_job(client, job.json()["job_id"])
        yield client


def placement(api: TestClient, episode_id: str) -> dict[str, object]:
    reference_label(api, episode_id)
    triage = api.get(f"/api/episodes/{episode_id}/triage").json()
    return next(c for c in triage["criteria"] if c["kind"] == "visual")


def test_a_visual_criterion_scores_fixture_episodes_from_recorded_answers(
    replay_api: TestClient,
):
    job = ask_visual(replay_api)

    assert job["failed"] == 0
    kept = placement(replay_api, "droid_100:0")
    assert (kept["status"], kept["measurement"]) == ("pass", "3 pass")
    split = placement(replay_api, "droid_100:1")
    assert (split["status"], split["uncertainty"]) == ("unsure", "samples split")


def test_asking_again_is_all_cache_hits(replay_api: TestClient, replay: CountingReplay):
    ask_visual(replay_api)
    before = replay.responses

    again = ask_visual(replay_api)

    assert again["failed"] == 0
    assert replay.responses == before
