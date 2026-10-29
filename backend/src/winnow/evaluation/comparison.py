"""The comparison table: false keeps, false rejects and coverage for Winnow, Winnow's worst case,
Spark alone and length alone, each counted against Reference labels."""

from collections.abc import Sequence
from typing import Literal

from winnow.evaluation.cases import EvaluationCase
from winnow.evaluation.models import SYSTEM_LABELS, Comparison, LengthRule, System, SystemRow
from winnow.evaluation.stats import wilson

Decision = Literal["keep", "reject"] | None  # None: not decided automatically
Outcome = tuple[bool, Decision]  # (description failure, decision)


def comparison(cases: Sequence[EvaluationCase]) -> Comparison:
    rule = hindsight_length_rule(cases)
    decisions: dict[System, list[Decision]] = {
        "winnow": [_winnow(c, review_kept=False) for c in cases],
        "winnow_review_kept": [_winnow(c, review_kept=True) for c in cases],
        "spark_alone": [c.spark_alone for c in cases],
        "length_alone": [_by_length(rule, c.duration_s) for c in cases],
    }
    failures = [c.description_failure for c in cases]
    rows = [system_row(s, list(zip(failures, d, strict=True))) for s, d in decisions.items()]
    return Comparison(rows=rows, length_rule=rule)


def system_row(system: System, outcomes: Sequence[Outcome]) -> SystemRow:
    failures = [d for failed, d in outcomes if failed]
    meeting = [d for failed, d in outcomes if not failed]
    decided = [d for _, d in outcomes if d is not None]
    return SystemRow(
        system=system,
        label=SYSTEM_LABELS[system],
        keeps=decided.count("keep"),
        rejects=decided.count("reject"),
        undecided=len(outcomes) - len(decided),
        false_keeps=wilson(failures.count("keep"), len(failures)),
        false_rejects=wilson(meeting.count("reject"), len(meeting)),
        coverage=wilson(len(decided), len(outcomes)),
    )


def _winnow(case: EvaluationCase, *, review_kept: bool) -> Decision:
    if case.winnow == "needs_review":
        return "keep" if review_kept else None
    return case.winnow


def _by_length(rule: LengthRule | None, duration_s: float) -> Decision:
    if rule is None:
        return None
    longer = duration_s >= rule.threshold_s
    shorter = duration_s <= rule.threshold_s
    return "keep" if (longer if rule.keep == "longer" else shorter) else "reject"


def _errors(rule: LengthRule, cases: Sequence[EvaluationCase]) -> tuple[float, int]:
    """Balanced error (false-keep rate plus false-reject rate), then false keeps."""
    outcomes: list[Outcome] = [
        (c.description_failure, _by_length(rule, c.duration_s)) for c in cases
    ]
    row = system_row("length_alone", outcomes)
    rates = [p.count / p.of for p in (row.false_keeps, row.false_rejects) if p.of]
    return sum(rates), row.false_keeps.count


def hindsight_length_rule(cases: Sequence[EvaluationCase]) -> LengthRule | None:
    """The one duration threshold, and which side of it to keep, that fits these very Reference
    labels best: generous to the baseline. Ties prefer "longer is better", then the shorter
    threshold."""
    durations = sorted({c.duration_s for c in cases})
    candidates = [
        LengthRule(keep=keep, threshold_s=t) for keep in ("longer", "shorter") for t in durations
    ]
    return min(candidates, key=lambda rule: _errors(rule, cases), default=None)
