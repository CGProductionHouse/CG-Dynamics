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


def depth_layer_rect(layer, size, pose, focal=1000):
    """Parallel image planes: uniform scale/translation, no face keystone/mesh.

    Explicit centre=(x,y,z), world_size=(w,h); camera looks straight down -Z.
    This is authored 2.5D graphic depth, not recovered scene/person depth.
    """
    cx,cy,cz,tx,ty,tz,roll=map(float,pose)
    if not np.isfinite([*pose,focal]).all() or focal<=0:
        raise ValueError('Finite explicit camera and positive focal length required')
    if abs(cx-tx)>1e-6 or abs(cy-ty)>1e-6 or tz>=cz or abs(roll)>1e-6:
        raise ValueError('Parallel depth layers require straight camera/no roll; do not warp photos')
    x,y,z=layer['centre'];ww,wh=layer['world_size'];im=layer['image']
    if not np.isfinite([x,y,z,ww,wh]).all() or min(ww,wh)<=0 or cz-z<=1:
        raise ValueError('Layer must have positive finite geometry in front of camera')
    if abs(ww/wh-im.width/im.height)>1e-6:
        raise ValueError('Preserve source aspect ratio; no stretching a photographic layer')
    scale=focal/(cz-z);w,h=size
    left=w/2+(x-cx-ww/2)*scale;top=h/2-(y-cy+wh/2)*scale
    return (left,top,left+ww*scale,top+wh*scale)


def render_depth_layers(layers,size,keys,time,focal=1000,fps=25,shutter=90,samples=17,
                        background=(18,24,28)):
    """Composite authored parallel RGBA planes far-to-near with temporal sampling.

    Warp premultiplied RGB+alpha together to avoid dark colour fringes. Shadows
    should be designed in the same plane/group as their card, not falsely labelled
    physical contact shadows. Supplied artwork/pose keys stay separately revisable.
    """
    if (not layers or fps<=0 or not 0<=shutter<=360 or samples<1 or
            not math.isfinite(time) or not np.isfinite([fps,shutter]).all()):
        raise ValueError('Explicit layers and finite temporal sampling required')
    ids=[l.get('id') for l in layers]
    if any(not isinstance(x,str) or not x for x in ids) or len(ids)!=len(set(ids)):
        raise ValueError('Persistent unique layer IDs required')
    ordered=sorted(layers,key=lambda l:l['centre'][2])
    exposure=shutter/360/fps
    times=np.linspace(time-exposure/2,time+exposure/2,samples) if shutter else [time]
    poses=[camera_pose(keys,t) for t in times]
    if all(np.array_equal(poses[0],p) for p in poses[1:]):poses=poses[:1]
    prepared=[]
    for l in ordered:
        a=np.asarray(l['image'].convert('RGBA'),np.float32)/255
        a[:,:,:3]*=a[:,:,3:4]
        prepared.append((l,a))
    accum=np.zeros((size[1],size[0],3),np.float32)
    for pose in poses:
        frame=np.empty_like(accum);frame[:]=np.asarray(background)/255
        for l,a in prepared:
            left,top,right,bottom=depth_layer_rect(l,size,pose,focal)
            sx=(right-left)/l['image'].width;sy=(bottom-top)/l['image'].height
            matrix=np.float32([[sx,0,left],[0,sy,top]])
            projected=cv2.warpAffine(a,matrix,size,flags=cv2.INTER_LINEAR,
                                      borderMode=cv2.BORDER_CONSTANT,borderValue=0)
            frame=projected[:,:,:3]+frame*(1-projected[:,:,3:4])
        accum+=frame
    return Image.fromarray(np.rint(np.clip(accum/len(poses),0,1)*255).astype('uint8'))


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
