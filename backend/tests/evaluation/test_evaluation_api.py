"""The evaluation report over fixture Episodes, their Reference labels and Spark alone's samples:
served by a route, returned identically by `winnow eval`, and logged for every Test set run."""

import json

import pytest
from fastapi.testclient import TestClient

from tests.helpers import app_context, wait_for_job
from winnow.baseline.models import BaselineAnswer
from winnow.baseline.prompts import FROZEN
from winnow.cli import main
from winnow.core.settings import Settings
from winnow.evaluation.service import evaluation_report
from winnow.triage.models import Label

FIRST_TRY, NEVER_DROPS = FROZEN.phrases[0], FROZEN.phrases[1]
# Winnow keeps fixture Episode 0, routes 1 to Needs review and rejects 2 (three grasp attempts).
EPISODES = ["droid_100:0", "droid_100:1", "droid_100:2", "droid_100:4"]


def reference_label(api: TestClient, episode_id: str, *fails: str) -> None:
    phrases = [
        {
            "phrase": p,
            "passed": p not in fails,
            "interval": {"start_s": 0.5, "end_s": 1.0} if p in fails else None,
        }
        for p in FROZEN.phrases
    ]
    body = {"phrases": phrases, "elapsed_s": 30, "instruction": "Put the block in the bowl"}
    response = api.post(f"/api/episodes/{episode_id}/reference-labels", json=body)
    assert response.status_code == 201, response.text


def spark_alone(api: TestClient, episode_id: str, *decisions: str | None) -> None:
    store = app_context(api).baseline
    for sample, decision in enumerate(decisions):
        answer = (
            None
            if decision is None
            else BaselineAnswer(
                decision=decision,  # type: ignore[arg-type]
                failure_type=None,
                time_s=None,
                reason="",
                confidence=0.9,
            )
        )
        store.save_sample(
            episode_id, FROZEN.text, sample, answer, "timeout" if not answer else None
        )


def labelled(api: TestClient, set_name: str) -> TestClient:
    job = api.post("/api/episodes/ingest", json={"source": "droid_100", "indices": [0, 1, 2, 4]})
    wait_for_job(api, job.json()["job_id"])
    api.post(f"/api/sets/{set_name}/episodes", json={"episode_ids": EPISODES})
    reference_label(api, "droid_100:0")
    reference_label(api, "droid_100:1", NEVER_DROPS)  # a failure Winnow can't see yet
    reference_label(api, "droid_100:2", FIRST_TRY)
    # droid_100:4 waits for its Reference label, so the report leaves it out.
    spark_alone(api, "droid_100:0", "keep", "keep", "reject")
    spark_alone(api, "droid_100:1", "reject", "reject", "reject")
    spark_alone(api, "droid_100:2", "keep", "keep", None)
    return api


@pytest.fixture
def test_set(api: TestClient) -> TestClient:
    return labelled(api, "test")


def run(api: TestClient, set_name: str, **body: object) -> dict[str, object]:
    response = api.post("/api/evaluation/runs", json={"set_name": set_name} | body)
    assert response.status_code == 200, response.text
    return response.json()


def rows(report: dict[str, object]) -> dict[str, dict[str, object]]:
    comparison = report["comparison"]
    assert isinstance(comparison, dict)
    return {row["system"]: row for row in comparison["rows"]}  # type: ignore[index]


def interval(count: int, of: int, low: float, high: float) -> dict[str, object]:
    return {
        "count": count,
        "of": of,
        "low": pytest.approx(low, abs=1e-4),
        "high": pytest.approx(high, abs=1e-4),
    }


def test_the_report_scores_only_labelled_episodes_against_their_reference_labels(
    test_set: TestClient,
):
    report = run(test_set, "test")

    assert (report["set_name"], report["rubric_version"]) == ("test", 1)
    assert (report["episodes"], report["labelled"], report["description_failures"]) == (4, 3, 2)
    winnow = rows(report)["winnow"]
    assert (winnow["keeps"], winnow["rejects"], winnow["undecided"]) == (1, 1, 1)
    assert winnow["false_keeps"] == interval(0, 2, 0.0, 0.6576)
    assert winnow["false_rejects"] == interval(0, 1, 0.0, 0.7935)
    assert winnow["coverage"] == interval(2, 3, 0.2077, 0.9385)
    kept = rows(report)["winnow_review_kept"]
    assert (kept["keeps"], kept["rejects"], kept["undecided"]) == (2, 1, 0)
    assert kept["false_keeps"] == interval(1, 2, 0.0945, 0.9055)  # it keeps droid_100:1
    spark = rows(report)["spark_alone"]
    assert (spark["keeps"], spark["rejects"], spark["undecided"]) == (2, 1, 0)
    assert spark["false_keeps"] == interval(1, 2, 0.0945, 0.9055)  # it keeps droid_100:2
    assert spark["false_rejects"] == interval(0, 1, 0.0, 0.7935)


def test_the_cli_returns_the_same_report_as_the_route(
    test_set: TestClient, settings: Settings, capsys: pytest.CaptureFixture[str]
):
    from_route = run(test_set, "test", rubric_version=1)

    assert main(["eval", "test", "--rubric-version", "1", "--json"], settings=settings) == 0
    assert json.loads(capsys.readouterr().out) == from_route


def test_the_cli_prints_the_comparison_table(
    test_set: TestClient, settings: Settings, capsys: pytest.CaptureFixture[str]
):
    assert main(["eval", "test"], settings=settings) == 0

    out = capsys.readouterr().out
    assert "Test set · Rubric v1 · 3 of 4 Episodes labelled · 2 description failures" in out
    assert "Spark alone" in out and "1 of 2 (0.09–0.91)" in out
    assert "±" not in out


def test_each_test_set_run_appends_one_dated_log_entry(test_set: TestClient, settings: Settings):
    assert test_set.get("/api/evaluation/test-runs").json() == []

    report = run(test_set, "test")
    main(["eval", "test"], settings=settings)

    log = test_set.get("/api/evaluation/test-runs").json()
    assert len(log) == 2
    assert [entry["rubric_version"] for entry in log] == [1, 1]
    assert log[1]["report"] == report  # newest first
    assert log[0]["run_at"] >= log[1]["run_at"]


def test_dev_set_runs_are_not_logged(api: TestClient):
    labelled(api, "dev")

    run(api, "dev")

    assert api.get("/api/evaluation/test-runs").json() == []


def test_an_unknown_rubric_version_is_not_found(test_set: TestClient):
    response = test_set.post("/api/evaluation/runs", json={"set_name": "test", "rubric_version": 9})

    assert response.status_code == 404


def fail_first_try(episode_id: str) -> list[Label]:
    """An interview or review label that would reject every Episode it touched."""
    return [Label(phrase=FIRST_TRY, value="fail", source="review")]


def test_interview_and_review_labels_never_touch_test_set_episodes(test_set: TestClient):
    ctx = app_context(test_set)

    report = evaluation_report(ctx, "test", tuning_labels=fail_first_try)

    assert report == evaluation_report(ctx, "test")
    assert rows(report.model_dump())["winnow"]["keeps"] == 1


def test_interview_and_review_labels_apply_to_dev_set_episodes(api: TestClient):
    ctx = app_context(labelled(api, "dev"))

    report = evaluation_report(ctx, "dev", tuning_labels=fail_first_try)

    winnow = rows(report.model_dump())["winnow"]
    assert (winnow["keeps"], winnow["rejects"]) == (0, 3)
