"""`in_hand_lost_s`, from the wrist object track: how long the object is gone from the wrist view,
or far from the fingers, while the gripper is still closed. A slip in transit.

The wrist camera is fixed to the gripper, so a held object stays where the wrist track was seeded:
between the fingertips. Its track's health is judged only while the object is in hand (up to the
last frame it is seen there), because after a slip, no box is the evidence, not SAM failing.
"""

import math
from dataclasses import dataclass, replace

from winnow.criteria.facts import EpisodeFacts
from winnow.criteria.grasps import Grasps, Interval
from winnow.criteria.measured import Measurement, at_times, seconds
from winnow.criteria.models import Criterion, Moment, TextSpan, TrackPlot
from winnow.criteria.track_frames import (
    by_frame,
    centre,
    frame_time,
    lost_in,
    median_width,
    no_track,
    points,
    robot_frame,
    track_frames,
    track_lost,
)
from winnow.tracking.models import Track
from winnow.tracking.wrist import OBJECT_POINT, RECIPE_SIZE

FAR_WIDTHS = 1.5  # further than this from the fingers, in the track's box-widths, is out of hand


@dataclass(frozen=True)
class _Read:
    closed: list[int]  # 5 fps frames with the gripper closed
    lost: list[int]  # closed frames with no box, or a box far from the fingers
    distance: dict[int, float | None]  # per frame, from the fingers in box-widths
    fps: float

    @property
    def held(self) -> list[int]:
        return [f for f in self.closed if f not in self.lost]


def _fingers(track: Track) -> tuple[float, float]:
    """The wrist seed point, between the fingertips, in the track's pixels."""
    return (
        OBJECT_POINT[0] * track.width / RECIPE_SIZE[0],
        OBJECT_POINT[1] * track.height / RECIPE_SIZE[1],
    )


def _read(track: Track, facts: EpisodeFacts, grasps: Grasps, frames: range) -> _Read:
    boxes = by_frame(track)
    fingers, width = _fingers(track), median_width(track)
    distance: dict[int, float | None] = {}
    for f in frames:
        box = boxes.get(f)
        distance[f] = None if box is None else round(math.dist(centre(box), fingers) / width, 3)
    level = grasps.settings.gripper_closed_level.value
    gripper = facts.signals.gripper
    closed = [f for f in frames if gripper[robot_frame(facts, frame_time(track, f))] > level]
    lost = [f for f in closed if (d := distance[f]) is None or d > FAR_WIDTHS]
    return _Read(closed, lost, distance, track.fps)


def _measurement(read: _Read, track: Track) -> Measurement:
    if not read.closed:
        return Measurement(0.0, "0.0 s", [TextSpan(text="The gripper is never closed here.")], [])
    if not read.lost:
        nearest = [(d, f) for f in read.closed if (d := read.distance[f]) is not None]
        furthest, at = max(nearest)
        evidence = [
            TextSpan(
                text=f"Between the fingers while the gripper was closed: at most {furthest:.1f}"
            ),
            TextSpan(text=" box-widths from them, at "),
            *at_times([frame_time(track, at)]),
            TextSpan(text="."),
        ]
        return Measurement(0.0, "0.0 s", evidence, [])
    lost_s = round(len(read.lost) / read.fps, 3)
    first = frame_time(track, read.lost[0])
    evidence = [
        TextSpan(text=f"Gone, or over {FAR_WIDTHS:g} box-widths from the fingers, for "),
        TextSpan(text=f"{seconds(lost_s)} while the gripper was closed, from "),
        *at_times([first]),
        TextSpan(text="."),
    ]
    return Measurement(lost_s, seconds(lost_s), evidence, [Moment(t=first, label="Lost")], first)


def in_hand_lost_s(
    criterion: Criterion, facts: EpisodeFacts, grasps: Grasps, window: Interval
) -> Measurement:
    track = facts.wrist
    if track is None:
        return no_track("wrist", "the wrist view hasn't been tracked.")
    frames = track_frames(track, facts, window.start, window.end)
    read = _read(track, facts, grasps, frames)
    plot = TrackPlot(
        label="Object from the fingers",
        unit="box-widths",
        level=FAR_WIDTHS,
        points=points(track, read.distance),
    )
    measured = replace(_measurement(read, track), plot=plot)
    if read.closed and not read.held:
        why = TextSpan(text=" Unsure: SAM never found the object between the fingers.")
        evidence = [*measured.evidence, why]
        return replace(measured, evidence=evidence, status="unsure", uncertainty="track lost")
    health = lost_in(track, range(frames.start, read.held[-1] + 1)) if read.held else None
    return measured if health is None else track_lost(measured, track, health)
