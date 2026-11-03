"""Boundary/continuity regressions for source-independent existing techniques.

These prove compositing, not source fit, native editing or musical taste.
"""
from pathlib import Path
import unittest
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from visual_treatments import text_aperture, glyph_shine, type_reveal

ROOT=Path(__file__).resolve().parents[4]


class PortableVisuals(unittest.TestCase):
    def test_aperture_preserves_the_current_moving_source_and_full_resolve(self):
        mask=Image.new('L',(120,200));ImageDraw.Draw(mask).rectangle((40,70,80,130),fill=255)
        for t in range(5):
            source=Image.new('RGB',mask.size,(20,t*40,80))
            ImageDraw.Draw(source).rectangle((t*10,0,t*10+8,199),fill=(255,255,255))
            part=text_aperture(source,mask,(0,0,0),1,(60,100))
            self.assertEqual(part.getpixel((50,80)),source.getpixel((50,80)))
            self.assertEqual(text_aperture(source,mask,(0,0,0),20,(60,100)).tobytes(),source.tobytes())

    def test_counter_pivot_and_mismatched_mask_fail_instead_of_black_hole(self):
        mask=Image.new('L',(120,200));d=ImageDraw.Draw(mask)
        d.ellipse((20,50,100,150),fill=255);d.ellipse((40,70,80,130),fill=0)
        picture=Image.new('RGB',mask.size,'red')
        with self.assertRaises(ValueError):text_aperture(picture,mask,(0,0,0),2,(60,100))
        with self.assertRaises(ValueError):text_aperture(picture,mask.resize((60,100)),(0,0,0))
        with self.assertRaises(ValueError):text_aperture(picture,mask,(0,0,0),float('nan'),(30,100))

    def test_glyph_shine_cannot_change_alpha_or_background_rgb(self):
        font=ImageFont.truetype(str(ROOT/'scripts/video-editing/studio-phase2/scene/assets/SpaceGrotesk.ttf'),24)
        layer=type_reveal((180,240),[('PROOF',(50,110,130))],font,(12,60),9,0,shutter=0)
        plain=np.asarray(layer)
        for centre in (-50,30,80,250):
            result=np.asarray(glyph_shine(layer,centre,18,.2,.4,(200,230,235)))
            self.assertTrue(np.array_equal(result[:,:,3],plain[:,:,3]))
            self.assertTrue(np.array_equal(result[plain[:,:,3]==0],plain[plain[:,:,3]==0]))
        self.assertNotEqual(glyph_shine(layer,60,18,.2,.4,(200,230,235)).tobytes(),layer.tobytes())

    def test_zero_strength_is_bit_identical_and_bad_geometry_is_rejected(self):
        layer=Image.new('RGBA',(40,80),(20,40,60,128))
        self.assertEqual(glyph_shine(layer,20,10,.2,0,(255,255,255)).tobytes(),layer.tobytes())
        with self.assertRaises(ValueError):glyph_shine(layer,20,0,.2,.4,(255,255,255))
        with self.assertRaises(ValueError):glyph_shine(layer,20,10,.2,2,(255,255,255))


if __name__=='__main__':unittest.main()
