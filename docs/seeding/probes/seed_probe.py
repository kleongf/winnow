"""seed_probe.py clip|seed_frame|box:l,t,r,b or point:x,y[;x,y]|direction|stride|tag ...  (SAM on any clip)"""
import json, subprocess, sys, time
from collections import Counter
from pathlib import Path
from meta_sam_parser import FramePrompt, PromptBox, PromptObject, PromptPoint, build_object_prompt
from winnow.core.settings import get_settings
from winnow.meta.client import MetaClient, _as_input
from winnow.meta.costs import CostEntry
from winnow.meta.pricing import SAM, sam_cost
from winnow.tracking.sam_output import parse_boxes
s = get_settings(); m = MetaClient(s)
out_dir = s.data_dir / "seeding" / "sam"; out_dir.mkdir(parents=True, exist_ok=True)

def nframes(p: Path) -> int:
    return int(subprocess.run(["ffprobe","-v","error","-count_frames","-select_streams","v:0","-show_entries","stream=nb_read_frames","-of","csv=p=0",str(p)],capture_output=True,text=True).stdout.strip())

def strided(clip: Path, stride: int) -> Path:
    if stride == 1: return clip
    out = s.data_dir / "seeding" / "clips" / f"{clip.parent.name}_{clip.stem}_s{stride}.mp4"; out.parent.mkdir(parents=True, exist_ok=True)
    if not out.exists():
        subprocess.run(["ffmpeg","-loglevel","error","-y","-i",str(clip),"-vf",f"select=not(mod(n\\,{stride})),setpts=N/({15/stride}*TB)","-r",str(15/stride),"-c:v","libx264","-pix_fmt","yuv420p",str(out)],check=True)
    return out

for arg in sys.argv[1:]:
    clip_s, seed_s, prompt_s, direction, stride_s, tag = arg.split("|")
    stride = int(stride_s); clip = strided(Path(clip_s), stride); n = nframes(clip); seed = int(seed_s) // stride
    kind, coords = prompt_s.split(":")
    if kind == "box":
        l, t, r, b = (round(float(v)) for v in coords.split(","))
        fp = FramePrompt(frame=seed, box=PromptBox(left=l, top=t, right=r, bottom=b))
    else:
        fp = FramePrompt(frame=seed, points=[PromptPoint(x=abs(round(float(p.split(",")[0]))), y=round(float(p.split(",")[1])), label="negative" if p.startswith("-") else "positive") for p in coords.split(";")])
    prompt = build_object_prompt(size=(320, 180), objects=[PromptObject(id=1, prompts=[fp])])
    m.costs.ensure_affordable(sam_cost(n)); started = time.monotonic(); fid = m.upload(clip)
    with m._openai.responses.stream(model=SAM, input=_as_input([{"type":"input_text","text":prompt},{"type":"input_video","file_id":fid}]),
            extra_body={"metadata":{"include_confidence":"true","propagation_direction":direction}}) as stream:
        final = stream.get_final_response()
    latency = time.monotonic() - started; usage = final.usage.model_dump() if final.usage else {}
    processed = int(usage.get("video_frames_processed") or n); usd = sam_cost(processed)
    m.costs.record(CostEntry(SAM, f"seeding:{tag}", usd, latency, {"frames": processed, "prompt": prompt[:80]}))
    (out_dir / f"{tag}.txt").write_text(final.output_text)
    boxes = parse_boxes(final.output_text); frames = {bx.frame for bx in boxes}
    confs = [bx.confidence for bx in boxes if bx.confidence is not None]
    row = dict(tag=tag, frames=n, tracked=len(frames), ids=dict(Counter(bx.object_id for bx in boxes)), mean_conf=round(sum(confs)/max(len(confs),1),2), usd=round(usd,4), latency_s=round(latency,1))
    print(json.dumps(row))
    with (s.data_dir / "seeding" / "results.jsonl").open("a") as f: f.write(json.dumps(row) + "\n")
print("total spent $", round(m.costs.spent_usd(), 4))
