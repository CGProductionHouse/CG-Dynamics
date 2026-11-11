"""Actual encoded 1080p Lottie effect/static/late controls; source-bound objective checks."""
import json,hashlib,subprocess,sys
from pathlib import Path
import numpy as np
from PIL import Image
from create_jobs import ROOT,MODES,sha,FRAMES,FPS
R=ROOT.parent
FF=R.parent/'ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe'
PROBE=R.parent/'ffmpeg-9.0.2-essentials_build/bin/ffprobe.exe'
ROI=(995,155,1750,910)
OUTSIDE=(180,175,870,255)
FRAMES_TO_CHECK=(0,18,35,45,70,89)
errors=[]
receipts={}
arrays={}
def run(args):
    p=subprocess.run([str(a) for a in args],capture_output=True,creationflags=subprocess.CREATE_NO_WINDOW,timeout=240)
    if p.returncode:raise RuntimeError('Command failed: '+p.stderr.decode('utf8',errors='replace')[-500:])
    return p.stdout
def cropdiff(a,b,region):
    a=np.asarray(Image.open(a).convert('RGB').crop(region),dtype=np.int16)
    b=np.asarray(Image.open(b).convert('RGB').crop(region),dtype=np.int16)
    return round(float(np.abs(a-b).mean()),4)
def check(ok,name,details=None):
    receipts.setdefault('checks',[]).append({'name':name,'pass':bool(ok),'details':details})
    if not ok:errors.append(name)
for mode in MODES:
    d=ROOT/('qualification-'+mode)
    config=json.loads((d/'config.json').read_text())
    media=d/'output'/config['output_name']
    if not media.is_file():raise RuntimeError('Actual rendered output absent: '+str(media))
    report=json.loads((d/'output/REPORT.json').read_text())
    meta=json.loads(run([PROBE,'-v','error','-show_streams','-show_format','-of','json',media]))
    videos=[x for x in meta['streams'] if x['codec_type']=='video']
    v=videos[0]
    check(v.get('width')==1920 and v.get('height')==1080,mode+':NATIVE_1080P')
    check(int(v.get('nb_frames',0))==FRAMES,mode+':ENCODED_90_FRAMES',v.get('nb_frames'))
    check(abs(float(meta['format']['duration'])-3)<.04,mode+':THREE_SECOND_CLOCK',meta['format']['duration'])
    check(len([x for x in meta['streams'] if x['codec_type']=='audio'])==0,mode+':SILENT_STUDY_ONLY')
    check(report.get('deterministic_seek') is True,mode+':OUT_OF_ORDER_SEEK')
    check(report.get('decoded_all_frames') is True,mode+':RENDERER_FULL_DECODE')
    check(not (report.get('page_errors') or report.get('external_requests') or report.get('geometry_errors')),mode+':PAGE_NETWORK_BOUNDS')
    check(sha(media)==report.get('video_sha256'),mode+':EXACT_SHA_RECEIPT')
    run([FF,'-v','error','-nostdin','-i',media,'-f','null','NUL'])
    check(True,mode+':INDEPENDENT_FULL_DECODE')
    folder=d/'sampled';folder.mkdir(exist_ok=True)
    for frame in FRAMES_TO_CHECK:
        target=folder/f'f{frame:03d}.png'
        if target.exists():raise RuntimeError('Sample already exists: '+str(target))
        run([FF,'-v','error','-nostdin','-i',media,'-vf','select=eq(n\\,'+str(frame)+')','-fps_mode','passthrough','-frames:v','1',target])
        check(target.is_file() and target.stat().st_size>5000,mode+':EXACT_FRAME_'+str(frame))
        arrays[(mode,frame)]=target
    receipts[mode]={'mp4':str(media),'sha256':sha(media),'bytes':media.stat().st_size,'duration':meta['format']['duration'],'source':sha(d/'assets/source.lottie.json')}
for f in (35,70):
    eff=arrays[('effect',f)];plain=arrays[('plain',f)];late=arrays[('late',f)]
    receipts['comparison_frame_'+str(f)]={'effect_plain':cropdiff(eff,plain,ROI),'effect_late':cropdiff(eff,late,ROI),'late_plain':cropdiff(late,plain,ROI),'outside_effect_plain':cropdiff(eff,plain,OUTSIDE)}
d0=cropdiff(arrays[('effect',0)],arrays[('effect',70)],ROI)
p0=cropdiff(arrays[('plain',0)],arrays[('plain',70)],ROI)
neg35=cropdiff(arrays[('late',35)],arrays[('plain',35)],ROI)
effect35=cropdiff(arrays[('effect',35)],arrays[('plain',35)],ROI)
effect70=cropdiff(arrays[('effect',70)],arrays[('plain',70)],ROI)
negative70=cropdiff(arrays[('late',70)],arrays[('plain',70)],ROI)
check(d0>1,'ACTUAL_LOTTIE_VECTOR_MOVES',d0)
check(p0<1,'PLAIN_FRAME_ZERO_HOLDS',p0)
check(effect35>1.5,'DESIGNED_EARLY_ONSET',effect35)
check(neg35<1.0,'NEGATIVE_LATE_ONSET_REPRODUCED',neg35)
check(negative70>1,'NEGATIVE_EVENTUALLY_MOVES',negative70)
check(effect70>2,'EFFECT_CONTINUES',effect70)
check(cropdiff(arrays[('effect',70)],arrays[('plain',70)],OUTSIDE)<2,'UNCHANGED_OUTSIDE_VECTOR_ROI')
check(sha(ROOT/'qualification-effect/assets/source.lottie.json')==sha(ROOT/'qualification-late/assets/source.lottie.json'),'EXACT_SOURCE_SAME_AS_NEGATIVE')
receipts['state']='ENCODED_TECHNICAL_QUALIFICATION_ONLY' if not errors else 'BLOCKED'
receipts['creative_approval']=False
receipts['tests_passed']=sum(r['pass'] for r in receipts.get('checks',[]))
receipts['tests_total']=len(receipts.get('checks',[]))
receipts['failures']=errors
receipts['scope']='Self-authored silent Lottie animation, not TikTok/Facebook source recreation, licensed client asset or music listening'
p=ROOT/'ENCODED-CHECKS.json'
if p.exists():raise RuntimeError('Protected QA report already exists')
p.write_text(json.dumps(receipts,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in receipts.items() if k in ['state','tests_passed','tests_total','failures','comparison_frame_35','comparison_frame_70']},indent=2))
raise SystemExit(1 if errors else 0)
