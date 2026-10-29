"""An Episode's facts: everything the scoring function may read about one Episode.

Robot data, and which sources are missing or failed their step. Tracks and their health, the
target box and cached visual answers join here as their Criteria arrive.
"""

from collections.abc import Mapping
from dataclasses import dataclass, field
from functools import cached_property
from typing import Literal

from winnow.criteria.primitives import Source
from winnow.episodes.models import EpisodeSignals, FloatArray
from winnow.episodes.speed import smoothed_speed

SourceProblem = Literal["source missing", "step failed"]


@dataclass(frozen=True)
class EpisodeFacts:
    signals: EpisodeSignals
    # Sources a Criterion can't read for this Episode; each one's Criteria are unsure.
    unavailable: Mapping[Source, SourceProblem] = field(default_factory=dict[Source, SourceProblem])

    @cached_property
    def t(self) -> list[float]:
        """s from the Episode's start, per frame."""
        stamps = self.signals.timestamps
        start = float(stamps[0]) if len(stamps) else 0.0
        return [round(float(v) - start, 4) for v in stamps]

    @cached_property
    def speed(self) -> FloatArray:
        return smoothed_speed(self.signals)
