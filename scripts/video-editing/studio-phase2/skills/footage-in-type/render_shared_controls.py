"""Bounded licensed-source integration controls for shared aperture/shine operators.

No client video, template or new renderer. Run with the existing cleared coffee
original and a new private output directory. Silent picture mechanism proof only.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

REPO=Path(__file__).resolve().parents[5]
sys.path.insert(0,str(REPO/'.agents/skills/cg-video-story-editor/scripts'))
from visual_treatments import type_reveal, text_aperture, glyph_shine

SHA='883b71655e2f2448a03b02f6e318eced58b51bac5b74da86c018995f3c817331'
W,H,FPS,N=540,960,24,72


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',required=True,type=Path)
    p.add_argument('--output',required=True,type=Path)
    args=p.parse_args()
    with args.source.open('rb') as stream:
        if hashlib.file_digest(stream,'sha256').hexdigest()!=SHA:raise ValueError('Wrong/unverified practice original')
    if args.output.exists():raise ValueError('Use a NEW protected output folder')
    args.output.mkdir(parents=True)
    font=ImageFont.truetype(str(REPO/'scripts/video-editing/studio-phase2/scene/assets/SpaceGrotesk.ttf'),160)
    title=type_reveal((W,H),[('POUR',(70,150,180))],font,(50,390),9,0,shutter=0)
    mask=title.getchannel('A')
    distance=cv2.distanceTransform((np.asarray(mask)>250).astype(np.uint8),cv2.DIST_L2,5)
    y,x=np.unravel_index(distance.argmax(),distance.shape);pivot=(int(x),int(y))
    source=cv2.VideoCapture(str(args.source));rate=source.get(cv2.CAP_PROP_FPS)
    modes=('plain','aperture','flat-title','shine');encoders={}
    contacts=Image.new('RGB',(5*162,4*314),(16,16,16));labels=ImageDraw.Draw(contacts)
    full_mask_frames=[];preencode_spill=0
    for mode in modes:
        encoders[mode]=subprocess.Popen(['ffmpeg','-nostdin','-v','error','-f','rawvideo','-pix_fmt','rgb24',
            '-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-threads','1','-crf','18',
            '-pix_fmt','yuv420p',str(args.output/(mode+'.mp4'))],stdin=subprocess.PIPE)
    try:
        for i in range(N):
            source.set(cv2.CAP_PROP_POS_FRAMES,round((1+i/FPS)*rate));ok,bgr=source.read()
            if not ok:raise RuntimeError('Source span incomplete')
            frame=Image.fromarray(cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB))
            crop_w=round(frame.height*W/H);left=(frame.width-crop_w)//2
            frame=frame.crop((left,0,left+crop_w,frame.height)).resize((W,H),Image.Resampling.LANCZOS)
            u=np.clip((i-23)/40,0,1);scale=1+119*(u*u*(3-2*u))
            aperture=text_aperture(frame,mask,(10,20,28),scale,pivot)
            if aperture.tobytes()==frame.tobytes():full_mask_frames.append(i)
            centre=-100+740*np.clip((i-16)/25,0,1)
            shining=title if not 16<=i<=41 else glyph_shine(title,centre,32,.2,.45,(230,245,250))
            a=np.asarray(shining);b=np.asarray(title)
            preencode_spill=max(preencode_spill,int(np.max(np.abs(a[b[:,:,3]==0].astype(int)-b[b[:,:,3]==0].astype(int)))))
            flat=Image.alpha_composite(frame.convert('RGBA'),title).convert('RGB')
            shine=Image.alpha_composite(frame.convert('RGBA'),shining).convert('RGB')
            for row,(mode,im) in enumerate(zip(modes,(frame,aperture,flat,shine))):
                encoders[mode].stdin.write(im.tobytes())
                if i in (0,18,36,60,71):
                    col=(0,18,36,60,71).index(i)
                    im.save(args.output/f'{mode}-f{i:02}.png')
                    contacts.paste(im.resize((162,288)),(col*162,row*314+26))
                    labels.text((col*162+3,row*314+5),mode+' f'+str(i),fill='white')
    finally:
        source.release()
        for encoder in encoders.values():
            encoder.stdin.close()
        codes=[encoder.wait() for encoder in encoders.values()]
    if any(codes):raise RuntimeError('An encode failed')
    if not full_mask_frames or N-1 not in full_mask_frames:raise RuntimeError('Aperture does not actually reach full picture')
    contacts.save(args.output/'comparison.png')
    report={'source_sha256':SHA,'source_url':'https://mixkit.co/free-stock-video/cup-being-filled-with-coffee-in-a-coffee-machine-41865/',
        'rights':'Existing Mixkit Stock Video Free License record; unchanged practice original',
        'source_span_seconds':[1,1+N/FPS],'frames':N,'fps':FPS,'canvas':[W,H],'pivot':pivot,
        'first_exact_full_picture_frame':min(full_mask_frames),'shine_preencode_outside_alpha_max':preencode_spill,
        'limit':'Silent compositing diagnostic. No creative, native-text, physical-phone or music approval. Lossy decoded edges require separate inspection.'}
    for mode in modes:
        subprocess.run(['ffmpeg','-nostdin','-v','error','-i',str(args.output/(mode+'.mp4')),'-f','null','-'],check=True)
    (args.output/'receipt.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report))


if __name__=='__main__':main()
