"""Original flat-gold versus internally bevelled/weathered lettering.

No stock, copied creator artwork or paid effect; not a native editor title proof.
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

ROOT = Path(__file__).resolve().parents[2]
FONT = ROOT / "scene/assets/SpaceGrotesk.ttf"
W, H, FPS, COUNT = 540, 960, 30, 90


def encode(path: Path, frames: list[np.ndarray]) -> None:
    p = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                          "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264",
                          "-crf", "18", "-pix_fmt", "yuv420p", str(path)], stdin=subprocess.PIPE)
    for a in frames: p.stdin.write(a.tobytes())
    p.stdin.close()
    if p.wait(): raise RuntimeError(path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype(str(FONT), 88)
    font.set_variation_by_name("Bold")
    mask = Image.new("L", (W,H), 0)
    d = ImageDraw.Draw(mask)
    for title,y in (("EXPLORE",390),("MORE",482)):
        box=d.textbbox((0,0),title,font=font)
        d.text(((W-(box[2]-box[0]))/2-box[0],y-box[1]),title,font=font,fill=255)
    alpha=np.asarray(mask,dtype=float)/255
    distance=cv2.distanceTransform((alpha>.5).astype(np.uint8),cv2.DIST_L2,5)
    height=np.minimum(distance/3,1)
    gx=cv2.Sobel(height,cv2.CV_64F,1,0)/8
    gy=cv2.Sobel(height,cv2.CV_64F,0,1)/8
    normal=np.stack((-gx*3,-gy*3,np.ones_like(gx)),axis=-1)
    normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
    light=np.array((-.6,-.7,1.0));light/=np.linalg.norm(light)
    diffuse=np.maximum(0,normal@light)
    yy,xx=np.mgrid[:H,:W]
    bands=.95+.12*np.sin((yy-350)*.06)
    rng=np.random.default_rng(875)
    noise=rng.normal(size=(H,W))
    pits=cv2.GaussianBlur((noise>1.6).astype(float),(0,0),.7)
    material=np.array((227,173,67))*bands[...,None]*(.65+.5*diffuse[...,None])
    # Keep material readable at phone size; the first 110-strength pitting looked dirty.
    material-=pits[...,None]*35
    half_light=light+np.array((0,0,1));half_light/=np.linalg.norm(half_light)
    specular=np.maximum(0,normal@half_light)**24
    material+=specular[...,None]*np.array((25,23,17))
    material=np.clip(material,0,255)
    flat=np.full((H,W,3),(215,166,69),dtype=float)
    versions={"flat":[],"material":[]}
    max_outside=0
    for i in range(COUNT):
        bg=np.zeros((H,W,3),dtype=float)
        bg[:]=np.array((10,29,37))+(1-yy/H)[...,None]*np.array((8,16,20))
        opacity=np.clip((i-6)/8,0,1)
        a=alpha[...,None]*opacity
        f=np.rint(bg*(1-a)+flat*a).astype(np.uint8)
        m=np.rint(bg*(1-a)+material*a).astype(np.uint8)
        max_outside=max(max_outside,int(np.max(abs(m[alpha==0].astype(int)-f[alpha==0].astype(int)))))
        versions['flat'].append(f);versions['material'].append(m)
    assert max_outside==0
    mask.save(args.output_dir/'title-mask.png')
    Image.fromarray(np.rint(material).astype(np.uint8)).save(args.output_dir/'material-layer.png')
    for key,frames in versions.items(): encode(args.output_dir/f'{key}.mp4',frames)
    contact=Image.new('RGB',(W*2,H))
    for j,key in enumerate(('flat','material')):contact.paste(Image.fromarray(versions[key][30]),(j*W,0))
    contact.resize((810,720)).save(args.output_dir/'contact.jpg',quality=94)
    evidence={'fps':FPS,'frames':COUNT,'title':['EXPLORE','MORE'],'font_sha256':hashlib.sha256(FONT.read_bytes()).hexdigest(),
              'bevel_radius_px':3,'pitting_strength':35,'seed':875,'preencode_changes_outside_glyph_alpha':max_outside,
              'limits':'Original raster material; not reference effect settings, natural depth mask or native editable text',
              'outputs':{name:hashlib.sha256((args.output_dir/name).read_bytes()).hexdigest()
                         for name in ('flat.mp4','material.mp4')}}
    (args.output_dir/'receipt.json').write_text(json.dumps(evidence,indent=2),encoding='utf-8')
    print(json.dumps(evidence))


if __name__=='__main__':main()
