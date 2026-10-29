"""Measured primitives: computed from an Episode's robot data alone, no model calls."""

from dataclasses import dataclass

import numpy as np

from winnow.criteria.facts import EpisodeFacts
from winnow.criteria.grasps import Grasps, Interval
from winnow.criteria.models import Criterion, Moment, Status, TextSpan


@dataclass(frozen=True)
class Measurement:
    value: float | None  # in the primitive's unit; None when there is nothing to measure
    shown: str  # the value as the user reads it, e.g. "3 attempts"
    evidence: list[TextSpan]
    moments: list[Moment]
    at_s: float | None = None  # where it goes wrong, should the value fail
    status: Status | None = None  # set only when the value alone doesn't decide


def seconds(t: float) -> str:
    return f"{t:.1f} s"


def at_times(times: list[float]) -> list[TextSpan]:
    """'0.9 s, 1.3 s and 1.8 s', each time a span that seeks."""
    spans: list[TextSpan] = []
    for i, t in enumerate(times):
        if i:
            spans.append(TextSpan(text=" and " if i == len(times) - 1 else ", "))
        spans.append(TextSpan(text=seconds(t), t=t))
    return spans


def _plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


def grasp_attempts(
    criterion: Criterion, facts: EpisodeFacts, grasps: Grasps, window: Interval
) -> Measurement:
    """Closures up to and including the grasp. With no grasp it fails, whatever the threshold."""
    t = facts.t
    failed = [t[c.start] for c in grasps.failed]
    moments = [Moment(t=s, label=f"Attempt {i + 1}") for i, s in enumerate(failed)]
    grasp = grasps.the_grasp
    if grasp is None:
        evidence = [TextSpan(text="No grasp: the gripper never closed.")]
        if failed:
            rise = f"{grasps.rise_rule_m * 100:g} cm"
            evidence = [
                TextSpan(text=f"No grasp: {_plural(len(failed), 'closure')}, at "),
                *at_times(failed),
                TextSpan(text=f", and none lifted the arm {rise}."),
            ]
        return Measurement(
            len(failed), "no grasp", evidence, moments, failed[0] if failed else None, "fail"
        )
    moments.append(Moment(t=t[grasp.start], label="Grasp"))
    if not failed:
        evidence = [TextSpan(text="Grasped on the first closure, at "), *at_times([t[grasp.start]])]
        return Measurement(1, "1 attempt", [*evidence, TextSpan(text=".")], moments)
    evidence = [
        TextSpan(text=f"{_plural(len(failed), 'failed grasp attempt')}, at "),
        *at_times(failed),
        TextSpan(text=", before the grasp at "),
        *at_times([t[grasp.start]]),
        TextSpan(text="."),
    ]
    attempts = len(failed) + 1
    return Measurement(attempts, _plural(attempts, "attempt"), evidence, moments, failed[0])


def _longest_run(still: np.ndarray) -> tuple[int, int]:
    """(start, length) of the longest run of True."""
    best = (0, 0)
    start = 0
    for i, is_still in enumerate([*still.tolist(), False]):
        if not is_still:
            if i - start > best[1]:
                best = (start, i - start)
            start = i + 1
    return best


def longest_still_s(
    criterion: Criterion, facts: EpisodeFacts, grasps: Grasps, window: Interval
) -> Measurement:
    """The longest stretch in the window, after the arm first moves and before it last stops,
    where the end effector is slower than `speed_below_m_s`."""
    below = criterion.params["speed_below_m_s"]
    speed = facts.speed[window.start : window.end + 1]
    moving = np.flatnonzero(speed >= below)
    if len(moving) == 0:
        return Measurement(0.0, "0.0 s", [TextSpan(text="The arm never moved here.")], [])
    first = window.start + int(moving[0])
    start, length = _longest_run(speed[moving[0] : moving[-1] + 1] < below)
    still_s = length / facts.signals.fps
    if length == 0:
        return Measurement(0.0, "0.0 s", [TextSpan(text="The arm never stopped.")], [])
    t0 = facts.t[first + start]
    t1 = facts.t[min(first + start + length, len(facts.t) - 1)]
    evidence = [
        TextSpan(text=f"Still (under {below:g} m/s) for {seconds(still_s)}, from "),
        *at_times([t0]),
        TextSpan(text=" to "),
        *at_times([t1]),
        TextSpan(text="."),
    ]
    moments = [Moment(t=t0, label="Stops"), Moment(t=t1, label="Moves again")]
    return Measurement(round(still_s, 3), seconds(still_s), evidence, moments, t0)
