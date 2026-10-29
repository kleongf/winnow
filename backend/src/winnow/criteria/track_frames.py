"""What the tracked primitives share: a stretch of robot-data frames in a SAM track's 5 fps
frames, the track's health over the frames a Criterion reads, and the results a missing or lost
track gives.

Health is `tracking.health`'s three rules, judged only on the frames the Criterion reads, so a
track lost elsewhere in the Episode never makes it unsure.
"""

import statistics
from dataclasses import replace

from winnow.criteria.facts import EpisodeFacts
from winnow.criteria.measured import Measurement, at_times
from winnow.criteria.models import PlotPoint, TextSpan
from winnow.tracking.health import MISSING_FRACTION, track_health
from winnow.tracking.models import Track, TrackBox, TrackHealth


def frame_at(track: Track, t: float) -> int:
    """The 5 fps frame showing at `t` s."""
    return max(0, min(int(t * track.fps + 1e-6), track.frames - 1))


def frame_time(track: Track, frame: int) -> float:
    return round(frame / track.fps, 4)


def track_frames(track: Track, facts: EpisodeFacts, start: int, end: int) -> range:
    """The 5 fps frames covering robot-data frames `start` to `end`, inclusive."""
    return range(frame_at(track, facts.t[start]), frame_at(track, facts.t[end]) + 1)


def robot_frame(facts: EpisodeFacts, t: float) -> int:
    """The robot-data frame nearest `t` s."""
    return max(0, min(round(t * facts.signals.fps), len(facts.t) - 1))


def by_frame(track: Track) -> dict[int, TrackBox]:
    return {box.frame: box for box in track.boxes}


def centre(box: TrackBox) -> tuple[float, float]:
    return ((box.left + box.right) / 2, (box.top + box.bottom) / 2)


def median_width(track: Track) -> float:
    return statistics.median(b.right - b.left for b in track.boxes) if track.boxes else 1.0


def points(track: Track, values: dict[int, float | None]) -> list[PlotPoint]:
    return [PlotPoint(t=frame_time(track, f), value=v) for f, v in sorted(values.items())]


def no_track(track: str, why: str) -> Measurement:
    """A Criterion whose track doesn't exist: unsure, with nothing measured."""
    evidence = [TextSpan(text=f"No {track} track: {why}")]
    return Measurement(
        None, f"no {track} track", evidence, [], status="unsure", uncertainty="source missing"
    )


def lost_in(track: Track, frames: range) -> TrackHealth | None:
    """The track's health over `frames` when it shows SAM lost the object there, else None."""
    health = track_health(track.boxes, track.frames, frames)
    return health if health.lost else None


def _loss_spans(track: Track, health: TrackHealth) -> list[TextSpan]:
    spans: list[TextSpan] = []
    for frames, what in ((health.area_jumps, "swelled"), (health.centre_jumps, "jumped")):
        if frames:
            spans += [
                TextSpan(text=f"{'; ' if spans else ''}its box {what} at "),
                *at_times([frame_time(track, f) for f in frames]),
            ]
    if health.missing_fraction > MISSING_FRACTION:
        share = f"{health.missing_fraction:.0%}"
        spans.append(TextSpan(text=f"{'; ' if spans else ''}no box on {share} of frames"))
    return spans


def track_lost(measured: Measurement, track: Track, health: TrackHealth) -> Measurement:
    """`measured`, made unsure because SAM lost the object where it was read. Its value stays
    for the record, but carries no weight: p is 0.5."""
    evidence = [
        *measured.evidence,
        TextSpan(text=" Unsure: SAM lost the object here: "),
        *_loss_spans(track, health),
        TextSpan(text="."),
    ]
    return replace(measured, evidence=evidence, status="unsure", uncertainty="track lost", m=None)
