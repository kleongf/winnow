"""grid.py <mp4> <frame> <out.png> [box l,t,r,b ...]: frame upscaled 3x with a 20-px grid and optional boxes."""
import subprocess, sys
import numpy as np
from PIL import Image, ImageDraw
src, frame, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
raw = subprocess.run(["ffmpeg","-loglevel","error","-i",src,"-vf",f"select=eq(n\\,{frame})","-vframes","1","-f","rawvideo","-pix_fmt","rgb24","-"],capture_output=True,check=True).stdout
import os; gain=float(os.environ.get("GAIN","1")); img = Image.fromarray(np.clip(np.frombuffer(raw,np.uint8).reshape(180,320,3).astype(float)*gain,0,255).astype(np.uint8)).resize((960,540),Image.NEAREST)
d = ImageDraw.Draw(img)
for x in range(0,320,20):
    d.line([(x*3,0),(x*3,540)],fill=(255,255,0) if x%100==0 else (90,90,90)); d.text((x*3+1,1),str(x),fill=(255,255,0))
for y in range(0,180,20):
    d.line([(0,y*3),(960,y*3)],fill=(255,255,0) if y%100==0 else (90,90,90)); d.text((1,y*3+1),str(y),fill=(255,255,0))
for b in sys.argv[4:]:
    l,t,r,bt = map(float,b.split(",")); d.rectangle([l*3,t*3,r*3,bt*3],outline=(255,0,0),width=2)
img.save(out)
