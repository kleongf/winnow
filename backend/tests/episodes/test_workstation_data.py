"""What the Workstation reads: an Episode's per-frame signals and its clips."""

import pytest
from fastapi.testclient import TestClient

from tests.helpers import wait_for_job

CAMERAS = ["exterior_image_1_left", "exterior_image_2_left", "wrist_image_left"]


@pytest.fixture
def ingested(api: TestClient) -> TestClient:
    job = api.post("/api/episodes/ingest", json={"source": "droid_100", "indices": [0]})
    wait_for_job(api, job.json()["job_id"])
    return api


def test_an_episode_lists_the_cameras_it_has_clips_for(ingested: TestClient):
    [episode] = ingested.get("/api/episodes").json()

    assert episode["cameras"] == CAMERAS


def test_signals_give_one_value_per_frame_on_a_time_axis_from_zero(ingested: TestClient):
    signals = ingested.get("/api/episodes/droid_100:0/signals").json()

    assert len(signals["t"]) == 45
    assert signals["t"][0] == 0.0 and signals["t"][1] == pytest.approx(1 / 15, abs=1e-4)
    for name in ("gripper", "z", "speed"):
        assert len(signals[name]) == 45
    assert signals["gripper"][0] == 0.0 and max(signals["gripper"]) == 1.0  # the fixture closes
    assert min(signals["speed"]) >= 0.0
    assert max(signals["speed"]) < 1.0  # m/s: the fixture arm moves ~0.2 m in 3 s


def test_a_clip_is_served_as_mp4_and_can_be_seeked(ingested: TestClient):
    whole = ingested.get("/api/episodes/droid_100:0/clips/wrist_image_left")
    part = ingested.get(
        "/api/episodes/droid_100:0/clips/wrist_image_left", headers={"Range": "bytes=0-99"}
    )

    assert whole.status_code == 200
    assert whole.headers["content-type"] == "video/mp4"
    assert part.status_code == 206 and len(part.content) == 100


def test_unknown_episodes_and_cameras_are_not_found(ingested: TestClient):
    assert ingested.get("/api/episodes/droid_100:9/signals").status_code == 404
    assert ingested.get("/api/episodes/droid_100:0/clips/top_view").status_code == 404
