"""Inspect full encoded edges, actual ink margins and revision protection."""
from pathlib import Path
import argparse,json
import cv2,numpy as np
from PIL import Image,ImageDraw
def inspect(root):
 q=json.loads((root/'QA.json').read_text());ink=Image.open(root/'title.png').getbbox();rows=[]
 for v in q['variants']:
  cap=cv2.VideoCapture(str(root/(v['name']+'.mp4')));edge_counts=[];n=0
  while True:
   ok,f=cap.read()
   if not ok:break
   assert f.shape==(960,540,3)
   edges=np.concatenate([f[:2].reshape(-1,3),f[-2:].reshape(-1,3),f[:,:2].reshape(-1,3),f[:,-2:].reshape(-1,3)])
   edge_counts.append(int((edges.mean(axis=1)<65).sum()));n+=1
  cap.release();assert n==100
  row={'name':v['name'],'decoded_frames':n,'max_dark_empty_edge_pixels':max(edge_counts)}
  if v['name'].startswith('depth'):
   margins=[]
   for b in v['bounds']:
    l,t,r,bot=b['title'];sx=(r-l)/650;sy=(bot-t)/200
    margins.append(min(l+ink[0]*sx,540-(l+ink[2]*sx),t+ink[1]*sy,960-(t+ink[3]*sy)))
   row['minimum_actual_title_ink_margin']=min(margins)
  rows.append(row)
 return q,rows
def main():
 p=argparse.ArgumentParser();p.add_argument('--output',required=True,type=Path);p.add_argument('--failed',type=Path);a=p.parse_args();q,rows=inspect(a.output)
 assert all(r['max_dark_empty_edge_pixels']==0 for r in rows),rows
 assert all(r.get('minimum_actual_title_ink_margin',27)>=27 for r in rows),rows
 assert q['protected_prefix_equal']==65 and q['protected_prefix_frames']==65
 rejected=inspect(a.failed)[1]if a.failed else []
 if rejected:
  assert any(r['max_dark_empty_edge_pixels']>0 for r in rejected)
  assert any(r.get('minimum_actual_title_ink_margin',27)<27 for r in rejected)
 out={'state':'BOUNDED_GRAPHIC_DEPTH_MECHANISM_CHECKED_NOT_CLIENT_RELEASE','current':rows,'rejected_controls':rejected,'protected_prefix':q['protected_prefix_equal'],'changed_tail':q['changed_tail_frames'],'limits':q['limits'],'shutter_limit':'Camera motion is sampled; per-frame independently authored badge-depth animation is held through that frame exposure, not separately motion-blurred.'}
 (a.output/'ACCEPTANCE.json').write_text(json.dumps(out,indent=2))
 canvas=Image.new('RGB',(1620,1000),'white');d=ImageDraw.Draw(canvas)
 for i,(name,label)in enumerate([('static','Static'),('flat-camera','Flat camera / overscanned'),('depth-r03','Independent depth planes')]):
  canvas.paste(Image.open(a.output/f'{name}-45.jpg'),(i*540,40));d.text((i*540+12,12),label,fill='black')
 canvas.save(a.output/'COMPARISON-45.jpg',quality=95)
 print(json.dumps(out))
if __name__=='__main__':main()
