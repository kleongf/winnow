import time
from typing import cast

from fastapi import FastAPI
from fastapi.testclient import TestClient

from winnow.baseline.prompts import FROZEN
from winnow.core.context import AppContext


def wait_for_job(api: TestClient, job_id: int, timeout_s: float = 60.0) -> dict[str, object]:
    """Poll a job until no item is queued or running, and return its final state."""
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        job: dict[str, object] = api.get(f"/api/jobs/{job_id}").json()
        if job["finished"]:
            return job
        time.sleep(0.05)
    raise TimeoutError(f"Job {job_id} still running after {timeout_s} s")


def app_context(api: TestClient) -> AppContext:
    """The context the running app built, to read stores no route exposes."""
    app = cast(FastAPI, api.app)
    return cast(AppContext, app.state.context)


def reference_label(api: TestClient, episode_id: str) -> None:
    """Give an Episode a first-pass Reference label passing every Phrase, which reveals its
    outputs. The instruction is used only where the Episode has none."""
    phrases = [{"phrase": p, "passed": True, "interval": None} for p in FROZEN.phrases]
    body = {"phrases": phrases, "elapsed_s": 10.0, "instruction": "Put the block in the bowl"}
    saved = api.post(f"/api/episodes/{episode_id}/reference-labels", json=body)
    assert saved.status_code == 201, saved.text
