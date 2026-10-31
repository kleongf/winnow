"""e2e's disagree spec under the replay transport: the compile `tests.record_interview` scripted
replays, and its Phrase's Criteria disagree on e2e's Dev set Episode."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from tests.helpers import reference_label, wait_for_job
from tests.interview.client import skip_to
from tests.record_interview import CAREFUL, DISAGREE, INTERVIEW_ANSWERS
from tests.record_meta import E2E_DEV_SET, RECORDINGS
from winnow.app import create_app
from winnow.core.settings import Settings
from winnow.meta.replay import ReplayTransport

DEV = [f"droid_100:{i}" for i in E2E_DEV_SET]


@pytest.fixture(scope="module")
def droid100_root(e2e_droid100_root: Path) -> Path:
    """e2e's fixture source, which the compile was recorded against."""
    return e2e_droid100_root


@pytest.fixture
def replay_api(settings: Settings, tmp_path: Path) -> Iterator[TestClient]:
    replies = tmp_path / "replies.jsonl"
    replies.write_text(RECORDINGS.read_text() + INTERVIEW_ANSWERS.read_text())
    with TestClient(create_app(settings, transport=ReplayTransport(replies))) as client:
        body = {"source": "droid_100", "indices": list(E2E_DEV_SET)}
        wait_for_job(client, client.post("/api/episodes/ingest", json=body).json()["job_id"])
        client.post("/api/sets/dev/episodes", json={"episode_ids": DEV})
        for episode in DEV:
            reference_label(client, episode)
        yield client


def test_the_scripted_compile_replays_and_its_criteria_disagree_on_the_dev_set(
    replay_api: TestClient,
):
    compiled = replay_api.post("/api/rubric/draft/compile", json={"description": DISAGREE})
    assert compiled.status_code == 200, compiled.text

    question = skip_to(replay_api, "disagree")

    assert (question["phrase"], question["episode_id"]) == (CAREFUL, DEV[0])
    assert [r["status"] for r in question["results"]] == ["pass", "fail"]
    assert question["measurement"] == "1 fails, 1 passes"
