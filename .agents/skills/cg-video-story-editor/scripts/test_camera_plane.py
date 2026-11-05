import unittest
import numpy as np
from PIL import Image,ImageDraw
from camera_plane import camera_pose,project_corners,render_camera

class CameraProjection(unittest.TestCase):
    def test_frontal_square_projects_without_keystone(self):
        p=[0,0,100,0,0,0,0];corners=project_corners((100,100),(100,100),p,90)
        np.testing.assert_allclose(corners,[[25,25],[75,25],[75,75],[25,75]],atol=.0001)

    def test_lateral_camera_changes_perspective_not_only_scale(self):
        frontal=project_corners((100,100),(100,100),[0,0,100,0,0,0,0],90)
        lateral=project_corners((100,100),(100,100),[35,0,100,0,0,0,0],90)
        self.assertFalse(np.allclose(frontal,lateral))
        self.assertNotAlmostEqual(float(lateral[3,1]-lateral[0,1]),float(lateral[2,1]-lateral[1,1]))

    def test_shutter_cannot_blur_locked_holds(self):
        art=Image.new('RGB',(100,100),'black');ImageDraw.Draw(art).rectangle((30,20,65,80),fill='white')
        keys=[[0,[0,0,100],[0,0,0],0],[1,[0,0,100],[0,0,0],0]]
        a=render_camera(art,(100,100),keys,.5,shutter=0)
        b=render_camera(art,(100,100),keys,.5,shutter=180,samples=33)
        self.assertEqual(a.tobytes(),b.tobytes())

    def test_later_settle_revision_preserves_earlier_camera_exposures(self):
        keys=[[0,[0,0,100],[0,0,0],0],[1,[0,0,100],[0,0,0],0],[2,[50,0,100],[50,0,0],0]]
        rev=[keys[0],keys[1],[2.08,*keys[2][1:]]]
        for t in np.linspace(0,.98,50):np.testing.assert_array_equal(camera_pose(keys,t),camera_pose(rev,t))
        self.assertFalse(np.array_equal(camera_pose(keys,1.6),camera_pose(rev,1.6)))

    def test_behind_camera_and_degenerate_pose_fail(self):
        with self.assertRaises(ValueError):project_corners((100,100),(100,100),[0,0,0,0,0,0,0])
        with self.assertRaises(ValueError):project_corners((100,100),(100,100),[0,0,100,0,0,200,0])
        with self.assertRaises(ValueError):camera_pose([[1,[0,0,100],[0,0,0],0],[1,[0,0,90],[0,0,0],0]],1)

if __name__=='__main__':unittest.main()
