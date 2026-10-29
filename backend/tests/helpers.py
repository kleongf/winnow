import time

from fastapi.testclient import TestClient


def wait_for_job(api: TestClient, job_id: int, timeout_s: float = 60.0) -> dict[str, object]:
    """Poll a job until no item is queued or running, and return its final state."""
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        job: dict[str, object] = api.get(f"/api/jobs/{job_id}").json()
        if job["finished"]:
            return job
        time.sleep(0.05)
    raise TimeoutError(f"Job {job_id} still running after {timeout_s} s")
