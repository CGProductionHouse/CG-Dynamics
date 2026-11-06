"""5s mixed-weight baseline/reveal study using existing portable type operator.
Explicit licensed source/font inputs; no client template, download or new engine.
"""
from pathlib import Path
import argparse,sys,subprocess,hashlib,json,cv2
import numpy as np
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parents[5];sys.path.insert(0,str(R/'.agents/skills/cg-video-story-editor/scripts'))
from visual_treatments import type_reveal
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--source-sha256',required=True);p.add_argument('--font',required=True);p.add_argument('--font-sha256',required=True);p.add_argument('--output',required=True);p.add_argument('--protected',action='store_true');a=p.parse_args();D=Path(a.output);D.mkdir(parents=True,exist_ok=False)
def sha(path):
 with Path(path).open('rb')as f:return hashlib.file_digest(f,'sha256').hexdigest()
assert sha(a.source)==a.source_sha256 and sha(a.font)==a.font_sha256
def font(size,weight):
 f=ImageFont.truetype(a.font,size);f.set_variation_by_name(weight);return f
regular=font(44,'Regular');bold=font(76,'Bold');small=font(31,'Regular');W,H=540,960;frames=[];c=cv2.VideoCapture(a.source);fps=c.get(cv2.CAP_PROP_FPS)
for i in range(125):
 c.set(cv2.CAP_PROP_POS_FRAMES,int((2+i/25)*fps));ok,v=c.read();assert ok;frames.append(Image.fromarray(cv2.cvtColor(v,cv2.COLOR_BGR2RGB)).resize((W,H),Image.Resampling.LANCZOS))
c.release();white=(246,241,229);accent=(229,178,113)
def draw(i,mode):
 im=frames[i].convert('RGBA');shade=Image.new('RGBA',(W,H));mask=np.zeros((H,W),np.uint8);mask[:345]=np.linspace(150,0,345).astype(np.uint8)[:,None];shade.paste((8,16,21),(0,0,W,H));shade.putalpha(Image.fromarray(mask));im=Image.alpha_composite(im,shade)
 if mode=='plain':return im.convert('RGB')
 second='LAST'if mode=='revision'else'MORE';baseline=226
 for word,f,x,start,color in [('ONE',regular,42,0,white),(second,bold,42+round(regular.getlength('ONE'))+18,.84,accent)]:
  top=baseline+f.getbbox(word,anchor='ls')[1];lay=type_reveal((W,H),[(word,color)],f,(x,top),i/25,start,entrance=.32,shutter=90);im=Image.alpha_composite(im,lay)
 im=Image.alpha_composite(im,type_reveal((W,H),[('before',white),('you',white),('go?',white)],small,(44,253),i/25,1.25,stagger=.07,entrance=.32,shutter=90))
 # Short underline resolves beneath copy; the real stream/nozzle remains unobscured.
 u=float(np.clip((i/25-1.65)/.35,0,1));ImageDraw.Draw(im).rectangle((44,300,44+round(395*u),303),fill=accent)
 return im.convert('RGB')
rendered={};outputs={}
for mode in ['plain','designed','revision']:
 images=[draw(i,mode)for i in range(125)];rendered[mode]=images;dest=D/(mode+'.mp4');proc=subprocess.Popen(['ffmpeg','-v','error','-nostdin','-f','rawvideo','-pix_fmt','rgb24','-s','540x960','-r','25','-i','-','-an','-c:v','libx264','-preset','fast','-crf','17','-threads','2',str(dest)],stdin=subprocess.PIPE)
 for im in images:proc.stdin.write(im.tobytes())
 proc.stdin.close();assert proc.wait()==0;outputs[mode]=dict(path=str(dest),sha256=sha(dest))
assert all(rendered['designed'][i].tobytes()==rendered['revision'][i].tobytes()for i in range(21))
changed=[i for i in range(125)if rendered['designed'][i].tobytes()!=rendered['revision'][i].tobytes()];assert changed and min(changed)>=21
protected={}
if a.protected:
 def segment(images,dest):
  proc=subprocess.Popen(['ffmpeg','-v','error','-nostdin','-f','rawvideo','-pix_fmt','rgb24','-s','540x960','-r','25','-i','-','-an','-c:v','libx264','-preset','fast','-crf','17','-threads','2',str(dest)],stdin=subprocess.PIPE)
  for im in images:proc.stdin.write(im.tobytes())
  proc.stdin.close();assert proc.wait()==0
 common=D/'common-opening.mp4';segment(rendered['designed'][:21],common)
 for mode in ['designed','revision']:
  tail=D/(mode+'-tail.mp4');segment(rendered[mode][21:],tail);lst=D/(mode+'-parts.txt');assert "'"not in str(D.resolve());lst.write_text("file '"+common.resolve().as_posix()+"'\nfile '"+tail.resolve().as_posix()+"'\n");dest=D/(mode+'-protected.mp4');subprocess.run(['ffmpeg','-v','error','-f','concat','-safe','0','-i',str(lst),'-c','copy','-movflags','+faststart',str(dest)],check=True);protected[mode]=dict(path=str(dest),sha256=sha(dest))
board=Image.new('RGB',(1500,2000),'#ddd');d=ImageDraw.Draw(board)
for j,idx in enumerate([0,6,20,25,31,43,74,124]):
 for k,mode in enumerate(['plain','designed','revision']):
  thumb=rendered[mode][idx].resize((165,294));x=(j%4)*375+k*120;y=(j//4)*1000;board.paste(thumb.resize((118,210)),(x,y));d.text((x,y+215),f'{mode} f{idx}',fill='black')
 # A full-size designed detail at the same source instant, separate from thumbnail comparisons.
 board.paste(rendered['designed'][idx].resize((340,604)),((j%4)*375,(j//4)*1000+265))
board.save(D/'INSPECTION.jpg',quality=95)
for idx in [25,43,74]:rendered['designed'][idx].save(D/f'designed-{idx}.png')
encoded={}
for mode in outputs:
 cap=cv2.VideoCapture(str(D/(mode+'.mp4')));count=0;duplicates=0;previous=None
 while True:
  ok,v=cap.read()
  if not ok:break
  if previous is not None and np.array_equal(v,previous):duplicates+=1
  previous=v;count+=1
 cap.release();assert count==125;encoded[mode]=dict(frames=count,adjacent_exact_duplicates=duplicates)
receipt=dict(source=dict(path=a.source,sha256=a.source_sha256,range_seconds=[2,7],rights='Existing hash-verified licensed Mixkit41865; actual item/FreeLicense rechecked6Nov'),font=dict(path=a.font,sha256=a.font_sha256,weights=['Regular','Bold']),outputs=outputs,protected_outputs=protected,encoded=encoded,mechanism='Existing type_reveal, mixed44/76px common226pxbaseline, .32srise,90degshutter, wordstagger; no sourcewarp',revision='MORE->LAST only, rendered opening21frames exact before encode. Optional commonencoded21frame cache plus separatechangedtail prevents GOP prediction leaking into protectedopening; actualencodedparity still measured separately.',changed_frames=changed,scope='Nonclient typography component on real ongoingpour, not a proven new hook/fullfilm/native/heard/mastery/clientapproval',sound='Silent picture study; sound choice considered but no fake coffeefoley or licensed-mix claim')
(D/'RECEIPT.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(dict(outputs=outputs,changed_range=[min(changed),max(changed)])))
