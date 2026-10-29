"""Where Episodes come from: one adapter per dataset, all yielding the same Episode shape."""

from pathlib import Path
from typing import Protocol

from winnow.core.settings import Settings
from winnow.episodes import droid100
from winnow.episodes.models import SourceEpisode


class Source(Protocol):
    name: str
    cameras: tuple[str, ...]

    def load(self, index: int) -> SourceEpisode: ...

    def clip(self, index: int, camera: str) -> Path: ...


def sources_from(settings: Settings) -> dict[str, Source]:
    root = settings.droid100_root
    fetch = (
        droid100.local_fetch(root)
        if root is not None
        else droid100.hub_fetch(settings.data_dir / "droid_100")
    )
    return {droid100.NAME: droid100.Droid100(fetch)}
