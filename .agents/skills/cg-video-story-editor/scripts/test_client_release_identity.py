"""Observed filename conventions and sequence boundaries; not creative approval."""
import unittest
from check_client_release import production_prefix,named_for_prefix

class ProductionNames(unittest.TestCase):
    def identity(self,code):
        return {'verified':True,'year':2026,'month':11,'client_short_code':code,'video_number':1}

    def test_recorded_client_code_word_separators(self):
        for code in ['ACTION_SPORTS','WATCH_ADDICT','CENTRAL_CANVAS','PSG','EHP','TBS','WISERIDE']:
            with self.subTest(code=code):
                prefix=production_prefix(self.identity(code))
                self.assertTrue(named_for_prefix(prefix+'.mp4',prefix))
                self.assertTrue(named_for_prefix(prefix+'_A_REAL_STORY.mp4',prefix))
                self.assertTrue(named_for_prefix(prefix+'_COVER.jpg',prefix))

    def test_sequence_is_a_complete_component(self):
        prefix=production_prefix(self.identity('PSG'))
        for name in ['2026_11_PSG_VIDEO_010.mp4','2026_11_PSG_VIDEO_01X.mp4',
                     '2026_11_PSG_VIDEO_02.mp4','2026_11_PSG_VIDEO_010_COVER.jpg']:
            with self.subTest(name=name):self.assertFalse(named_for_prefix(name,prefix))

    def test_unverified_or_pathlike_codes_stay_blocked(self):
        for code in ['../PSG','PSG/TEAM','_PSG','PSG TEAM','A'*33]:
            with self.subTest(code=code):
                with self.assertRaises(ValueError):production_prefix(self.identity(code))
        identity=self.identity('PSG');identity['verified']=False
        with self.assertRaises(ValueError):production_prefix(identity)

    def test_canonical_normalisation_and_bounds(self):
        self.assertEqual(production_prefix(self.identity(' watch_addict ')), '2026_11_WATCH_ADDICT_VIDEO_01')
        self.assertEqual(production_prefix(self.identity('CLIENT-A')), '2026_11_CLIENT-A_VIDEO_01')
        for key,value in [('year',1999),('year',2101),('month',0),('month',13),
                          ('video_number',0),('video_number',100),('video_number',1.5),('month',True),('month',float('inf'))]:
            with self.subTest(key=key,value=value):
                identity=self.identity('PSG');identity[key]=value
                with self.assertRaises(ValueError):production_prefix(identity)

if __name__=='__main__':unittest.main()
