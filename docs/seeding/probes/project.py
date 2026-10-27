"""project.py <ep> <cam> <fx> <frames> [offsets_m]: overlay the projected end effector (and points down the tool axis)."""

import json
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = "/Users/kevin/VisualStudioProjects/winnow/data/droid_1.0.1/episodes"


def euler_xyz(r: np.ndarray) -> np.ndarray:
    """Extrinsic x-y-z Euler (scipy 'xyz'): R = Rz @ Ry @ Rx."""
    cx, cy, cz = np.cos(r)
    sx, sy, sz = np.sin(r)
    rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return rz @ ry @ rx


def project(points: np.ndarray, extr: np.ndarray, fx: float, cx: float = 160, cy: float = 90) -> np.ndarray:
    rot, t = euler_xyz(extr[3:]), extr[:3]
    cam = (points - t) @ rot  # == R^T (p - t) for each row
    return np.stack([fx * cam[:, 0] / cam[:, 2] + cx, fx * cam[:, 1] / cam[:, 2] + cy, cam[:, 2]], axis=1)


def tool_points(pose: np.ndarray, offsets: list[float]) -> np.ndarray:
    rot = euler_xyz(pose[3:])
    return np.array([pose[:3] + rot[:, 2] * o for o in offsets])


if __name__ == "__main__":
    ep, cam, fx = int(sys.argv[1]), sys.argv[2], float(sys.argv[3])
    frames = [int(x) for x in sys.argv[4].split(",")]
    offsets = [float(x) for x in sys.argv[5].split(",")] if len(sys.argv) > 5 else [0.0, 0.05, 0.10, 0.15]
    rows = json.load(open(f"{ROOT}/ep{ep}.json"))
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", f"{ROOT}/ep{ep}_{cam}.mp4", "-f", "rawvideo",
                          "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    video = np.frombuffer(raw, np.uint8).reshape(-1, 180, 320, 3)
    colors = [(255, 0, 0), (255, 160, 0), (0, 255, 0), (0, 200, 255), (255, 0, 255)]
    tiles = []
    for f in frames:
        r = rows[f]
        pts = project(tool_points(np.array(r["observation.state.cartesian_position"]), offsets),
                      np.array(r[f"camera_extrinsics.{cam}"]), fx)
        img = Image.fromarray(video[f]).resize((640, 360))
        d = ImageDraw.Draw(img)
        for (u, v, z), c in zip(pts, colors):
            d.ellipse([u * 2 - 5, v * 2 - 5, u * 2 + 5, v * 2 + 5], outline=c, width=2)
        d.text((4, 4), f"f{f} g={r['observation.state.gripper_position']:.2f}", fill=(255, 255, 0))
        tiles.append(np.asarray(img))
    while len(tiles) % 4:
        tiles.append(np.zeros_like(tiles[0]))
    grid = np.vstack([np.hstack(tiles[i:i + 4]) for i in range(0, len(tiles), 4)])
    out = f"{ROOT}/proj_ep{ep}_{cam}_fx{int(fx)}.jpg"
    Image.fromarray(grid).save(out, quality=85)
    print(out)
