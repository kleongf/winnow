"""What the scoring function says about one Episode, and what the Episodes table lists."""

from typing import Literal

from pydantic import BaseModel

from winnow.criteria.models import Comparator, Moment, Status, TextSpan
from winnow.criteria.primitives import Kind, Primitive

TriageDecision = Literal["keep", "reject", "needs_review"]
# Why a result is unsure. Near threshold, samples split, track lost and the rest join as their
# sources arrive.
UncertaintySignal = Literal["window empty"]
LabelSource = Literal["interview", "review", "audit"]


class PhraseLabel(BaseModel):
    """A human's answer for one Phrase of one Episode; it overrides that Phrase's result."""

    phrase: str
    value: Literal["pass", "fail"]
    source: LabelSource


class CriterionResult(BaseModel):
    criterion_id: str
    phrase: str
    primitive: Primitive
    kind: Kind
    hard: bool
    english: str
    status: Status
    value: float | None
    measurement: str  # the value as the user reads it, e.g. "3 attempts"
    comparator: Comparator
    threshold: float
    unit: str
    evidence: list[TextSpan]
    moments: list[Moment]
    window: tuple[float, float] | None  # s; None when the window is empty
    window_name: str
    at_s: float | None  # where it went wrong, for a fail
    uncertainty: UncertaintySignal | None
    camera: str | None  # the view to show; None for robot data


class PhraseResult(BaseModel):
    phrase: str
    hard: bool  # has a hard Criterion, so it counts toward the Triage decision
    status: Status | None  # None: no Criterion checks it
    label: PhraseLabel | None  # the human answer that set `status`, if any


class Triage(BaseModel):
    decision: TriageDecision
    reason: list[TextSpan]  # one sentence; spans with a time seek to it
    criteria: list[CriterionResult]
    phrases: list[PhraseResult]


class EpisodeTriage(Triage):
    episode_id: str
    rubric_version: int


class TriageRow(BaseModel):
    episode_id: str
    decision: TriageDecision
    reason: str


class TriageList(BaseModel):
    rubric_version: int
    rows: list[TriageRow]
