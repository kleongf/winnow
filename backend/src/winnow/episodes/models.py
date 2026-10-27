from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

FloatArray = NDArray[np.float64]


@dataclass(frozen=True)
class EpisodeSignals:
    """An Episode's robot data, one row per frame."""

    episode_index: int
    fps: float
    timestamps: FloatArray
    position: FloatArray  # end-effector xyz in metres, shape (n, 3)
    gripper: FloatArray  # 0 = open, 1 = closed
    success_label: bool  # the dataset's own outcome label

    @property
    def duration_s(self) -> float:
        return float(self.timestamps[-1] - self.timestamps[0]) if len(self.timestamps) else 0.0
