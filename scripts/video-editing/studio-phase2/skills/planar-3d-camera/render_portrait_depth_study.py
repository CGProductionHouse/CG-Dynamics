"""Rigid photographic planes, flat control and protected late wording revision.

Practice only: no client likeness, recovered person depth, face mesh or sound.
"""
from pathlib import Path
import argparse,sys,json,hashlib,subprocess
import cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
REPO=Path(__file__).resolve().parents[5];sys.path.insert(0,str(REPO/'.agents/skills/cg-video-story-editor/scripts'))
from camera_plane import render_depth_layers,depth_layer_rect,camera_pose
from visual_treatments import layout_type_runs
SOURCE_SHA='3afa22d3acf94f0aa73f2958f70a05842a88a3b62f7784aecee75a40d78a126f'
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(p,x):Path(p).write_text(json.dumps(x,indent=2),encoding='utf8')
def main():
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--ffmpeg',type=Path,required=True);p.add_argument('--preview-only',action='store_true');a=p.parse_args();O=a.output.resolve();O.mkdir(parents=True,exist_ok=True);cv2.setNumThreads(2)
 assert sha(a.source)==SOURCE_SHA,'Use licensed original, not native rendered control'
 c=cv2.VideoCapture(str(a.source));c.set(cv2.CAP_PROP_POS_FRAMES,45);ok,b=c.read();c.release();assert ok and b.shape==(720,1280,3)
 photo=Image.fromarray(cv2.cvtColor(b,cv2.COLOR_BGR2RGB)).crop((170,0,890,720)).convert('RGBA');photo.save(O/'original-crop.png')
 FONT=REPO/'scripts/video-editing/studio-phase2/scene/assets/SpaceGrotesk.ttf'
 def font(n,w):
  f=ImageFont.truetype(str(FONT),n);f.set_variation_by_axes([w]);return f
 size=(540,960);fps=25;N=125;focal=700
 paper=Image.new('RGBA',(1500,2200),(235,229,213,255));dr=ImageDraw.Draw(paper)
 for y in range(0,2200,10):dr.line((0,y,1500,y),fill=(230+(y%3),224,209,255))
 lines=Image.new('RGBA',(1000,1500));dr=ImageDraw.Draw(lines)
 for i in range(4):dr.arc((70+i*15,50+i*15,850+i*15,1420-i*15),20,300,fill=(68,103,82,140),width=3)
 # Keep decorative lines above the title through every camera position.
 lines.paste((0,0,0,0),(0,1040,1000,1500))
 card=Image.new('RGBA',(800,800));shadow=Image.new('RGBA',card.size);ImageDraw.Draw(shadow).rectangle((38,40,778,780),fill=(25,37,30,65));card=shadow.filter(ImageFilter.GaussianBlur(12));ImageDraw.Draw(card).rectangle((25,20,775,770),fill=(250,247,237,255));card.alpha_composite(photo,(40,35))
 def title(word):
  im=Image.new('RGBA',(850,280));dr=ImageDraw.Draw(im)
  layout=layout_type_runs([[('A',font(63,400),(33,57,45)),('CHANGE',font(63,700),(33,57,45))],[('of',font(80,400),(33,57,45)),(word,font(80,700),(33,57,45))]],(24,14),800,line_gap=10,word_gap=16)
  for r in layout:dr.text(r['origin'],r['text'],font=r['font'],fill=r['colour'],anchor='ls')
  return im
 titles={w:title(w) for w in ['SCENE','PACE']}
 keys=[[0,[0,0,1450],[0,0,0],0],[.6,[0,0,1450],[0,0,0],0],[1.8,[45,5,1390],[45,5,0],0],[3.2,[45,5,1390],[45,5,0],0],[4.4,[0,5,1450],[0,5,0],0],[5,[0,5,1450],[0,5,0],0]]
 neutral=[[0,[0,0,1450],[0,0,0],0],[5,[0,0,1450],[0,0,0],0]]
 def layers(word):return [dict(id='paper',image=paper,centre=(0,0,-300),world_size=(3000,4400)),dict(id='lines-behind-photo',image=lines,centre=(0,20,-100),world_size=(1000,1500)),dict(id='unaltered-square-photo-card',image=card,centre=(0,120,120),world_size=(800,800)),dict(id='mixed-weight-title',image=titles[word],centre=(50,-500,180),world_size=(850,280))]
 # Overscan flatten is an independently rendered plane, not the original layers.
 flat={w:render_depth_layers(layers(w),(810,1440),neutral,0,focal=focal,shutter=0) for w in titles}
 def picture(name,i):
  word='PACE' if name=='copy-revision' and i>=75 else 'SCENE';ls=layers(word);t=i/fps
  if name=='flat-moving':ls=[dict(id='flattened-control',image=flat[word],centre=(0,0,0),world_size=(810*1450/focal,1440*1450/focal))]
  return render_depth_layers(ls,size,neutral if name=='plain' else keys,t,focal=focal,fps=fps,shutter=90,samples=17)
 for n in ['plain','flat-moving','depth','copy-revision']:
  for i in [0,30,60,90,124]:picture(n,i).save(O/f'preview-{n}-{i:03}.png')
 margins=[];photo_bounds=[]
 for i in range(N):
  for t in np.linspace(i/fps-.005,i/fps+.005,17):
   pose=camera_pose(keys,t);ls=layers('SCENE' if i<75 else 'PACE');bb=depth_layer_rect(ls[2],size,pose,focal);photo_bounds.append(bb)
   assert abs((bb[2]-bb[0])/(bb[3]-bb[1])-1)<1e-7
   l,top,r,bot=depth_layer_rect(ls[3],size,pose,focal);box=ls[3]['image'].getbbox();sx=(r-l)/850;sy=(bot-top)/280
   margins.append(min(l+box[0]*sx,540-l-box[2]*sx,top+box[1]*sy,960-top-box[3]*sy))
 assert min(margins)>=30,('Title not safe',min(margins))
 plan=dict(source=str(a.source.resolve()),source_sha256=SOURCE_SHA,source_frame=45,crop=[170,0,890,720],cropped_photo_sha256=sha(O/'original-crop.png'),source_orientation='Landscape upright, no rotation. One static extracted photograph; no moving-footage stabilisation claim.',rights_url='https://mixkit.co/free-stock-video/girl-from-the-front-walking-through-a-park-4825/',font_sha256=sha(FONT),font_licence_sha256=sha(FONT.with_name('OFL.txt')),size=size,fps=fps,frames=N,keys=keys,focal=focal,shutter=90,samples=17,layer_geometry=[dict(id=l['id'],centre=l['centre'],world_size=l['world_size']) for l in layers('SCENE')],min_title_margin=min(margins),revision='Only SCENE->PACE from frame75; camera/photo/all earlier frames unchanged',limits=['Stock model not a client or staff member','Explicit rectangular photo planes, not subject extraction or inferred human depth','Silent isolated mechanism, not a client hook/story or native editable project'])
 save(O/'PLAN.json',plan)
 if a.preview_only:print(json.dumps(dict(previews=True,min_title_margin=min(margins))));return
 rows=[]
 for n in ['plain','flat-moving','depth','copy-revision']:
  out=O/(n+'.mp4');assert not out.exists(),out
  proc=subprocess.Popen([str(a.ffmpeg),'-v','error','-nostdin','-f','rawvideo','-pix_fmt','rgb24','-s','540x960','-r','25','-i','-','-an','-c:v','libx264','-threads','2','-preset','fast','-qp','18','-bf','0','-g','25','-sc_threshold','0','-x264-params','rc-lookahead=0','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],stdin=subprocess.PIPE)
  try:
   for i in range(N):proc.stdin.write(picture(n,i).tobytes())
  finally:proc.stdin.close()
  assert proc.wait()==0
  cap=cv2.VideoCapture(str(out));hashes=[];page=Image.new('RGB',(1350,2640));dr=ImageDraw.Draw(page)
  for i in range(N):
   ok,b=cap.read();assert ok;hashes.append(hashlib.sha256(b.tobytes()).hexdigest());im=Image.fromarray(cv2.cvtColor(b,cv2.COLOR_BGR2RGB));x=i%10*135;y=i//10*200;page.paste(im.resize((112,199)),(x,y));dr.text((x+1,y+1),str(i),fill='white')
   if i in [0,30,60,74,75,90,124]:im.save(O/f'{n}-{i:03}.png')
  assert not cap.read()[0];cap.release();page.save(O/f'{n}-all125.jpg',quality=94);rows.append(dict(name=n,sha256=sha(out),frames=N,hashes=hashes));print(n,'125 decoded',flush=True)
 equal=sum(a==b for a,b in zip(rows[2]['hashes'][:75],rows[3]['hashes'][:75]));changed=sum(a!=b for a,b in zip(rows[2]['hashes'][75:],rows[3]['hashes'][75:]));save(O/'QA.json',dict(variants=rows,protected_opening_equal=equal,protected_opening_frames=75,changed_tail=changed,tail_frames=50,status='REQUIRES_ACTUAL_ENCODED_INSPECTION',operator_sha256=sha(REPO/'.agents/skills/cg-video-story-editor/scripts/camera_plane.py')));print('prefix',equal,'/75; changed',changed,'/50')
if __name__=='__main__':main()
