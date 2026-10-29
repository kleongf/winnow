"""The report as plain text for `winnow eval`: counts first, then 95% intervals, never "±"."""

from winnow.evaluation.models import EvaluationReport, LengthRule, Proportion, SystemRow
from winnow.sets.models import SET_LABELS

COLUMNS = ("System", "Keeps", "Rejects", "Undecided", "Coverage", "False keeps", "False rejects")


def counted(p: Proportion) -> str:
    """e.g. "1 of 4 (0.05–0.70)"; with nothing to count, just "0 of 0"."""
    if p.low is None or p.high is None:
        return f"{p.count} of {p.of}"
    return f"{p.count} of {p.of} ({p.low:.2f}–{p.high:.2f})"


def length_rule_text(rule: LengthRule | None) -> str:
    if rule is None:
        return "Length alone: no labelled Episode to fit a threshold to"
    side = "≥" if rule.keep == "longer" else "≤"
    return (
        f"Length alone keeps Episodes {side} {rule.threshold_s:.1f} s (threshold set in hindsight)"
    )


def _cells(row: SystemRow) -> tuple[str, ...]:
    return (
        row.label,
        str(row.keeps),
        str(row.rejects),
        str(row.undecided),
        f"{row.coverage.count} of {row.coverage.of}",
        counted(row.false_keeps),
        counted(row.false_rejects),
    )


def report_text(report: EvaluationReport) -> str:
    header = (
        f"{SET_LABELS[report.set_name]} · Rubric v{report.rubric_version} · "
        f"{report.labelled} of {report.episodes} Episodes labelled · "
        f"{report.description_failures} description failures"
    )
    table = [COLUMNS, *(_cells(row) for row in report.comparison.rows)]
    widths = [max(len(line[i]) for line in table) for i in range(len(COLUMNS))]
    lines = [
        "  ".join(cell.ljust(w) for cell, w in zip(line, widths, strict=True)) for line in table
    ]
    rule = length_rule_text(report.comparison.length_rule)
    return "\n".join([header, "", *(line.rstrip() for line in lines), "", rule]) + "\n"
