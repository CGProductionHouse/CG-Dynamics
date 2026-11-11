"""Nolan M06: offline, source-bound STEM ENGINEERING PROOF and final-export parity.
Research-only until real client provenance, music taste and release are independently qualified.
No network, no generative services, no native editor takeover.
"""
from __future__ import annotations
import argparse,hashlib,json,math,os,subprocess,sys,wave
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parent
CORE=Path.home()/'.codex/skills/cg-video-story-editor/scripts'
sys.path.insert(0,str(CORE))
from voice_overlay import ducking_envelope
FF=ROOT.parent/'ffmpeg-9.0.2-essentials_build/bin'
RATE=48000; CHANNELS=2
CREATE=(subprocess.CREATE_NO_WINDOW|subprocess.BELOW_NORMAL_PRIORITY_CLASS) if os.name=='nt' else 0
def sha(p):
 with Path(p).open('rb')as s:return hashlib.file_digest(s,'sha256').hexdigest()
def pcm(p):
 with wave.open(str(p),'rb') as w:
  if (w.getframerate(),w.getnchannels(),w.getsampwidth())!=(RATE,CHANNELS,2):raise ValueError('Only 48kHz stereo PCM16 source stems qualified')
  return np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').reshape(-1,2).astype(np.float64)/32768.
def write_wav(p,a):
 if p.exists():raise ValueError('Existing output must not be overwritten')
 arr=np.clip(np.round(a*32768),-32768,32767).astype('<i2')
 with wave.open(str(p),'wb')as w:w.setframerate(RATE);w.setnchannels(CHANNELS);w.setsampwidth(2);w.writeframes(arr.tobytes())
def load(plan_path):
 path=Path(plan_path).resolve(strict=True);plan=json.loads(path.read_text(encoding='utf-8-sig'))
 if plan.get('schema')!=1 or plan.get('purpose')!='TECHNICAL_PROOF_ONLY':raise ValueError('M06 test route cannot clear a client film')
 if plan.get('sample_rate')!=RATE or plan.get('fps')!=30:raise ValueError('Unqualified timing format')
 duration=plan.get('duration_seconds')
 if not isinstance(duration,(int,float)) or isinstance(duration,bool) or not math.isfinite(duration) or not 3<=duration<=30:raise ValueError('Invalid bounded duration')
 if round(duration*30)!=duration*30:raise ValueError('Duration must align with video frame clock')
 stems=plan.get('stems')
 if not isinstance(stems,dict) or set(stems)!={'dialogue','music','sfx'}:raise ValueError('Exactly three independent stems required')
 n=round(duration*RATE);audio={}
 for name,info in stems.items():
  if not isinstance(info,dict):raise ValueError('Stem record missing')
  src=Path(info.get('path','')).resolve(strict=True);h=info.get('sha256','').lower()
  if len(h)!=64 or sha(src)!=h:raise ValueError('Changed or missing '+name+' stem')
  if src.suffix.lower()!='.wav':raise ValueError('Source must be plain PCM WAV')
  start=info.get('start_seconds');gain=info.get('gain_db')
  if not all(isinstance(v,(float,int)) and not isinstance(v,bool) and math.isfinite(v) for v in (start,gain)):raise ValueError('Nonfinite timing or gain')
  if start<0 or abs(start*RATE-round(start*RATE))>.01 or not -40<=gain<=0:raise ValueError('Unsupported timing or gain')
  sample=pcm(src);first=round(start*RATE);last=first+len(sample)
  if not len(sample) or last>n:raise ValueError('Stem exceeds picture or is empty')
  track=np.zeros((n,2),np.float64);track[first:last]=sample*10**(gain/20)
  audio[name]=track
 options=plan.get('ducking',{})
 if not isinstance(options,dict) or not 3<=options.get('reduction_db',0)<=20:raise ValueError('Ducking must be explicitly configured')
 for key in ('attack','release','lookahead','hold'):
  v=options.get(key)
  if not isinstance(v,(int,float)) or not math.isfinite(v) or v<0 or v>2:raise ValueError('Bad ducking '+key)
 if options['attack']<=0 or options['release']<=0:raise ValueError('Ducking attack/release must be positive')
 return path,plan,audio
