"""The real transport: Meta's OpenAI-compatible Responses API, via the async OpenAI SDK."""

from pathlib import Path
from typing import cast

import openai
from openai import AsyncOpenAI
from openai.types.responses import Response, ResponseInputParam

from winnow.meta.models import MetaContent
from winnow.meta.pricing import SAM
from winnow.meta.transport import FileGoneError, Reply, TransientError


def _as_input(content: MetaContent) -> ResponseInputParam:
    return cast(ResponseInputParam, [{"type": "message", "role": "user", "content": content}])


def _usage(response: Response) -> dict[str, int]:
    """Flatten usage, keeping SAM's extra `video_frames_processed` field."""
    if response.usage is None:
        return {}
    raw: dict[str, object] = response.usage.model_dump()
    usage = {k: int(v) for k, v in raw.items() if isinstance(v, int | float)}
    # SAM's usage may come without token details; the SDK doesn't validate responses.
    details = getattr(response.usage, "input_tokens_details", None)
    usage["cached_tokens"] = details.cached_tokens if details is not None else 0
    return usage


def _is_file_gone(error: openai.APIStatusError) -> bool:
    return error.status_code in (400, 404) and "file" in str(error.message).lower()


class OpenAITransport:
    def __init__(self, base_url: str, api_key: str) -> None:
        # Retries are the client's job, so they share its backoff and budget handling.
        self._openai = AsyncOpenAI(base_url=base_url, api_key=api_key, max_retries=0)

    async def upload(self, path: Path) -> str:
        with path.open("rb") as f:
            return (await self._openai.files.create(purpose="user_data", file=f)).id

    async def count_tokens(self, model: str, content: MetaContent) -> int:
        counted = await self._openai.responses.input_tokens.count(
            model=model, input=_as_input(content)
        )
        return counted.input_tokens

    async def respond(self, model: str, content: MetaContent, options: dict[str, object]) -> Reply:
        try:
            response = await self._send(model, content, options)
        except openai.APIConnectionError as e:
            raise TransientError(str(e)) from e
        except openai.APIStatusError as e:
            if e.status_code == 429 or e.status_code >= 500:
                raise TransientError(f"{e.status_code}: {e.message}") from e
            if _is_file_gone(e):
                raise FileGoneError(e.message) from e
            raise
        return Reply(response.output_text, _usage(response))

    async def _send(self, model: str, content: MetaContent, options: dict[str, object]) -> Response:
        # Options go in the body as-is: Meta's fields (SAM metadata) aren't in the SDK's types.
        if model == SAM:  # SAM answers long tracks as a stream
            async with self._openai.responses.stream(
                model=model, input=_as_input(content), extra_body=options
            ) as stream:
                return await stream.get_final_response()
        return await self._openai.responses.create(
            model=model, input=_as_input(content), extra_body=options
        )
