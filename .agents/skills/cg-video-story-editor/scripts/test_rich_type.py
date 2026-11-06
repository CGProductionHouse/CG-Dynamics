"""Visible-ink, baseline, fit and protected revision tests; no taste/phone claim."""
from pathlib import Path
import unittest
from PIL import ImageFont
from visual_treatments import layout_type_runs, rich_type_reveal

FONT=Path(__file__).resolve().parents[4]/'scripts/video-editing/studio-phase2/scene/assets/SpaceGrotesk.ttf'
def font(size,weight):
    f=ImageFont.truetype(str(FONT),size);f.set_variation_by_axes([weight]);return f

class RichType(unittest.TestCase):
    def setUp(self):
        self.normal=font(28,400);self.bold=font(42,700)
        self.lines=[[('prepare',self.normal,(255,255,255)),('EARLY',self.bold,(120,220,150))],
                    [('gyp',self.bold,(255,255,255)),('HÊ',self.normal,(255,255,255))]]
    def test_mixed_sizes_share_baseline_and_visible_ink_gap(self):
        a=layout_type_runs(self.lines,(20,30),450,line_gap=9)
        self.assertEqual(a[0]['baseline'],a[1]['baseline'])
        self.assertEqual(min(x['rect'][1] for x in a if x['line']==1)-max(x['rect'][3] for x in a if x['line']==0),9)
        self.assertGreater(a[2]['rect'][3],a[2]['baseline']) # descender survives
    def test_fit_fails_instead_of_shrinking_or_replacing_font(self):
        with self.assertRaises(ValueError):layout_type_runs(self.lines,(20,30),20)
        a=layout_type_runs(self.lines,(20,30),450)
        self.assertIs(a[1]['font'],self.bold)
    def test_invalid_layout_and_reveal_bounds_fail(self):
        for lines,width,gap in [([],450,9),(self.lines,450,-1),(self.lines,float('nan'),9)]:
            with self.assertRaises(ValueError):layout_type_runs(lines,(20,30),width,gap)
        a=layout_type_runs(self.lines,(20,30),450)
        with self.assertRaises(ValueError):rich_type_reveal((50,50),a,1,[0]*len(a))
    def test_reveal_stays_inside_ink_rectangles_and_holds_sharp(self):
        a=layout_type_runs(self.lines,(20,30),450)
        before=rich_type_reveal((520,240),a,-1,[0]*4)
        self.assertIsNone(before.getbbox())
        sharp=rich_type_reveal((520,240),a,2,[0]*4)
        self.assertIsNotNone(sharp.getbbox())
        self.assertEqual(sharp.tobytes(),rich_type_reveal((520,240),a,3,[0]*4).tobytes())
        for t in [.1,.25,1]:
            im=rich_type_reveal((520,240),a,t,[0]*4)
            for y in range(im.height):
                for x in range(im.width):
                    if im.getpixel((x,y))[3]:
                        self.assertTrue(any(l<=x<r and top<=y<b for l,top,r,b in [v['rect'] for v in a]))
    def test_late_word_revision_preserves_prior_visible_frames(self):
        a=layout_type_runs(self.lines,(20,30),450)
        changed=[self.lines[0],[('dry',self.bold,(255,255,255)),self.lines[1][1]]]
        b=layout_type_runs(changed,(20,30),450)
        for t in [0,.25,.5,.75]:
            self.assertEqual(rich_type_reveal((520,240),a,t,[0,.15,1.2,1.35]).tobytes(),
                             rich_type_reveal((520,240),b,t,[0,.15,1.2,1.35]).tobytes())
        self.assertNotEqual(rich_type_reveal((520,240),a,2,[0]*4).tobytes(),rich_type_reveal((520,240),b,2,[0]*4).tobytes())

if __name__=='__main__':unittest.main()
