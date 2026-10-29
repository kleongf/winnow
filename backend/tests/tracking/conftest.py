"""The app with a scripted SAM and fixture Episodes 0-2 ingested."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from tests.helpers import wait_for_job
from tests.tracking.scripted_sam import ScriptedSam
from winnow.app import create_app
from winnow.core.settings import Settings


@pytest.fixture
def sam() -> ScriptedSam:
    return ScriptedSam()


@pytest.fixture
def scripted_api(settings: Settings, sam: ScriptedSam) -> Iterator[TestClient]:
    with TestClient(create_app(settings, transport=sam)) as client:
        job = client.post(
            "/api/episodes/ingest", json={"source": "droid_100", "indices": [0, 1, 2]}
        )
        wait_for_job(client, job.json()["job_id"])
        yield client
