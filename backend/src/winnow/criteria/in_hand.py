"""`in_hand_lost_s`, from the wrist object track: how long the object is gone from the wrist view,
or far from the fingers, while the gripper is still closed and holding steady. A slip in transit.

The wrist camera is fixed to the gripper, so a held object stays where the wrist track was seeded:
between the fingertips. Its track's health is judged only while the object is in hand (up to the
last frame it is seen there), because after a slip, no box is the evidence, not SAM failing.
"""

import math
import statistics
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
# How far below its held reading the gripper may be and still count as holding steady (0 open,
# 1 closed). Settled on droid_100 16 and droid_1.0.1 9, whose objects leave the fingers only as
# the gripper opens.
SETTLED = 0.05


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
    closed = _still_closed(track, facts, grasps, frames)
    lost = [f for f in closed if (d := distance[f]) is None or d > FAR_WIDTHS]
    return _Read(closed, lost, distance, track.fps)


def _still_closed(track: Track, facts: EpisodeFacts, grasps: Grasps, frames: range) -> list[int]:
    """Frames where the gripper is closed and holding steady: above the Rubric's closed level and
    within SETTLED of its median reading while closed. As it closes on the object or opens to let
    go, the object leaving the fingers is the grasp or the release, not a slip."""
    level = grasps.settings.gripper_closed_level.value
    reading = {
        f: float(facts.signals.gripper[robot_frame(facts, frame_time(track, f))]) for f in frames
    }
    closed = [f for f in frames if reading[f] > level]
    if not closed:
        return []
    held = statistics.median(reading[f] for f in closed)
    return [f for f in closed if reading[f] >= held - SETTLED]


def _measurement(read: _Read, track: Track) -> Measurement:
    if not read.closed:
        return Measurement(0.0, "0.0 s", [TextSpan(text="The gripper is never closed here.")], [])
    if not read.lost:
        nearest = [(d, f) for f in read.closed if (d := read.distance[f]) is not None]
        furthest, at = max(nearest)
        held = f"Between the fingers while the gripper was closed: at most {furthest:.1f}"
        evidence = [
            TextSpan(text=f"{held} box-widths from them, at "),
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
