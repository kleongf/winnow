"""An Episode's facts: everything the scoring function may read about one Episode.

Robot data only for now; tracks and their health, the target box, cached visual answers and
step failures join here as their Criteria arrive.
"""

from dataclasses import dataclass
from functools import cached_property

from winnow.episodes.models import EpisodeSignals, FloatArray
from winnow.episodes.speed import smoothed_speed


@dataclass(frozen=True)
class EpisodeFacts:
    signals: EpisodeSignals

    @cached_property
    def t(self) -> list[float]:
        """s from the Episode's start, per frame."""
        stamps = self.signals.timestamps
        start = float(stamps[0]) if len(stamps) else 0.0
        return [round(float(v) - start, 4) for v in stamps]

    @cached_property
    def speed(self) -> FloatArray:
        return smoothed_speed(self.signals)
