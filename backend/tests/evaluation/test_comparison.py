"""The comparison table, from each labelled Episode's Reference label, Winnow's Triage decision,
Spark alone's answer and its length. Expected intervals are 95% Wilson, worked by hand."""

import pytest

from winnow.evaluation.cases import EvaluationCase
from winnow.evaluation.comparison import comparison
from winnow.triage.models import TriageDecision


def case(
    n: int,
    failure: bool,
    winnow: TriageDecision,
    spark: str | None,
    duration_s: float,
) -> EvaluationCase:
    return EvaluationCase(
        episode_id=f"droid_100:{n}",
        duration_s=duration_s,
        description_failure=failure,
        winnow=winnow,
        spark_alone=spark,  # type: ignore[arg-type]
    )


# 4 description failures, 3 Episodes that meet the Description. Failures are shorter.
CASES = [
    case(0, True, "reject", "keep", 4.0),
    case(1, True, "needs_review", "keep", 5.0),
    case(2, True, "keep", "reject", 6.0),
    case(3, True, "reject", None, 12.0),
    case(4, False, "keep", "keep", 10.0),
    case(5, False, "needs_review", "keep", 11.0),
    case(6, False, "reject", "reject", 13.0),
]


def rows() -> dict[str, dict[str, object]]:
    table = comparison(CASES)
    return {row.system: row.model_dump() for row in table.rows}


def proportion(count: int, of: int, low: float, high: float) -> dict[str, object]:
    return {
        "count": count,
        "of": of,
        "low": pytest.approx(low, abs=1e-4),
        "high": pytest.approx(high, abs=1e-4),
    }


def test_rows_come_in_table_order():
    assert list(rows()) == ["winnow", "winnow_review_kept", "spark_alone", "length_alone"]


def test_winnow_counts_false_keeps_on_true_failures_with_a_wilson_interval():
    winnow = rows()["winnow"]

    assert (winnow["keeps"], winnow["rejects"], winnow["undecided"]) == (2, 3, 2)
    assert winnow["false_keeps"] == proportion(1, 4, 0.0456, 0.6994)
    assert winnow["false_rejects"] == proportion(1, 3, 0.0615, 0.7923)
    assert winnow["coverage"] == proportion(5, 7, 0.3589, 0.9178)


def test_winnows_worst_case_keeps_every_needs_review():
    worst = rows()["winnow_review_kept"]

    assert (worst["keeps"], worst["rejects"], worst["undecided"]) == (4, 3, 0)
    assert worst["false_keeps"] == proportion(2, 4, 0.1500, 0.8500)
    assert worst["false_rejects"] == proportion(1, 3, 0.0615, 0.7923)
    assert worst["coverage"] == proportion(7, 7, 0.6457, 1.0)


def test_spark_alone_without_an_answer_decides_nothing():
    spark = rows()["spark_alone"]

    assert (spark["keeps"], spark["rejects"], spark["undecided"]) == (4, 2, 1)
    assert spark["false_keeps"] == proportion(2, 4, 0.1500, 0.8500)
    assert spark["false_rejects"] == proportion(1, 3, 0.0615, 0.7923)


def test_length_alone_uses_the_one_threshold_that_fits_the_set_best_in_hindsight():
    table = comparison(CASES)
    length = rows()["length_alone"]

    # Keeping Episodes of 10 s or more misses only the 12 s failure: 1/4 false keeps, 0/3 rejects.
    assert table.length_rule is not None
    assert (table.length_rule.keep, table.length_rule.threshold_s) == ("longer", 10.0)
    assert (length["keeps"], length["rejects"], length["undecided"]) == (4, 3, 0)
    assert length["false_keeps"] == proportion(1, 4, 0.0456, 0.6994)
    assert length["false_rejects"] == proportion(0, 3, 0.0, 0.5615)


def test_length_alone_may_keep_shorter_episodes_when_that_fits_better():
    flipped = [
        case(i, c.description_failure, c.winnow, c.spark_alone, 20.0 - c.duration_s)
        for i, c in enumerate(CASES)
    ]

    rule = comparison(flipped).length_rule
    assert rule is not None
    assert (rule.keep, rule.threshold_s) == ("shorter", 10.0)


def test_an_empty_set_has_no_intervals_and_no_length_rule():
    table = comparison([])

    assert table.length_rule is None
    for row in table.rows:
        assert row.false_keeps.model_dump() == {"count": 0, "of": 0, "low": None, "high": None}
