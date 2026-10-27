"""Fail if any source file grows past the line limit, so god files can't form."""

import subprocess
import sys
from pathlib import Path

SOURCE_LIMIT = 300
TEST_LIMIT = 500
EXTENSIONS = {".py", ".ts", ".tsx", ".js", ".sh"}
GENERATED = {"frontend/src/api/schema.ts"}


def is_test(path: str) -> bool:
    name = Path(path).name
    return path.startswith(("backend/tests/", "e2e/")) or ".test." in name or name.startswith("test_")


def main() -> int:
    tracked = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
        capture_output=True, text=True, check=True,
    ).stdout.splitlines()
    failures: list[str] = []
    for path in tracked:
        if Path(path).suffix not in EXTENSIONS or path in GENERATED or not Path(path).exists():
            continue
        limit = TEST_LIMIT if is_test(path) else SOURCE_LIMIT
        lines = len(Path(path).read_text().splitlines())
        if lines > limit:
            failures.append(f"{path}: {lines} lines (limit {limit}); split it up")
    for failure in failures:
        sys.stderr.write(failure + "\n")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
