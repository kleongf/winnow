"""sheet.py <tag> <clip.mp4> <stride> <frame,frame,...> [gain]: contact sheet of SAM boxes on chosen frames."""

import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from winnow.tracking.sam_output import parse_boxes

tag, clip, stride, frames = sys.argv[1], sys.argv[2], int(sys.argv[3]), [int(x) for x in sys.argv[4].split(",")]
gain = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
root = Path("/Users/kevin/VisualStudioProjects/winnow/data/seeding")
boxes = {bx.frame: bx for bx in parse_boxes((root / "sam" / f"{tag}.txt").read_text())}
raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", clip, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                     capture_output=True, check=True).stdout
video = np.frombuffer(raw, np.uint8).reshape(-1, 180, 320, 3)
tiles = []
for f in frames:
    img = Image.fromarray(np.clip(video[f].astype(float) * gain, 0, 255).astype(np.uint8)).resize((640, 360))
    dr = ImageDraw.Draw(img)
    bx = boxes.get(f // stride)
    if bx:
        dr.rectangle([bx.left * 2, bx.top * 2, bx.right * 2, bx.bottom * 2], outline=(255, 0, 0), width=3)
        dr.text((6, 20), f"c={bx.confidence:.2f}", fill=(255, 255, 0))
    else:
        dr.text((6, 20), "no box", fill=(255, 80, 80))
    dr.text((6, 4), f"f{f} ({f / 15:.1f}s)", fill=(255, 255, 0))
    tiles.append(np.asarray(img))
cols = 4
while len(tiles) % cols:
    tiles.append(np.zeros_like(tiles[0]))
grid = np.vstack([np.hstack(tiles[i:i + cols]) for i in range(0, len(tiles), cols)])
out = root / "sheets" / f"{tag}.jpg"
out.parent.mkdir(parents=True, exist_ok=True)
Image.fromarray(grid).save(out, quality=85)
print(out)
