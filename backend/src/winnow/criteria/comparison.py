"""A Criterion's comparator, applied to a measured value."""

from winnow.criteria.models import Criterion


def passes(criterion: Criterion, value: float) -> bool:
    match criterion.comparator:
        case "<":
            return value < criterion.threshold
        case "<=":
            return value <= criterion.threshold
        case ">=":
            return value >= criterion.threshold
        case ">":
            return value > criterion.threshold
        case "==":
            return value == criterion.threshold


def signed_distance(criterion: Criterion, value: float) -> float:
    """How far `value` is from the threshold, in the Criterion's unit: positive on the passing
    side, negative on the failing side (always ≤ 0 for `==`)."""
    match criterion.comparator:
        case "<" | "<=":
            return criterion.threshold - value
        case ">" | ">=":
            return value - criterion.threshold
        case "==":
            return -abs(value - criterion.threshold)
