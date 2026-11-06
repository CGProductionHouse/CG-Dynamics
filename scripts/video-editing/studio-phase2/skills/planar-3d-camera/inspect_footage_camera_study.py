"""Inspect actual camera-study encodes and create one removable cue audition."""
from pathlib import Path
import argparse,json,subprocess,hashlib,wave
import numpy as np,cv2
from PIL import Image,ImageDraw

def main():
 p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);p.add_argument('--ffmpeg',type=Path,required=True);a=p.parse_args();O=a.output.resolve();F=a.ffmpeg.resolve()
 q=json.loads((O/'QA.json').read_text());r=json.loads((O/'RECIPE.json').read_text());fps=24000/1001;N=120
 assert q['protected_prefix_equal']==q['protected_prefix_frames']==76
 assert all(v['source_projection_covers_frame'] for v in q['variants'])
 assert all(v['min_ink_margin'] is None or v['min_ink_margin']>=27 for v in q['variants']),[(v['name'],v['min_ink_margin'])for v in q['variants']]
 arrays=[]
 for v in q['variants']:
  cap=cv2.VideoCapture(str(O/(v['name']+'.mp4')));frames=[]
  while True:
   ok,b=cap.read()
   if not ok:break
   frames.append(b)
  cap.release();assert len(frames)==N
  arrays.append(frames)
  v['black_frames']=[i for i,b in enumerate(frames)if b.mean()<2]
  v['duplicate_frames']=[i for i in range(1,N)if np.array_equal(frames[i-1],frames[i])]
  assert not v['black_frames'] and not v['duplicate_frames']
 # Three aligned versions retain real motion, identical source-frame progression.
 comparison=O/'Comparison.mp4';assert not comparison.exists()
 proc=subprocess.Popen([str(F),'-v','error','-f','rawvideo','-pix_fmt','rgb24','-s','1620x1020','-r','24000/1001','-i','-','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(comparison)],stdin=subprocess.PIPE)
 for i in range(N):
  page=Image.new('RGB',(1620,1020),(18,18,18));d=ImageDraw.Draw(page)
  for col,label in enumerate(['Fixed camera','Single-plane move','Independent title depth']):
   page.paste(Image.fromarray(cv2.cvtColor(arrays[col][i],cv2.COLOR_BGR2RGB)),(col*540,60));d.text((col*540+15,20),label,fill='white')
  proc.stdin.write(page.tobytes())
  if i in [0,38,53,76,104,119]:page.save(O/f'COMPARISON-{i:03}.jpg',quality=95)
 proc.stdin.close();assert proc.wait()==0
 # Original sound DESIGN only: camera-speed shaped air and a restrained settle click.
 # Silence outside the move is intentional in this isolated audition, not a film bed.
 rate=48000;n=round(N/fps*rate);t=np.arange(n)/rate;rng=np.random.default_rng(6110624)
 x=np.clip((t-.6)/1.6,0,1);velocity=30*x*x*(x-1)**2;envelope=velocity/max(velocity)
 noise=rng.normal(0,1,n);spectrum=np.fft.rfft(noise);hz=np.fft.rfftfreq(n,1/rate);spectrum[(hz<650)|(hz>3600)]=0
 air=np.fft.irfft(spectrum,n);air/=max(abs(air));air*=.08*envelope
 dt=t-2.2;click=.055*np.sin(2*np.pi*1700*dt)*np.exp(-np.maximum(dt,0)*230)*(dt>=0)*(dt<.04)
 pcm=air+click;assert max(abs(pcm))<.2
 wav=O/'CAMERA-CUE-UNHEARD.wav';assert not wav.exists()
 with wave.open(str(wav),'wb')as w:w.setparams((1,2,rate,0,'NONE','not compressed'));w.writeframes(np.rint(pcm*32767).astype('<i2').tobytes())
 av=O/'Depth-SFX-AUDITION-NOT-APPROVED.mp4';assert not av.exists()
 subprocess.run([str(F),'-v','error','-i',str(O/'depth.mp4'),'-i',str(wav),'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','192k','-t',str(N/fps),'-movflags','+faststart',str(av)],check=True)
 packet_hashes=[subprocess.check_output([str(F),'-v','error','-i',str(p),'-map','0:v','-c','copy','-f','hash','-hash','sha256','-']).decode().strip()for p in [O/'depth.mp4',av]]
 assert packet_hashes[0]==packet_hashes[1],'SFX mux changed encoded picture packets'
 # Encoded audio packet copy is never a hearing verdict. Inspect actual decoded cue energy.
 raw=subprocess.check_output([str(F),'-v','error','-i',str(av),'-vn','-ar',str(rate),'-ac','1','-f','f32le','-']);decoded=np.frombuffer(raw,dtype='<f4')
 blocks=np.array([np.sqrt(np.mean(decoded[i:i+480]**2))for i in range(0,len(decoded)-479,480)])
 sound=dict(state='ORIGINAL_REMOVABLE_UNHEARD_SFX_AUDITION_ONLY',air_velocity_peak_seconds=1.4,measured_10ms_rms_peak_seconds=float(blocks.argmax()*.01),graphic_settle_seconds=2.2,wav_peak_dbfs=float(20*np.log10(max(abs(pcm)))),human_listening='not_recorded',music_fit='No music or final soundtrack; no beat/taste/physical espresso sound claim',picture_packet_preserved=True,picture_packet_sha256=packet_hashes[0])
 save=dict(state='BOUNDED_REAL_FOOTAGE_CAMERA_CHECKS_PASS_PENDING_AUTHOR_REVIEW',source_frames=[48,168],fps='24000/1001',frames=N,duration=N/fps,protected_prefix_equal=76,changed_tail_frames=q['changed_tail_frames'],variants=[{k:v for k,v in v.items()if k!='hashes'}for v in q['variants']],sound=sound,limits='No reconstructed scene depth, face-mask/native-editability/hearing/physical-phone/client approval; small parallax must earn a story role, not automatic quality.')
 (O/'ACCEPTANCE.json').write_text(json.dumps(save,indent=2));print(json.dumps(save,indent=2))
if __name__=='__main__':main()
