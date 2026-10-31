"""The replay transport, watched: what reaches it, so a test can assert which calls were made."""

from dataclasses import dataclass, field
from pathlib import Path

from tests.meta.fakes import NoTranscribe
from winnow.meta.models import MetaContent
from winnow.meta.replay import ReplayTransport
from winnow.meta.transport import Reply


@dataclass
class CountingReplay(NoTranscribe):
    """The replay transport, counting every call that reaches it and keeping each compile
    request's text."""

    replay: ReplayTransport
    calls: int = 0
    compiles: list[list[str]] = field(default_factory=list[list[str]])

    async def upload(self, path: Path) -> str:
        self.calls += 1
        return await self.replay.upload(path)

    async def count_tokens(self, model: str, content: MetaContent) -> int:
        self.calls += 1
        return await self.replay.count_tokens(model, content)

    async def respond(self, model: str, content: MetaContent, options: dict[str, object]) -> Reply:
        self.calls += 1
        text_format = options.get("text")
        if isinstance(text_format, dict) and text_format["format"]["name"] == "rubric":
            self.compiles.append([str(part["text"]) for part in content if "text" in part])
        return await self.replay.respond(model, content, options)
