"""Explicit matte-driven outline/prelap and invert-extract operators.

No segmentation/model fetch or camera/source-time inference. Caller supplies the
current matching source frame and inspected matte, brand colour, onset and duty.
"""
import cv2
import numpy as np
from PIL import Image


def outline_depth(picture, glyph, foreground, colour, stroke=2):
    """Bottom source / solid title / source foreground / outline title.

    Exact Jihad Konda layer order. Outline stays in front while subject occludes
    the fill; not a faux drop shadow or all-outline replacement.
    """
    if glyph.mode!='L' or foreground.mode!='L' or glyph.size!=picture.size or foreground.size!=picture.size:
        raise ValueError('Same-frame same-canvas L masks required')
    if not isinstance(stroke,int) or stroke<1:raise ValueError('Positive integral stroke required')
    rgb=np.asarray(picture.convert('RGB'),dtype=float);g=np.asarray(glyph,dtype=float)/255;m=np.asarray(foreground,dtype=float)/255
    # Inner outline never expands title footprint/spacing into adjacent copy.
    eroded=cv2.erode(np.asarray(glyph),np.ones((2*stroke+1,2*stroke+1),np.uint8))/255
    outline=np.clip(g-eroded,0,1)
    fill=g*(1-m);a=np.maximum(fill,outline)
    return Image.fromarray(np.rint(rgb*(1-a[:,:,None])+np.asarray(colour)*a[:,:,None]).clip(0,255).astype('uint8'))


def incoming_subject_prelap(outgoing, incoming, matte, dark=.15, light=.85):
    """Incoming moving subject with reversed luminance before a real cut.

    Caller supplies two pre-cut incoming handles; next frame after cut must
    advance to the full incoming source. Outside matte remains exact outgoing.
    """
    if outgoing.size!=incoming.size or matte.size!=outgoing.size or matte.mode!='L':
        raise ValueError('Registered equal canvases and explicit L matte required')
    if not 0<=dark<light<=1:raise ValueError('Explicit curve endpoints in0..1 required')
    src=np.asarray(incoming.convert('RGB'),dtype=float)/255
    y=src@np.array([.2126,.7152,.0722]);tone=(light-(light-dark)*y)*255
    a=np.asarray(matte,dtype=float)/255;bg=np.asarray(outgoing.convert('RGB'),dtype=float)
    return Image.fromarray(np.rint(bg*(1-a[:,:,None])+tone[:,:,None]*a[:,:,None]).astype('uint8'))


def invert_extract(picture, black=64, white=255, softness=25, blur=5, angle=70, noise=.025, seed=0):
    """Bounded reconstruction of Premiere Invert->Extract plus Screen texture.

    Extract is modelled as luma-keyed alpha over BLACK, then Screen mixed with
    its blurred/noisy inverted image. Not a pixel-exact Adobe effect clone.
    Black/white are source-specific thresholds; alpha edges need motion review.
    """
    if not 0<=black<white<=255 or softness<=0 or blur<0 or not 0<=noise<=1:
        raise ValueError('Invalid extraction/texture settings')
    inv=255-np.asarray(picture.convert('RGB'),dtype=float)
    y=inv@np.array([.2126,.7152,.0722]);lo=np.clip((y-black)/softness,0,1)
    hi=np.ones_like(y) if white==255 else np.clip((white-y)/softness,0,1)
    # Luma-key range against BLACK; native adjustment-layer alpha/compositing
    # must be checked in the actual application, not assumed numerically equal.
    alpha=lo*hi
    # Adobe Extract is grayscale, not retained inverse RGB. Earlier coloured
    # R01/R02 study outputs are rejected controls; keep that failure recorded.
    base=np.repeat((y*alpha)[:,:,None],3,axis=2)
    length=max(1,round(blur));kernel=np.zeros((2*length+1,2*length+1),np.float32)
    theta=np.deg2rad(angle);cx=length;cy=length
    cv2.line(kernel,(round(cx-length*np.cos(theta)),round(cy-length*np.sin(theta))),(round(cx+length*np.cos(theta)),round(cy+length*np.sin(theta))),1,1);kernel/=kernel.sum()
    texture=cv2.filter2D(base,-1,kernel)
    rng=np.random.default_rng(seed);texture=np.clip(texture+rng.normal(0,noise*255,texture.shape[:2])[:,:,None]*(base.max(axis=2)>0)[:,:,None],0,255)
    screened=255-(255-base)*(255-texture)/255
    return Image.fromarray(np.rint(screened).clip(0,255).astype('uint8'))
