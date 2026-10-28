"""Full-shot display-plane test, controlled green screen versus drifting feature track.

Extends the existing filmed-phone insert, not the rejected digital growth.
No general natural-scene mask, captured transition or native editor claim.
"""
from __future__ import annotations
import argparse,hashlib,importlib.util,json
from functools import lru_cache
from pathlib import Path
import cv2
import numpy as np
from PIL import Image,ImageDraw,ImageFont

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('existing_plane',HERE/'render_carpenter_plane.py')
encoder=importlib.util.module_from_spec(spec);spec.loader.exec_module(encoder)
W,H,COUNT=540,960,251
SHA='0b1f1ec15a30b59fa06240b03adad50e3f6cef38ec6a3a8d8587d983644a7418'

@lru_cache(maxsize=8)
def font(path,size):
    return ImageFont.truetype(path,size)

def screen(frame):
    key=cv2.inRange(cv2.cvtColor(frame,cv2.COLOR_BGR2HSV),np.array([45,120,55]),np.array([90,255,255]))
    contours,_=cv2.findContours(key,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    contour=max(contours,key=cv2.contourArea)
    assert 25000<cv2.contourArea(contour)<65000
    component=np.zeros_like(key)
    cv2.drawContours(component,[contour],-1,255,cv2.FILLED)
    key=cv2.bitwise_and(key,component)
    # A minimum rectangle seeds the four edge neighborhoods. Adaptive polygon
    # simplification failed when rounded corners alternated between4 and5 vertices.
    a=cv2.boxPoints(cv2.minAreaRect(contour)).astype(float)
    a=a[np.argsort(np.arctan2(a[:,1]-a[:,1].mean(),a[:,0]-a[:,0].mean()))]
    a=np.roll(a,-np.argmin(a.sum(1)),axis=0)
    # Fit the convex display envelope, not the notch's concave inner edge.
    # The first pass fit that inner edge and left obvious green wedges above it.
    envelope=np.zeros_like(key)
    cv2.fillConvexPoly(envelope,cv2.convexHull(contour),255)
    envelopes,_=cv2.findContours(envelope,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    points=max(envelopes,key=cv2.contourArea).reshape(-1,2).astype(float);lines=[]
    for k in range(4):
        x,y=a[k],a[(k+1)%4];v=y-x;u=(points-x)@v/(v@v);z=points-x
        distance=np.abs(v[0]*z[:,1]-v[1]*z[:,0])/np.linalg.norm(v)
        selected=points[(u>.18)&(u<.82)&(distance<16)]
        assert len(selected)>60, 'Insufficient straight-edge support'
        vx,vy,px,py=cv2.fitLine(selected.astype(np.float32),cv2.DIST_HUBER,0,.01,.01).reshape(4)
        lines.append((np.array([px,py]),np.array([vx,vy])))
    corners=[]
    for k in range(4):
        x,v=lines[k-1];y,w=lines[k]
        t=np.linalg.solve(np.stack([v,-w],axis=1),y-x)[0];corners.append(x+t*v)
    q=np.float32(corners)
    # One source-pixel virtual-art overscan; the alpha never expands over the rim.
    centre=q.mean(axis=0)
    q=centre+(q-centre)*1.01
    assert cv2.isContourConvex(q) and cv2.contourArea(q)>25000
    return q,key

def design(index,revised,font_path):
    im=Image.new('RGB',(480,960),(25,42,52));d=ImageDraw.Draw(im)
    # Wholly original fictional practice artwork; no client/UI brand asset.
    for y in range(0,960,80):d.line((32,y,448,y),fill=(35,54,64),width=2)
    d.ellipse((320,620,650,950),outline=(82,112,122),width=8)
    d.text((42,120),'FIELD NOTES',font=font(font_path,27),fill=(154,174,178))
    words=['MAKE','SPACE'] if index<120 else ['FOR','FOCUS' if revised else 'IDEAS']
    big=font(font_path,100)
    for k,word in enumerate(words):d.text((38,280+k*120),word,font=big,fill=(212,205,188))
    d.line((42,570,170,570),fill=(212,205,188),width=8)
    d.text((42,760),'PRACTICE',font=font(font_path,30),fill=(154,174,178))
    return cv2.cvtColor(np.array(im),cv2.COLOR_RGB2BGR)

def composite(frame,art,quad,key,bleed=False):
    source=np.float32([[0,0],[479,0],[479,959],[0,959]])
    M=cv2.getPerspectiveTransform(source,quad)
    warped=cv2.warpPerspective(art,M,(1280,720),flags=cv2.INTER_LINEAR)
    valid=cv2.warpPerspective(np.full((960,480),255,np.uint8),M,(1280,720))
    if bleed:
        # Tiny gaps belong to the original graphic's own background bleed, not
        # reflected/painted camera footage. Refuse to conceal a misaligned plane.
        missing=(valid<250).astype(np.uint8)
        distance=cv2.distanceTransform(missing,cv2.DIST_L2,3)
        assert distance[key>0].max()<4, 'Registration gap too large for background bleed'
        warped=cv2.warpPerspective(art,M,(1280,720),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
        valid[:]=255
    alpha=(key.astype(np.float32)/255)*(valid.astype(np.float32)/255)
    # Actual source green-channel variation modulates the insert; no invented glass.
    light=np.clip(frame[:,:,1].astype(np.float32)/np.median(frame[:,:,1][key>0]),.7,1.25)
    lit=np.clip(warped.astype(np.float32)*light[:,:,None],0,255)
    result=np.rint(frame*(1-alpha[:,:,None])+lit*alpha[:,:,None]).clip(0,255).astype(np.uint8)
    # Remove the source's green anti-aliased fringe only in a one-pixel outer band.
    # No matte expansion across the handset and no unrestricted skin desaturation.
    hsv=cv2.cvtColor(frame,cv2.COLOR_BGR2HSV)
    band=(cv2.dilate(key,np.ones((3,3),np.uint8))>0)&(key==0)
    greenish=(hsv[:,:,0]>=35)&(hsv[:,:,0]<=95)&(hsv[:,:,1]>=35)&(hsv[:,:,2]>=15)
    spill=band&greenish&(frame[:,:,1].astype(float)>1.1*np.maximum(frame[:,:,0],frame[:,:,2]))
    result[spill,1]=np.maximum(result[spill,0],result[spill,2])
    protected=(key==0)&~spill
    assert np.array_equal(result[protected],frame[protected]), 'Pixels outside actual key and one-pixel spill must remain original'
    return result, float(np.mean((key>0)&(valid<250)))

def portrait(frame):
    return cv2.resize(frame[:,380:785],(W,H),interpolation=cv2.INTER_LINEAR)

def main():
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--output-dir',type=Path,required=True)
    p.add_argument('--font',default='C:/Windows/Fonts/arialbd.ttf');args=p.parse_args()
    assert hashlib.sha256(args.source.read_bytes()).hexdigest()==SHA
    args.output_dir.mkdir(parents=True,exist_ok=True)
    cv2.setNumThreads(2)
    cap=cv2.VideoCapture(str(args.source));assert abs(cap.get(5)-24000/1001)<.001 and cap.get(7)==COUNT
    ok,first=cap.read();assert ok;q0,k0=screen(first)
    ring=cv2.subtract(cv2.dilate(k0,np.ones((19,19),np.uint8)),cv2.erode(k0,np.ones((3,3),np.uint8)))
    prev=cv2.cvtColor(first,cv2.COLOR_BGR2GRAY)
    pts=cv2.goodFeaturesToTrack(prev,maxCorners=100,qualityLevel=.01,minDistance=5,mask=ring);origin=pts.copy()
    assert len(pts)>10
    names=['plain','fixed-first-plane','feature-track','keyed-plane','keyed-revision']
    writers={n:encoder.writer(args.output_dir/f'{n}.mp4',W,H) for n in names}
    rows=[];snapshots={n:[] for n in names};revision_changed=[];i=0
    try:
        while True:
            if i==0:frame=first
            else:
                ok,frame=cap.read()
                if not ok:break
            q,key=screen(frame);grey=cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY)
            if i:
                nxt,st,_=cv2.calcOpticalFlowPyrLK(prev,grey,pts,None,winSize=(21,21),maxLevel=3,criteria=(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,40,.001))
                back,sb,_=cv2.calcOpticalFlowPyrLK(grey,prev,nxt,None,winSize=(21,21),maxLevel=3)
                good=(st[:,0]>0)&(sb[:,0]>0)&(np.linalg.norm(back-pts,axis=2)[:,0]<.65)
                pts,origin=nxt[good],origin[good];assert len(pts)>=8
                mat,inliers=cv2.findHomography(origin,pts,cv2.RANSAC,1.2)
                assert mat is not None and inliers.sum()>=8
                qf=cv2.perspectiveTransform(q0[None],mat)[0]
                pts,origin=pts[inliers[:,0]>0],origin[inliers[:,0]>0]
            else:mat=np.eye(3);qf=q0.copy()
            kf=cv2.warpPerspective(k0,mat,(1280,720),flags=cv2.INTER_NEAREST)
            iou=np.logical_and(kf>0,key>0).sum()/np.logical_or(kf>0,key>0).sum()
            art=design(i,False,args.font);revision=design(i,True,args.font)
            fixed,gap_fixed=composite(frame,art,q0,key)
            feature,gap_feature=composite(frame,art,qf,key)
            keyed,gap_keyed=composite(frame,art,q,key,bleed=True)
            revised,_=composite(frame,revision,q,key,bleed=True)
            changed=not np.array_equal(keyed,revised)
            assert changed==(i>=120)
            if changed:revision_changed.append(i)
            frames={'plain':frame,'fixed-first-plane':fixed,'feature-track':feature,'keyed-plane':keyed,'keyed-revision':revised}
            for name,value in frames.items():
                out=portrait(value);writers[name].stdin.write(out.tobytes())
                if i in [0,50,100,119,120,150,200,250]:snapshots[name].append((i,out))
            assert np.min(q[:,0])>380 and np.max(q[:,0])<785 and np.min(q[:,1])>0 and np.max(q[:,1])<720
            rows.append({'frame':i,'quad':q.tolist(),'feature_quad':qf.tolist(),'feature_points':len(pts),'feature_mask_iou':float(iou),
                'mean_corner_disagreement':float(np.linalg.norm(qf-q,axis=1).mean()),'fixed_gap_fraction_canvas':gap_fixed,
                'feature_gap_fraction_canvas':gap_feature,'keyed_gap_fraction_canvas':gap_keyed})
            prev=grey;i+=1
            if i%50==0:print(f'Encoded input frames {i}/{COUNT}',flush=True)
    finally:
        cap.release()
        for w in writers.values():w.stdin.close()
        for w in writers.values():assert w.wait()==0
    assert i==COUNT and revision_changed==list(range(120,COUNT))
    sheet=Image.new('RGB',(270*8,500*5),'#101010');d=ImageDraw.Draw(sheet)
    for row,name in enumerate(names):
        for col,(index,frame) in enumerate(snapshots[name]):
            sheet.paste(Image.fromarray(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB)).resize((270,480)),(col*270,row*500+20))
            d.text((col*270+3,row*500+3),f'{name} f{index}',fill='white')
    sheet.save(args.output_dir/'contact.jpg',quality=94)
    for name in names:
        for index,frame in snapshots[name]:
            if index in [120,250]:cv2.imwrite(str(args.output_dir/f'{name}-f{index}.png'),frame)
    evidence={'source_sha256':SHA,'source_range':'all251 original frames, no retime','fps':'24000/1001','frames':COUNT,'dimensions':[W,H],
        'crop_source':[380,0,405,720],'colour_key_hsv':[[45,120,55],[90,255,255]],'keyed_geometry':'4 source-edge Huber line fits; per-frame quad intersection, notch protected by actual key',
        'feature_geometry':'incremental LK FB<.65px, homography RANSAC1.2px; initial key used only for seed ring; not natural segmentation',
        'outside_key_preencode':'all251 frames unchanged outside actual key plus explicitly green one-pixel spill band; source hand/notch/bezel retained',
        'graphic_bleed':'original graphic background only, bounded<4 source pixels; never camera-footage edge invention',
        'revision':'only IDEAS->FOCUS at frames120-250; all earlier preencode frames identical','revision_changed_frames':revision_changed,
        'feature_min_iou':min(x['feature_mask_iou'] for x in rows),'feature_max_mean_corner_disagreement':max(x['mean_corner_disagreement'] for x in rows),
        'audio':'silent source and outputs; no heard audio/beat claim','limits':'controlled green-display insert, not natural person matte, arbitrary scene-plane tracking, physical filmed reveal, native editability or client approval',
        'rows':rows,'outputs':{n:hashlib.sha256((args.output_dir/f'{n}.mp4').read_bytes()).hexdigest() for n in names}}
    (args.output_dir/'evidence.json').write_text(json.dumps(evidence,indent=2));print(json.dumps({k:v for k,v in evidence.items() if k not in ['rows','revision_changed_frames']}))

if __name__=='__main__':main()
