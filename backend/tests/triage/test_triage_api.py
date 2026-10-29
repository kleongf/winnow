"""The seeded Rubric scores every ingested Episode, served for the Episodes table and the
Workstation."""

import sqlite3

import pytest
from fastapi.testclient import TestClient

from tests.conftest import OPEN_GRIPPER_EPISODE
from tests.helpers import app_context, reference_label, wait_for_job
from winnow.baseline.prompts import FROZEN
from winnow.rubric.models import Rubric

FIRST_TRY = "grasps the object on the first try"
REGRASP_EPISODE = 2  # the fixture's failures (i % 3 == 2) are Episode 42-shaped


@pytest.fixture
def ingested(api: TestClient) -> TestClient:
    indices = [0, REGRASP_EPISODE, OPEN_GRIPPER_EPISODE]
    job = api.post("/api/episodes/ingest", json={"source": "droid_100", "indices": indices})
    wait_for_job(api, job.json()["job_id"])
    for index in indices:  # their outputs show only once labelled
        reference_label(api, f"droid_100:{index}")
    return api


def test_the_rubric_is_seeded_from_the_frozen_description(api: TestClient):
    version = api.get("/api/rubric").json()

    assert version["version"] == 1
    rubric = version["rubric"]
    assert rubric["description"] == FROZEN.text
    assert rubric["phrases"] == list(FROZEN.phrases)
    [criterion] = rubric["criteria"]
    assert (criterion["primitive"], criterion["phrase"], criterion["kind"]) == (
        "grasp_attempts",
        FIRST_TRY,
        "measured",
    )
    assert (criterion["comparator"], criterion["threshold"], criterion["hard"]) == ("<=", 1, True)
    settings = rubric["settings"]
    assert settings["gripper_closed_level"]["value"] == 0.2
    assert settings["grasp_rise_m"]["value"] == 0.02
    assert settings["gripper_closed_level"]["assumption"]  # nobody has confirmed it yet


def test_every_episode_gets_a_triage_decision_and_reason(ingested: TestClient):
    listed = ingested.get("/api/triage").json()

    assert listed["rubric_version"] == 1
    rows = {r["episode_id"]: r for r in listed["rows"]}
    assert {i: r["decision"] for i, r in rows.items()} == {
        "droid_100:0": "keep",
        "droid_100:2": "reject",
        "droid_100:4": "reject",
    }
    assert rows["droid_100:2"]["reason"] == (
        f'Rejected: "{FIRST_TRY}" failed. 2 failed grasp attempts, at 0.9 s and 1.3 s, '
        "before the grasp at 1.8 s."
    )
    assert "never closed" in rows["droid_100:4"]["reason"]


def test_an_episodes_triage_has_its_criterion_results_with_moments(ingested: TestClient):
    triage = ingested.get(f"/api/episodes/droid_100:{REGRASP_EPISODE}/triage").json()

    assert (triage["episode_id"], triage["rubric_version"]) == ("droid_100:2", 1)
    assert triage["decision"] == "reject"
    [result] = triage["criteria"]
    assert result["status"] == "fail" and result["measurement"] == "3 attempts"
    assert [m["label"] for m in result["moments"]] == ["Attempt 1", "Attempt 2", "Grasp"]
    assert result["at_s"] == result["moments"][0]["t"]
    assert result["window"] == {"start": 0.0, "end": pytest.approx(44 / 15, abs=1e-3)}
    assert [s["t"] for s in triage["reason"] if s["t"] is not None] == [
        m["t"] for m in result["moments"]
    ]
    first_try = triage["phrases"][0]
    assert first_try == {"phrase": FIRST_TRY, "hard": True, "status": "fail", "label": None}
    assert [p["status"] for p in triage["phrases"][1:]] == [None, None, None]  # not checked yet


def test_an_unknown_episode_has_no_triage(api: TestClient):
    assert api.get("/api/episodes/droid_100:9/triage").status_code == 404


def test_rubric_versions_are_immutable_and_the_latest_one_scores(ingested: TestClient):
    rubrics = app_context(ingested).rubrics
    seeded = rubrics.latest()
    stricter = seeded.rubric.model_copy(deep=True)
    stricter.criteria[0].threshold = 3

    added = rubrics.add(Rubric.model_validate(stricter.model_dump()))

    assert added.version == 2
    assert rubrics.get(1) == seeded
    rows = {r["episode_id"]: r for r in ingested.get("/api/triage").json()["rows"]}
    assert rows["droid_100:2"]["decision"] == "keep"
    with pytest.raises(sqlite3.DatabaseError, match="immutable"):
        ingested_db = app_context(ingested).db
        ingested_db.execute("UPDATE rubric_versions SET rubric = '{}' WHERE version = 1")
