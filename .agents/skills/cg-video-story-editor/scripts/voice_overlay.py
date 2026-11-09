"""Rights/locale-bound narration timing and deterministic ducking envelopes.

No service call, voice cloning, identity claim or automatic creative approval.
Accept real licensed/consented narration; separate engineering-only test voices.
"""
import numpy as np

def validate_voice(profile,required_locale='en-ZA',production=True):
    required=['voice_id','locale','source','rights_scope','script_sha256','audio_sha256']
    missing=[x for x in required if not profile.get(x)]
    if missing:raise ValueError('Missing narration provenance: '+', '.join(missing))
    if production:
        if profile['locale']!=required_locale:raise ValueError('Voice locale is not the requested brand locale')
        if profile.get('engineering_only') or profile['rights_scope'] not in ['commercial_licensed','consented_original']:raise ValueError('Narration is not cleared for production')
        if profile.get('pronunciation_reviewed') is not True or profile.get('accent_reviewed') is not True:raise ValueError('Pronunciation/accent review is not witnessed')
    return dict(production_eligible=production,voice_id=profile['voice_id'],locale=profile['locale'],meaning='Provenance gate only; actual script/audio/mix still needs review')

def place_segments(segments,sample_rate,total_seconds):
    """Segments [(start_seconds, mono/stereo PCM)] with no silent overwrite."""
    output=np.zeros((round(total_seconds*sample_rate),2),np.float64);occupied=[]
    for start,audio in segments:
        a=np.asarray(audio,dtype=float)
        if a.ndim==1:a=np.column_stack((a,a))
        if a.ndim!=2 or a.shape[1]!=2 or not np.isfinite(a).all() or start<0:raise ValueError('Finite mono/stereo audio at nonnegative time required')
        first=round(start*sample_rate);last=first+len(a)
        if last>len(output) or any(first<b and last>a for a,b in occupied):raise ValueError('Narration overlaps or extends outside picture; revise pacing instead of clipping')
        output[first:last]+=a;occupied.append((first,last))
    return output

def ducking_envelope(voice,sample_rate,reduction_db=9,threshold_db=-42,attack=.025,release=.2,lookahead=0,hold=0):
    """Offline bed gain; optional anticipation/hold preserve phrase onsets/gaps.

    Speech stays fixed in time and gain. Defaults retain the causal control;
    lookahead is an offline envelope preview, not latency-free live ducking.
    """
    if not np.isfinite([sample_rate,reduction_db,threshold_db,attack,release,lookahead,hold]).all() or sample_rate<=0 or attack<=0 or release<=0 or reduction_db<0 or lookahead<0 or hold<0:raise ValueError('Finite positive timing/rate and nonnegative reduction/lookahead/hold required')
    a=np.asarray(voice,dtype=float)
    if a.ndim not in (1,2) or (a.ndim==2 and a.shape[1]!=2) or not np.isfinite(a).all():raise ValueError('Finite mono/stereo voice required')
    a=np.mean(a*a,axis=1) if a.ndim==2 else a*a
    block=max(1,round(.01*sample_rate));target=np.ones(len(a));floor=10**(-reduction_db/20)
    for first in range(0,len(a),block):
        if np.sqrt(np.mean(a[first:first+block]))>=10**(threshold_db/20):target[first:first+block]=floor
    if (lookahead or hold) and len(a):
        active=target<1
        edges=np.diff(np.r_[False,active,False].astype(np.int8))
        starts=np.flatnonzero(edges==1);ends=np.flatnonzero(edges==-1)
        counts=np.zeros(len(a)+1,np.int32)
        np.add.at(counts,np.maximum(0,starts-round(lookahead*sample_rate)),1)
        np.add.at(counts,np.minimum(len(a),ends+round(hold*sample_rate)),-1)
        target=np.where(np.cumsum(counts[:-1])>0,floor,1.)
    out=np.empty_like(target);gain=1.
    for i,v in enumerate(target):
        tau=attack if v<gain else release;gain=v+(gain-v)*np.exp(-1/(sample_rate*tau));out[i]=gain
    return out
