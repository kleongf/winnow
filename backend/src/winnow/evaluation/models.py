"""The evaluation report: Winnow and the baselines scored against Reference labels.

Each metric family is one section of `EvaluationReport`; later sections (right reason,
risk–coverage, the source ablation, cost) join as fields beside `comparison`.
"""

from typing import Literal

from pydantic import BaseModel, Field

from winnow.sets.models import SetName

System = Literal["winnow", "winnow_review_kept", "spark_alone", "length_alone"]
SYSTEM_LABELS: dict[System, str] = {
    "winnow": "Winnow",
    "winnow_review_kept": "Winnow (all Needs review kept)",
    "spark_alone": "Spark alone",
    "length_alone": "Length alone",
}


class Proportion(BaseModel):
    """`count` of `of`, with its 95% Wilson interval; no interval when `of` is 0."""

    count: int
    of: int
    low: float | None
    high: float | None


class SystemRow(BaseModel):
    system: System
    label: str
    keeps: int
    rejects: int
    undecided: int  # Winnow's Needs review; Spark alone with no majority answer
    false_keeps: Proportion  # description failures kept, of all description failures
    false_rejects: Proportion  # Episodes meeting the Description rejected, of all of them
    coverage: Proportion  # Episodes decided automatically, of all labelled Episodes


class LengthRule(BaseModel):
    """Length alone's one duration threshold, chosen in hindsight on the evaluated set."""

    keep: Literal["longer", "shorter"]  # keep Episodes at least / at most `threshold_s` long
    threshold_s: float


class Comparison(BaseModel):
    rows: list[SystemRow]
    length_rule: LengthRule | None  # None when no Episode is labelled


class EvaluationRequest(BaseModel):
    set_name: SetName
    rubric_version: int | None = Field(default=None, ge=1)  # None: the latest version


class EvaluationReport(BaseModel):
    set_name: SetName
    rubric_version: int
    episodes: int  # in the set
    labelled: int  # with a first-pass Reference label; only these are scored
    description_failures: int  # labelled Episodes whose Reference label fails a Phrase
    comparison: Comparison


class TestRun(BaseModel):
    """One logged Test set run: the reported numbers are the last of these before the freeze."""

    __test__ = False  # not a pytest class

    id: int
    run_at: str
    rubric_version: int
    report: EvaluationReport