def mix(plan_path,out):
 path,plan,a=load(plan_path);out=Path(out).resolve()
 if out.exists():raise ValueError('Private output exists; use revision directory')
 if any((p/'.git').exists() for p in [out,*out.parents]):raise ValueError('Not inside a Git checkout')
 out.mkdir(parents=True)
 env=ducking_envelope(a['dialogue'],RATE,reduction_db=plan['ducking']['reduction_db'],threshold_db=plan['ducking'].get('threshold_db',-45),attack=plan['ducking']['attack'],release=plan['ducking']['release'],lookahead=plan['ducking']['lookahead'],hold=plan['ducking']['hold'])
 ducked=a['music']*env[:,None];total=a['dialogue']+ducked+a['sfx']
 if not np.isfinite(total).all() or np.max(np.abs(total))>=.96:raise ValueError('Mix peak too high; fix source gains, do not silently normalize')
 for name,track in [('dialogue',a['dialogue']),('music-unducked',a['music']),('music-ducked',ducked),('sfx',a['sfx']),('mix',total)]:
  write_wav(out/(name+'.wav'),track)
 report={'state':'TECHNICAL_STEM_MIX_NOT_CREATIVE_APPROVAL','purpose':plan['purpose'],'plan_sha256':sha(path),'operator_sha256':sha(__file__),
 'source_sha256':{n:plan['stems'][n]['sha256'] for n in a},'pcm_sha256':{x:sha(out/(x+'.wav'))for x in ['dialogue','music-unducked','music-ducked','sfx','mix']},
 'duration_seconds':plan['duration_seconds'],'sample_rate':RATE,'expected_video_frames':round(plan['duration_seconds']*30),
 'duck_gain_min_db':round(20*math.log10(max(float(np.min(env)),1e-12)),3),'voice_unchanged':True,'audio_source_rights':'synthetic diagnostic only','perceptual_listening':'NOT_DONE','creative_release':False}
 (out/'MIX-RECEIPT.json').write_text(json.dumps(report,indent=2))
 return report
def decode_export(video,ff):
 raw=subprocess.run([str(ff),'-v','error','-nostdin','-i',str(video),'-map','0:a:0','-f','f32le','-ac','2','-ar',str(RATE),'-'],capture_output=True,creationflags=CREATE,timeout=40,check=True).stdout
 return np.frombuffer(raw,dtype='<f4').reshape(-1,2).astype(np.float64)
def compare(expected,actual):
 # AAC can introduce encoder/decoder padding. Search only +-40ms, not a full arbitrary retiming.
 e=expected[::16].mean(axis=1);a=actual[::16].mean(axis=1);n=min(len(e),len(a));best=(-1.,0)
 for lag in range(-120,121):
  if lag>=0:x=e[:n-lag];y=a[lag:lag+n-lag]
  else:x=e[-lag:n];y=a[:n+lag]
  if len(x)<100:continue
  corr=float(np.dot(x,y)/(np.linalg.norm(x)*np.linalg.norm(y)+1e-15))
  if corr>best[0]:best=(corr,lag*16)
 return best
