"""Meta Model API client: cached, rate-limited, budget-checked, cost-logged SAM and Spark calls."""

import asyncio
import base64
import random
import sqlite3
import time
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from pathlib import Path

from winnow.core.settings import Settings
from winnow.meta.cache import CachedReply, MetaCache, file_sha256, request_key
from winnow.meta.costs import CostEntry, CostLog
from winnow.meta.limits import DEFAULT_LIMITS, Clock, Limit, Limiter, Sleep
from winnow.meta.models import (
    Image,
    MetaContent,
    Part,
    SamCall,
    SamRequest,
    SparkCall,
    SparkRequest,
    Text,
    Video,
)
from winnow.meta.openai_transport import OpenAITransport
from winnow.meta.pricing import SAM, sam_cost, spark_cost
from winnow.meta.transport import FileGoneError, Reply, TransientError, Transport

# The token-count endpoint counts a referenced video as ~1 token, so the budget check assumes
# this many per video part until real usage comes back.
ASSUMED_TOKENS_PER_VIDEO = 100_000
ATTEMPTS = 3  # for 429s, 5xx and dropped connections
BACKOFF_S = 2.0  # first retry waits 2-4 s, the second 4-8 s


class IncompleteReplyError(RuntimeError):
    """The model stopped before finishing (e.g. at the token cap). Paid for, never cached, so
    running again retries it."""


Estimate = Callable[[MetaContent], Awaitable[float]]
Price = Callable[[Reply], float]


@dataclass(frozen=True)
class _Request:
    """One call in transport terms, plus how to estimate and price it."""

    model: str
    purpose: str
    parts: tuple[Part, ...]
    options: dict[str, object]
    estimate: Estimate
    price: Price
    sample: int = 0

    @property
    def key(self) -> str:
        return request_key(self.model, self.parts, self.options, self.sample)


@dataclass(frozen=True)
class _Outcome:
    reply: Reply
    usd: float  # charged now: 0 for a cache hit
    latency_s: float
    cached: bool


