"""Stateful information/UI motion on an existing Pillow composition.

Stable identity and bounded geometry; caller owns brand assets and true content.
No fabricated app, financial value, interaction recording or new editor engine.
"""
import math
from PIL import ImageDraw

def settle(time,start,end):
    if end<=start:raise ValueError('A move needs positive duration')
    u=max(0.,min(1.,(time-start)/(end-start)))
    return u*u*u*(u*(u*6-15)+10)

def interpolate_rect(a,b,progress):
    if len(a)!=4 or len(b)!=4 or not all(math.isfinite(x) for x in [*a,*b,progress]):raise ValueError('Finite rectangles required')
    if a[2]<=a[0] or a[3]<=a[1] or b[2]<=b[0] or b[3]<=b[1] or not 0<=progress<=1:raise ValueError('Ordered rectangles and bounded progress required')
    return tuple(x+(y-x)*progress for x,y in zip(a,b))

def focus_frame(image,rect_a,rect_b,time,start,end,colour,width=4,radius=18):
    """One persistent focus frame moves/reflows; no scene-wide crossfade."""
    r=interpolate_rect(rect_a,rect_b,settle(time,start,end))
    if r[0]<0 or r[1]<0 or r[2]>image.width or r[3]>image.height:raise ValueError('Focus frame escapes canvas')
    out=image.copy();ImageDraw.Draw(out).rounded_rectangle(r,radius=radius,outline=colour,width=width)
    return out

def cursor_event(image,xy,time,at,colour,duration=.32):
    """Explicit illustrative pointer event; caller never labels it real app use."""
    out=image.copy();u=(time-at)/duration
    if 0<=u<=1:
        radius=5+20*settle(time,at,at+duration)
        ImageDraw.Draw(out).ellipse((xy[0]-radius,xy[1]-radius,xy[0]+radius,xy[1]+radius),outline=colour,width=max(1,round(4*(1-u))))
    return out

def reflow_rows(ids,selected_id,top,collapsed_height,expanded_height,gap):
    """Persistent row IDs get new geometry when one expands; no item cloning."""
    if len(set(ids))!=len(ids) or selected_id not in ids or min(collapsed_height,expanded_height)<=0 or gap<0:
        raise ValueError('Unique IDs, selected item and positive row geometry required')
    rows={};y=top
    for ident in ids:
        height=expanded_height if ident==selected_id else collapsed_height
        rows[ident]=(y,y+height);y+=height+gap
    return rows

def validate_ui_plan(plan):
    """CA UI-01 planning requirement; renderer/output checks still prove use."""
    choices=[c for c in plan.get('skill_applications',[]) if c.get('role')=='ui']
    if not choices:return ['UI-01 requires an actual UI/information-motion application in this film']
    errors=[]
    for choice in choices:
        p=choice.get('parameters',{});ids=p.get('component_ids',[]);states=p.get('state_ids',[])
        if not isinstance(ids,list) or not ids or any(not isinstance(x,str) or not x for x in ids) or len(set(ids))!=len(ids):errors.append('UI-01 requires explicit unique persistent component_ids')
        if not isinstance(states,list) or len(states)<2 or any(not isinstance(x,str) or not x for x in states) or len(set(states))!=len(states):errors.append('UI-01 requires at least two explicit state_ids')
        if not choice.get('purpose') or not choice.get('mechanism'):errors.append('UI-01 requires the viewer purpose and actual transition mechanism')
    return errors
