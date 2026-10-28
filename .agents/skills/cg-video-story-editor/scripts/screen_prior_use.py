"""Flag possible reused footage; not an automatic editorial/rights approval.

python screen_prior_use.py POST.mp4 OUTPUT.json RAW1.mp4 RAW2.mp4 --rotate-ccw
Requires FFmpeg, NumPy and SciPy. No network, cookies or account access.
"""
import argparse,json,subprocess
from pathlib import Path
import numpy as np
from scipy.fft import dctn

def hashes(path,fps,rotate=False):
    vf=('transpose=2,' if rotate else '')+f'fps={fps},scale=32:32,format=gray'
    raw=subprocess.check_output(['ffmpeg','-v','error','-threads','2','-i',str(path),'-vf',vf,'-f','rawvideo','-pix_fmt','gray','-threads','2','-'])
    frames=np.frombuffer(raw,dtype=np.uint8).reshape(-1,32,32)
    d=dctn(frames,axes=(1,2),norm='ortho')[:,:8,:8].reshape(-1,64)
    return d>np.median(d[:,1:],axis=1)[:,None]

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('post',type=Path);ap.add_argument('output',type=Path);ap.add_argument('sources',type=Path,nargs='+')
    ap.add_argument('--rotate-ccw',action='store_true');ap.add_argument('--post-fps',type=float,default=25);ap.add_argument('--source-fps',type=float,default=6);ap.add_argument('--flag-bits',type=int,default=6)
    a=ap.parse_args();old=hashes(a.post,a.post_fps);rows=[]
    if not len(old):raise ValueError('Reference has no decoded video frames')
    for source in a.sources:
        h=hashes(source,a.source_fps,a.rotate_ccw);best=[];indices=[]
        for batch in np.array_split(h,max(1,(len(h)+99)//100)):
            distances=np.count_nonzero(batch[:,None,:]!=old[None,:,:],axis=2)
            best.extend(distances.min(axis=1).tolist());indices.extend(distances.argmin(axis=1).tolist())
        i=int(np.argmin(best));row=dict(source=str(source),min_hash_distance=int(best[i]),source_time=i/a.source_fps,post_time=indices[i]/a.post_fps,flagged_source_frames=sum(x<=a.flag_bits for x in best),requires_visual_review=True);rows.append(row);print(json.dumps(row),flush=True)
    a.output.write_text(json.dumps(dict(reference=str(a.post),post_sample_fps=a.post_fps,source_sample_fps=a.source_fps,threshold_bits=a.flag_bits,warning='Screening only: grading, crop and camera similarity affect matches. No-match is not proof of never published.',results=rows),indent=2),encoding='utf-8')

if __name__=='__main__':main()
