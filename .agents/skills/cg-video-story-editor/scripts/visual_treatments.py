"""Portable operators extracted from existing type, aperture, shine and panel studies.

Input/output Pillow images only: no encoder, music, client defaults or new engine.
Pass the actual approved font/colours. Keep linked source/layers/recipe for revision.
"""
from __future__ import annotations

from PIL import Image, ImageDraw
import numpy as np


def type_reveal(size, runs, font, position, time, start, stagger=.08, entrance=.35, shutter=180, fps=25):
    """Word-staggered clipped vertical resolve with spatial shutter integration.

    `runs` is [(word, approved RGB tuple), ...]; font is caller-loaded, never substituted.
    RGB is unpremultiplied and alpha carries coverage for normal compositing.
    """
    if not runs or entrance <= 0 or stagger < 0 or not 0 <= shutter <= 360 or fps <= 0:
        raise ValueError('Invalid explicit type treatment')
    w,h=size; x,y=position
    boxes=[font.getbbox(word) for word,_ in runs]
    height=max(b[3]-b[1] for b in boxes)
    width=sum(font.getlength(word) for word,_ in runs)+font.getlength(' ')*(len(runs)-1)
    if x < 0 or y < 0 or x+width > w or y+height > h:
        raise ValueError('Approved type does not fit its intended canvas; revise layout, never substitute font')
    result=Image.new('RGBA',size)
    exposure=shutter/360/fps
    samples=np.linspace(time-exposure/2,time+exposure/2,129) if shutter else np.array([time])
    for index,((word,colour),box) in enumerate(zip(runs,boxes)):
        glyph=Image.new('L',(box[2]-box[0],height))
        ImageDraw.Draw(glyph).text((-box[0],-box[1]),word,font=font,fill=255)
        alpha=np.zeros((h,w),dtype=float)
        # Integer coverage aggregation comes from graphic-transform-blur's tested recipe.
        positions=[]
        for t in samples:
            u=np.clip((t-start-index*stagger)/entrance,0,1)
            positions.append(round(y+(height+1)*(1-u)**3))
        offsets,counts=np.unique(positions,return_counts=True)
        for top,count in zip(offsets,counts):
            a=max(y,top);b=min(y+height,top+height)
            if b>a:
                alpha[a:b,round(x):round(x)+glyph.width]+=np.asarray(glyph)[a-top:b-top]*(count/len(samples))
        layer=Image.new('RGBA',size,(*colour,0));layer.putalpha(Image.fromarray(np.rint(alpha).astype(np.uint8)))
        result=Image.alpha_composite(result,layer)
        x+=font.getlength(word)+font.getlength(' ')
    return result


def registered_panels(outgoing, incoming, time, arrivals, centres, half_width, shear, resolve_at, white_seconds=0):
    """All panels reveal one common incoming source/time canvas, never duplicated fits."""
    if outgoing.size!=incoming.size or len(arrivals)!=len(centres) or not arrivals or half_width<=0:
        raise ValueError('Panels require equal canvases and explicit matched geometry/timing')
    if resolve_at<=max(arrivals) or white_seconds<0:
        raise ValueError('Invalid reveal schedule')
    if time>=resolve_at:return incoming.copy()
    w,h=incoming.size;yy,xx=np.mgrid[:h,:w];field=xx+shear*(yy-h/2)
    image=np.asarray(outgoing.convert('RGB')).copy();source=np.asarray(incoming.convert('RGB'))
    for at,centre in zip(arrivals,centres):
        if time>=at:
            mask=abs(field-centre)<half_width
            image[mask]=(242,239,227) if time-at<white_seconds else source[mask]
    return Image.fromarray(image)


def text_aperture(picture, glyph_mask, background, scale=1., pivot=None):
    """Reveal the same current source frame through caller-authored approved type.

    Scale about a FILLED stroke, not a letter counter. No source-time reset, generated
    person mask or false promise of native editable text. Return RGB composition.
    """
    if glyph_mask.mode!='L' or glyph_mask.size!=picture.size or not np.isfinite(scale) or scale<1:
        raise ValueError('Aperture needs a same-canvas L glyph mask and finite scale >=1')
    if pivot is None:pivot=(picture.width/2,picture.height/2)
    x,y=pivot
    if not 0<=x<picture.width or not 0<=y<picture.height or glyph_mask.getpixel((int(x),int(y)))<128:
        raise ValueError('Aperture pivot must lie inside an opaque letter stroke, never its counter')
    mask=glyph_mask.transform(picture.size,Image.Transform.AFFINE,
        (1/scale,0,x-x/scale,0,1/scale,y-y/scale),resample=Image.Resampling.BICUBIC)
    base=Image.new('RGB',picture.size,background)
    base.paste(picture.convert('RGB'),(0,0),mask)
    return base


def glyph_shine(layer, centre, width, shear, strength, highlight_rgb):
    """Soft highlight replaces RGB only inside an existing glyph's unchanged alpha.

    Caller supplies the approved highlight, trajectory and level. Unlike a moving
    white card, this cannot brighten surrounding footage or alter title opacity.
    """
    values=(centre,width,shear,strength,*highlight_rgb)
    if layer.mode!='RGBA' or len(highlight_rgb)!=3 or not all(np.isfinite(v) for v in values):
        raise ValueError('Shine needs an RGBA title and explicit finite RGB/geometry')
    if width<=0 or not 0<=strength<=1 or any(not 0<=v<=255 for v in highlight_rgb):
        raise ValueError('Invalid highlight width, strength or RGB')
    source=np.asarray(layer);out=source.copy();yy,xx=np.mgrid[:layer.height,:layer.width]
    amount=np.exp(-.5*((xx-shear*(yy-layer.height/2)-centre)/width)**2)*strength
    amount*=source[:,:,3]>0
    rgb=source[:,:,:3].astype(float)
    out[:,:,:3]=np.rint(rgb*(1-amount[:,:,None])+np.array(highlight_rgb)*amount[:,:,None]).astype(np.uint8)
    return Image.fromarray(out)
