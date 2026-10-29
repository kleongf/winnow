"""Tracked primitives from the exterior object track, seeded from the hand-drawn box: whether the
object fell after release, and how far it moved. Placement against the target box is in
`criteria.placement`.

Without a hand-drawn box there is no exterior track, so these are unsure ("source missing") and
the Episode goes to Needs review rather than being guessed at.
"""

import math
from dataclasses import replace

from winnow.criteria.facts import EpisodeFacts
from winnow.criteria.grasps import Grasps, Interval
from winnow.criteria.measured import Measurement, at_times
from winnow.criteria.models import Criterion, Moment, TextSpan, TrackPlot
from winnow.criteria.track_frames import (
    by_frame,
    centre,
    frame_time,
    lost_in,
    no_track,
    points,
    robot_frame,
    track_frames,
    track_lost,
)
from winnow.tracking.models import Track

FALL_WINDOW_S = 1.0  # a fall shows within this long of the release


def no_exterior_track() -> Measurement:
    return no_track("exterior", "box the object on Prepare to track it.")


def checked(
    measured: Measurement, track: Track, frames: range, plot: TrackPlot | None = None
) -> Measurement:
    """`measured` with its plot, made unsure if SAM lost the object on `frames`."""
    measured = replace(measured, plot=plot)
    health = lost_in(track, frames)
    return measured if health is None else track_lost(measured, track, health)


def no_box(track: Track, frames: range, where: str) -> Measurement:
    """Nothing to measure: SAM has no box on any of `frames`, which its health calls lost."""
    evidence = [TextSpan(text=f"SAM has no box {where}.")]
    return checked(Measurement(None, "no box", evidence, []), track, frames)


def _fall(drops: dict[int, float], track: Track, released_s: float) -> Measurement:
    lowest = max(drops, key=lambda f: drops[f])
    fell = round(max(0.0, drops[lowest]), 3)
    moments = [Moment(t=released_s, label="Release")]
    after = f"in the {FALL_WINDOW_S:g} s after release at "
    if fell == 0:
        evidence = [TextSpan(text=f"Stayed put {after}"), *at_times([released_s])]
        return Measurement(fell, "0.0 box-heights", [*evidence, TextSpan(text=".")], moments)
    lowest_s = frame_time(track, lowest)
    evidence = [
        TextSpan(text=f"Fell {fell:.1f} box-heights {after}"),
        *at_times([released_s]),
        TextSpan(text=", lowest at "),
        *at_times([lowest_s]),
        TextSpan(text="."),
    ]
    moments.append(Moment(t=lowest_s, label="Lowest"))
    return Measurement(fell, f"{fell:.1f} box-heights", evidence, moments, lowest_s)


def fall_after_release(
    criterion: Criterion, facts: EpisodeFacts, grasps: Grasps, window: Interval
) -> Measurement:
    """How far the object's box drops in the second after the grasp opens, in the box-heights it
    had at release: set by the release, not the window, like `release_height_m`."""
    track = facts.exterior
    if track is None:
        return no_exterior_track()
    grasp = grasps.the_grasp
    if grasp is None or not grasps.released:
        why = "No grasp to release." if grasp is None else "No release: the grasp never opened."
        evidence = [TextSpan(text=why)]
        return Measurement(
            None, "no release", evidence, [], status="unsure", uncertainty="window empty"
        )
    released_s = facts.t[grasp.end + 1]
    end = robot_frame(facts, released_s + FALL_WINDOW_S)
    frames = track_frames(track, facts, grasp.end + 1, end)
    boxes = by_frame(track)
    seen = [f for f in frames if f in boxes]
    if not seen:
        return no_box(track, frames, "after release")
    ref = boxes[seen[0]]
    height = ref.bottom - ref.top
    drops = {f: round((centre(boxes[f])[1] - centre(ref)[1]) / height, 3) for f in seen}
    plot = TrackPlot(
        label="Drop since release",
        unit="box-heights",
        level=criterion.threshold,
        points=points(track, {f: drops.get(f) for f in frames}),
    )
    return checked(_fall(drops, track, released_s), track, frames, plot)


def object_displacement(
    criterion: Criterion, facts: EpisodeFacts, grasps: Grasps, window: Interval
) -> Measurement:
    """How far the object's box centre moved from its first box in the window to its last, in the
    first box's widths."""
    track = facts.exterior
    if track is None:
        return no_exterior_track()
    frames = track_frames(track, facts, window.start, window.end)
    boxes = by_frame(track)
    seen = [f for f in frames if f in boxes]
    if not seen:
        return no_box(track, frames, "in this window")
    first = boxes[seen[0]]
    width = first.right - first.left
    moved = {f: round(math.dist(centre(boxes[f]), centre(first)) / width, 3) for f in seen}
    start_s, end_s = frame_time(track, seen[0]), frame_time(track, seen[-1])
    value = moved[seen[-1]]
    evidence = [
        TextSpan(text=f"Moved {value:.1f} box-widths, from "),
        *at_times([start_s]),
        TextSpan(text=" to "),
        *at_times([end_s]),
        TextSpan(text="."),
    ]
    plot = TrackPlot(
        label="Distance from its first box",
        unit="box-widths",
        level=criterion.threshold,
        points=points(track, {f: moved.get(f) for f in frames}),
    )
    moments = [Moment(t=start_s, label="From"), Moment(t=end_s, label="To")]
    measured = Measurement(value, f"{value:.1f} box-widths", evidence, moments, end_s)
    return checked(measured, track, frames, plot)
