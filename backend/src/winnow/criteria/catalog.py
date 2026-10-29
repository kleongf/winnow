"""The Criteria catalog: per primitive, how to measure it and how to say it in English.

The metadata (kind, unit, params, conclusive, noise floor, source) lives in
`criteria.primitives`.
"""

from collections.abc import Callable
from dataclasses import dataclass

from winnow.criteria.facts import EpisodeFacts
from winnow.criteria.grasps import Grasps, Interval
from winnow.criteria.measured import Measurement, grasp_attempts, release_height_m
from winnow.criteria.models import Criterion
from winnow.criteria.motion import active_duration_s, longest_still_s, path_efficiency
from winnow.criteria.primitives import Primitive

Measure = Callable[[Criterion, EpisodeFacts, Grasps, Interval], Measurement]


@dataclass(frozen=True)
class Entry:
    measure: Measure
    # The measured quantity in English; formatted with the Criterion's params.
    english: str


CATALOG: dict[Primitive, Entry] = {
    "grasp_attempts": Entry(grasp_attempts, "Grasp attempts, up to and including the grasp,"),
    "longest_still_s": Entry(
        longest_still_s, "Longest stretch with the arm under {speed_below_m_s:g} m/s"
    ),
    "release_height_m": Entry(
        release_height_m, "Release height above where the object was picked up"
    ),
    "active_duration_s": Entry(active_duration_s, "Time the arm is moving"),
    "path_efficiency": Entry(path_efficiency, "Path efficiency (straight line over path)"),
}
