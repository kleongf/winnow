"""The network edge of `meta/`: everything above it is testable without the Meta API."""

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from winnow.meta.models import MetaContent


@dataclass(frozen=True)
class Reply:
    text: str
    usage: dict[str, int]  # input_tokens, output_tokens, cached_tokens, video_frames_processed


class TransientError(RuntimeError):
    """A 429, a 5xx, or a dropped connection: worth retrying."""


class FileGoneError(RuntimeError):
    """The server no longer has a file we uploaded earlier."""


class Transport(Protocol):
    async def upload(self, path: Path) -> str: ...

    async def count_tokens(self, model: str, content: MetaContent) -> int: ...

    async def respond(
        self, model: str, content: MetaContent, options: dict[str, object]
    ) -> Reply: ...
