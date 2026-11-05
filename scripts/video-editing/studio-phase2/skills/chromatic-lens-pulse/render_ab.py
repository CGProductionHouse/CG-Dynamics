"""Single source-footage zoom/warp/chromatic pulse, not graphic shutter blur.

Usage: python render_ab.py --output-dir PRIVATE_DIR
Uses the previously licensed city-follow source; no new engine or plugin.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

SOURCE = Path.home() / "Videos/CG-AI-Editing/Nolan-Skill-Proofs/cinematic-travel-20261027/mixkit-134-720.mp4"
SHA = "de17d355543cda1f396361d2e217ae115c9be5eb60efe22cce0fc6a3d517d54d"
W, H, FPS, COUNT = 540, 960, 30, 90


def encode(path: Path, frames: list[np.ndarray]) -> None:
    p = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                          "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264",
                          "-crf", "18", "-pix_fmt", "yuv420p", str(path)], stdin=subprocess.PIPE)
    for frame in frames: p.stdin.write(frame.tobytes())
    p.stdin.close()
    if p.wait(): raise RuntimeError(path)


def lens(frame: np.ndarray, pulse: float, strength: float) -> tuple[np.ndarray, float]:
    yy, xx = np.mgrid[:H, :W].astype(np.float32)
    dx, dy = xx-W/2, yy-220
    radius = np.sqrt((dx/(W*.7))**2+(dy/(H*.9))**2)
    edge = np.clip((radius-.18)/.65, 0, 1)**2
    u = pulse*strength
    factor = (1-.12*u*radius**2)/(1+.08*u)
    total = np.zeros_like(frame, dtype=np.float32)
    excursion = 0.0
    # Short spatial radial shutter integration; no generated optical-flow frames.
    for shutter in np.linspace(0, .035*u, 9):
        for channel, direction in enumerate((1, 0, -1)):
            f = factor/(1+shutter)+direction*.006*u*edge
            mx = (W/2+dx*f).astype(np.float32)
            my = (220+dy*f).astype(np.float32)
            excursion = max(excursion, float(max(0, -mx.min(), mx.max()-(W-1), -my.min(), my.max()-(H-1))))
            total[..., channel] += cv2.remap(frame[..., channel], mx, my, cv2.INTER_LINEAR,
                                            borderMode=cv2.BORDER_REFLECT_101)/9
    return np.rint(total).clip(0,255).astype(np.uint8), excursion


def main() -> None:
    parser=argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--source", type=Path, default=SOURCE, help="Local authorised original; SHA-256 remains mandatory")
    args=parser.parse_args();args.output_dir.mkdir(parents=True,exist_ok=True)
    if hashlib.sha256(args.source.read_bytes()).hexdigest()!=SHA: raise RuntimeError("Source identity changed")
    cap=cv2.VideoCapture(str(args.source))
    versions={"plain":[],"zoom-only":[],"mild":[],"strong":[]}; crop_centres=[]; excursions=[]
    # Reuse the prior manually inspected source anchors, not invented tracking.
    times=9+np.array([0,15,30,45,60,75,90,105,119])*3/24
    centres=np.array([750,670,680,600,610,690,760,710,590],dtype=float)
    changed={"mild":[],"strong":[]}
    for i in range(COUNT):
        t=9+i/FPS
        j=min(len(times)-2,max(0,int(np.searchsorted(times,t,side="right")-1)))
        u=(t-times[j])/(times[j+1]-times[j]);u=u*u*(3-2*u)
        cx=centres[j]*(1-u)+centres[j+1]*u
        cap.set(cv2.CAP_PROP_POS_MSEC,t*1000);ok,frame=cap.read()
        if not ok:raise RuntimeError(i)
        left=round(np.clip(cx-202.5,0,875));crop_centres.append(cx)
        base=cv2.cvtColor(cv2.resize(frame[:,left:left+405],(W,H)),cv2.COLOR_BGR2RGB)
        versions['plain'].append(base)
        pulse=np.sin(np.pi*(i-23)/13)**2 if 24<=i<=35 else 0
        zoom=1+.08*pulse
        matrix=np.array([[zoom,0,W/2*(1-zoom)],[0,zoom,220*(1-zoom)]],dtype=np.float32)
        versions['zoom-only'].append(cv2.warpAffine(base,matrix,(W,H),flags=cv2.INTER_LINEAR,
                                                   borderMode=cv2.BORDER_REFLECT_101) if pulse else base.copy())
        for name,strength in [('mild',1.0),('strong',4.0)]:
            result,excursion=lens(base,pulse,strength) if pulse else (base.copy(),0)
            excursions.append(excursion)
            if not np.array_equal(result,base):changed[name].append(i)
            versions[name].append(result)
    cap.release()
    assert all(v==list(range(24,36)) for v in changed.values())
    assert max(excursions)<.01, 'An out-of-source sample would create an edge-fill dependency'
    for name,frames in versions.items():encode(args.output_dir/f'{name}.mp4',frames)
    picks=(23,25,29,33,36)
    contact=Image.new('RGB',(W*len(picks),(H+20)*len(versions)),'#141414')
    d=ImageDraw.Draw(contact)
    for row,(name,frames) in enumerate(versions.items()):
        for col,i in enumerate(picks):
            contact.paste(Image.fromarray(frames[i]),(col*W,row*(H+20)+20))
            d.text((col*W+5,row*(H+20)+3),f'{name} f{i}',fill='white')
    contact.resize((1350,1960)).save(args.output_dir/'contact.jpg',quality=93)
    Image.fromarray(versions['mild'][29]).save(args.output_dir/'mild-peak.png')
    Image.fromarray(versions['strong'][29]).save(args.output_dir/'strong-peak.png')
    evidence={'source_sha256':SHA,'source_in':9,'fps':FPS,'frames':COUNT,'preencode_changed_frames':changed,
              'max_out_of_source_excursion_px':max(excursions),'manual_crop_centres':crop_centres,
              'radial_samples':9,'strengths':{'mild':1,'strong':4},'sound':'none',
              'scope':'one moving source; not a cross-shot transition or exact creator preset',
              'outputs':{n:hashlib.sha256((args.output_dir/f'{n}.mp4').read_bytes()).hexdigest() for n in versions}}
    (args.output_dir/'evidence.json').write_text(json.dumps(evidence,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in evidence.items() if k!='manual_crop_centres'}))


if __name__=='__main__':main()
