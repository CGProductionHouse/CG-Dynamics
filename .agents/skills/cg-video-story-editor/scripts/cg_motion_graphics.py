"""CG motion-graphics operators, reusable around real footage.
Technical input: a live BGR shot and timeline frame. No stock, no generated people,
no auto font substitution, no camera/face distortion; original moving pixels stay linked.
This is a testable local production operator, not a client-approved universal preset.
"""
from __future__ import annotations
import math
import cv2
import numpy as np
from PIL import Image
from camera_plane import depth_layer_rect

COPPER=(27,79,155)      # BGR #9b4f1b
TEAL=(55,47,10)        # BGR #0a2f37
WHITE=(244,245,245)
WARM=(179,211,233)
def ease(v):
    t=min(1.,max(0.,float(v)))
    return t*t*t*(t*(6*t-15)+10)
def cover(frame,w,h,fy=.5,fx=.5):
    ih,iw=frame.shape[:2]
    assert iw and ih and w>0 and h>0
    sc=max(w/iw,h/ih)
    nw=max(w,round(iw*sc));nh=max(h,round(ih*sc))
    resized=cv2.resize(frame,(nw,nh),interpolation=cv2.INTER_AREA if sc<1 else cv2.INTER_LINEAR)
    left=round((nw-w)*min(1,max(0,fx)))
    top=round((nh-h)*min(1,max(0,fy)))
    return resized[top:top+h,left:left+w].copy()
