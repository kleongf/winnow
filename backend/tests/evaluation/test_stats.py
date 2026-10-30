"""Intervals from few labels, checked against known values."""

import pytest

from winnow.evaluation.stats import clopper_pearson_lower, clopper_pearson_upper, wilson


def test_wilson_on_14_of_15_is_0_70_to_0_99():
    p = wilson(14, 15)

    assert (p.count, p.of) == (14, 15)
    assert (round(p.low or 0, 2), round(p.high or 0, 2)) == (0.70, 0.99)


def test_the_one_sided_lower_bound_when_every_one_is_good_is_the_nth_root_of_1_minus_conf():
    assert clopper_pearson_lower(15, 15, 0.90) == pytest.approx(0.1 ** (1 / 15), abs=1e-9)
    assert round(clopper_pearson_lower(15, 15, 0.90), 2) == 0.86


def test_the_one_sided_upper_bound_when_none_is_seen_mirrors_it():
    assert clopper_pearson_upper(0, 10, 0.90) == pytest.approx(1 - 0.1 ** (1 / 10), abs=1e-9)


def test_two_one_sided_bounds_at_97_5_percent_make_the_two_sided_95_percent_interval():
    # The exact (Clopper–Pearson) 95% interval for 2 of 20 is 0.0123–0.3170.
    assert clopper_pearson_lower(2, 20, 0.975) == pytest.approx(0.01235, abs=5e-5)
    assert clopper_pearson_upper(2, 20, 0.975) == pytest.approx(0.31698, abs=5e-5)


def test_the_bounds_stop_at_0_and_1():
    assert clopper_pearson_lower(0, 10, 0.90) == 0.0
    assert clopper_pearson_upper(10, 10, 0.90) == 1.0
    assert (clopper_pearson_lower(0, 0, 0.90), clopper_pearson_upper(0, 0, 0.90)) == (0.0, 1.0)


def test_an_impossible_count_is_refused():
    with pytest.raises(ValueError):
        clopper_pearson_upper(11, 10, 0.90)
    with pytest.raises(ValueError):
        clopper_pearson_lower(1, 2, 1.0)
