"""One labelled Episode as the report sees it: its Reference label's verdict on the Description,
and what each system decided. This is the narrow seam between scoring and the report: only the
Triage decision crosses it, so new Criteria, signals and confidence leave the report alone."""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from winnow.baseline.models import EpisodeBaseline
from winnow.reference_labels.models import ReferenceLabel
from winnow.triage.models import TriageDecision

SparkDecision = Literal["keep", "reject"]


@dataclass(frozen=True)
class EvaluationCase:
    episode_id: str
    duration_s: float
    description_failure: bool  # its Reference label fails at least one Phrase
    winnow: TriageDecision
    spark_alone: SparkDecision | None  # the majority of its samples; None without one


def description_failure(label: ReferenceLabel) -> bool:
    return any(not p.passed for p in label.phrases)


def spark_alone_decision(baseline: EpisodeBaseline) -> SparkDecision | None:
    """The majority over answered samples; a tie or no answer at all decides nothing."""
    decisions: Sequence[SparkDecision] = [
        s.answer.decision for s in baseline.samples if s.answer is not None
    ]
    keeps = decisions.count("keep")
    rejects = len(decisions) - keeps
    if keeps == rejects:
        return None
    return "keep" if keeps > rejects else "reject"
