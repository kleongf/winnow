"""Recorded Meta responses for tests and CI, which never call the Meta API.

Record by running the real pipeline once, then `export_recordings` the cache to a fixture file.
Tests `load_recordings` it into a fresh cache and use `OfflineTransport`, so a recorded request
is a cache hit and anything else fails loudly instead of reaching the network.
"""

import json
import sqlite3
from pathlib import Path

from winnow.meta.cache import CachedReply, MetaCache
from winnow.meta.models import MetaContent
from winnow.meta.transport import Reply


class UnrecordedCallError(RuntimeError):
    pass


def _unrecorded(model: str, content: MetaContent) -> UnrecordedCallError:
    texts = [str(part["text"])[:200] for part in content if part.get("type") == "input_text"]
    return UnrecordedCallError(
        f"No recorded {model} response for {texts}. Make the call for real once, then "
        "export_recordings into the fixture file."
    )


class OfflineTransport:
    async def upload(self, path: Path) -> str:
        raise UnrecordedCallError(f"Upload of {path.name} attempted offline")

    async def count_tokens(self, model: str, content: MetaContent) -> int:
        raise _unrecorded(model, content)

    async def respond(self, model: str, content: MetaContent, options: dict[str, object]) -> Reply:
        raise _unrecorded(model, content)


def export_recordings(db: sqlite3.Connection, path: Path) -> int:
    """Write every cached response as one JSON line; returns how many."""
    entries = list(MetaCache(db).entries())
    lines = [
        json.dumps(
            {
                "key": e.key,
                "model": e.model,
                "text": e.reply.text,
                "usage": e.reply.usage,
                "usd": e.usd,
            }
        )
        for e in entries
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(line + "\n" for line in lines))
    return len(lines)


def load_recordings(db: sqlite3.Connection, path: Path) -> int:
    cache = MetaCache(db)
    count = 0
    for line in path.read_text().splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        usage = {str(k): int(v) for k, v in row["usage"].items()}
        reply = Reply(str(row["text"]), usage)
        cache.put(CachedReply(str(row["key"]), str(row["model"]), reply, float(row["usd"])))
        count += 1
    return count
