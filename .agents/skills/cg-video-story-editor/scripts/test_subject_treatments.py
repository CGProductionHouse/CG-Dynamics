import unittest
import numpy as np
from PIL import Image,ImageDraw
from subject_treatments import outline_depth,incoming_subject_prelap,invert_extract

class SubjectTreatments(unittest.TestCase):
    def test_outline_stays_front_while_filled_centre_restores_subject(self):
        bg=Image.new('RGB',(40,40),(30,50,70));g=Image.new('L',bg.size);ImageDraw.Draw(g).rectangle((10,10,30,30),fill=255)
        person=Image.new('L',bg.size,255);out=outline_depth(bg,g,person,(200,40,30),2)
        self.assertEqual(out.getpixel((10,20)),(200,40,30))
        self.assertEqual(out.getpixel((20,20)),bg.getpixel((20,20)))
        self.assertEqual(out.getpixel((5,5)),bg.getpixel((5,5)))

    def test_outline_empty_foreground_matches_solid_title(self):
        bg=Image.new('RGB',(40,40),'black');g=Image.new('L',bg.size);ImageDraw.Draw(g).rectangle((10,10,30,30),fill=255)
        out=outline_depth(bg,g,Image.new('L',bg.size),(10,200,100),2)
        self.assertEqual(out.getpixel((20,20)),(10,200,100))

    def test_incoming_prelap_cannot_change_outside_matte(self):
        bg=Image.new('RGB',(40,40),(10,30,50));src=Image.new('RGB',bg.size,'black');m=Image.new('L',bg.size);ImageDraw.Draw(m).rectangle((15,10,25,30),fill=255)
        out=np.asarray(incoming_subject_prelap(bg,src,m));mask=np.asarray(m)>0
        np.testing.assert_array_equal(out[~mask],np.asarray(bg)[~mask])
        self.assertTrue((out[mask]>200).all())
        self.assertEqual(incoming_subject_prelap(bg,src,Image.new('L',bg.size)).tobytes(),bg.tobytes())

    def test_extract_texture_is_deterministic_and_rejects_bad_thresholds(self):
        bg=Image.new('RGB',(40,40),(30,80,120))
        self.assertEqual(invert_extract(bg,seed=2).tobytes(),invert_extract(bg,seed=2).tobytes())
        out=np.asarray(invert_extract(bg,seed=2))
        np.testing.assert_array_equal(out[:,:,0],out[:,:,1])
        np.testing.assert_array_equal(out[:,:,1],out[:,:,2])
        with self.assertRaises(ValueError):invert_extract(bg,black=240,white=192)
        with self.assertRaises(ValueError):outline_depth(bg,Image.new('L',(20,20)),Image.new('L',bg.size),(1,2,3))

if __name__=='__main__':unittest.main()
