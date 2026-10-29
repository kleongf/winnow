"""`winnow`: the pipeline from the command line, for bulk precompute without the browser.

winnow ingest droid_100 3 16 42
winnow fixtures <dir> [--episodes N]
"""

import argparse
import asyncio
import sys
from pathlib import Path

from winnow.core.context import AppContext, build_context
from winnow.core.settings import Settings, get_settings
from winnow.episodes.fixtures import write_fixture_source
from winnow.episodes.service import ingest_items


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="winnow")
    commands = parser.add_subparsers(dest="command", required=True)
    ingest = commands.add_parser("ingest", help="ingest Episodes into the Dataset")
    ingest.add_argument("source", choices=["droid_100"])
    ingest.add_argument("indices", nargs="+", type=int)
    fixtures = commands.add_parser("fixtures", help="write synthetic droid_100-layout Episodes")
    fixtures.add_argument("root", type=Path)
    fixtures.add_argument("--episodes", type=int, default=3)
    return parser


async def _ingest(ctx: AppContext, source: str, indices: list[int]) -> int:
    job_id = ctx.jobs.create("ingest", ingest_items(source, indices))
    await ctx.runner.run(job_id)
    job = ctx.jobs.get(job_id)
    assert job is not None
    for item in job.items:
        note = f" ({item.detail})" if item.detail else ""
        sys.stdout.write(f"{item.label}: {item.status}{note}\n")
    sys.stdout.write(f"job {job_id}: {job.done} done, {job.failed} failed\n")
    return 1 if job.failed else 0


def main(argv: list[str] | None = None, settings: Settings | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.command == "fixtures":
        write_fixture_source(args.root, episodes=args.episodes)
        sys.stdout.write(f"wrote {args.episodes} fixture Episodes to {args.root}\n")
        return 0
    ctx = build_context(settings or get_settings())
    try:
        return asyncio.run(_ingest(ctx, args.source, args.indices))
    finally:
        ctx.db.close()


if __name__ == "__main__":
    sys.exit(main())
