"""view_probe.py ep,camera,seed_frame,l,t,r,b,direction,stride,tag ...

Box-prompt SAM on one camera of a droid_100 Episode, seeded on any frame, optionally at 15/stride fps.
camera: ext1 | ext2 | wrist. direction: forward | backward | both.
"""

import json
import subprocess
import sys
import time
from collections import Counter
from pathlib import Path

from meta_sam_parser import FramePrompt, PromptBox, PromptObject, build_object_prompt
from winnow.core.settings import get_settings
from winnow.episodes.droid100 import h264_clip, load_signals
from winnow.meta.client import MetaClient, _as_input
from winnow.meta.costs import CostEntry
from winnow.meta.pricing import SAM, sam_cost
from winnow.tracking.sam_output import parse_boxes

CAMS = {"ext1": "exterior_image_1_left", "ext2": "exterior_image_2_left", "wrist": "wrist_image_left"}
s = get_settings()
d = s.data_dir / "droid_100"
m = MetaClient(s)
out_dir = s.data_dir / "seeding" / "sam"
out_dir.mkdir(parents=True, exist_ok=True)


def strided(clip: Path, stride: int) -> Path:
    if stride == 1:
        return clip
    out = clip.with_name(clip.stem + f"_s{stride}.mp4")
    if not out.exists():
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(clip), "-vf",
                        f"select=not(mod(n\\,{stride})),setpts=N/({15 / stride}*TB)", "-r", str(15 / stride),
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", str(out)], check=True)
    return out


def track(clip: Path, prompt: str, frames: int, direction: str, purpose: str):
    m.costs.ensure_affordable(sam_cost(frames))
    started = time.monotonic()
    fid = m.upload(clip)
    with m._openai.responses.stream(  # pyright: ignore[reportPrivateUsage]
        model=SAM, input=_as_input([{"type": "input_text", "text": prompt}, {"type": "input_video", "file_id": fid}]),
        extra_body={"metadata": {"include_confidence": "true", "propagation_direction": direction}},
    ) as stream:
        final = stream.get_final_response()
    latency = time.monotonic() - started
    usage = final.usage.model_dump() if final.usage else {}
    processed = int(usage.get("video_frames_processed") or frames)
    usd = sam_cost(processed)
    m.costs.record(CostEntry(SAM, purpose, usd, latency, {"frames": processed, "prompt": prompt[:80]}))
    return final.output_text, processed, usd, latency


rows = []
for arg in sys.argv[1:]:
    ep_s, cam, seed_s, l, t, r, b, direction, stride_s, tag = arg.split(",")
    ep, seed, stride = int(ep_s), int(seed_s), int(stride_s)
    n_full = len(load_signals(ep, d).timestamps)
    clip = strided(h264_clip(ep, CAMS[cam], d), stride)
    n = len(range(0, n_full, stride))
    box = PromptBox(left=round(float(l)), top=round(float(t)), right=round(float(r)), bottom=round(float(b)))
    prompt = build_object_prompt(size=(320, 180), objects=[PromptObject(id=1, prompts=[FramePrompt(frame=seed // stride, box=box)])])
    text, processed, usd, latency = track(clip, prompt, n, direction, f"seeding:{tag}")
    (out_dir / f"{tag}.txt").write_text(text)
    boxes = parse_boxes(text)
    frames = sorted({bx.frame for bx in boxes})
    confs = [bx.confidence for bx in boxes if bx.confidence is not None]
    missing = [f for f in range(n) if f not in set(frames)]
    row = dict(tag=tag, ep=ep, cam=cam, seed=seed, stride=stride, direction=direction, frames=n, processed=processed,
               tracked=len(frames), ids=dict(Counter(bx.object_id for bx in boxes)),
               mean_conf=round(sum(confs) / max(len(confs), 1), 2), min_conf=round(min(confs, default=0), 2),
               usd=round(usd, 4), latency_s=round(latency, 1),
               first_missing=[f * stride for f in missing[:10]], n_missing=len(missing))
    rows.append(row)
    print(json.dumps(row))
with (s.data_dir / "seeding" / "results.jsonl").open("a") as f:
    for row in rows:
        f.write(json.dumps(row) + "\n")
print("total spent $", round(m.costs.spent_usd(), 4))
