"""A short film-strip transport across a source-time cut, with isolated leak control.

Original masks/geometry, licensed picture. Not a captured physical burn or native preset.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path.home()/'Videos/CG-AI-Editing/Nolan-Skill-Proofs/cinematic-travel-20261027/mixkit-134-720.mp4'
SHA = 'de17d355543cda1f396361d2e217ae115c9be5eb60efe22cce0fc6a3d517d54d'
W, H, FPS, COUNT, CUT = 540, 960, 30, 90, 45
START, END, PITCH = 42, 48, 1000
spec = importlib.util.spec_from_file_location('optics_recipe', ROOT/'skills/chromatic-lens-pulse/render_ab.py')
recipe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recipe)


def strip(outgoing: np.ndarray, incoming: np.ndarray, progress: float) -> np.ndarray:
    result = Image.new('RGB',(W,H),(8,7,6))
    for image, top in [(outgoing,round(-progress*PITCH)),(incoming,round((1-progress)*PITCH))]:
        aperture = Image.new('L',(W,H))
        ImageDraw.Draw(aperture).rounded_rectangle((23,24,W-24,H-25),radius=12,fill=255)
        result.paste(Image.fromarray(image),(0,top),aperture)
        draw = ImageDraw.Draw(result)
        for y in range(8,H,40):
            for x in (6,W-14):
                draw.rounded_rectangle((x,top+y,x+7,top+y+14),radius=2,fill=(135,127,112))
    return np.asarray(result)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--source',type=Path,default=SOURCE)
    parser.add_argument('--output-dir',type=Path,required=True)
    args = parser.parse_args()
    if hashlib.sha256(args.source.read_bytes()).hexdigest()!=SHA:
        raise RuntimeError('Licensed source identity changed')
    args.output_dir.mkdir(parents=True,exist_ok=True)
    anchors = 9+np.array([0,15,30,45,60,75,90,105,119])*3/24
    centres = np.array([750,670,680,600,610,690,760,710,590],dtype=float)
    cap = cv2.VideoCapture(str(args.source))
    plain = []; source_times = []
    for i in range(COUNT):
        # An explicit same-take time compression, not a second camera/location.
        t = 9+i/FPS if i<CUT else 11+(i-CUT)/FPS
        j=min(len(anchors)-2,max(0,int(np.searchsorted(anchors,t,side='right')-1)))
        u=(t-anchors[j])/(anchors[j+1]-anchors[j]);u=u*u*(3-2*u)
        left=round(np.clip(centres[j]*(1-u)+centres[j+1]*u-202.5,0,875))
        cap.set(cv2.CAP_PROP_POS_MSEC,t*1000);ok,frame=cap.read()
        if not ok:raise RuntimeError(i)
        plain.append(cv2.cvtColor(cv2.resize(frame[:,left:left+405],(W,H)),cv2.COLOR_BGR2RGB));source_times.append(t)
    cap.release()
    versions={'plain-cut':plain,'transport':[],'transport-leak':[]}
    yy,xx=np.mgrid[:H,:W];changed={n:[] for n in versions if n!='plain-cut'}
    for i,base in enumerate(plain):
        transport=base.copy();leak=base.copy()
        if START<=i<END:
            p=(i-START+.5)/(END-START)
            # Spatial shutter integration over film movement, no invented optical-flow pose.
            samples=[strip(plain[START-1],plain[END],float(np.clip(p+s,0,1))).astype(float)
                     for s in np.linspace(-.045,.045,31)]
            transport=np.rint(np.mean(samples,axis=0)).astype(np.uint8)
            gap_y=(1-p)*PITCH-20
            alpha=.72*np.sin(np.pi*p)**2*np.exp(-((xx-120)/470)**2-((yy-gap_y)/125)**2)
            rgb=transport.astype(float)/255
            leak=np.rint((1-(1-rgb)*(1-alpha[...,None]*np.array((1,.44,.07))))*255).clip(0,255).astype(np.uint8)
        for name,frame in [('transport',transport),('transport-leak',leak)]:
            versions[name].append(frame)
            if np.any(frame!=base):changed[name].append(i)
    assert all(v==list(range(START,END)) for v in changed.values())
    for name,frames in versions.items():recipe.encode(args.output_dir/f'{name}.mp4',frames)
    picks=(41,42,44,45,47,48)
    contact=Image.new('RGB',(W*len(picks),(H+20)*3),'#141414');draw=ImageDraw.Draw(contact)
    for row,(name,frames) in enumerate(versions.items()):
        for col,i in enumerate(picks):
            contact.paste(Image.fromarray(frames[i]),(col*W,row*(H+20)+20))
            draw.text((col*W+3,row*(H+20)+3),f'{name} f{i}',fill='white')
    contact.resize((1620,1470)).save(args.output_dir/'contact.jpg',quality=94)
    Image.fromarray(versions['transport-leak'][44]).save(args.output_dir/'transport-leak-full.png')
    receipt={'source_sha256':SHA,'fps':FPS,'frames':COUNT,'cut_frame':CUT,'source_times_s':source_times,
        'active_frames':[START,END-1],'held_outgoing_frame':START-1,'held_incoming_frame':END,
        'pitch_px':PITCH,'spatial_shutter_samples':31,'changed_preencode_frames':changed,
        'scope':'original film-strip interpretation; explicit same-take time compression, not continuous capture or exact template',
        'sound':'none','outputs':{n:hashlib.sha256((args.output_dir/f'{n}.mp4').read_bytes()).hexdigest() for n in versions}}
    (args.output_dir/'evidence.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in receipt.items() if k!='source_times_s'}))


if __name__=='__main__':main()
