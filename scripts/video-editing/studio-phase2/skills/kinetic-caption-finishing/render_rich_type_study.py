"""Original geometric type study; explicit local output, no client/API/media upload."""
from pathlib import Path
import sys,json,hashlib,subprocess,argparse
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
REPO=Path(__file__).resolve().parents[5]
sys.path.insert(0,str(REPO/'.agents/skills/cg-video-story-editor/scripts'))
from visual_treatments import layout_type_runs,rich_type_reveal
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);p.add_argument('--ffmpeg',type=Path,required=True);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
 fontpath=REPO/'scripts/video-editing/studio-phase2/scene/assets/SpaceGrotesk.ttf';licence=fontpath.with_name('OFL.txt')
 def font(size,weight):
  f=ImageFont.truetype(str(fontpath),size);f.set_variation_by_axes([weight]);return f
 white=(242,240,230);warm=(232,185,90);normal=font(36,400);bold=font(76,700);large=font(92,700);small=font(21,400)
 lines=[[('MAKE',normal,white),('ROOM',bold,warm)],[('for',normal,white),('BETTER',bold,white)],[('IDEAS',large,warm)]]
 changed=[*lines[:2],[('STORIES',large,warm)]]
 first=layout_type_runs(lines,(64,410),592,line_gap=14,word_gap=16);second=layout_type_runs(changed,(64,410),592,line_gap=14,word_gap=16)
 starts=[.12,.3,.64,.82,1.52];size=(720,1280);fps=25;N=100
 yy,xx=np.mgrid[:1280,:720];rng=np.random.default_rng(61106);noise=rng.normal(0,.65,(1280,720));base=np.empty((1280,720,3),dtype=np.uint8)
 for c,(lo,hi)in enumerate([(13,30),(22,43),(28,48)]):base[:,:,c]=np.clip(lo+(hi-lo)*(xx/720*.4+yy/1280*.6)+noise,0,255)
 # Original geometric shapes/texture. No stock, client logo or photographed face.
 def background(t):
  im=Image.fromarray(base).convert('RGBA');l=Image.new('RGBA',size);d=ImageDraw.Draw(l);x=round(570+12*np.sin(t*.8));d.polygon([(x,-50),(810,20),(650,1280),(x-160,1280)],fill=(40,59,63,75));d.line((64,344,656,344),fill=(190,177,148,70),width=1);d.text((64,282),'TYPE / COMPOSITION STUDY',font=small,fill=(*white,180));d.text((64,1020),'Original artwork  /  Silent practice',font=small,fill=(*white,160));return Image.alpha_composite(im,l)
 allqa=[]
 for name,layout,static in [('plain',first,True),('designed',first,False),('revision',second,False)]:
  out=a.output/(name+'.mp4');assert not out.exists(),out
  proc=subprocess.Popen([str(a.ffmpeg),'-v','error','-f','rawvideo','-pix_fmt','rgb24','-s','720x1280','-r','25','-i','-','-an','-c:v','libx264','-threads','2','-preset','fast','-qp','18','-bf','0','-g','25','-sc_threshold','0','-x264-params','rc-lookahead=0','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],stdin=subprocess.PIPE)
  for i in range(N):
   t=i/fps;layer=rich_type_reveal(size,layout,10 if static else t,starts,entrance=.32,shutter=90)
   shadow=Image.new('RGBA',size,(0,0,0,0));shadow.putalpha(layer.getchannel('A').filter(ImageFilter.GaussianBlur(4)).point(lambda v:round(v*.38)))
   im=background(t);im.alpha_composite(shadow,(1,4));im=Image.alpha_composite(im,layer).convert('RGB');proc.stdin.write(np.asarray(im).tobytes())
  proc.stdin.close();assert proc.wait()==0
  import cv2
  cap=cv2.VideoCapture(str(out));contact=Image.new('RGB',(1440,2560));d=ImageDraw.Draw(contact);hashes=[]
  for i in range(N):
   ok,f=cap.read();assert ok;hashes.append(hashlib.sha256(f.tobytes()).hexdigest());im=Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB));x=i%10*144;y=i//10*256;contact.paste(im.resize((144,256)),(x,y));d.text((x+2,y+2),str(i),fill='white')
   if i in [10,25,37,40,50,70,99]:im.save(a.output/f'{name}-{i:02}.jpg',quality=96)
  assert not cap.read()[0];cap.release();contact.save(a.output/(name+'-all100.jpg'),quality=94);allqa.append({'name':name,'path':str(out),'sha256':sha(out),'decoded_frames':100,'decoded_frame_hashes':hashes})
 firsthash=allqa[1]['decoded_frame_hashes'];revisionhash=allqa[2]['decoded_frame_hashes'];equal=[i for i,(x,y)in enumerate(zip(firsthash,revisionhash))if x==y]
 q={'font':{'path':str(fontpath),'sha256':sha(fontpath),'licence':str(licence),'licence_sha256':sha(licence),'claim':'Existing SIL OFL font; fictional practice, no client brand approval'},'source_rights':'Original procedural geometric artwork/text/no external media','dimensions':size,'fps':fps,'duration':4,'variants':allqa,'protected_prefix_frames':37,'protected_prefix_exact':sum(i in equal for i in range(37)),'changed_tail_frames':sum(i not in equal for i in range(40,100)),'layout':[{k:v for k,v in x.items()if k!='font'}for x in second],'limits':'Silent raster mechanism only; no hearing/beat/native-editable/phone/hook/client/mastery claim. Plain control is readable earlier; reveal is not automatically a better opening.'}
 (a.output/'QA.json').write_text(json.dumps(q,indent=2));print(json.dumps({k:q[k]for k in ['protected_prefix_frames','protected_prefix_exact','changed_tail_frames']}))
if __name__=='__main__':main()
