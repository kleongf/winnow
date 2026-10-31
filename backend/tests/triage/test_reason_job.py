"""Spark's Reasons are written in the background: queued on request, after a Run and when a visual
job finishes, for every Reject and Needs review whose inputs have no Reason yet."""

import time
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from tests.helpers import ask_visual, reference_label, track_cleanly, wait_for_job
from tests.rubric.scripted import ScriptedCompile, criterion, phrase
from tests.triage.scripted import ScriptedReason
from winnow.app import create_app
from winnow.baseline.prompts import FROZEN
from winnow.cli import main
from winnow.core.settings import Settings

NEVER_DROPS = FROZEN.phrases[1]
KEPT, UNSURE, REJECTED = "droid_100:0", "droid_100:1", "droid_100:2"


def finished_reason_job(api: TestClient, after: int = 0) -> dict[str, object]:
    """The latest Reason job newer than job `after`, once it has finished."""
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        job = api.get("/api/jobs/latest", params={"kind": "reason"}).json()
        if job is not None and job["id"] > after and job["finished"]:
            return job
        time.sleep(0.05)
    raise TimeoutError("no Reason job finished")


def labels(job: dict[str, object]) -> set[str]:
    return {item["label"] for item in job["items"]}  # type: ignore[index, union-attr]


def triage(api: TestClient, episode_id: str) -> dict[str, object]:
    return api.get(f"/api/episodes/{episode_id}/triage").json()


@pytest.fixture
def spark() -> ScriptedReason:
    return ScriptedReason()


@pytest.fixture
def written(settings: Settings, spark: ScriptedReason) -> Iterator[TestClient]:
    """Episode 0 kept, 1 needing review and 2 rejected, their visual Criteria asked."""
    with TestClient(create_app(settings, transport=spark)) as api:
        job = api.post("/api/episodes/ingest", json={"source": "droid_100", "indices": [0, 1, 2]})
        wait_for_job(api, job.json()["job_id"])
        for episode_id in (KEPT, UNSURE, REJECTED):
            reference_label(api, episode_id)
            track_cleanly(api, episode_id)
        ask_visual(api)
        yield api


def test_a_finished_visual_job_queues_a_reason_for_each_reject_and_needs_review(
    written: TestClient,
):
    job = finished_reason_job(written)

    assert labels(job) == {UNSURE, REJECTED}
    assert job["failed"] == 0
    rejected = triage(written, REJECTED)
    assert rejected["reason_source"] == "spark"
    assert str(rejected["reason"][0]["text"]).startswith("Written by Spark")  # type: ignore[index]
    assert triage(written, KEPT)["reason_source"] == "template"


def test_asking_again_queues_only_episodes_whose_reason_is_out_of_date(
    written: TestClient,
):
    first = finished_reason_job(written)
    again = written.post("/api/reasons")
    assert (again.status_code, again.json()) == (202, {"job_id": None})

    label = {"phrase": NEVER_DROPS, "value": "fail", "source": "review"}
    written.post(f"/api/episodes/{UNSURE}/labels", json=label)
    assert triage(written, UNSURE)["reason_source"] == "template"
    started = written.post("/api/reasons")

    assert started.status_code == 202
    job = wait_for_job(written, started.json()["job_id"])
    assert int(str(job["id"])) > int(str(first["id"]))
    assert labels(job) == {UNSURE}
    assert triage(written, UNSURE)["reason_source"] == "spark"


def test_an_answer_citing_a_time_not_given_keeps_the_template(
    settings: Settings, spark: ScriptedReason
):
    spark.answer = '{"spans": [{"text": "It slipped at 0.1 s.", "t": 0.1}]}'
    with TestClient(create_app(settings, transport=spark)) as api:
        job = api.post("/api/episodes/ingest", json={"source": "droid_100", "indices": [2]})
        wait_for_job(api, job.json()["job_id"])
        reference_label(api, REJECTED)

        job = wait_for_job(api, api.post("/api/reasons").json()["job_id"])

        [item] = job["items"]  # type: ignore[misc]
        assert item["status"] == "failed" and "0.1" in item["detail"]
        assert triage(api, REJECTED)["reason_source"] == "template"


def test_writing_reasons_needs_the_meta_api(api: TestClient):
    response = api.post("/api/reasons")

    assert response.status_code == 503
    assert "MODEL_API_KEY" in response.json()["detail"]


def test_a_run_queues_reasons_for_the_new_version(settings: Settings):
    compile_ = ScriptedCompile(answers=[])
    with TestClient(create_app(settings, transport=compile_)) as api:
        job = api.post("/api/episodes/ingest", json={"source": "droid_100", "indices": [0, 2]})
        wait_for_job(api, job.json()["job_id"])
        compile_.answers.append(
            {"phrases": [phrase("one grasp", criteria=[criterion("grasp_attempts", "<=", 1)])]}
        )
        compiled = api.post("/api/rubric/draft/compile", json={"description": "one grasp"})
        assert compiled.status_code == 200, compiled.text

        assert api.post("/api/rubric/draft/run").status_code == 201

        job = finished_reason_job(api)
        assert labels(job) == {REJECTED}  # Episode 0 grasps once: kept


def test_the_cli_writes_reasons(settings: Settings, capsys: pytest.CaptureFixture[str]):
    spark = ScriptedReason()
    assert main(["ingest", "droid_100", "2"], settings=settings, transport=spark) == 0

    assert main(["reasons"], settings=settings, transport=spark) == 0

    assert f"{REJECTED} reason: done" in capsys.readouterr().out
    assert len(spark.asked) == 1


def test_the_cli_needs_the_meta_api(settings: Settings, capsys: pytest.CaptureFixture[str]):
    assert main(["reasons"], settings=settings) == 2
    assert "MODEL_API_KEY" in capsys.readouterr().err
