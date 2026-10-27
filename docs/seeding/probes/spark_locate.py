"""Spark standard vs contributor localization against hand-drawn boxes (320x180 frame, sent 3x upscaled)."""

import base64
import io
import json
import subprocess

import numpy as np
from PIL import Image

from winnow.core.settings import get_settings
from winnow.meta.client import MetaClient
from winnow.meta.pricing import SPARK_CONTRIBUTOR, SPARK_STANDARD

s = get_settings()
m = MetaClient(s)
H = s.data_dir / "droid_100" / "h264"
CASES = [  # episode, camera, frame, noun phrase, hand box
    (42, "exterior_image_1_left", 0, "the black TV remote control", (197, 132, 227, 164)),
    (42, "exterior_image_2_left", 0, "the black TV remote control", (217, 103, 241, 121)),
    (16, "exterior_image_1_left", 0, "the small blue object on the saucer", (214, 66, 222, 75)),
    (16, "exterior_image_2_left", 0, "the small blue object on the saucer", (137, 107, 157, 118)),
    (16, "wrist_image_left", 75, "the blue object", (176, 64, 212, 138)),
    (3, "exterior_image_1_left", 0, "the bag of chips", (177, 135, 202, 152)),
    (3, "exterior_image_1_left", 0, "the robot gripper's two fingers", (187, 47, 219, 81)),
]
SCHEMA = {"type": "object", "additionalProperties": False, "required": ["visible", "x_min", "y_min", "x_max", "y_max"],
          "properties": {"visible": {"type": "boolean"}, "x_min": {"type": "integer"}, "y_min": {"type": "integer"},
                         "x_max": {"type": "integer"}, "y_max": {"type": "integer"}}}


def frame_url(ep: int, cam: str, f: int) -> str:
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(H / cam / f"episode_{ep:06d}.mp4"), "-vf",
                          f"select=eq(n\\,{f})", "-vframes", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True, check=True).stdout
    img = Image.fromarray(np.frombuffer(raw, np.uint8).reshape(180, 320, 3)).resize((960, 540), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def iou(a, b) -> float:
    w = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    h = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - w * h
    return w * h / union if union else 0.0


rows = []
for ep, cam, f, noun, hand in CASES:
    url = frame_url(ep, cam, f)
    prompt = (f"This image is 960x540 pixels. Give a tight bounding box around {noun}, in pixel coordinates "
              "(x from the left edge, y from the top edge). Box only that object, not anything holding or under it.")
    for model in (SPARK_STANDARD, SPARK_CONTRIBUTOR):
        r = m.spark(model, [{"type": "input_text", "text": prompt}, {"type": "input_image", "image_url": url}],
                    f"seeding:locate:ep{ep}", SCHEMA, effort="high", max_output_tokens=6000)
        o = json.loads(r.text)
        box = tuple(round(o[k] / 3) for k in ("x_min", "y_min", "x_max", "y_max"))
        row = dict(ep=ep, cam=cam[:10], frame=f, noun=noun, model=model, hand=hand, spark=box,
                   iou=round(iou(hand, box), 2), usd=round(r.usd, 4), latency_s=round(r.latency_s, 1))
        rows.append(row)
        print(json.dumps(row))
(s.data_dir / "seeding" / "locate.json").write_text(json.dumps(rows, indent=1))
print("total spent $", round(m.costs.spent_usd(), 4))
