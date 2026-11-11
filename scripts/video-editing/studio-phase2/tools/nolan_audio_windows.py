"""Offline long-recording multi-window identity analysis for Nolan's EXISTING music history.
Recording-hash likeness is review evidence, NEVER licensing, taste or approval.
"""
from __future__ import annotations
import argparse,hashlib,json,math,sys
from pathlib import Path
from datetime import datetime,timezone
ROOT=next((p for p in Path(__file__).resolve().parents if (p/'nolan_audio_identity.py').is_file()),None)
if ROOT is None:raise RuntimeError('Existing Nolan audio identity runtime not found')
if str(ROOT) not in sys.path:sys.path.insert(0,str(ROOT))
from nolan_audio_identity import identity
from nolan_guard import load_history,fingerprint_similarity,atomic

SCHEMA=1
WINDOW=120.0
OVERLAP=20.0
MAX_WINDOWS=8
THRESHOLD=.92

def plan_windows(duration:float,window=WINDOW,overlap=OVERLAP,max_windows=MAX_WINDOWS)->dict:
    if not isinstance(duration,(int,float)) or not math.isfinite(duration) or duration <10:
        raise ValueError('Source must have >=10 finite seconds of audio')
    if not (10<=window<=300) or not (10<=overlap<window) or not (1<=max_windows<=8):
        raise ValueError('Unsupported bounded fingerprint plan')
    if duration<=window:
        return {'windows':[{'start_seconds':0.0,'seconds':round(float(duration),6)}],
                'coverage_complete':True,'covered_until_seconds':round(float(duration),6),'source_duration_seconds':float(duration)}
    steps=math.ceil((duration-window)/(window-overlap))
    count=steps+1
    if count<=max_windows:
        starts=[i*(duration-window)/steps for i in range(count)]
        complete=True
    else:
        starts=[i*(window-overlap) for i in range(max_windows)]
        complete=False
    windows=[{'start_seconds':round(float(s),6),'seconds':round(min(window,duration-s),6)}
             for s in starts]
    return {'windows':windows,'coverage_complete':complete,
            'covered_until_seconds':round(windows[-1]['start_seconds']+windows[-1]['seconds'],6),
            'source_duration_seconds':round(float(duration),6),
            'overlap_seconds':overlap,'max_windows':max_windows}

def fingerprint_windows(source:Path,*,cache:Path)->dict:
    source=Path(source).resolve()
    if not source.is_file():raise FileNotFoundError(source)
    # Actual durations come from the existing proven source-bound fpcalc/ffprobe path.
    first=identity(source,start=0,seconds=WINDOW,cache=cache)
    plan=plan_windows(first['source_duration_seconds'])
    records=[first]
    for w in plan['windows'][1:]:
        records.append(identity(source,start=w['start_seconds'],
                                seconds=w['seconds'],cache=cache))
    digests={r['source_sha256'] for r in records}
    if len(digests)!=1:raise ValueError('Source changed across fingerprint windows')
    windows=[]
    for r in records:
        w=r['window'];f=r['fingerprint']
        windows.append({'start_seconds':w['start_seconds'],'seconds':w['duration_seconds'],
                        'fingerprint':{'algorithm':f['algorithm'],'values':f['values']},
                        'source_sha256':r['source_sha256'],
                        'cache_hit':r['cache_hit'],
                        'cache_record':r['cache_record']})
    return {'schema':SCHEMA,'source_sha256':first['source_sha256'],
            'source_duration_seconds':plan['source_duration_seconds'],
            'windows':windows,'coverage_complete':plan['coverage_complete'],
            'covered_until_seconds':plan['covered_until_seconds'],
            'uncovered_tail_seconds':round(max(0,plan['source_duration_seconds']-plan['covered_until_seconds']),6),
            'meaning':'Recording similarity window coverage; not perceptual style/taste or creative approval',
            'external_upload':False,'creative_approval':False}

