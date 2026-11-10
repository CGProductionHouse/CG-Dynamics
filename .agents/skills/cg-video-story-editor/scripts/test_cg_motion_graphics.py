"""Synthetic, source-free contracts for CG moving-footage compositing."""
import sys,unittest
from pathlib import Path
import cv2,numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parent))
from cg_motion_graphics import GraphicsRig,compose_feature,cover,rounded_mask,ease

class MotionGraphicsTests(unittest.TestCase):
 def setUp(self):
  self.w=270;self.h=480
  yy,xx=np.mgrid[:self.h,:self.w]
  self.frame=np.stack((np.uint8(xx%256),np.uint8(yy%256),np.uint8((xx+yy)%256)),axis=2)
  self.rig=GraphicsRig(self.w,self.h)
 def test_full_frame_source_geometry(self):
  self.assertTrue(np.array_equal(cover(self.frame,self.w,self.h),self.frame))
  self.assertEqual(cover(self.frame,220,350).shape,(350,220,3))
  self.assertEqual(cover(self.frame,220,350,fy=.8).shape,(350,220,3))
 def test_rounded_alpha(self):
  m=rounded_mask(100,160,20)
  self.assertEqual(m.shape,(160,100))
  self.assertEqual(int(m[0,0]),0)
  self.assertEqual(int(m[80,50]),255)
 def test_easing(self):
  self.assertEqual(ease(-1),0)
  self.assertEqual(ease(2),1)
  self.assertAlmostEqual(ease(.5),.5)
  self.assertLess(ease(.1),ease(.9))
 def test_focus_and_gallery_have_real_output_delta(self):
  for mode in ('focus','gallery','split'):
   out=compose_feature(self.rig,self.frame,.35,mode=mode)
   self.assertEqual(out.shape,self.frame.shape)
   self.assertEqual(out.dtype,np.uint8)
   self.assertGreater(float(np.mean(np.abs(out.astype(np.int16)-self.frame.astype(np.int16)))),5,mode)
   self.assertGreater(float(out.mean()),12,mode)
 def test_depth_nonwarping_and_motion(self):
  arr=[compose_feature(self.rig,self.frame,t,mode='gallery') for t in [0,.35,.9,1.3]]
  self.assertTrue(any(not np.array_equal(arr[i],arr[i+1])for i in range(3)))
  self.assertTrue(all(a.shape==(480,270,3) for a in arr))
 def test_static_determinism(self):
  x=compose_feature(self.rig,self.frame,.6,mode='focus')
  y=compose_feature(self.rig,self.frame,.6,mode='focus')
  self.assertTrue(np.array_equal(x,y))
 def test_unknown_mode_fails(self):
  with self.assertRaises(ValueError):compose_feature(self.rig,self.frame,.5,mode='not-a-real-effect')
if __name__=='__main__':unittest.main()
