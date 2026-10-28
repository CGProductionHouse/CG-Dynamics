"""Intentional graphic inset-to-full-frame reveal, not a physical device claim.

Reuses the inspected city source and crop anchors. Sound is original and separable.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import wave
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

SOURCE=Path.home()/"Videos/CG-AI-Editing/Nolan-Skill-Proofs/cinematic-travel-20261027/mixkit-134-720.mp4"
SHA="de17d355543cda1f396361d2e217ae115c9be5eb60efe22cce0fc6a3d517d54d"
W,H,FPS,COUNT,START,END=540,960,30,90,18,42


def encode(path:Path,frames:list[np.ndarray])->None:
    p=subprocess.Popen(['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}',
                        '-r',str(FPS),'-i','-','-an','-c:v','libx264','-crf','18','-pix_fmt','yuv420p',str(path)],stdin=subprocess.PIPE)
    for frame in frames:p.stdin.write(frame.tobytes())
    p.stdin.close()
    if p.wait():raise RuntimeError(path)


def ease(u:float)->float:
    return 6*u**5-15*u**4+10*u**3


def card(canvas:np.ndarray,scale:float)->tuple[np.ndarray,list[int]]:
    if scale>=1:return canvas.copy(),[0,0,W,H]
    width=round(W*scale);height=round(H*scale)
    left=(W-width)//2;top=(H-height)//2
    result=np.full((H,W,3),(16,34,42),dtype=np.uint8)
    result[top:top+height,left:left+width]=cv2.resize(canvas,(width,height),interpolation=cv2.INTER_CUBIC)
    return result,[left,top,width,height]


def main()->None:
    parser=argparse.ArgumentParser();parser.add_argument('--output-dir',type=Path,required=True)
    parser.add_argument("--source", type=Path, default=SOURCE, help="Local authorised original; SHA-256 remains mandatory")
    args=parser.parse_args();args.output_dir.mkdir(parents=True,exist_ok=True)
    if hashlib.sha256(args.source.read_bytes()).hexdigest()!=SHA:raise RuntimeError('Source identity changed')
    cap=cv2.VideoCapture(str(args.source))
    times=9+np.array([0,15,30,45,60,75,90,105,119])*3/24
    centres=np.array([750,670,680,600,610,690,760,710,590],dtype=float)
    versions={'plain':[],'linear':[],'eased':[]};boxes={n:[] for n in versions}
    for i in range(COUNT):
        t=9+i/FPS;j=min(len(times)-2,max(0,int(np.searchsorted(times,t,side='right')-1)))
        u=(t-times[j])/(times[j+1]-times[j]);u=u*u*(3-2*u)
        cx=centres[j]*(1-u)+centres[j+1]*u;left=round(np.clip(cx-202.5,0,875))
        cap.set(cv2.CAP_PROP_POS_MSEC,t*1000);ok,source=cap.read()
        if not ok:raise RuntimeError(i)
        canvas=cv2.cvtColor(cv2.resize(source[:,left:left+405],(W,H)),cv2.COLOR_BGR2RGB)
        p=float(np.clip((i-START)/(END-START),0,1))
        for name,progress in [('plain',float(i>=END)),('linear',p),('eased',ease(p))]:
            image,box=card(canvas,.5+.5*progress)
            versions[name].append(image);boxes[name].append(box)
    cap.release()
    for name in ('linear','eased'):
        assert all(np.array_equal(versions[name][i],versions['plain'][i]) for i in list(range(START+1))+list(range(END,COUNT)))
        assert all(b[0]>=0 and b[1]>=0 and b[0]+b[2]<=W and b[1]+b[3]<=H for b in boxes[name])
        assert all(a[2]<=b[2] and a[3]<=b[3] for a,b in zip(boxes[name],boxes[name][1:]))
    for name,frames in versions.items():encode(args.output_dir/f'{name}.mp4',frames)
    rate=48000;n=round(COUNT/FPS*rate);rng=np.random.default_rng(87428)
    noise=rng.normal(size=n);freq=np.fft.rfftfreq(n,1/rate)
    spectrum=np.fft.rfft(noise);spectrum[(freq<250)|(freq>5500)]=0
    noise=np.fft.irfft(spectrum,n=n);noise/=np.max(abs(noise))
    t=np.arange(n)/rate;u=np.clip((t-START/FPS)/((END-START)/FPS),0,1)
    velocity=30*u*u*(1-u)*(1-u);velocity/=velocity.max()
    audio=noise*velocity*.16
    with wave.open(str(args.output_dir/'motion-whoosh.wav'),'wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate)
        f.writeframes(np.rint(audio*32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg','-y','-v','error','-i',str(args.output_dir/'eased.mp4'),'-i',str(args.output_dir/'motion-whoosh.wav'),
                    '-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','160k','-shortest',str(args.output_dir/'eased-sound.mp4')],check=True)
    picks=(18,23,30,37,42)
    contact=Image.new('RGB',(W*len(picks),(H+20)*3),'#141414');draw=ImageDraw.Draw(contact)
    for row,(name,frames) in enumerate(versions.items()):
        for col,i in enumerate(picks):
            contact.paste(Image.fromarray(frames[i]),(col*W,row*(H+20)+20))
            draw.text((col*W+5,row*(H+20)+3),f'{name} f{i}',fill='white')
    contact.resize((1350,1470)).save(args.output_dir/'contact.jpg',quality=93)
    Image.fromarray(versions['eased'][30]).save(args.output_dir/'midpoint.png')
    evidence={'fps':FPS,'frames':COUNT,'source_sha256':SHA,'source_in':9,'grow_frames':[START,END],
              'boxes':boxes,'outside_window_preencode_identical':True,'bounds_and_monotonic_size':True,
              'cue':'original 250–5500 Hz noise; envelope follows quintic scale velocity; unheard',
              'scope':'graphic card; no phone/screen/tracking or second-angle claim',
              'outputs':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in args.output_dir.glob('*.mp4')}}
    (args.output_dir/'evidence.json').write_text(json.dumps(evidence,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in evidence.items() if k!='boxes'}))


if __name__=='__main__':main()