def rounded_mask(w,h,r):
    r=max(0,min(int(r),w//2,h//2))
    mask=np.zeros((h,w),np.uint8)
    if r==0:
        mask[:]=255;return mask
    cv2.rectangle(mask,(r,0),(w-r-1,h-1),255,-1)
    cv2.rectangle(mask,(0,r),(w-1,h-r-1),255,-1)
    for x,y in [(r,r),(w-r-1,r),(r,h-r-1),(w-r-1,h-r-1)]:
        cv2.circle(mask,(x,y),r,255,-1,lineType=cv2.LINE_AA)
    return mask
class GraphicsRig:
    def __init__(self,w,h,logo_path=None):
        self.w=w;self.h=h
        yy,xx=np.mgrid[0:h,0:w].astype(np.float32)
        self.radial_warm=np.exp(-(((xx-w*.83)/(w*.8))**2+((yy-h*.19)/(h*.58))**2)*2)
        self.radial_teal=np.exp(-(((xx-w*.13)/(w*.75))**2+((yy-h*.85)/(h*.8))**2)*2)
        self.grad_x=np.tile(np.linspace(0,1,w,dtype=np.float32),(h,1))
        self.logo=None
        self._layer_image=Image.new('RGBA',(w,h))
        if logo_path:
            im=Image.open(logo_path).convert('RGBA')
            alpha=im.getchannel('A')
            box=alpha.getbbox()
            if box:
                im=im.crop(box)
                im.thumbnail((int(w*.16),int(w*.16)),Image.Resampling.LANCZOS)
                rgba=np.array(im)
                self.logo=cv2.cvtColor(rgba,cv2.COLOR_RGBA2BGRA)
    def background(self,picture,seconds,accent=.9):
        w,h=self.w,self.h
        small=cv2.resize(picture,(max(1,w//12),max(1,h//12)),interpolation=cv2.INTER_AREA)
        small=cv2.GaussianBlur(small,(11,11),3)
        blurred=cv2.resize(small,(w,h),interpolation=cv2.INTER_LINEAR)
        # Actual footage stays present behind the designed source panels.
        out=blurred.astype(np.float32)*.31
        out+=np.array([25,21,10],np.float32)
        warm=(self.radial_warm*(.65+.35*math.sin(seconds*.65+1.2))*accent)[:,:,None]
        cyan=(self.radial_teal*(.7+.3*math.sin(seconds*.48+1.5)))[:,:,None]
        out+=warm*np.array([6,32,72],np.float32)
        out+=cyan*np.array([28,26,2],np.float32)
        return np.uint8(np.clip(out,0,255))
    def motif(self,board,seconds,progress=0,level=.65):
        w,h=self.w,self.h
        col=(24,48,57)
        # restrained architectural grid, backdrop only, no unreadable full-frame word
        stride=max(1,int(w*.13))
        offset=int(seconds*8)%stride
        for x in range(offset,w,stride):cv2.line(board,(x,0),(x,h),col,1,cv2.LINE_AA)
        for y in range(int(h*.1),h,max(1,int(w*.17))):
            cv2.line(board,(0,y),(w,y),col,1,cv2.LINE_AA)
        # two arc/measurement elements anchored outside live subject rather than a fake app UI
        cx=int(w*.83);cy=int(h*.19);radius=int(w*.145)
        cv2.ellipse(board,(cx,cy),(radius,radius),0,int(-65+seconds*14)%360,int(35+seconds*14)%360,(31,97,139),max(1,w//360),cv2.LINE_AA)
        cv2.circle(board,(cx,cy),int(radius*.44),(24,56,66),1,cv2.LINE_AA)
        # bottom project progress line only while a composed view is active
        y=int(h*.92);l=int(w*.12);r=int(w*.89)
        cv2.line(board,(l,y),(r,y),(42,53,55),max(1,w//450),cv2.LINE_AA)
        cv2.line(board,(l,y),(l+int((r-l)*max(0,min(1,progress))),y),(30,111,173),max(1,w//210),cv2.LINE_AA)
        if self.logo is not None:
            logo=self.logo
            lh,lw=logo.shape[:2]
            x=int(w*.065);y0=int(h*.052)
            if y0+lh<h and x+lw<w:
                alpha=(logo[:,:,3:4].astype(np.float32)/255*.72)
                patch=board[y0:y0+lh,x:x+lw].astype(np.float32)
                board[y0:y0+lh,x:x+lw]=np.uint8(patch*(1-alpha)+logo[:,:,:3]*alpha)
        return board
    def card(self,canvas,picture,centre,size,alpha=1,accent=COPPER,corner=None,
             shadow=True,focus=(.5,.5),border_scale=1.):
        w,h=self.w,self.h
        cw=max(1,round(size[0]));ch=max(1,round(size[1]))
        left=int(round(centre[0]-cw/2));top=int(round(centre[1]-ch/2))
        a=max(0,left);b=max(0,top);c=min(w,left+cw);d=min(h,top+ch)
        if a>=c or b>=d:return canvas
        if corner is None:corner=round(min(w,h)*.026)
        rounded=rounded_mask(cw,ch,corner)
        photo=cover(picture,cw,ch,fx=focus[0],fy=focus[1])
        if shadow:
            sw=max(1,int(w*.026));off=int(w*.02)
            sm=cv2.GaussianBlur(rounded,(0,0),sigmaX=sw/2,sigmaY=sw/2)
            sl=max(0,left+off);st=max(0,top+off)
            sr=min(w,left+off+cw);sb=min(h,top+off+ch)
            if sr>sl and sb>st:
                sub=sm[st-top-off:sb-top-off,sl-left-off:sr-left-off].astype(np.float32)/255*.47*alpha
                canvas[st:sb,sl:sr]=np.uint8(canvas[st:sb,sl:sr].astype(np.float32)*(1-sub[:,:,None]))
        roi=canvas[b:d,a:c]
        ly=b-top;lx=a-left
        m=rounded[ly:ly+d-b,lx:lx+c-a].astype(np.float32)/255*alpha
        source=photo[ly:ly+d-b,lx:lx+c-a].astype(np.float32)
        roi[:]=np.uint8(np.clip(roi*(1-m[:,:,None])+source*m[:,:,None],0,255))
        # intentional 1.5 px chromed border around the panel, not a wipe
        p1=(left,top);p2=(left+cw-1,top+ch-1)
        cv2.rectangle(canvas,p1,p2,accent,max(1,round(w/540*border_scale)),cv2.LINE_AA)
        return canvas
    def corners(self,img,rect,seconds,accent=COPPER):
        w=self.w;stroke=max(2,round(w/270))
        x,y,r,b=[int(v) for v in rect];length=int(w*.047)
        for px,sgnx in [(x,1),(r,-1)]:
            for py,sgny in [(y,1),(b,-1)]:
                cv2.line(img,(px,py),(px+sgnx*length,py),accent,stroke,cv2.LINE_AA)
                cv2.line(img,(px,py),(px,py+sgny*length),accent,stroke,cv2.LINE_AA)
        # single travelling hairline across the top edge as the layer settles
        pos=x+round((r-x)*ease(seconds/.65))
        cv2.line(img,(x,y),(pos,y),(160,208,230),max(1,stroke//2),cv2.LINE_AA)
        return img
def compose_feature(rig,picture,t,duration=1.5,mode='focus',accent=COPPER):
    w,h=rig.w,rig.h
    canvas=rig.motif(rig.background(picture,t),t,progress=min(1,t/duration))
    arrive=ease(t/.42)
    if mode=='focus':
        # Eased camera-space reveal → sharp footage hold
        large=ease((t-.80)/.60)
        cw=w*(.79+(.21*large))
        ch=h*(.785+(.215*large))
        x=w*(.73-.23*arrive)
        cy=h*(.55-.05*large)
        rig.card(canvas,picture,(x,cy),(cw,ch),corner=max(2,round(w*(1-large)*.028)),accent=accent)
        if large<.85:
            rig.corners(canvas,(x-cw/2,cy-ch/2,x+cw/2,cy+ch/2),t,accent)
        return canvas
    if mode=='gallery':
        # Full photo as an overscanned cinematic card; no portrait squeeze or rotation
        n=ease(t/.55)
        # Source-independent two-and-a-half-dimensional rigid photo plane from Nolan's existing camera operator
        layer={'centre':(0.,0.,0.),'world_size':(float(w),float(h)),'image':rig._layer_image}
        s=.79+.035*n
        shift=float(w*.045*(1-n))
        left,top,right,bottom=depth_layer_rect(layer,(w,h),(shift,0.,1000./s,shift,0.,0.,0.),focal=1000.)
        cw=right-left;ch=bottom-top
        x=(left+right)/2.;y=(top+bottom)/2.
        rig.card(canvas,picture,(x,y),(cw,ch),corner=round(w*.026),accent=accent)
        rig.corners(canvas,(x-cw/2,y-ch/2,x+cw/2,y+ch/2),t,accent)
        return canvas
    if mode=='split':
        # Real footage remains one moving source, not duplicated; second panel carries only graphic texture
        cw=w*.86;ch=h*.68;x=w*.5;y=h*.5
        n=ease(t/.5)
        rig.card(canvas,picture,(w*(.5+.56*(1-n)),y),(cw,ch),accent=accent)
        if n>.45:
            rig.corners(canvas,(x-cw/2,y-ch/2,x+cw/2,y+ch/2),t,accent)
        return canvas
    raise ValueError('Unknown motion-graphics mode')
