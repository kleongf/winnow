"""Honest statistics from few labels: a count plus an interval, never "±"."""

from math import sqrt

from pydantic import BaseModel


class Proportion(BaseModel):
    """`count` of `of`, with its 95% Wilson interval; no interval when `of` is 0."""

    count: int
    of: int
    low: float | None
    high: float | None


Z_95 = 1.959964  # two-sided 95%


def wilson(count: int, of: int, z: float = Z_95) -> Proportion:
    """The Wilson score interval, which stays inside [0, 1] and behaves at 0 and n."""
    if of == 0:
        return Proportion(count=0, of=0, low=None, high=None)
    p = count / of
    z2 = z * z
    denominator = 1 + z2 / of
    centre = (p + z2 / (2 * of)) / denominator
    half = z * sqrt(p * (1 - p) / of + z2 / (4 * of * of)) / denominator
    return Proportion(count=count, of=of, low=max(0.0, centre - half), high=min(1.0, centre + half))
