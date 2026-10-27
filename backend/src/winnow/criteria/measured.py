"""Measured Criteria: computed from an Episode's robot data alone, no model calls."""

from dataclasses import dataclass

import numpy as np

from winnow.episodes.models import EpisodeSignals, FloatArray

CLOSED_THRESHOLD = 0.2  # gripper state above this counts as closed
PAUSE_SPEED_M_S = 0.01
PAUSE_MIN_S = 1.0


@dataclass(frozen=True)
class Interval:
    start: int  # first frame, inclusive
    end: int  # last frame, inclusive


def closures(gripper: FloatArray) -> list[Interval]:
    """Each stretch of frames where the gripper is closed."""
    closed = gripper > CLOSED_THRESHOLD
    intervals: list[Interval] = []
    start: int | None = None
    for i, is_closed in enumerate(closed):
        if is_closed and start is None:
            start = i
        elif not is_closed and start is not None:
            intervals.append(Interval(start, i - 1))
            start = None
    if start is not None:
        intervals.append(Interval(start, len(closed) - 1))
    return intervals


def regrasp_count(signals: EpisodeSignals) -> int:
    """Closures before the final one: 0 means the first grasp held."""
    return max(len(closures(signals.gripper)) - 1, 0)


def release_height_m(signals: EpisodeSignals) -> float | None:
    """How far above its grasp height the final grasp opened; None if it never closed."""
    found = closures(signals.gripper)
    if not found:
        return None
    final = found[-1]
    release = min(final.end + 1, len(signals.gripper) - 1)
    return float(signals.position[release, 2] - signals.position[final.start, 2])


def longest_pause_s(signals: EpisodeSignals) -> float:
    """Longest stretch, after the arm first moves, where the end effector is nearly still."""
    if len(signals.position) < 2:
        return 0.0
    speed = np.linalg.norm(np.diff(signals.position, axis=0), axis=1) * signals.fps
    moving = np.flatnonzero(speed >= PAUSE_SPEED_M_S)
    if len(moving) == 0:
        return 0.0
    longest = run = 0
    for is_still in speed[moving[0] : moving[-1] + 1] < PAUSE_SPEED_M_S:
        run = run + 1 if is_still else 0
        longest = max(longest, run)
    seconds = longest / signals.fps
    return seconds if seconds >= PAUSE_MIN_S else 0.0
