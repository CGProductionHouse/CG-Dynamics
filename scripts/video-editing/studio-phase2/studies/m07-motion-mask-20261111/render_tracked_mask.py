"""Lens-bound feathered mask over actual prequalified CC0 3D source footage.
Silent technical control, NOT client creative or photographic/live-action claim.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import cv2
import numpy as np
from track_lens import SOURCE, EXPECTED, source_frames, track

ROOT=Path(__file__).parent
OUTPUT=ROOT/"output"
SCALE_RADIUS=81.0
def eased(t):
    x=np.clip((t-.22)/.42,0,1);intro=x*x*(3-2*x)
    x=np.clip((3.0-t)/.40,0,1);outro=x*x*(3-2*x)
    return float(intro*outro)

def add_lens_mask(frame,position,t):
    """Affine motion follows source features. All pixel changes confined to moving lens ROI."""
    cx,cy=position["center"];s=position["scale"]
    r=SCALE_RADIUS*s
    if not (650<cx<1350 and 300<cy<850 and .8<s<1.2):
        raise ValueError("TRACK_BOUNDARY_OUTSIDE_APPROVED_SOURCE_ROI")
    strength=eased(t)
    if strength<=1e-7:return frame.copy(),np.zeros(frame.shape[:2],np.uint8)
    pad=int(math.ceil(r+9))
    x1=max(0,int(cx)-pad);x2=min(frame.shape[1],int(cx)+pad+1)
    y1=max(0,int(cy)-pad);y2=min(frame.shape[0],int(cy)+pad+1)
    roi=frame[y1:y2,x1:x2]
    yy,xx=np.mgrid[y1:y2,x1:x2]
    norm=np.sqrt((xx-cx)**2+(yy-cy)**2)/r
    mask=np.clip((1.0-norm)/.16,0,1).astype(np.float32)
    # Gentle colour within the glass, plus a diagonal travelling highlight.
    sweep=((xx-cx)/r)*.76+((yy-cy)/r)*.24
    scan=np.exp(-((sweep-(t/3.0*1.85-.95))/.13)**2).astype(np.float32)
    annulus=np.exp(-((norm-.80)/.045)**2).astype(np.float32)
    flicker=(.65+.35*math.sin(math.pi*2*(t*.72-.18)))
    glow=mask*(.16+.30*scan+.12*annulus)*strength*flicker
    base=roi.astype(np.float32)
    warm=np.array([167.,186.,220.],dtype=np.float32) # BGR warmth; brand neutral
    tinted=base*(1-glow[...,None])+warm*glow[...,None]
    # A thin accurately masked moving outline, avoiding opaque tech-card UI.
    outline=annulus*.37*strength*mask
    tinted=tinted*(1-outline[...,None])+np.array([205.,235.,246.])[None,None,:]*outline[...,None]
    out=frame.copy()
    out[y1:y2,x1:x2]=np.clip(tinted,0,255).astype(np.uint8)
    alpha=np.zeros(frame.shape[:2],np.uint8)
    alpha[y1:y2,x1:x2]=np.rint(mask*strength*255).astype(np.uint8)
    return out,alpha

def ffmpeg_binary():
    paths=[r"C:\Users\info\Documents\Codex\2026-10-27\n\work\tools\ffmpeg-9.0.2-essentials_build\bin\ffmpeg.exe",shutil.which("ffmpeg")]
    for candidate in paths:
        if candidate and Path(candidate).is_file(): return candidate
    raise RuntimeError("LOCAL_FFMPEG_NOT_FOUND")

def encode(frames,positions,kind,ffmpeg):
    dst=OUTPUT/("NOLAN-M07-MOTION-MASK-"+kind+"-1080P.mp4")
    if dst.exists():raise FileExistsError("PROTECTED_OUTPUT_EXISTS:"+str(dst))
    cmd=[ffmpeg,"-hide_banner","-loglevel","error","-y","-f","rawvideo","-pixel_format","bgr24","-video_size","1920x1080","-framerate","30","-i","pipe:0","-an","-threads","2","-c:v","libx264","-preset","veryfast","-crf","19","-pix_fmt","yuv420p","-color_range","tv","-colorspace","bt709","-color_primaries","bt709","-color_trc","bt709","-movflags","+faststart",str(dst)]
    proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    try:
        for i,frame in enumerate(frames):
            if kind=="PLAIN":out=frame
            elif kind=="TRACKED":
                out,alpha=add_lens_mask(frame,positions[i],i/30)
                if i in (0,35,44,70,89):
                    cv2.imwrite(str(OUTPUT/f"tracked_mask_{i:02d}.png"),alpha)
            elif kind=="NEGATIVE_STATIC":
                out,_=add_lens_mask(frame,positions[0],i/30)
            else:raise ValueError("INVALID_CONTROL")
            proc.stdin.write(out.tobytes())
        proc.stdin.close()
        err=proc.stderr.read().decode("utf-8","replace")
        rc=proc.wait()
        if rc:raise RuntimeError(f"FFMPEG_{kind}_FAILED:"+err[-3000:])
    except Exception:
        proc.kill();proc.wait()
        raise
    return {"kind":kind,"path":str(dst),"bytes":dst.stat().st_size,"sha256":hashlib.sha256(dst.read_bytes()).hexdigest(),"ffmpeg_command":cmd[:-1]+["<protected-output>"]}

if __name__=="__main__":
    OUTPUT.mkdir(exist_ok=True)
    src=source_frames()
    observed=track(src)
    if observed["source_sha256"]!=EXPECTED or observed["frames"]!=90:raise RuntimeError("SOURCE_MISMATCH")
    ff=ffmpeg_binary()
    receipts=[encode(src,observed["positions"],name,ff) for name in ("PLAIN","TRACKED","NEGATIVE_STATIC")]
    document={"schema":1,"purpose":"TECHNICAL_PROOF_ONLY","source_sha256":EXPECTED,"source_rights":"Poly Haven Camera 01 original CC0 .blend verified M03","source_type":"real Blender-rendered 3D moving source, NOT live-action photography","motion_mechanism":"actual LK/RANSAC object path + feathered moving lens-region RGB mask","sound":"SILENT","duration_s":3.0,"size":[1920,1080],"fps":30,"track_end_displacement_px":observed["end_to_start_px"],"videos":receipts}
    (OUTPUT/"RENDER-RECEIPT.json").write_text(json.dumps(document,indent=2),encoding="utf-8")
    print(json.dumps({"status":"ENCODED_PENDING_FULL_DECODE_AND_VISUAL_REVIEW","track_px":observed["end_to_start_px"],"videos":[{k:r[k] for k in ("kind","bytes","sha256")} for r in receipts]}))