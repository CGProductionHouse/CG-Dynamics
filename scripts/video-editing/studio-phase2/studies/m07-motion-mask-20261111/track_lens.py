"""Source-bound Lucas-Kanade lens tracking, silent engineering study only."""
import cv2
import hashlib
import json
import numpy as np
from pathlib import Path

SOURCE=Path(r"C:\Users\info\Documents\Codex\2026-10-27\n\work\tools\nolan-browser-motion\overall-development-20261110\camera-lab-r02\NOLAN-NATIVE-3D-CAMERA-QUALIFICATION.mp4")
EXPECTED="0b771891a9313d20e370774810523a0c951097d8bcd7681f20e3b07a7afb0b22"
CENTRE=np.array([1138.0,597.0],dtype=np.float64)
RADIUS=117.0
DOWNSAMPLE=0.5

def source_frames(path=SOURCE):
    p=Path(path)
    if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=EXPECTED: raise ValueError("SOURCE_HASH_MISMATCH")
    v=cv2.VideoCapture(str(p))
    fps=v.get(cv2.CAP_PROP_FPS)
    count=int(v.get(cv2.CAP_PROP_FRAME_COUNT))
    w=int(v.get(cv2.CAP_PROP_FRAME_WIDTH));h=int(v.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if count!=90 or w!=1920 or h!=1080 or abs(fps-30)>0.001:
        v.release(); raise ValueError("UNEXPECTED_SOURCE_METADATA")
    frames=[]
    for i in range(count):
        ok,frame=v.read()
        if not ok or frame is None or frame.shape!=(h,w,3): raise ValueError("INCOMPLETE_VIDEO")
        frames.append(frame)
    v.release()
    return frames

def initial_features(gray):
    h,w=gray.shape
    x,y=np.meshgrid(np.arange(w),np.arange(h))
    radial=np.sqrt((x-CENTRE[0]*DOWNSAMPLE)**2+(y-CENTRE[1]*DOWNSAMPLE)**2)
    mask=((radial>36)&(radial<64)).astype(np.uint8)*255
    p=cv2.goodFeaturesToTrack(gray,maxCorners=125,qualityLevel=0.008,minDistance=4,blockSize=5,mask=mask)
    if p is None or len(p)<25: raise ValueError("NO_SOURCE_FEATURES")
    return p.astype(np.float32)

def track(frames):
    first=cv2.cvtColor(cv2.resize(frames[0],None,fx=DOWNSAMPLE,fy=DOWNSAMPLE),cv2.COLOR_BGR2GRAY)
    points=initial_features(first)
    original_count=len(points)
    gray_old=first
    cumulative=np.eye(3,dtype=np.float64)
    path=[]
    for i,frame in enumerate(frames):
        if i:
            gray=cv2.cvtColor(cv2.resize(frame,None,fx=DOWNSAMPLE,fy=DOWNSAMPLE),cv2.COLOR_BGR2GRAY)
            nxt,st,_=cv2.calcOpticalFlowPyrLK(gray_old,gray,points,None,winSize=(25,25),maxLevel=3,criteria=(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,30,0.008))
            back,bst,_=cv2.calcOpticalFlowPyrLK(gray,gray_old,nxt,None,winSize=(25,25),maxLevel=3)
            good=(st.reshape(-1)==1)&(bst.reshape(-1)==1)&(np.linalg.norm(back.reshape(-1,2)-points.reshape(-1,2),axis=1)<1.4)
            old=points[good].reshape(-1,2);new=nxt[good].reshape(-1,2)
            if len(old)<12: raise ValueError(f"TRACK_LOST_AT_FRAME_{i}")
            matrix,inliers=cv2.estimateAffinePartial2D(old,new,method=cv2.RANSAC,ransacReprojThreshold=1.75,maxIters=500)
            if matrix is None or inliers is None or int(inliers.sum())<10: raise ValueError(f"RANSAC_FAILED_AT_FRAME_{i}")
            ratio=float(inliers.sum())/len(old)
            if ratio<.66: raise ValueError(f"UNSTABLE_TRACK_AT_FRAME_{i}")
            M=np.eye(3,dtype=np.float64);M[:2]=matrix
            scale=np.sqrt(abs(np.linalg.det(M[:2,:2])))
            if not .94<scale<1.06: raise ValueError(f"ABRUPT_FRAME_SCALE_AT_{i}")
            cumulative=M@cumulative
            points=new[inliers.ravel()==1].reshape(-1,1,2).astype(np.float32)
            gray_old=gray
        else: ratio=1.0
        center=cumulative@np.array([CENTRE[0]*DOWNSAMPLE,CENTRE[1]*DOWNSAMPLE,1.0])
        scl=np.sqrt(abs(np.linalg.det(cumulative[:2,:2])))
        path.append({"frame":i,"center":[round(float(center[0]/DOWNSAMPLE),3),round(float(center[1]/DOWNSAMPLE),3)],"scale":round(float(scl),5),"features":len(points),"inlier_fraction":round(ratio,4)})
    xy=np.array([q["center"] for q in path])
    if np.linalg.norm(xy[-1]-xy[0])<22: raise ValueError("INSUFFICIENT_REAL_SOURCE_MOTION")
    if min(q["features"] for q in path)<12: raise ValueError("TRACK_INLIERS_TOO_FEW")
    return {"source":str(SOURCE),"source_sha256":EXPECTED,"frames":len(frames),"method":"pyramidal_LK_forward_backward_plus_RANSAC_affine","initial_features":original_count,"positions":path,"end_to_start_px":round(float(np.linalg.norm(xy[-1]-xy[0])),3),"min_inlier_fraction":min(q["inlier_fraction"] for q in path)}
if __name__=="__main__":
    frames=source_frames()
    result=track(frames)
    Path(__file__).with_name("tracking.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
    print(json.dumps({"frames":result["frames"],"initial_features":result["initial_features"],"end_to_start_px":result["end_to_start_px"],"min_inlier_fraction":result["min_inlier_fraction"],"first":result["positions"][0],"middle":result["positions"][44],"last":result["positions"][-1]}))