"""Original layered artwork controls; no brand, stock acquisition or GUI use."""
from pathlib import Path
import argparse,sys,subprocess,json,hashlib
import cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
REPO=Path(__file__).resolve().parents[5];sys.path.insert(0,str(REPO/'.agents/skills/cg-video-story-editor/scripts'))
from camera_plane import render_depth_layers,depth_layer_rect,camera_pose
from ui_motion import settle
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument('--output',required=True,type=Path);p.add_argument('--ffmpeg',required=True,type=Path);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True);cv2.setNumThreads(2)
 size=(540,960);fps=25;N=100;FONT=REPO/'scripts/video-editing/studio-phase2/scene/assets/SpaceGrotesk.ttf'
 def font(n,weight=500):
  f=ImageFont.truetype(str(FONT),n);f.set_variation_by_axes([weight]);return f
 dark=(22,43,47);green=(46,111,103);gold=(203,155,75)
 rng=np.random.default_rng(611062);noise=rng.normal(0,.7,(1600,900));paper=np.zeros((1600,900,3),np.uint8)
 for k,v in enumerate((236,232,218)):paper[:,:,k]=np.clip(v+noise,0,255)
 paper=Image.fromarray(paper).convert('RGBA')
 grid=Image.new('RGBA',(900,1600));d=ImageDraw.Draw(grid)
 for x in range(0,900,80):d.line((x,0,x,1600),fill=(*dark,12),width=1)
 for y in range(0,1600,80):d.line((0,y,900,y),fill=(*dark,12),width=1)
 d.ellipse((40,350,860,1170),outline=(*green,90),width=4)
 hero=Image.new('RGBA',(660,780));shadow=Image.new('RGBA',hero.size);dr=ImageDraw.Draw(shadow);dr.rounded_rectangle((35,35,625,745),radius=30,fill=(0,0,0,55));hero=shadow.filter(ImageFilter.GaussianBlur(13));dr=ImageDraw.Draw(hero);dr.rounded_rectangle((24,20,614,730),radius=27,fill=(250,248,239,255));dr.text((65,65),'ONE IDEA',font=font(25),fill=dark);dr.text((65,103),'THREE PLANES',font=font(39,700),fill=green)
 for i,(xy,c)in enumerate([((80,260,330,510),green),((230,330,480,580),gold),((345,225,550,430),dark)]):
  dr.rounded_rectangle(xy,radius=26,fill=(*c,255));dr.text((xy[0]+24,xy[1]+22),f'0{i+1}',font=font(35,700),fill=(255,255,255,255))
 dr.text((65,650),'Original geometric illustration',font=font(22),fill=dark)
 title=Image.new('RGBA',(650,200));dr=ImageDraw.Draw(title);dr.text((8,0),'LAYERED',font=font(83,700),fill=dark);dr.text((8,87),'STORIES',font=font(83,400),fill=green)
 badge=Image.new('RGBA',(270,180));s=Image.new('RGBA',badge.size);ImageDraw.Draw(s).rounded_rectangle((16,20,250,164),radius=20,fill=(0,0,0,70));badge=s.filter(ImageFilter.GaussianBlur(8));dr=ImageDraw.Draw(badge);dr.rounded_rectangle((8,8,242,152),radius=18,fill=(*dark,255));dr.text((30,25),'FOCUS',font=font(35,700),fill=(255,255,255));dr.text((30,82),'in depth',font=font(28),fill=(236,213,169))
 layers=[dict(id='paper',image=paper,centre=(0,0,-450),world_size=(1500,1500*1600/900)),dict(id='rings',image=grid,centre=(0,0,-200),world_size=(1100,1100*1600/900)),dict(id='hero',image=hero,centre=(0,0,0),world_size=(620,620*780/660)),dict(id='title',image=title,centre=(-20,480,160),world_size=(540,540*200/650)),dict(id='focus',image=badge,centre=(185,-290,340),world_size=(250,250*180/270))]
 keys=[[0,[-55,0,1450],[-55,0,0],0],[.6,[-55,0,1450],[-55,0,0],0],[1.8,[55,12,1320],[55,12,0],0],[2.5,[55,12,1320],[55,12,0],0],[3.6,[-15,0,1400],[-15,0,0],0],[4,[-15,0,1400],[-15,0,0],0]]
 neutral=[[0,[0,0,1450],[0,0,0],0],[4,[0,0,1450],[0,0,0],0]]
 # Overscan is essential: a frame-sized flattened card exposes empty borders
 # under lateral travel even when every independent source plane covers them.
 flat=render_depth_layers(layers,(810,1440),neutral,0,focal=800,shutter=0)
 flattened=[dict(id='flat',image=flat,centre=(0,0,0),world_size=(810*1450/800,1440*1450/800))]
 for l in layers:l['image'].save(a.output/(l['id']+'.png'))
 qa=[]
 for name in ['static','flat-camera','depth-r03','depth-r04']:
  out=a.output/(name+'.mp4');assert not out.exists(),out
  proc=subprocess.Popen([str(a.ffmpeg),'-v','error','-f','rawvideo','-pix_fmt','rgb24','-s','540x960','-r','25','-i','-','-an','-c:v','libx264','-threads','2','-preset','fast','-qp','18','-bf','0','-g','25','-sc_threshold','0','-x264-params','rc-lookahead=0','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],stdin=subprocess.PIPE)
  bounds=[]
  for i in range(N):
   t=i/25;ls=[dict(l)for l in layers]
   if name=='depth-r04':ls[-1]['centre']=(185,-290,340-70*settle(t,2.6,3.25))
   if name in ['static','flat-camera']:im=render_depth_layers(flattened,size,neutral if name=='static'else keys,t,focal=800,samples=17)
   else:im=render_depth_layers(ls,size,keys,t,focal=800,samples=17)
   bounds.append({l['id']:depth_layer_rect(l,size,camera_pose(keys,t),800)for l in ls if l['id']in ['hero','title','focus']});proc.stdin.write(im.tobytes())
  proc.stdin.close();assert proc.wait()==0
  cap=cv2.VideoCapture(str(out));contact=Image.new('RGB',(1080,1920));dr=ImageDraw.Draw(contact);hashes=[]
  for i in range(N):
   ok,f=cap.read();assert ok;hashes.append(hashlib.sha256(f.tobytes()).hexdigest());im=Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB));x=i%10*108;y=i//10*192;contact.paste(im.resize((108,192)),(x,y));dr.text((x+1,y+1),str(i),fill='black')
   if i in [0,15,30,45,62,65,75,90,99]:im.save(a.output/f'{name}-{i:02}.jpg',quality=96)
  assert not cap.read()[0];cap.release();contact.save(a.output/(name+'-all100.jpg'),quality=94);qa.append(dict(name=name,sha256=sha(out),decoded_frames=100,hashes=hashes,bounds=bounds));print(name,'decoded100',flush=True)
 pre=sum(qa[2]['hashes'][i]==qa[3]['hashes'][i]for i in range(65));tail=sum(qa[2]['hashes'][i]!=qa[3]['hashes'][i]for i in range(67,100))
 record={'source_rights':'Original procedural paper/illustration/type; no stock/person/client brand','font':str(FONT),'font_sha256':sha(FONT),'font_licence_sha256':sha(FONT.with_name('OFL.txt')),'size':size,'fps':fps,'frames':N,'keys':keys,'revision':'Only focus badge authored depth340->270 during2.6-3.25s; all artwork, camera keys and other planes unchanged','protected_prefix_equal':pre,'protected_prefix_frames':65,'changed_tail_frames':tail,'variants':qa,'implementation_sha256':sha(Path(__file__)),'operator_sha256':sha(REPO/'.agents/skills/cg-video-story-editor/scripts/camera_plane.py'),'limits':'Authored parallel graphic planes, not reconstructed photographic depth or physical contact shadows. No real-face/native/sound/phone/client/mastery claim. Independent normal-speed inspection remains open.'}
 (a.output/'QA.json').write_text(json.dumps(record,indent=2));print(json.dumps({'protected_prefix_equal':pre,'prefix':65,'changed_tail':tail}))
if __name__=='__main__':main()
