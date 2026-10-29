"""Two cleared forward-moving forest shots: plain/uniform/ramp controls.

Source-specific practice recipe, not a sideways whip, continuous location,
general editor, native effect or interpolation model. Reuse existing encoder.
"""
from __future__ import annotations
import argparse,hashlib,importlib.util,json,subprocess
from pathlib import Path
import cv2
import numpy as np
from PIL import Image,ImageDraw

W,H,N=540,960,48
FPS=24000/1001
SOURCES={
 'canopy':('ea27751d1ad382903511d2f4d0e25ddeddea26233f14ada5348e6fc58e676953',420,540),
 'open':('a673913de1545f41ef7beaea6903d85364eebca97b8a6a520f1a942357f739e8',144,216)}
spec=importlib.util.spec_from_file_location('existing_encoder',Path(__file__).parents[1]/'chromatic-lens-pulse/render_ab.py')
encoder=importlib.util.module_from_spec(spec);spec.loader.exec_module(encoder)
encoder.FPS='24000/1001'

def motion(a,b):
    ga=cv2.cvtColor(a,cv2.COLOR_RGB2GRAY);gb=cv2.cvtColor(b,cv2.COLOR_RGB2GRAY)
    pts=cv2.goodFeaturesToTrack(ga,500,.01,7)
    assert pts is not None and len(pts)>20
    q,ok,_=cv2.calcOpticalFlowPyrLK(ga,gb,pts,None,winSize=(25,25),maxLevel=3)
    back,ob,_=cv2.calcOpticalFlowPyrLK(gb,ga,q,None,winSize=(25,25),maxLevel=3)
    good=(ok.ravel()>0)&(ob.ravel()>0)&(np.linalg.norm(back-pts,axis=2).ravel()<.8)
    p0,p1=pts[good].reshape(-1,2),q[good].reshape(-1,2)
    m,inliers=cv2.estimateAffinePartial2D(p0,p1,method=cv2.RANSAC,ransacReprojThreshold=1.3)
    assert m is not None and inliers.sum()>30
    co=np.array([W/2,H/2,1]);d=m@co-co[:2]
    return {'log_scale':float(np.log(np.hypot(m[0,0],m[1,0]))),
      'dx':float(d[0]),'dy':float(d[1]),'roll_deg':float(np.degrees(np.arctan2(m[1,0],m[0,0]))),
      'inliers':int(inliers.sum())}

def med(rows):return {k:float(np.median([r[k] for r in rows])) for k in rows[0]}