def inspect(plan_path,out,video):
 path,plan,a=load(plan_path);out=Path(out).resolve(strict=True);video=Path(video).resolve(strict=True)
 proof=json.loads((out/'MIX-RECEIPT.json').read_text())
 if proof['plan_sha256']!=sha(path) or proof['operator_sha256']!=sha(__file__):raise ValueError('Changed plan or engine; regenerate private candidate')
 for name,h in proof['pcm_sha256'].items():
  if sha(out/(name+'.wav'))!=h:raise ValueError('Modified or absent stem: '+name)
 probe=json.loads(subprocess.check_output([str(FF/'ffprobe.exe'),'-v','error','-show_streams','-show_format','-of','json',str(video)],creationflags=CREATE,timeout=30))
 v=next((s for s in probe['streams']if s['codec_type']=='video'),None);aud=next((s for s in probe['streams']if s['codec_type']=='audio'),None)
 if not v or not aud:raise ValueError('Final AV streams missing')
 if (v.get('width'),v.get('height'))!=(1280,720) or int(v.get('nb_frames',0))!=proof['expected_video_frames']:raise ValueError('Changed picture canvas/frame count')
 dec=decode_export(video,FF/'ffmpeg.exe');mixpcm=pcm(out/'mix.wav')
 if abs(len(dec)-len(mixpcm))>round(.05*RATE):raise ValueError('Truncated or excess final AAC samples')
 corr,lag=compare(mixpcm,dec)
 if corr<.985:raise ValueError('Final mix differs from planned stems or is mistimed')
 if abs(lag)>.025*RATE:raise ValueError('Export A/V alignment delayed')
 # Exact-source measured reference in speech interval, SFX interval and final tail.
 gaps=[]
 for name,(first,last)in {'opening':(0,.7),'voice':(1.2,2.4),'sfx':(4.0,4.28),'ending':(plan['duration_seconds']-.55,plan['duration_seconds']-.10)}.items():
  i,j=round(first*RATE),round(last*RATE)
  delta=int(lag);start=max(0,i+delta);end=min(len(dec),j+delta)
  if end-start<.03*RATE:raise ValueError('Missing '+name+' decoded window')
  reference=mixpcm[i:i+(end-start)];observed=dec[start:end]
  error=float(np.sqrt(np.mean((observed-reference)**2)))
  strength=float(np.sqrt(np.mean(reference**2)))
  gaps.append({'window':name,'error_to_signal':round(error/max(strength,1e-8),4),'rms_dbfs':round(20*math.log10(max(float(np.sqrt(np.mean(observed**2))),1e-12)),2)})
  if error/max(strength,1e-8)>.27:raise ValueError('Export changed planned sound in '+name+' window')
 if gaps[-1]['rms_dbfs']< -52:raise ValueError('Final sound tail inaudible/ended early')
 # independently check SFX evidence: it must exist, peak at the planned source span, and survive the actual final export.
 sfx=pcm(out/'sfx.wav');i=round(plan['stems']['sfx']['start_seconds']*RATE);j=min(len(sfx),i+round(.25*RATE))
 if np.max(np.abs(sfx[i:j]))<.008:raise ValueError('SFX source not actually present in planned cue window')
 measured=subprocess.run([str(FF/'ffmpeg.exe'),'-nostdin','-hide_banner','-i',str(video),'-map','0:a:0','-vn','-af','silencedetect=noise=-50dB:d=0.35,loudnorm=print_format=json','-f','null','-'],capture_output=True,text=True,creationflags=CREATE,timeout=40,check=True).stderr
 import re
 m=re.findall(r'\{\s*"input_i".*?\}',measured,re.S)
 if not m:raise ValueError('No measured exact-export loudness report')
 loud=json.loads(m[-1]);lufs=float(loud['input_i']);tp=float(loud['input_tp'])
 if not math.isfinite(lufs) or not math.isfinite(tp) or tp>=-0.3:raise ValueError('Final true peak/loudness needs review')
 if re.search(r'silence_start\s*:',measured):raise ValueError('Unexplained silence found in exact final output')
 result={'state':'EXACT_EXPORT_ENGINEERING_PROOF_NOT_LISTENED','export_sha256':sha(video),'video_frames':int(v['nb_frames']),'audio_samples':len(dec),'correlation':round(corr,6),'alignment_samples':lag,'alignment_ms':round(lag*1000/RATE,3),
 'windows':gaps,'lufs':lufs,'true_peak_dbtp':tp,'source_bound':True,'stem_tracks':list(a),
 'meaning':'SFX, stem survival, sync and technical continuity; not music taste, audible clarity, accent, client approval or Premiere native editability','creative_release':False}
 (out/'EXACT-EXPORT-RECEIPT.json').write_text(json.dumps(result,indent=2))
 return result
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('action',choices=['mix','inspect']);ap.add_argument('plan',type=Path);ap.add_argument('out',type=Path);ap.add_argument('video',type=Path,nargs='?');args=ap.parse_args()
 if args.action=='inspect' and args.video is None:ap.error('inspect needs exact exported MP4')
 print(json.dumps(mix(args.plan,args.out) if args.action=='mix' else inspect(args.plan,args.out,args.video),indent=2))
