"""Source-specific natural wood-plane attachment; no colour key or 3D claim.

Originals/private rendered media stay out of Git. Reuse the existing encoder.
"""
from __future__ import annotations
import argparse,hashlib,importlib.util,json,subprocess
from pathlib import Path
import cv2
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter

SHA='5d6ec13c437538c886b3a254eeaaed2a050f81907af1c224fac1f44696b5b859'
COUNT=96;W,H=1280,720
# R02 crossed a recessed plank join. Place the art on the continuous near plank.
QUAD=np.float32([[600,615],[920,532],[1050,605],[710,705]])
REGION=np.int32([[1030,40],[1260,40],[1260,200],[1000,270],[1000,470],[1240,650],[1240,700],[400,700]])
RECT=np.float32([[0,0],[511,0],[511,175],[0,175]])
spec=importlib.util.spec_from_file_location('existing_encoder',Path(__file__).parents[1]/'chromatic-lens-pulse/render_ab.py')
encoder=importlib.util.module_from_spec(spec);spec.loader.exec_module(encoder)
encoder.W,encoder.H,encoder.FPS=W,H,'24000/1001'

def high(a):
    a=cv2.GaussianBlur(a,(0,0),.7).astype(np.float32)
    return a-cv2.GaussianBlur(a,(0,0),6)

def ncc(a,b):
    a=a-a.mean();b=b-b.mean()
    return float((a*b).sum()/np.sqrt((a*a).sum()*(b*b).sum()))

def track(frames):
    sift=cv2.SIFT_create(nfeatures=2500);mask=np.zeros((720,1280),np.uint8)
    cv2.fillPoly(mask,[REGION],255)
    k0,d0=sift.detectAndCompute(frames[0],mask)
    global_anchor=np.eye(3);anchor=0;rows=[]
    plane=cv2.getPerspectiveTransform(QUAD,RECT);patch_ref=None
    for i,g in enumerate(frames):
        if i==0:
            matrix=np.eye(3);nin=len(k0);err=0.;spread=[1280.,720.]
            inside=np.float32([k.pt for k in k0])
        else:
            k,d=sift.detectAndCompute(g,None)
            assert d is not None
            forward=cv2.BFMatcher().knnMatch(d0,d,k=2)
            back=cv2.BFMatcher().knnMatch(d,d0,k=2)
            bmap={a.queryIdx:a.trainIdx for a,b in back if a.distance<.7*b.distance}
            matches=[a for a,b in forward if a.distance<.7*b.distance and bmap.get(a.trainIdx)==a.queryIdx]
            src=np.float32([k0[m.queryIdx].pt for m in matches]);dst=np.float32([k[m.trainIdx].pt for m in matches])
            train=np.arange(len(src))%4!=0;hold=~train
            assert train.sum()>=20 and hold.sum()>=8,(i,len(src))
            local,inliers=cv2.findHomography(src[train],dst[train],cv2.RANSAC,1.7)
            assert local is not None
            inside=src[train][inliers.ravel()>0];nin=len(inside)
            assert nin>=30
            pred=cv2.perspectiveTransform(src[hold,None],local).reshape(-1,2)
            err=float(np.median(np.linalg.norm(pred-dst[hold],axis=1)))
            spread=np.ptp(inside,axis=0).tolist()
            assert err<.7 and spread[1]>130,(i,err,spread)
            matrix=local@global_anchor;matrix/=matrix[2,2]
        quad=cv2.perspectiveTransform(QUAD[None],matrix)[0]
        assert np.all(quad>=0) and quad[:,0].max()<1280 and quad[:,1].max()<720
        assert cv2.isContourConvex(quad),i
        anchor_quad=cv2.perspectiveTransform(QUAD[None],global_anchor)[0]
        hull=cv2.convexHull(inside)
        extrap=max(0.,max(-cv2.pointPolygonTest(hull,tuple(map(float,xy)),True) for xy in anchor_quad))
        patch=cv2.warpPerspective(g,plane@np.linalg.inv(matrix),(512,176),flags=cv2.INTER_LINEAR)
        detail=high(patch)[12:-12,12:-12]
        if patch_ref is None:patch_ref=detail
        similarity=ncc(patch_ref,detail)
        assert similarity>.70,(i,similarity,'Natural patch failed, do not trust feature residual alone')
        fixed=cv2.warpPerspective(g,plane,(512,176),flags=cv2.INTER_LINEAR)
        rows.append({'frame':i,'anchor_frame':anchor,'homography':matrix.tolist(),'quad':quad.tolist(),
          'inliers':nin,'holdout_median_source_px':err,'inlier_spread_source_xy':spread,
          'quad_extrapolation_source_px':extrap,'tracked_patch_highpass_ncc':similarity,
          'fixed_patch_highpass_ncc':ncc(patch_ref,high(fixed)[12:-12,12:-12])})
        if i and i%24==0:
            current_mask=cv2.warpPerspective(mask,matrix,(1280,720),flags=cv2.INTER_NEAREST)
            k0,d0=sift.detectAndCompute(g,current_mask)
            global_anchor=matrix.copy();anchor=i
    return rows