def compare_windows(source:dict,history:list[dict],*,threshold=THRESHOLD)->dict:
    if source.get('schema')!=SCHEMA or not source.get('windows'):
        raise ValueError('Invalid source window record')
    if not 0.8<=threshold<=1.0:raise ValueError('Unqualified threshold')
    source_sha=source.get('source_sha256','')
    if len(source_sha)!=64:raise ValueError('Source lacks bound SHA256')
    valid_s=[]
    for w in source['windows']:
        if w.get('source_sha256')!=source_sha:raise ValueError('Window source digest mismatch')
        fp=w.get('fingerprint',{})
        if fp.get('algorithm')!='chromaprint_raw_v1' or len(fp.get('values',[]))<80:
            raise ValueError('Window fingerprint missing/invalid')
        valid_s.append(w)
    seen=set();missing=0;compared=0;results=[]
    for idx,h in enumerate(history):
        f=h.get('fingerprint',{})
        historical=[]
        if f.get('values'):
            historical=[{'fingerprint':f,'start_seconds':0}]
        for w in h.get('fingerprint_windows',[]):
            if isinstance(w,dict) and w.get('fingerprint',{}).get('values'):
                historical.append(w)
        if not historical:
            missing+=1
            continue
        key=h.get('sha256') or h.get('record_id') or ('index',idx)
        if key in seen:continue
        seen.add(key);compared+=1
        if any(w['fingerprint'].get('algorithm')!='chromaprint_raw_v1' for w in historical):
            missing+=1;continue
        best=None
        for a in valid_s:
            for b in historical:
                sim=fingerprint_similarity(a['fingerprint']['values'],b['fingerprint']['values'])
                score=sim.get('score')
                if score is not None and (best is None or score>best['score']):
                    best={'score':score,'source_start_seconds':a['start_seconds'],
                          'history_start_seconds':b.get('start_seconds',0),
                          'offset_frames':sim['offset'],
                          'aligned_frames':sim['compared_frames'],
                          'coverage_of_shorter':sim['coverage_of_shorter']}
        if best and best['score']>=threshold:
            results.append({'record_id':h.get('record_id'),'title':h.get('title'),
                            'history_status':h.get('status'),'comparison':best})
    # A negative screen is NEVER music clearance; incomplete history is explicit.
    return {'state':'RECORDING_MATCH_REVIEW_HOLD' if results else 'NO_MATCH_IN_SCREENED_WINDOWS_NOT_CLEARANCE',
            'matches':results,'history_rows':len(history),'unique_recordings_compared':compared,
            'history_rows_without_usable_fingerprints':missing,'source_coverage_complete':source.get('coverage_complete') is True,
            'historical_coverage_complete':missing==0,'threshold':threshold,
            'creative_approval':False,
            'limitations':['No fingerprint means unknown, never permitted reuse',
                           'Pitch/tempo changes, heavily mixed voiceover and emotionally similar compositions not qualified',
                           'Only available source and historical windows compared','Owner exclusions and source licence remain stronger selection gates']}

def main(argv=None)->int:
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('source',type=Path)
    p.add_argument('--shared',type=Path,default=Path(r'D:\OneDrive\CG Production House\Video Editing System'))
    p.add_argument('--output',type=Path,required=True)
    a=p.parse_args(argv)
    if a.output.exists():raise ValueError('Do not overwrite a prior receipt')
    rec=fingerprint_windows(a.source,cache=a.shared/'research/audio-identity-cache')
    result={'generated_utc':datetime.now(timezone.utc).isoformat(),
            'source':{'sha256':rec['source_sha256'],'duration_seconds':rec['source_duration_seconds'],
                     'window_count':len(rec['windows']),'window_positions':[w['start_seconds'] for w in rec['windows']],
                     'coverage_complete':rec['coverage_complete'],'uncovered_tail_seconds':rec['uncovered_tail_seconds']},
            'history':compare_windows(rec,load_history(a.shared)),
            'source_record':rec}
    atomic(a.output,result)
    print(json.dumps({k:v for k,v in result.items()if k!='source_record'},indent=2))
    return 2 if result['history']['matches'] else 0

if __name__=='__main__':raise SystemExit(main())