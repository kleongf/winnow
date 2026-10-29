import time
from typing import cast

from fastapi import FastAPI
from fastapi.testclient import TestClient

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
