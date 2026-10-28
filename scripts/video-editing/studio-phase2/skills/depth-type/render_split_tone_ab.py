"""Fictional split-tone title: same picture, text in front versus behind foreground.

Uses existing licensed chroma source; does not establish natural-person masking.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'media/mixkit-28306-2160.mp4'
SHA='80e0bf3d84faf6e2b0efabfc9001aeadde09e1ce56d0530360ceff5b9be596a5'
W,H,FW,FH,FPS,COUNT=540,960,540,710,30,90


def encode(path:Path,frames:list[np.ndarray])->None:
    p=subprocess.Popen(['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}',
                        '-r',str(FPS),'-i','-','-an','-c:v','libx264','-crf','18','-pix_fmt','yuv420p',str(path)],stdin=subprocess.PIPE)
    for a in frames:p.stdin.write(a.tobytes())
    p.stdin.close()
    if p.wait():raise RuntimeError(path)


def over(background:np.ndarray,foreground:np.ndarray,alpha:np.ndarray)->np.ndarray:
    return np.rint(background*(1-alpha[...,None])+foreground*alpha[...,None]).clip(0,255).astype(np.uint8)


def main()->None:
    parser=argparse.ArgumentParser();parser.add_argument('--output-dir',type=Path,required=True)
    parser.add_argument("--source", type=Path, default=SOURCE, help="Local authorised original; SHA-256 remains mandatory")
    args=parser.parse_args();args.output_dir.mkdir(parents=True,exist_ok=True)
    if hashlib.sha256(args.source.read_bytes()).hexdigest()!=SHA:raise RuntimeError('Source identity changed')
    raw=subprocess.check_output(['ffmpeg','-v','error','-ss','3','-i',str(args.source),'-t','3',
        '-vf',f'crop=1642:2160:1312:0,scale={FW}:{FH},fps={FPS},chromakey=0x56ee00:0.13:0.09,despill=type=green:mix=0.7:expand=0.05,format=rgba',
        '-frames:v',str(COUNT),'-f','rawvideo','-pix_fmt','rgba','-'])
    subject=np.frombuffer(raw,np.uint8).reshape(COUNT,FH,FW,4)
    assert np.max(subject[:,:5,:,3])==0, 'A visible top crop would float inside the frame'
    font=ImageFont.truetype(str(ROOT/'scene/assets/SpaceGrotesk.ttf'),112);font.set_variation_by_name('Bold')
    masks={}; words=('FIND','YOUR','FLOW')
    for word in words:
        m=Image.new('L',(W,H));d=ImageDraw.Draw(m);box=d.textbbox((0,0),word,font=font)
        x=200; y=310
        assert x+box[2]-box[0]<W-10
        d.text((x-box[0],y-box[1]),word,font=font,fill=255);masks[word]=np.array(m,dtype=float)/255
    yy,xx=np.mgrid[:H,:W];base=np.zeros((H,W,3),dtype=np.uint8);base[:]=(14,35,44)
    rng=np.random.default_rng(87528);grain=cv2.GaussianBlur(rng.normal(size=(H,W)),(0,0),1.0)
    material=np.zeros((H,W,3),dtype=float);material[:]=(65,131,162);material[yy>355]=(225,164,54)
    material=np.clip(material+grain[...,None]*7,0,255).astype(np.uint8)
    versions={'front':[],'behind':[]};visibility=[];differences=[]
    for i in range(COUNT):
        word=words[i//30];glyph=masks[word]
        person=np.zeros((H,W,3),dtype=np.uint8);person[H-FH:,:FW]=subject[i,:,:,:3]
        alpha=np.zeros((H,W));alpha[H-FH:,:FW]=subject[i,:,:,3]/255
        raw_person=over(base,person,alpha)
        front=over(raw_person,material,glyph)
        behind=over(over(base,material,glyph),person,alpha)
        visibility.append(float(np.sum(glyph*(1-alpha))/np.sum(glyph)))
        differences.append(int(np.count_nonzero(np.any(front!=behind,axis=2))))
        # Opaque source foreground must cover the title exactly before compression.
        assert np.array_equal(behind[alpha==1],raw_person[alpha==1])
        versions['front'].append(front);versions['behind'].append(behind)
    for name,frames in versions.items():encode(args.output_dir/f'{name}.mp4',frames)
    picks=(0,15,30,45,60,75)
    contact=Image.new('RGB',(W*len(picks),(H+20)*2),'#141414');draw=ImageDraw.Draw(contact)
    for row,(name,frames) in enumerate(versions.items()):
        for col,i in enumerate(picks):
            contact.paste(Image.fromarray(frames[i]),(col*W,row*(H+20)+20))
            draw.text((col*W+5,row*(H+20)+3),f'{name} {words[i//30]} f{i}',fill='white')
    contact.resize((1620,980)).save(args.output_dir/'contact.jpg',quality=94)
    Image.fromarray(versions['behind'][45]).save(args.output_dir/'behind-full.png')
    evidence={'fps':FPS,'frames':COUNT,'source_sha256':SHA,'words':words,'min_visible_glyph_fraction':min(visibility),
              'max_visible_glyph_fraction':max(visibility),'changed_pixels_front_vs_behind':differences,
              'opaque_foreground_preserved_preencode':True,'placement':[200,310],
              'foreground_extent':[0,H-FH,FW,FH],'horizontal_layer_edges_are_frame_edges':FW==W,
              'source_limit':'green screen, not natural segmentation; same original source under both versions',
              'outputs':{n:hashlib.sha256((args.output_dir/f'{n}.mp4').read_bytes()).hexdigest() for n in versions}}
    (args.output_dir/'evidence.json').write_text(json.dumps(evidence,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in evidence.items() if k!='changed_pixels_front_vs_behind'}))


if __name__=='__main__':main()
