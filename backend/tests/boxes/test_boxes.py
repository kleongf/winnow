import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from tests.helpers import wait_for_job

EXTERIOR_2 = "exterior_image_2_left"


@pytest.fixture
def ingested(api: TestClient) -> TestClient:
    job = api.post("/api/episodes/ingest", json={"source": "droid_100", "indices": [0, 1]})
    wait_for_job(api, job.json()["job_id"])
    return api


def draw(api: TestClient, episode_id: str, **box: object):
    body = {"camera": EXTERIOR_2, "x1": 100, "y1": 60, "x2": 140, "y2": 90} | box
    return api.put(f"/api/episodes/{episode_id}/box", json=body)


def test_a_saved_box_is_listed_with_its_view(ingested: TestClient):
    saved = draw(ingested, "droid_100:1")

    assert saved.status_code == 200
    [box] = ingested.get("/api/boxes").json()
    assert {k: box[k] for k in ("episode_id", "camera", "x1", "y1", "x2", "y2")} == {
        "episode_id": "droid_100:1",
        "camera": EXTERIOR_2,
        "x1": 100,
        "y1": 60,
        "x2": 140,
        "y2": 90,
    }
    assert (box["frame_width"], box["frame_height"]) == (320, 180)
    assert ingested.get("/api/dataset").json()["boxes"] == 1


def test_drawing_again_replaces_the_box(ingested: TestClient):
    draw(ingested, "droid_100:1")
    draw(ingested, "droid_100:1", camera="exterior_image_1_left", x1=10, x2=50)

    [box] = ingested.get("/api/boxes").json()
    assert (box["camera"], box["x1"], box["x2"]) == ("exterior_image_1_left", 10, 50)


@pytest.mark.parametrize(
    "bad",
    [
        {"camera": "wrist_image_left"},  # placement is judged from an exterior view
        {"x2": 330},  # off the 320-px-wide frame
        {"x1": 120, "x2": 121},  # too small to track
    ],
)
def test_boxes_sam_cannot_use_are_refused(ingested: TestClient, bad: dict[str, object]):
    assert draw(ingested, "droid_100:1", **bad).status_code == 422
    assert ingested.get("/api/boxes").json() == []


def test_a_box_needs_an_ingested_episode(ingested: TestClient):
    assert draw(ingested, "droid_100:4").status_code == 404


def test_frame_zero_is_served_as_a_jpeg_at_the_clip_size(ingested: TestClient):
    response = ingested.get(f"/api/episodes/droid_100:0/frame0/{EXTERIOR_2}")

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    assert Image.open(io.BytesIO(response.content)).size == (320, 180)
    assert ingested.get("/api/episodes/droid_100:0/frame0/top_view").status_code == 404