def main():
    p=argparse.ArgumentParser();p.add_argument('--canopy',type=Path,required=True)
    p.add_argument('--open-shot',type=Path,required=True);p.add_argument('--output-dir',type=Path,required=True)
    args=p.parse_args();out=args.output_dir;out.mkdir(parents=True,exist_ok=True)
    # Decode exact numbered source frames, never seek by rounded milliseconds.
    sources={};metadata={};raw_b={}
    for name,path in [('canopy',args.canopy),('open',args.open_shot)]:
        sha,lo,hi=SOURCES[name];assert hashlib.sha256(path.read_bytes()).hexdigest()==sha
        c=cv2.VideoCapture(str(path));assert (int(c.get(3)),int(c.get(4)))==(1280,720)
        metadata[name]={'sha256':sha,'source_fps':c.get(cv2.CAP_PROP_FPS),'in_frame':lo,'out_frame':hi,'crop':[438,0,405,720]}
        selected={};i=0
        while i<=hi:
            ok,f=c.read();assert ok,(name,i)
            if i>=lo:
                selected[i]=cv2.cvtColor(cv2.resize(f[:,438:843],(W,H),interpolation=cv2.INTER_AREA),cv2.COLOR_BGR2RGB)
                if name=='open':raw_b[i]=cv2.cvtColor(f,cv2.COLOR_BGR2RGB)
            i+=1
        c.release();sources[name]=selected
    # Calibrate only the boundary's actual source expansion, not the web title.
    a_source=med([motion(sources['canopy'][i],sources['canopy'][i+1]) for i in range(532,540)])
    b_source=med([motion(sources['open'][i],sources['open'][i+1]) for i in range(144,152)])
    assert a_source['log_scale']>0 and b_source['log_scale']>0,'No actual forward expansion'
    bcurve=1/3
    acurve=72*(1+bcurve)*b_source['log_scale']/(120*a_source['log_scale'])-1
    assert 0<acurve<.6,('Unsuitable boundary; do not force-fit',acurve)
    t=np.linspace(0,1,N)
    def indices(lo,hi,curve):
        u=t+curve*(t*t-t);f=np.rint(lo+(hi-lo)*u).astype(int)
        assert f[0]==lo and f[-1]==hi and np.all(np.diff(f)>0)
        return f.tolist()
    maps={
      'plain-cut':{'canopy':[int(i) for i in np.rint(np.linspace(480,539,N))],'open':list(range(144,192))},
      'uniform-retime':{'canopy':indices(420,540,0),'open':indices(144,216,0)},
      'forward-ramp':{'canopy':indices(420,540,acurve),'open':indices(144,216,-bcurve)},
      'settle-revision':{'canopy':indices(420,540,acurve),'open':indices(144,216,-1/6)}}
    versions={};cache=out/'shot-cache';cache.mkdir(exist_ok=True)
    evidence={'fps':'24000/1001','frames':N*2,'cut_frame':N,'sources':metadata,
      'a_curve':acurve,'b_curve':bcurve,'revision_b_curve':1/6,'source_boundary_motion':{'canopy':a_source,'open':b_source},
      'frame_maps':maps,'output_motion':{},'output_hashes':{}}
    a_cache=None
    for name,mapping in maps.items():
        a=[sources['canopy'][int(i)] for i in mapping['canopy']]
        b=[sources['open'][int(i)] for i in mapping['open']]
        versions[name]=a+b
        af=cache/f'{name}-a.mp4';bf=cache/f'{name}-b.mp4'
        if name=='settle-revision':
            assert all(np.array_equal(x,y) for x,y in zip(a,versions['forward-ramp'][:N]))
            af=a_cache
        else:
            encoder.encode(af,a)
            if name=='forward-ramp':a_cache=af
        encoder.encode(bf,b)
        # Reuse A's exact encoded cache for the copy/timing revision.
        listing=out/f'{name}-concat.txt'
        assert "'" not in str(out.resolve()),'Use a private path without apostrophes'
        listing.write_text(''.join("file '"+f.resolve().as_posix()+"'\n" for f in [af,bf]))
        target=out/f'{name}.mp4'
        subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(target)],check=True)
        evidence['output_hashes'][name]=hashlib.sha256(target.read_bytes()).hexdigest()
        outgoing=med([motion(a[i],a[i+1]) for i in range(N-7,N-1)])
        incoming=med([motion(b[i],b[i+1]) for i in range(6)])
        evidence['output_motion'][name]={'outgoing':outgoing,'incoming':incoming,
            'expansion_log_gap':abs(outgoing['log_scale']-incoming['log_scale'])}
    # The initial retime does not align lateral/vertical motion. A distinct
    # bounded digital incoming reframe has its own fixed-zoom negative control.
    yy,xx=np.mgrid[:H,:W].astype(np.float32);bounds=[]
    def incoming_reframe(duration,dx=0.,dy=0.,log_zoom=0.):
        result=[]
        for k,idx in enumerate(maps['forward-ramp']['open']):
            q=max(0.,1-k/duration)**3
            z=1.12*np.exp(log_zoom*q)
            mx=(640.5+dx*q+(xx+.5-W/2)*720/(H*z)-.5).astype(np.float32)
            my=(360+dy*q+(yy+.5-H/2)*720/(H*z)-.5).astype(np.float32)
            assert mx.min()>=0 and mx.max()<=1279 and my.min()>=0 and my.max()<=719,'Out-of-source sample'
            bounds.append([float(mx.min()),float(mx.max()),float(my.min()),float(my.max())])
            result.append(cv2.remap(raw_b[int(idx)],mx,my,cv2.INTER_LINEAR))
        return result
    control=incoming_reframe(12)
    goal=evidence['output_motion']['forward-ramp']['outgoing']
    initial=med([motion(control[i],control[i+1]) for i in range(6)])
    evidence['guided_parameters']={};evidence['guided_sample_bounds']=bounds
    for name,duration in [('zoom-margin-control',12),('guided-handoff',12),('guided-revision',16)]:
        if name=='zoom-margin-control':dx=dy=ez=0.;b=control
        else:
            dq=np.median([max(0.,1-(i+1)/duration)**3-max(0.,1-i/duration)**3 for i in range(6)])
            dx=(goal['dx']-initial['dx'])/(-H*1.12/720*dq)
            dy=(goal['dy']-initial['dy'])/(-H*1.12/720*dq)
            ez=(goal['log_scale']-initial['log_scale'])/dq
            assert max(abs(dx),abs(dy))<25 and abs(ez)<.03,('Reject large correction',name,float(dx),float(dy),float(ez))
            b=incoming_reframe(duration,dx,dy,ez)
            assert all(np.array_equal(x,y) for x,y in zip(b[duration:],control[duration:]))
        versions[name]=versions['forward-ramp'][:N]+b
        bf=cache/f'{name}-b.mp4';encoder.encode(bf,b)
        listing=out/f'{name}-concat.txt'
        listing.write_text(''.join("file '"+f.resolve().as_posix()+"'\n" for f in [a_cache,bf]))
        target=out/f'{name}.mp4'
        subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(target)],check=True)
        evidence['output_hashes'][name]=hashlib.sha256(target.read_bytes()).hexdigest()
        incoming=med([motion(b[i],b[i+1]) for i in range(6)])
        evidence['output_motion'][name]={'outgoing':goal,'incoming':incoming,
            'expansion_log_gap':abs(goal['log_scale']-incoming['log_scale']),
            'centre_vector_gap_px':float(np.hypot(goal['dx']-incoming['dx'],goal['dy']-incoming['dy']))}
        evidence['guided_parameters'][name]={'release_frames':duration,'crop_offset_source_xy':[float(dx),float(dy)],'extra_log_zoom':float(ez),'fixed_zoom':1.12}
    contact=Image.new('RGB',(270*8,500*len(versions)),'#111111');d=ImageDraw.Draw(contact)
    for row,(name,frames) in enumerate(versions.items()):
        for col,f in enumerate([0,24,42,47,48,53,72,95]):
            contact.paste(Image.fromarray(frames[f]).resize((270,480)),(270*col,500*row+20))
            d.text((270*col+3,500*row+3),f'{name} f{f}',fill='white')
    contact.save(out/'preencode-contact.png')
    (out/'evidence.json').write_text(json.dumps(evidence,indent=2))
    print(json.dumps({'a_curve':acurve,'motion':evidence['output_motion'],'hashes':evidence['output_hashes']},indent=2))

if __name__=='__main__':main()
