"""The English a Criterion shows, rendered from its typed fields and nothing else."""

from winnow.criteria.catalog import CATALOG
from winnow.criteria.models import Criterion
from winnow.criteria.windows import window_name

COMPARATORS = {"<": "<", "<=": "≤", ">=": "≥", ">": ">", "==": "="}


def format_value(value: float, unit: str) -> str:
    if unit == "attempts":
        return f"{value:g}"
    if unit == "m":
        return f"{value * 100:g} cm"
    return f"{value:g} {unit}"


def english(criterion: Criterion) -> str:
    """e.g. 'Grasp attempts, up to and including the grasp, ≤ 1' or 'Longest stretch with the
    arm under 0.01 m/s, while holding, < 1.5 s'."""
    quantity = CATALOG[criterion.primitive].english.format(**criterion.params)
    if criterion.window.kind != "whole":
        quantity = f"{quantity.rstrip(',')}, {window_name(criterion.window)},"
    comparison = (
        f"{COMPARATORS[criterion.comparator]} {format_value(criterion.threshold, criterion.unit)}"
    )
    return f"{quantity} {comparison}"
