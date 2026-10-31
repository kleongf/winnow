"""The interview's API fixtures: the app with fixture Episodes 0-2 as the labelled Dev set, and
the draft compiled from `client.DESCRIPTION`."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from tests.helpers import reference_label, wait_for_job
from tests.interview.client import DESCRIPTION, DEV, compile_answer
from tests.rubric.scripted import ScriptedCompile
from winnow.app import create_app
from winnow.core.settings import Settings


@pytest.fixture
def spark() -> ScriptedCompile:
    return ScriptedCompile(answers=[])


@pytest.fixture
def api(settings: Settings, spark: ScriptedCompile) -> Iterator[TestClient]:
    with TestClient(create_app(settings, transport=spark)) as client:
        job = client.post(
            "/api/episodes/ingest", json={"source": "droid_100", "indices": [0, 1, 2]}
        )
        wait_for_job(client, job.json()["job_id"])
        client.post("/api/sets/dev/episodes", json={"episode_ids": DEV})
        for episode_id in DEV:
            reference_label(client, episode_id)
        yield client


@pytest.fixture
def drafted(api: TestClient, spark: ScriptedCompile) -> TestClient:
    spark.answers.append(compile_answer())
    response = api.post("/api/rubric/draft/compile", json={"description": DESCRIPTION})
    assert response.status_code == 200, response.text
    return api
