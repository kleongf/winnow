"""The Audit sample: Winnow's own Keeps (and a few Rejects) an auditor checks, and the Keep
precision their marks measure."""

from typing import Literal

from pydantic import BaseModel

from winnow.evaluation.stats import Proportion

AuditKind = Literal["keep", "reject"]  # the Triage decision it was drawn with
AuditMark = Literal["good", "bad"]


class AuditDraw(BaseModel):
    seed: int | None = None  # None: chosen at random, and recorded


class AuditItem(BaseModel):
    episode_id: str
    kind: AuditKind
    reason: str  # its Reason now
    mark: AuditMark | None  # good: every Phrase marked pass; bad: one marked fail; None: neither
    failed: list[str]  # the Phrases marked fail, in Rubric order


class KeepPrecision(BaseModel):
    good: Proportion  # marked Keeps found good, with the 95% Wilson interval
    lower_bound: float | None  # one-sided, at `lower_bound_confidence`; only when every one is good
    lower_bound_confidence: float


class AuditSample(BaseModel):
    rubric_version: int
    s: float  # the version's margin multiplier, which the sample is (or will be) drawn at
    # Set when the version had a sample drawn at another s, before calibration changed it: that
    # one no longer shows the version's Keeps, so draw again.
    earlier_s: float | None
    seed: int | None  # None: not drawn yet for this Rubric version at `s`
    drawn_at: str | None
    phrases: list[str]  # the Rubric version's Phrases, each a Good mark passes
    items: list[AuditItem]  # Keeps, then Rejects, each in the Dataset's order
    precision: KeepPrecision
