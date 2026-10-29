"""A scripted stand-in for the Meta API, so client tests never touch the network."""

import asyncio
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

from winnow.meta.client import MetaClient
from winnow.meta.models import MetaContent
from winnow.meta.transport import Reply


@dataclass
class FakeTransport:
    """Answers every call with `reply`, unless `script` has an exception or reply queued first."""

    reply: Reply = field(default_factory=lambda: Reply('{"ok": true}', {"input_tokens": 1000}))
    script: list[Reply | Exception] = field(default_factory=list[Reply | Exception])
    gate: asyncio.Event | None = None  # when set, calls wait for it, to hold them in flight
    calls: list[tuple[str, MetaContent]] = field(default_factory=list[tuple[str, MetaContent]])
    uploads: list[Path] = field(default_factory=list[Path])
    in_flight: int = 0
    max_in_flight: int = 0

    async def upload(self, path: Path) -> str:
        self.uploads.append(path)
        return f"file-{len(self.uploads)}"

    async def count_tokens(self, model: str, content: MetaContent) -> int:
        return 1000

    async def respond(self, model: str, content: MetaContent, options: dict[str, object]) -> Reply:
        self.calls.append((model, content))
        self.in_flight += 1
        self.max_in_flight = max(self.max_in_flight, self.in_flight)
        try:
            if self.gate is not None:
                await self.gate.wait()
            else:
                await asyncio.sleep(0)
            step = self.script.pop(0) if self.script else self.reply
            if isinstance(step, Exception):
                raise step
            return step
        finally:
            self.in_flight -= 1


@dataclass
class FakeTime:
    """A clock that only moves when the client sleeps."""

    now: float = 0.0
    slept: list[float] = field(default_factory=list[float])

    def clock(self) -> float:
        return self.now

    async def sleep(self, seconds: float) -> None:
        self.slept.append(seconds)
        self.now += seconds
        await asyncio.sleep(0)


MakeClient = Callable[..., MetaClient]
