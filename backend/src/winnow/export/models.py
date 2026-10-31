from pydantic import BaseModel

from winnow.triage.models import TriageDecision


class Rejection(BaseModel):
    """A line of an export's rejections.jsonl: an Episode left out, and why."""

    episode_id: str
    source_index: int
    decision: TriageDecision  # reject or needs_review
    reason: str


class ExportStarted(BaseModel):
    job_id: int
