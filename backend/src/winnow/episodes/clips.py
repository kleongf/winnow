"""Video conversions with ffmpeg: H.264 for Spark and the browser, 5 fps for SAM."""

import subprocess
from pathlib import Path

SAM_FPS = 5


def _ffmpeg(*args: str) -> None:
    result = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", *args], capture_output=True, text=True, check=False
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr.strip() or result.returncode}")


def _encode(source: Path, out: Path, *filters: str) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    partial = out.with_suffix(".partial.mp4")  # never leave a half-written clip under its name
    _ffmpeg(
        "-i", str(source), *filters,
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
        str(partial),
    )  # fmt: skip
    partial.replace(out)


def to_h264(source: Path, out: Path) -> None:
    _encode(source, out)


def to_sam_fps(source: Path, out: Path) -> None:
    _encode(source, out, "-vf", f"fps={SAM_FPS}")


def first_frame(clip: Path, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    partial = out.with_suffix(".partial.jpg")
    _ffmpeg("-i", str(clip), "-frames:v", "1", "-q:v", "2", str(partial))
    partial.replace(out)
