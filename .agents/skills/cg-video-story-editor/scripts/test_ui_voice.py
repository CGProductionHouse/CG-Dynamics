import unittest
import numpy as np
from PIL import Image
from ui_motion import settle,interpolate_rect,focus_frame,reflow_rows,validate_ui_plan
from voice_overlay import validate_voice,place_segments,ducking_envelope

class UIVoice(unittest.TestCase):
 def test_focus_stable_before_and_after_transition(self):
  self.assertEqual(settle(-1,1,2),0);self.assertEqual(settle(9,1,2),1)
  self.assertEqual(interpolate_rect((1,2,10,20),(3,4,14,22),0),(1,2,10,20))
  im=Image.new('RGB',(40,50));a=focus_frame(im,(1,2,10,20),(3,4,14,22),3,1,2,'white');b=focus_frame(im,(1,2,10,20),(3,4,14,22),4,1,2,'white');self.assertEqual(a.tobytes(),b.tobytes())
 def test_ui_off_canvas_and_bad_rectangles_fail(self):
  with self.assertRaises(ValueError):interpolate_rect((3,2,1,9),(1,2,3,9),.5)
  with self.assertRaises(ValueError):focus_frame(Image.new('RGB',(10,10)),(1,1,9,9),(1,1,20,20),3,1,2,'white')
 def test_expanding_selected_row_preserves_identity_and_prevents_overlap(self):
  ids=['a','b','c'];before=reflow_rows(ids,'a',10,20,40,5);after=reflow_rows(ids,'b',10,20,40,5)
  self.assertEqual(list(before),ids);self.assertEqual(list(after),ids);self.assertEqual(after['b'][1]-after['b'][0],40)
  for value in [before,after]:self.assertTrue(all(value[ids[i]][1]<value[ids[i+1]][0] for i in [0,1]))
  with self.assertRaises(ValueError):reflow_rows(['a','a'],'a',0,20,40,5)
 def test_ui_instruction_is_bound_to_a_real_selected_application(self):
  self.assertTrue(validate_ui_plan({'skill_applications':[]}))
  choice=dict(role='ui',purpose='Guide the selected policy term',mechanism='same focus frame travels',parameters=dict(component_ids=['focus'],state_ids=['amount','conditions']))
  self.assertEqual(validate_ui_plan({'skill_applications':[choice]}),[])
  choice['parameters']['state_ids']=['amount','amount'];self.assertTrue(validate_ui_plan({'skill_applications':[choice]}))
 def profile(self):return dict(voice_id='test-original',locale='en-ZA',source='Consented original narrator',rights_scope='consented_original',audio_sha256='a'*64,script_sha256='b'*64,accent_reviewed=True,pronunciation_reviewed=True)
 def test_us_engineering_cannot_be_accepted_as_south_african(self):
  p=self.profile();p.update(locale='en-US',engineering_only=True);self.assertFalse(validate_voice(p,production=False)['production_eligible'])
  with self.assertRaises(ValueError):validate_voice(p)
 def test_noncommercial_or_unreviewed_voice_fails(self):
  p=self.profile();p['rights_scope']='noncommercial'
  with self.assertRaises(ValueError):validate_voice(p)
  p=self.profile();p['accent_reviewed']=False
  with self.assertRaises(ValueError):validate_voice(p)
 def test_licensed_reviewed_voice_only_clears_provenance(self):
  self.assertTrue(validate_voice(self.profile())['production_eligible'])
 def test_audio_placement_retains_exact_speech_and_refuses_overlap(self):
  a=np.array([.1,.2,.3]);out=place_segments([(1,a)],10,2);np.testing.assert_array_equal(out[10:13,0],a);self.assertTrue((out[:10]==0).all())
  with self.assertRaises(ValueError):place_segments([(1,a),(1.1,a)],10,2)
  with self.assertRaises(ValueError):place_segments([(1,np.array([np.nan]))],10,2)
 def test_ducking_is_causal_and_recovers_without_changing_voice(self):
  voice=np.zeros((3000,2));voice[1000:1500]=.2;old=voice.copy();gain=ducking_envelope(voice,1000,reduction_db=9)
  np.testing.assert_array_equal(voice,old);self.assertTrue((gain[:1000]==1).all());self.assertLess(gain[1450],.36);self.assertGreater(gain[-1],.99)
 def test_offline_anticipation_protects_word_onset_without_moving_speech(self):
  voice=np.zeros((3000,2));voice[1000:1400]=.2;before=voice.copy()
  causal=ducking_envelope(voice,1000);preview=ducking_envelope(voice,1000,lookahead=.08,hold=.12)
  np.testing.assert_array_equal(voice,before)
  self.assertTrue((preview[:920]==1).all());self.assertLess(preview[1000],.39);self.assertGreater(causal[1000],.9)
  self.assertGreater(preview[-1],.99)
 def test_hold_bridges_word_gap_but_releases_between_phrases(self):
  voice=np.zeros(2500);voice[500:800]=.2;voice[900:1200]=.2
  causal=ducking_envelope(voice,1000);held=ducking_envelope(voice,1000,hold=.12)
  self.assertGreater(causal[895],.5);self.assertLess(held[895],.36);self.assertGreater(held[2499],.99)
 def test_hold_revision_protects_prearrival_and_default_control(self):
  voice=np.zeros(3000);voice[1000:1500]=.2
  a=ducking_envelope(voice,1000,lookahead=.08,hold=.12);b=ducking_envelope(voice,1000,lookahead=.08,hold=.2)
  np.testing.assert_array_equal(a[:1500],b[:1500]);self.assertLess(b[1650],a[1650])
  np.testing.assert_array_equal(ducking_envelope(voice,1000),ducking_envelope(voice,1000,lookahead=0,hold=0))
 def test_offline_duck_silence_empty_edges_and_invalid_timing(self):
  np.testing.assert_array_equal(ducking_envelope(np.zeros(100),1000,lookahead=.08,hold=.12),np.ones(100))
  self.assertEqual(len(ducking_envelope(np.zeros(0),1000,lookahead=.08,hold=.12)),0)
  g=ducking_envelope(np.ones(100)*.2,1000,lookahead=.08,hold=.12);self.assertTrue(np.isfinite(g).all());self.assertGreaterEqual(g.min(),10**(-9/20))
  for kwargs in [dict(lookahead=-.1),dict(hold=float('nan')),dict(attack=float('inf'))]:
   with self.assertRaises(ValueError):ducking_envelope(np.zeros(100),1000,**kwargs)
  for bad in [np.array([np.nan]),np.zeros((10,3)),np.zeros((2,3,4))]:
   with self.assertRaises(ValueError):ducking_envelope(bad,1000)
if __name__=='__main__':unittest.main()