def main():
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True)
    p.add_argument('--output-dir',type=Path,required=True)
    p.add_argument('--font',type=Path,default=Path('C:/Windows/Fonts/arialbd.ttf'))
    a=p.parse_args();assert hashlib.sha256(a.source.read_bytes()).hexdigest()==SHA
    assert a.font.is_file(),'Use an available licensed local font; do not download a replacement blindly'
    out=a.output_dir;out.mkdir(parents=True,exist_ok=True)
    c=cv2.VideoCapture(str(a.source));frames=[]
    assert (int(c.get(3)),int(c.get(4)))==(1280,720)
    for i in range(COUNT):
        ok,b=c.read();assert ok
        frames.append(cv2.cvtColor(b,cv2.COLOR_BGR2RGB))
    c.release();rows=track([cv2.cvtColor(f,cv2.COLOR_RGB2GRAY) for f in frames])
    font=ImageFont.truetype(str(a.font),100)
    def atlas(word):
        im=Image.new('L',(512,176));d=ImageDraw.Draw(im)
        assert d.textlength(word,font=font)<480
        d.text((256,88),word,font=font,fill=255,anchor='mm')
        return np.array(im.filter(ImageFilter.GaussianBlur(.65)))
    alpha0,alpha1=atlas('UNWIND'),atlas('UNPLUG')
    projection=cv2.getPerspectiveTransform(RECT,QUAD)
    versions={n:[] for n in ['plain','fixed-ink','tracked-white','tracked-ink','copy-revision']}
    support=[]
    for i,(source,row) in enumerate(zip(frames,rows)):
        matrix=np.array(row['homography'])@projection
        for name in versions:
            if name=='plain':result=source.copy()
            else:
                use=projection if name=='fixed-ink' else matrix
                art=alpha1 if name=='copy-revision' and i>=48 else alpha0
                alpha=cv2.warpPerspective(art,use,(1280,720),flags=cv2.INTER_LINEAR).astype(np.float32)/255
                if name=='tracked-white':result=np.rint(source*(1-.85*alpha[...,None])+255*.85*alpha[...,None]).clip(0,255).astype(np.uint8)
                else:result=np.rint(source*(1-.68*alpha[...,None])).clip(0,255).astype(np.uint8)
                assert np.array_equal(result[alpha==0],source[alpha==0]),'Unrelated source pixels changed'
                if name=='tracked-ink':support.append(int((alpha>0).sum()))
            versions[name].append(cv2.resize(result,(W,H),interpolation=cv2.INTER_AREA))
    assert all(np.array_equal(x,y) for x,y in zip(versions['tracked-ink'][:48],versions['copy-revision'][:48]))
    cache=out/'shot-cache';cache.mkdir(exist_ok=True);prefix=cache/'protected-prefix.mp4'
    encoder.encode(prefix,versions['tracked-ink'][:48]);hashes={}
    for name,fs in versions.items():
        target=out/(name+'.mp4')
        if name in ['tracked-ink','copy-revision']:
            tail=cache/(name+'-tail.mp4');encoder.encode(tail,fs[48:])
            listing=out/(name+'-concat.txt');assert "'" not in str(out.resolve())
            listing.write_text(''.join("file '"+f.resolve().as_posix()+"'\n" for f in [prefix,tail]))
            subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(target)],check=True)
        else:encoder.encode(target,fs)
        hashes[name]=hashlib.sha256(target.read_bytes()).hexdigest()
    im=Image.new('RGB',(320*8,200*len(versions)),'#171717');d=ImageDraw.Draw(im)
    for row,(name,fs) in enumerate(versions.items()):
        for col,i in enumerate([0,12,24,47,48,60,72,95]):
            im.paste(Image.fromarray(fs[i]).resize((320,180)),(col*320,row*200+20));d.text((col*320+3,row*200+2),f'{name} f{i}',fill='white')
    im.save(out/'preencode-contact.png')
    evidence={'source_sha256':SHA,'source_frames':[0,95],'fps':'24000/1001','frames':96,
      'initial_quad':QUAD.tolist(),'reference_wood_region':REGION.tolist(),'refresh_interval':24,
      'font_sha256':hashlib.sha256(a.font.read_bytes()).hexdigest(),'font_name':a.font.name,
      'ink_strength':.68,'atlas_defocus_px':.65,'texture_support_pixels':support,'rows':rows,'output_hashes':hashes}
    (out/'evidence.json').write_text(json.dumps(evidence,indent=2))
    print(json.dumps({'frames':len(rows),'min_inliers':min(r['inliers'] for r in rows),
      'max_holdout_median_source_px':max(r['holdout_median_source_px'] for r in rows),
      'min_tracked_patch_ncc':min(r['tracked_patch_highpass_ncc'] for r in rows),
      'end_fixed_patch_ncc':rows[-1]['fixed_patch_highpass_ncc'],'hashes':hashes},indent=2))

if __name__=='__main__':main()
