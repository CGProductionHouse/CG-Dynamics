"""Perspective camera over an explicit flat composition; no invented depth.

Pillow/NumPy/OpenCV only. Pass approved artwork and caller-owned camera keys.
Keys: (seconds, (camera_x,y,z), (target_x,y,z), roll_degrees).
World artwork is centred at z=0; x right, y up. Pixels are world units.
"""
import math
import cv2
import numpy as np
from PIL import Image


def camera_pose(keys, time, eased=True):
    if len(keys)<2 or any(keys[i+1][0]<=keys[i][0] for i in range(len(keys)-1)):
        raise ValueError('Camera keys need strictly increasing times')
    values=np.asarray([list(k[1])+list(k[2])+[k[3]] for k in keys],float)
    if values.shape!=(len(keys),7) or not np.isfinite(values).all():
        raise ValueError('Finite camera, target and roll required')
    if time<=keys[0][0]:return values[0]
    if time>=keys[-1][0]:return values[-1]
    i=next(i for i in range(len(keys)-1) if keys[i][0]<=time<keys[i+1][0])
    u=(time-keys[i][0])/(keys[i+1][0]-keys[i][0])
    if eased:u=u*u*u*(u*(u*6-15)+10)
    return values[i]*(1-u)+values[i+1]*u


def project_corners(source_size, output_size, pose, fov_y=40):
    if not 1<fov_y<179:raise ValueError('Vertical FOV must be between 1 and179 degrees')
    camera=np.asarray(pose[:3]);target=np.asarray(pose[3:6]);forward=target-camera
    if np.linalg.norm(forward)<1e-6:raise ValueError('Camera cannot equal target')
    forward=forward/np.linalg.norm(forward);right=np.cross(forward,[0.,1.,0.])
    if np.linalg.norm(right)<1e-6:raise ValueError('Camera up vector degenerates')
    right/=np.linalg.norm(right);up=np.cross(right,forward)
    theta=math.radians(pose[6]);r=right*math.cos(theta)+up*math.sin(theta);u=up*math.cos(theta)-right*math.sin(theta)
    sw,sh=source_size;w,h=output_size;f=.5*h/math.tan(math.radians(fov_y)/2)
    points=np.array([[-sw/2,sh/2,0],[sw/2,sh/2,0],[sw/2,-sh/2,0],[-sw/2,-sh/2,0]])-camera
    depth=points@forward
    if (depth<=1).any():raise ValueError('Plane crosses/behind camera; revise pose')
    return np.column_stack((w/2+f*(points@r)/depth,h/2-f*(points@u)/depth)).astype('float32')


def render_camera(artwork, size, keys, time, fps=25, shutter=90, samples=33,
                  eased=True, background=(19,24,22), fov_y=40):
    if fps<=0 or not 0<=shutter<=360 or samples<1:raise ValueError('Invalid temporal shutter')
    source=np.asarray(artwork.convert('RGB'));sw,sh=artwork.size
    src=np.float32([[0,0],[sw,0],[sw,sh],[0,sh]])
    exposure=shutter/360/fps
    times=np.linspace(time-exposure/2,time+exposure/2,samples) if shutter else [time]
    poses=[camera_pose(keys,t,eased) for t in times]
    # Sharp locked holds: no needless blur or numeric averaging at rest.
    if all(np.array_equal(poses[0],p) for p in poses[1:]):poses=poses[:1]
    accum=np.zeros((size[1],size[0],3),np.float32)
    for pose in poses:
        dst=project_corners(artwork.size,size,pose,fov_y)
        matrix=cv2.getPerspectiveTransform(src,dst)
        accum+=cv2.warpPerspective(source,matrix,size,flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=background)
    return Image.fromarray(np.rint(accum/len(poses)).astype('uint8'))


if __name__=='__main__':
    import argparse,json,subprocess
    from pathlib import Path
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artwork',required=True,type=Path)
    parser.add_argument('--recipe',required=True,type=Path)
    parser.add_argument('--keys',default='current_keys')
    parser.add_argument('--ffmpeg',required=True,type=Path)
    parser.add_argument('--output',required=True,type=Path)
    args=parser.parse_args();plan=json.loads(args.recipe.read_text(encoding='utf-8'))
    if args.output.exists():raise ValueError('Use a fresh output path; preserve earlier revisions')
    cv2.setNumThreads(2);artwork=Image.open(args.artwork).convert('RGB');size=tuple(plan['size']);fps=plan['fps']
    proc=subprocess.Popen([str(args.ffmpeg),'-v','error','-nostdin','-f','rawvideo','-pix_fmt','rgb24','-s',f'{size[0]}x{size[1]}','-r',str(fps),'-i','-','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',str(args.output)],stdin=subprocess.PIPE)
    try:
        for i in range(plan['frames']):
            frame=render_camera(artwork,size,plan[args.keys],i/fps,fps=fps,
                shutter=plan['current_shutter'],samples=plan['current_samples'],fov_y=plan['fov_y'])
            proc.stdin.write(frame.tobytes())
    finally:proc.stdin.close()
    if proc.wait()!=0:raise RuntimeError('FFmpeg encode failed; partial output is not accepted')
