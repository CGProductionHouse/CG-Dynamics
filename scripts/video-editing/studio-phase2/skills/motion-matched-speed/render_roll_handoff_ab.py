"""Registered same-take rotational time cut; not a captured linear whip.

Reuse existing encoder. Explicit source identity, plain/registered/shutter controls.
"""
from __future__ import annotations
import argparse, hashlib, importlib.util, json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw

W,H,FPS,COUNT,CUT = 540,960,30,90,45
SHA='f56f0c5adbb6d1d7e7f3792ad6707b0fd14f0068d8b2348d96a61cfe52c27dd3'
spec=importlib.util.spec_from_file_location('encoder',Path(__file__).parents[1]/'chromatic-lens-pulse/render_ab.py')
recipe=importlib.util.module_from_spec(spec);spec.loader.exec_module(recipe)

def weight(j):
    t=np.clip(j/11,0,1)
    return 1-t*t*(3-2*t)

def main():
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--output-dir',type=Path,required=True)
    args=p.parse_args();assert hashlib.sha256(args.source.read_bytes()).hexdigest()==SHA
    args.output_dir.mkdir(parents=True,exist_ok=True)
    cap=cv2.VideoCapture(str(args.source))
    def source(t):
        cap.set(cv2.CAP_PROP_POS_MSEC,t*1000);ok,f=cap.read();assert ok
        return cv2.cvtColor(f,cv2.COLOR_BGR2RGB)
    outgoing,incoming=source(6+44/FPS),source(10)
    sift=cv2.SIFT_create()
    ka,da=sift.detectAndCompute(cv2.cvtColor(outgoing,cv2.COLOR_RGB2GRAY),None)
    kb,db=sift.detectAndCompute(cv2.cvtColor(incoming,cv2.COLOR_RGB2GRAY),None)
    pairs=cv2.BFMatcher().knnMatch(db,da,k=2);good=[a for a,b in pairs if a.distance<.7*b.distance]
    a=np.float32([kb[m.queryIdx].pt for m in good]);b=np.float32([ka[m.trainIdx].pt for m in good])
    M,mask=cv2.estimateAffinePartial2D(a,b,method=cv2.RANSAC,ransacReprojThreshold=2)
    assert M is not None and mask.sum()>100
    angle=np.arctan2(M[1,0],M[0,0]);scale=np.hypot(M[0,0],M[1,0])
    assert angle>0, 'Incoming correction must release in the actual negative camera-roll direction'
    yy,xx=np.mgrid[:H,:W].astype(np.float32)
    base=np.stack([640+(xx-W/2)*720/H/1.35,360+(yy-H/2)*720/H/1.35,np.ones_like(xx)])
    versions={k:[] for k in ['plain-cut','registered-release','shutter-release']}
    bounds=[];changed={k:[] for k in versions if k!='plain-cut'}
    for i in range(COUNT):
        frame=source(6+i/FPS if i<CUT else 10+(i-CUT)/FPS)
        for name in versions:
            offsets=np.linspace(-.5,.5,31) if name=='shutter-release' and CUT<=i<CUT+11 else [0]
            total=np.zeros((H,W,3),np.float32)
            for offset in offsets:
                w=weight(i-CUT+offset) if name!='plain-cut' and i>=CUT else 0
                co,si=np.cos(angle*w),np.sin(angle*w);s=scale**w
                mat=np.array([[s*co,-s*si,M[0,2]*w],[s*si,s*co,M[1,2]*w]],np.float64)
                inverse=cv2.invertAffineTransform(mat)
                mx=(inverse[0]@base.reshape(3,-1)).reshape(H,W).astype(np.float32)
                my=(inverse[1]@base.reshape(3,-1)).reshape(H,W).astype(np.float32)
                assert mx.min()>=0 and mx.max()<=1279 and my.min()>=0 and my.max()<=719,'Out-of-source sample'
                bounds.append([float(mx.min()),float(mx.max()),float(my.min()),float(my.max())])
                total+=cv2.remap(frame,mx,my,cv2.INTER_LINEAR)/len(offsets)
            result=np.rint(total).clip(0,255).astype(np.uint8)
            versions[name].append(result)
            if name!='plain-cut' and not np.array_equal(result,versions['plain-cut'][-1]):changed[name].append(i)
    cap.release()
    assert changed['registered-release']==list(range(45,56))
    assert changed['shutter-release']==list(range(45,56))
    for name,frames in versions.items():recipe.encode(args.output_dir/f'{name}.mp4',frames)
    picks=[43,44,45,47,50,54,56]
    contact=Image.new('RGB',(270*len(picks),500*len(versions)),'#111111');d=ImageDraw.Draw(contact)
    for row,(name,frames) in enumerate(versions.items()):
        for col,f in enumerate(picks):
            contact.paste(Image.fromarray(frames[f]).resize((270,480)),(col*270,row*500+20));d.text((col*270+3,row*500+3),f'{name} f{f}',fill='white')
    contact.save(args.output_dir/'contact.jpg',quality=94)
    for name,frames in versions.items():Image.fromarray(frames[45]).save(args.output_dir/f'{name}-cut.png')
    err=np.linalg.norm(a@M[:,:2].T+M[:,2]-b,axis=1)
    evidence={'source_sha256':SHA,'source_ranges':[[6,7.5],[10,11.5]],'cut_frame':45,'declared_time_ellipsis_seconds':2.5,
        'fps':FPS,'frames':COUNT,'incoming_to_outgoing_affine':M.tolist(),'angle_degrees':float(np.degrees(angle)),
        'scale':float(scale),'matched_features':len(good),'ransac_inliers':int(mask.sum()),'median_inlier_error_source_px':float(np.median(err[mask[:,0]>0])),
        'crop_zoom_all_controls':1.35,'release_frames':[45,56],'release_curve':'smoothstep1-to0; negative picture roll',
        'shutter_samples':31,'shutter_window_frames':1,'changed_frames':changed,'all_samples_within_source':True,
        'bounds':[min(x[0] for x in bounds),max(x[1] for x in bounds),min(x[2] for x in bounds),max(x[3] for x in bounds)],
        'audio':'silent','limits':'Same camera take and declared omitted time; not matching separate locations, linear captured whip, beat sync or continuous documentary time. Spatial transform shutter only; no optical-flow synthesis.',
        'outputs':{n:hashlib.sha256((args.output_dir/f'{n}.mp4').read_bytes()).hexdigest() for n in versions}}
    (args.output_dir/'evidence.json').write_text(json.dumps(evidence,indent=2));print(json.dumps(evidence))

if __name__=='__main__':main()
