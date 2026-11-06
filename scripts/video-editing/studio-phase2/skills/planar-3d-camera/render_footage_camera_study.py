"""Source-bound moving-footage application of the existing camera tutorial.

No acquisition, client timeline, face warp, native-project or hearing claim.
"""
from pathlib import Path
import argparse,sys,json,hashlib,subprocess
import cv2,numpy as np
from PIL import Image,ImageFont,ImageDraw
REPO=Path(__file__).resolve().parents[5]
sys.path.insert(0,str(REPO/'.agents/skills/cg-video-story-editor/scripts'))
from camera_plane import render_depth_layers,depth_layer_rect,camera_pose
from visual_treatments import layout_type_runs,rich_type_reveal

SOURCE_SHA='883b71655e2f2448a03b02f6e318eced58b51bac5b74da86c018995f3c817331'
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(p,x):p.write_text(json.dumps(x,indent=2),encoding='utf8')

def main():
 p=argparse.ArgumentParser();p.add_argument('--source',required=True,type=Path);p.add_argument('--ffmpeg',required=True,type=Path);p.add_argument('--output',required=True,type=Path);p.add_argument('--preview-only',action='store_true');a=p.parse_args()
 a.source=a.source.resolve();a.ffmpeg=a.ffmpeg.resolve();a.output=a.output.resolve()
 assert sha(a.source)==SOURCE_SHA,'Use the actual licensed original, not a processed export'
 a.output.mkdir(parents=True,exist_ok=True);cv2.setNumThreads(2)
 F=a.ffmpeg;O=a.output;fps=24000/1001;N=120;size=(540,960);focal=800
 def run(args):subprocess.run([str(F),'-v','error','-threads','2',*map(str,args)],cwd=O,check=True)
 # Exact decoded source frame range, upright before motion estimation.
 stable=O/'source-stable.mp4'
 if not stable.exists():
  vf='trim=start_frame=48:end_frame=168,setpts=PTS-STARTPTS,setsar=1'
  run(['-i',a.source,'-vf',vf+',vidstabdetect=shakiness=2:accuracy=15:result=source.trf','-an','-f','null','-'])
  run(['-i',a.source,'-vf',vf+',vidstabtransform=input=source.trf:smoothing=6:optzoom=1:zoom=0.5','-an','-frames:v',N,'-c:v','libx264','-threads','2','-preset','fast','-qp','16','-pix_fmt','yuv420p',stable])
 else:
  receipt=json.loads((O/'RECIPE.json').read_text())
  assert receipt['source_sha256']==SOURCE_SHA and receipt['source_frames']==[48,168] and receipt['prepared_sha256']==sha(stable),'Prepared-source reuse requires exact source/frame/hash receipt'
 cap=cv2.VideoCapture(str(stable));frames=[]
 while True:
  ok,b=cap.read()
  if not ok:break
  assert b.shape==(1280,720,3);frames.append(Image.fromarray(cv2.cvtColor(b,cv2.COLOR_BGR2RGB)))
 cap.release();assert len(frames)==N
 fontpath=REPO/'scripts/video-editing/studio-phase2/scene/assets/SpaceGrotesk.ttf'
 def font(n,w):
  f=ImageFont.truetype(str(fontpath),n);f.set_variation_by_axes([w]);return f
 layout=layout_type_runs([[('SMALL',font(43,400),(247,244,236)),('DETAILS',font(43,700),(247,244,236))],[('DAILY',font(67,400),(247,244,236)),('RITUAL',font(67,700),(231,188,119))]],(12,10),626,line_gap=12,word_gap=13)
 starts=[1.65,1.74,1.86,1.98];type_size=(650,180)
 keys=[[0,[50,160,980],[50,160,0],0],[.6,[50,160,980],[50,160,0],0],[2.2,[-10,-40,1250],[-10,-40,0],0],[3.2,[-10,-40,1250],[-10,-40,0],0],[4.3,[25,-40,1250],[25,-40,0],0],[5.005,[25,-40,1250],[25,-40,0],0]]
 revised=json.loads(json.dumps(keys));revised[-2][1][0]=10;revised[-2][2][0]=10;revised[-1][1][0]=10;revised[-1][2][0]=10
 neutral=[[0,[-10,-40,1250],[-10,-40,0],0],[5.005,[-10,-40,1250],[-10,-40,0],0]]
 def layers(i):
  im=frames[i].convert('RGBA');fade=Image.new('RGBA',im.size);d=ImageDraw.Draw(fade)
  for y in range(700,1280):d.line((0,y,720,y),fill=(0,0,0,round(165*(y-700)/580)))
  photo=Image.alpha_composite(im,fade)
  title=rich_type_reveal(type_size,layout,i/fps,starts,entrance=.32,fps=fps)
  return [dict(id='continuous-coffee',image=photo,centre=(0,0,0),world_size=(1000,1000*1280/720)),dict(id='measured-title',image=title,centre=(15,-400,180),world_size=(600,600*180/650))]
 def picture(name,i):
  ls=layers(i);t=i/fps
  if name=='plain':return render_depth_layers(ls,size,neutral,t,focal=focal,fps=fps,samples=17)
  if name=='single-plane':
   flat=render_depth_layers(ls,(810,1440),neutral,t,focal=focal,fps=fps,shutter=0)
   ls=[dict(id='flattened',image=flat,centre=(-10,-40,0),world_size=(810*1250/focal,1440*1250/focal))]
  return render_depth_layers(ls,size,revised if name=='depth-revision'else keys,t,focal=focal,fps=fps,samples=17)
 for i in [0,38,53,76,104,119]:picture('depth',i).save(O/f'preview-{i:03}.png')
 save(O/'RECIPE.json',dict(size=size,fps='24000/1001',frames=N,source=str(a.source),source_sha256=SOURCE_SHA,source_frames=[48,168],prepared_sha256=sha(stable),orientation='Actual upright portrait source, no rotation; stabilization before camera',stabilization='vidstab shakiness2 accuracy15 smoothing6 optzoom1 zoom0.5',font=str(fontpath),font_sha256=sha(fontpath),font_licence_sha256=sha(fontpath.with_name('OFL.txt')),camera=keys,revision_camera=revised,focal=focal,shutter=90,samples=17,type_starts=starts,type_rows=[{k:v for k,v in r.items()if k!='font'}for r in layout],rights_url='https://mixkit.co/free-stock-video/cup-being-filled-with-coffee-in-a-coffee-machine-41865/',purpose='Begin with the moving coffee streams, ease back to the cup and a readable mixed-weight ritual headline; source detail drives the move',revision='Only final camera X25->10 after3.2s; source, type, initial move and soundtrack unchanged',limits='Authored plane depths, not recovered object depth; no face matte/physical room/native/hearing/client claim. Per-frame footage and reveal are held during camera-shutter samples.'))
 if a.preview_only:return
 qa=[]
 for name in ['plain','single-plane','depth','depth-revision']:
  out=O/(name+'.mp4');assert not out.exists(),out
  proc=subprocess.Popen([str(F),'-v','error','-f','rawvideo','-pix_fmt','rgb24','-s','540x960','-r','24000/1001','-i','-','-an','-c:v','libx264','-threads','2','-preset','fast','-qp','18','-bf','0','-g','24','-sc_threshold','0','-x264-params','rc-lookahead=0','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],stdin=subprocess.PIPE)
  margins=[];coverage=[]
  for i in range(N):
   ls=layers(i);bbox=ls[1]['image'].getbbox();t=i/fps;ks=neutral if name=='plain'else revised if name=='depth-revision'else keys
   for st in np.linspace(t-90/360/fps/2,t+90/360/fps/2,17):
    pose=camera_pose(ks,st);l,top,r,bot=depth_layer_rect(ls[0],size,pose,focal);coverage.append(l<=0 and top<=0 and r>=540 and bot>=960)
    if bbox and name!='single-plane':
     l,top,r,bot=depth_layer_rect(ls[1],size,pose,focal);sx=(r-l)/650;sy=(bot-top)/180
     margins.append(min(l+bbox[0]*sx,540-l-bbox[2]*sx,top+bbox[1]*sy,960-top-bbox[3]*sy))
   im=picture(name,i);assert im.size==size;proc.stdin.write(im.tobytes())
  proc.stdin.close();assert proc.wait()==0
  cap=cv2.VideoCapture(str(out));hashes=[];page=Image.new('RGB',(1296,1920));d=ImageDraw.Draw(page)
  for i in range(N):
   ok,b=cap.read();assert ok;hashes.append(hashlib.sha256(b.tobytes()).hexdigest());im=Image.fromarray(cv2.cvtColor(b,cv2.COLOR_BGR2RGB));x=i%12*108;y=i//12*192;page.paste(im.resize((108,192)),(x,y));d.text((x+1,y+1),str(i),fill='white')
   if i in [0,38,53,76,104,119]:im.save(O/f'{name}-{i:03}.png')
  assert not cap.read()[0];cap.release();page.save(O/(name+'-all120.jpg'),quality=95)
  qa.append(dict(name=name,path=str(out),sha256=sha(out),frames=N,hashes=hashes,min_ink_margin=min(margins)if margins else None,source_projection_covers_frame=all(coverage)));print(name,'120 decoded',flush=True)
 protect=sum(qa[2]['hashes'][i]==qa[3]['hashes'][i]for i in range(76));changes=sum(qa[2]['hashes'][i]!=qa[3]['hashes'][i]for i in range(80,N))
 save(O/'QA.json',dict(variants=qa,protected_prefix_equal=protect,protected_prefix_frames=76,changed_tail_frames=changes,implementation_sha256=sha(Path(__file__)),operator_sha256=sha(REPO/'.agents/skills/cg-video-story-editor/scripts/camera_plane.py'),status='ENCODED_OUTPUTS_REQUIRE_AUTHOR_INSPECTION'))
 print('Protected',protect,'/76; tail changed',changes,flush=True)

if __name__=='__main__':main()
