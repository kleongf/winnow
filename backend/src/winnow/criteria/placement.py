"""`final_overlap`: the share of the object's final exterior box inside the target box.

One-sided evidence: no overlap is a strong fail, but from one view at 320x180, overlap can't
tell "in" from "in front of", so placement also gets a visual question. Unsure without a target
box (SAM found none and none was drawn) or without an exterior track (no hand-drawn box).
"""

from winnow.criteria.exterior_track import checked, no_box, no_exterior_track
from winnow.criteria.facts import EpisodeFacts
from winnow.criteria.grasps import Grasps, Interval
from winnow.criteria.measured import Measurement, at_times
from winnow.criteria.models import Criterion, Moment, TextSpan, TrackPlot
from winnow.criteria.track_frames import by_frame, frame_time, points, track_frames
from winnow.tracking.models import FrameBox, TargetBox, Track, TrackBox


def _target_in_clip(target: FrameBox, of: TargetBox, track: Track) -> FrameBox:
    """The target box, from frame-0 pixels to the track's clip pixels."""
    sx, sy = track.width / of.frame_width, track.height / of.frame_height
    return FrameBox(
        left=target.left * sx,
        top=target.top * sy,
        right=target.right * sx,
        bottom=target.bottom * sy,
    )


def _inside(box: TrackBox, target: FrameBox) -> float:
    width = max(0.0, min(box.right, target.right) - max(box.left, target.left))
    height = max(0.0, min(box.bottom, target.bottom) - max(box.top, target.top))
    area = (box.right - box.left) * (box.bottom - box.top)
    return round(width * height / area, 3) if area > 0 else 0.0


def _no_target(target: TargetBox | None) -> Measurement:
    why = "No target box yet."
    if target is not None and target.status == "not_found":
        why = f"No target box: SAM found no {target.target}. Draw one on Prepare."
    elif target is not None:
        why = "No target box: the instruction names no target. Draw one on Prepare."
    evidence = [TextSpan(text=why)]
    return Measurement(
        None, "no target box", evidence, [], status="unsure", uncertainty="source missing"
    )


def final_overlap(
    criterion: Criterion, facts: EpisodeFacts, grasps: Grasps, window: Interval
) -> Measurement:
    track = facts.exterior
    if track is None:
        return no_exterior_track()
    if facts.target is None or facts.target.box is None:
        return _no_target(facts.target)
    target = _target_in_clip(facts.target.box, facts.target, track)
    frames = track_frames(track, facts, window.start, window.end)
    boxes = by_frame(track)
    seen = [f for f in frames if f in boxes]
    if not seen:
        return no_box(track, frames, "in this window")
    shares = {f: _inside(boxes[f], target) for f in seen}
    final, final_s = shares[seen[-1]], frame_time(track, seen[-1])
    evidence = [
        TextSpan(text=f"{final:.0%} of the object's final box is inside the target box, at "),
        *at_times([final_s]),
        TextSpan(text="."),
    ]
    plot = TrackPlot(
        label="Share inside the target box",
        unit="ratio",
        level=criterion.threshold,
        points=points(track, {f: shares.get(f) for f in frames}),
    )
    moments = [Moment(t=final_s, label="Final box")]
    measured = Measurement(final, f"{final:.2f}", evidence, moments, final_s)
    return checked(measured, track, frames, plot)
