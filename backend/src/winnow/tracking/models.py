from typing import Literal

from pydantic import BaseModel

TrackKind = Literal["wrist"]  # "exterior" arrives with the hand-drawn-box track


class TrackBox(BaseModel):
    """SAM's box on one frame of the 5 fps clip, in that clip's pixels (half-open bounds)."""

    frame: int
    left: float
    top: float
    right: float
    bottom: float


class TrackHealth(BaseModel):
    """Signs SAM lost the object, recomputed on every read. SAM's confidence is never used."""

    area_jumps: list[int]  # frames whose box area is over 4x the track's median
    centre_jumps: list[int]  # frames whose centre moved over one box-width from the frame before
    missing_fraction: float  # share of frames with no box
    lost: bool  # any area or centre jump, or no box on over 20% of frames


class Track(BaseModel):
    episode_id: str
    kind: TrackKind
    camera: str
    # "no_closure": the gripper never closed, so there was nothing to seed; recorded, not failed
    status: Literal["tracked", "no_closure"]
    fps: float
    frames: int  # in the 5 fps clip
    width: int
    height: int
    seed_frame: int | None
    boxes: list[TrackBox]
    health: TrackHealth | None  # None without a track
