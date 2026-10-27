"""Meta Model API client: budget-checked, cost-logged SAM 3.1 and Spark calls."""

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, cast

from openai import OpenAI
from openai.types.responses import ResponseInputParam

from winnow.core.settings import Settings
from winnow.meta.costs import CostEntry, CostLog
from winnow.meta.pricing import SAM, sam_cost, spark_cost

# Meta extends the Responses API with content types the OpenAI SDK doesn't type (input_video).
MetaContent = list[dict[str, object]]
Effort = Literal["minimal", "low", "medium", "high", "xhigh", "max"]
# The token-count endpoint counts a referenced video as ~1 token, so the budget check assumes
# this many per video part until real usage comes back.
ASSUMED_TOKENS_PER_VIDEO = 100_000


@dataclass(frozen=True)
class SamCall:
    text: str
    frames_processed: int
    usd: float
    latency_s: float


@dataclass(frozen=True)
class SparkCall:
    text: str
    input_tokens: int
    output_tokens: int
    usd: float
    latency_s: float


def _as_input(content: MetaContent) -> ResponseInputParam:
    return cast(ResponseInputParam, [{"type": "message", "role": "user", "content": content}])


class MetaClient:
    def __init__(self, settings: Settings) -> None:
        if settings.model_api_key is None:
            raise RuntimeError("MODEL_API_KEY is not set; add it to .env")
        self._openai = OpenAI(
            base_url=settings.meta_base_url, api_key=settings.model_api_key.get_secret_value()
        )
        self.costs = CostLog(settings.data_dir / "meta_costs.jsonl", settings.meta_budget_usd)

    def upload(self, path: Path) -> str:
        with path.open("rb") as f:
            return self._openai.files.create(purpose="user_data", file=f).id

    def sam_track(self, file_id: str, prompt: str, frames: int, purpose: str) -> SamCall:
        """Track through one video from a noun phrase or a box/point prompt.

        `frames` is the clip's frame count and bounds the cost check.
        """
        self.costs.ensure_affordable(sam_cost(frames))
        content: MetaContent = [
            {"type": "input_text", "text": prompt},
            {"type": "input_video", "file_id": file_id},
        ]
        started = time.monotonic()
        with self._openai.responses.stream(
            model=SAM,
            input=_as_input(content),
            extra_body={
                "metadata": {"include_confidence": "true", "propagation_direction": "forward"}
            },
        ) as stream:
            final = stream.get_final_response()
        latency = time.monotonic() - started
        usage = final.usage.model_dump() if final.usage else {}
        processed = int(usage.get("video_frames_processed") or frames)
        usd = sam_cost(processed)
        self.costs.record(
            CostEntry(SAM, purpose, usd, latency, {"frames": processed, "prompt": prompt[:80]})
        )
        return SamCall(final.output_text, processed, usd, latency)

    def count_input_tokens(self, model: str, content: MetaContent) -> int:
        return self._openai.responses.input_tokens.count(
            model=model, input=_as_input(content)
        ).input_tokens

    def spark(
        self,
        model: str,
        content: MetaContent,
        purpose: str,
        schema: dict[str, object],
        effort: Effort = "medium",
        max_output_tokens: int = 4000,
    ) -> SparkCall:
        videos = sum(1 for part in content if part.get("type") in ("input_video", "input_file"))
        input_tokens = self.count_input_tokens(model, content) + videos * ASSUMED_TOKENS_PER_VIDEO
        self.costs.ensure_affordable(spark_cost(model, input_tokens, max_output_tokens))
        started = time.monotonic()
        response = self._openai.responses.create(
            model=model,
            input=_as_input(content),
            reasoning={"effort": effort},
            max_output_tokens=max_output_tokens,
            text={"format": {"type": "json_schema", "name": "answer", "schema": schema}},
        )
        latency = time.monotonic() - started
        usage = response.usage
        used_in = usage.input_tokens if usage else input_tokens
        used_out = usage.output_tokens if usage else max_output_tokens
        cached = usage.input_tokens_details.cached_tokens if usage else 0
        usd = spark_cost(model, used_in, used_out, cached)
        detail: dict[str, int | float | str] = {"input_tokens": used_in, "output_tokens": used_out}
        self.costs.record(CostEntry(model, purpose, usd, latency, detail))
        return SparkCall(response.output_text, used_in, used_out, usd, latency)
