import unittest
import numpy as np
from PIL import Image
from camera_plane import depth_layer_rect,render_depth_layers

class DepthLayers(unittest.TestCase):
    def setUp(self):
        self.keys=[[0,[0,0,100],[0,0,0],0],[1,[0,0,100],[0,0,0],0]]
        self.pose=[0,0,100,0,0,0,0]
        self.l=dict(id='card',centre=(0,0,0),world_size=(50,50),image=Image.new('RGBA',(50,50),'white'))
    def test_near_layer_moves_more_without_changing_its_aspect(self):
        near={**self.l,'centre':(0,0,30)};p=[10,0,100,10,0,0,0]
        far0=depth_layer_rect(self.l,(100,100),self.pose,100);far1=depth_layer_rect(self.l,(100,100),p,100)
        n0=depth_layer_rect(near,(100,100),self.pose,100);n1=depth_layer_rect(near,(100,100),p,100)
        self.assertGreater(abs(n1[0]-n0[0]),abs(far1[0]-far0[0]))
        self.assertAlmostEqual(n1[2]-n1[0],n1[3]-n1[1])
    def test_rgba_edges_composite_without_black_fringe(self):
        l={**self.l,'image':Image.new('RGBA',(50,50),(255,255,255,128))}
        im=render_depth_layers([l],(100,100),self.keys,.5,focal=100,background=(255,255,255))
        np.testing.assert_array_equal(np.asarray(im),np.full((100,100,3),255,dtype=np.uint8))
    def test_layer_order_is_depth_based_and_opaque_foreground_occludes(self):
        far={**self.l,'id':'far','image':Image.new('RGBA',(50,50),'red')}
        near={**self.l,'id':'near','centre':(0,0,10),'image':Image.new('RGBA',(50,50),'blue')}
        a=render_depth_layers([near,far],(100,100),self.keys,.5,focal=100)
        b=render_depth_layers([far,near],(100,100),self.keys,.5,focal=100)
        self.assertEqual(a.tobytes(),b.tobytes());self.assertEqual(a.getpixel((50,50)),(0,0,255))
    def test_photo_stretch_camera_tilt_and_crossing_fail(self):
        for l,pose in [({**self.l,'world_size':(50,70)},self.pose),({**self.l,'centre':(0,0,110)},self.pose),(self.l,[10,0,100,0,0,0,0])]:
            with self.assertRaises(ValueError):depth_layer_rect(l,(100,100),pose,100)
        with self.assertRaises(ValueError):render_depth_layers([self.l,self.l],(100,100),self.keys,.5)
    def test_shutter_cannot_blur_locked_hold(self):
        a=render_depth_layers([self.l],(100,100),self.keys,.5,focal=100,shutter=0)
        b=render_depth_layers([self.l],(100,100),self.keys,.5,focal=100,shutter=180,samples=33)
        self.assertEqual(a.tobytes(),b.tobytes())

if __name__=='__main__':unittest.main()
