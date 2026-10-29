"""Per-primitive catalog metadata: what each primitive measures and how far to trust it.

Adding a primitive means a name here, its metadata below, and a measure function and English
template in `criteria.catalog`.
"""

from dataclasses import dataclass
from typing import Literal

Primitive = Literal["grasp_attempts", "longest_still_s"]
Kind = Literal["measured", "tracked", "visual"]


@dataclass(frozen=True)
class PrimitiveInfo:
    kind: Kind
    unit: str
    params: tuple[str, ...]  # the names a Criterion's `params` must have
    # A crisp fail of a conclusive primitive fails its Phrase on its own; an inconclusive one
    # (release_height_m, stacking) can only make it unsure.
    conclusive: bool
    noise_floor: float  # the smallest margin a measurement deserves, in `unit`


PRIMITIVES: dict[Primitive, PrimitiveInfo] = {
    "grasp_attempts": PrimitiveInfo("measured", "attempts", (), conclusive=True, noise_floor=0),
    "longest_still_s": PrimitiveInfo(
        "measured", "s", ("speed_below_m_s",), conclusive=True, noise_floor=0.2
    ),
}