class MetaClient:
    def __init__(
        self,
        transport: Transport,
        db: sqlite3.Connection,
        costs: CostLog,
        limits: Mapping[str, Limit] = DEFAULT_LIMITS,
        clock: Clock = time.monotonic,
        sleep: Sleep = asyncio.sleep,
    ) -> None:
        self._transport = transport
        self._cache = MetaCache(db)
        self.costs = costs
        self._limiters = {model: Limiter(limit, clock, sleep) for model, limit in limits.items()}
        self._pending: dict[str, asyncio.Task[_Outcome]] = {}
        self._clock = clock
        self._sleep = sleep

    @classmethod
    def from_settings(cls, settings: Settings, db: sqlite3.Connection) -> "MetaClient":
        if settings.model_api_key is None:
            raise RuntimeError("MODEL_API_KEY is not set; add it to .env")
        transport = OpenAITransport(
            settings.meta_base_url, settings.model_api_key.get_secret_value()
        )
        costs = CostLog(settings.cost_log_path, settings.meta_budget_usd)
        return cls(transport, db, costs)

    async def sam_track(self, request: SamRequest) -> SamCall:
        parts = (Text(request.prompt), Video(request.video))
        options: dict[str, object] = {"metadata": dict(request.metadata)}

        async def estimate(_: MetaContent) -> float:
            return sam_cost(request.frames)

        def price(reply: Reply) -> float:
            return sam_cost(reply.usage.get("video_frames_processed", request.frames))

        outcome = await self._call(_Request(SAM, request.purpose, parts, options, estimate, price))
        frames = outcome.reply.usage.get("video_frames_processed", request.frames)
        return SamCall(outcome.reply.text, frames, outcome.usd, outcome.latency_s, outcome.cached)

    async def spark(self, request: SparkRequest) -> SparkCall:
        options: dict[str, object] = {
            "reasoning": {"effort": request.effort},
            "max_output_tokens": request.max_output_tokens,
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": request.schema_name,
                    "schema": request.schema,
                }
            },
        }

        async def estimate(content: MetaContent) -> float:
            videos = sum(1 for p in request.parts if isinstance(p, Video))
            tokens = await self._transport.count_tokens(request.model, content)
            tokens += videos * ASSUMED_TOKENS_PER_VIDEO
            return spark_cost(request.model, tokens, request.max_output_tokens)

        def price(reply: Reply) -> float:
            usage = reply.usage
            return spark_cost(
                request.model,
                usage.get("input_tokens", 0),
                usage.get("output_tokens", 0),
                usage.get("cached_tokens", 0),
            )

        call = _Request(
            request.model, request.purpose, request.parts, options, estimate, price, request.sample
        )
        outcome = await self._call(call)
        usage = outcome.reply.usage
        return SparkCall(
            outcome.reply.text,
            usage.get("input_tokens", 0),
            usage.get("output_tokens", 0),
            outcome.usd,
            outcome.latency_s,
            outcome.cached,
        )

    async def _call(self, call: _Request) -> _Outcome:
        key = call.key
        hit = self._cache.get(key)
        if hit is not None:
            self._record_hit(hit, call.purpose)
            return _Outcome(hit.reply, 0.0, 0.0, cached=True)
        pending = self._pending.get(key)
        if pending is not None:  # the same request is already in flight: share its answer
            shared = await pending
            self._record_hit(CachedReply(key, call.model, shared.reply, shared.usd), call.purpose)
            return _Outcome(shared.reply, 0.0, 0.0, cached=True)
        task = asyncio.ensure_future(self._miss(key, call))
        self._pending[key] = task
        task.add_done_callback(lambda _: self._pending.pop(key, None))
        return await task

    async def _miss(self, key: str, call: _Request) -> _Outcome:
        content = await self._content(call.parts)
        with self.costs.reserve(await call.estimate(content)):
            started = self._clock()
            try:
                reply = await self._respond(call.model, content, call.options)
            except FileGoneError:  # uploads expire server-side: upload again, once
                self._forget_uploads(call.parts)
                content = await self._content(call.parts)
                reply = await self._respond(call.model, content, call.options)
            latency = self._clock() - started
            usd = call.price(reply)
            self.costs.record(CostEntry(call.model, call.purpose, usd, latency, dict(reply.usage)))
            if reply.incomplete:
                raise IncompleteReplyError(f"{call.model} stopped early: {reply.incomplete}")
            self._cache.put(CachedReply(key, call.model, reply, usd))
        return _Outcome(reply, usd, latency, cached=False)

    async def _respond(self, model: str, content: MetaContent, options: dict[str, object]) -> Reply:
        for attempt in range(ATTEMPTS):
            try:
                async with self._limiter(model).slot():
                    return await self._transport.respond(model, content, options)
            except TransientError:
                if attempt == ATTEMPTS - 1:
                    raise
                await self._sleep(BACKOFF_S * 2**attempt * (1 + random.random()))
        raise AssertionError("unreachable")

    def _record_hit(self, hit: CachedReply, purpose: str) -> None:
        detail: dict[str, int | float | str] = {"cache": "hit", "original_usd": hit.usd}
        self.costs.record(CostEntry(hit.model, purpose, 0.0, 0.0, detail))

    def _limiter(self, model: str) -> Limiter:
        if model not in self._limiters:
            raise KeyError(f"No limit configured for {model}")
        return self._limiters[model]

    async def _content(self, parts: tuple[Part, ...]) -> MetaContent:
        return [await self._content_part(p) for p in parts]

    async def _content_part(self, part: Part) -> dict[str, object]:
        match part:
            case Text(text):
                return {"type": "input_text", "text": text}
            case Video(path):
                return {"type": "input_video", "file_id": await self._file_id(path)}
            case Image(path):
                mime = "image/png" if path.suffix == ".png" else "image/jpeg"
                data = base64.b64encode(path.read_bytes()).decode()
                return {"type": "input_image", "image_url": f"data:{mime};base64,{data}"}

    def _forget_uploads(self, parts: tuple[Part, ...]) -> None:
        for part in parts:
            if isinstance(part, Video):
                self._cache.forget_upload(file_sha256(part.path))

    async def _file_id(self, path: Path) -> str:
        sha = file_sha256(path)
        known = self._cache.upload_id(sha)
        if known is not None:
            return known
        file_id = await self._transport.upload(path)
        self._cache.remember_upload(sha, file_id)
        return file_id
