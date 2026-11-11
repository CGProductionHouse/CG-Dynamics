"""Nolan M06 guarded engineering regression suite. Synthetic diagnostic only."""
from __future__ import annotations
import copy,hashlib,json,math,os,subprocess,sys,tempfile,unittest
from pathlib import Path
import numpy as np
from nolan_stem_audio import pcm,sha,mix,inspect,write_wav,FF,RATE
RUN=Path(__file__).resolve().parent/'overall-development-20261110/M06-STEM-MIX-R04'
def make_fixture():
 if RUN.exists():raise ValueError('Fixture directory already exists; use protected run')
 RUN.mkdir(parents=True);src=RUN/'source';src.mkdir()
 def stereo(a):return np.column_stack((a,a*.92))
 duration=8.
 t=np.arange(round(duration*RATE))/RATE
 bed=.17*(np.sin(2*np.pi*220*t)+.38*np.sin(2*np.pi*330*t))
 bed[-round(.10*RATE):]*=np.linspace(1,.9,round(.10*RATE))
 v=np.arange(round(2*RATE))/RATE
 # ENGINEERING frequency/amplitude test signal, not speech or a model-created voice.
 dialogue=.31*(np.sin(2*np.pi*410*v)+.23*np.sin(2*np.pi*775*v))*(.65+.35*np.sin(2*np.pi*2.1*v)**2)
 s=np.arange(round(.25*RATE))/RATE
 accent=.41*np.sin(2*np.pi*(1400*s+250*s*s))*np.exp(-18*s)
 for name,signal in [('music',bed),('dialogue',dialogue),('sfx',accent)]:
  write_wav(src/(name+'.wav'),stereo(signal))
 stems={n:{'path':str(src/(n+'.wav')),'sha256':sha(src/(n+'.wav')),'start_seconds':{'music':0.,'dialogue':1.,'sfx':4.}[n],'gain_db':{'music':-11.,'dialogue':-5.,'sfx':-7.}[n]}for n in ('music','dialogue','sfx')}
 plan={'schema':1,'purpose':'TECHNICAL_PROOF_ONLY','sample_rate':RATE,'fps':30,'duration_seconds':duration,'stems':stems,
 'ducking':{'reduction_db':12.,'attack':.025,'release':.23,'lookahead':.05,'hold':.11,'threshold_db':-46.}}
 (RUN/'PLAN.json').write_text(json.dumps(plan,indent=2))
 receipt=mix(RUN/'PLAN.json',RUN/'mix-r01')
 if receipt['expected_video_frames']!=240:raise AssertionError('Bad clock')
 return plan
def encode(wav,out,duration=8.):
 ff=str(FF/'ffmpeg.exe')
 subprocess.run([ff,'-hide_banner','-v','error','-nostdin','-threads','2','-f','lavfi','-i',f'color=c=black:s=1280x720:r=30:d={duration}',
 '-i',str(wav),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac','-b:a','256k',
 '-ar',str(RATE),'-ac','2','-t',str(duration),'-movflags','+faststart',str(out)],check=True,creationflags=0x08000000,timeout=70)
class StemEngineeringTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.plan=make_fixture()
  cls.base=RUN/'mix-r01'
  cls.good=RUN/'STEM-TECHNICAL-PROOF.mp4'
  encode(cls.base/'mix.wav',cls.good)
  cls.actual=inspect(RUN/'PLAN.json',cls.base,cls.good)
 def test_exact_export_checked(self):
  self.assertEqual(self.actual['state'],'EXACT_EXPORT_ENGINEERING_PROOF_NOT_LISTENED')
  self.assertEqual(self.actual['video_frames'],240)
  self.assertGreater(self.actual['correlation'],.985)
 def test_third_stem_exists(self):self.assertEqual(set(self.actual['stem_tracks']),{'dialogue','music','sfx'})
 def test_output_does_not_claim_taste(self):self.assertFalse(self.actual['creative_release'])
 def test_dialogue_pcm_not_delayed_or_replaced(self):
  expected=pcm(RUN/'source/dialogue.wav')*10**(-5./20)
  actual=pcm(self.base/'dialogue.wav')[RATE:RATE+len(expected)]
  self.assertLess(float(np.max(np.abs(expected-actual))),1.01/32768)
  self.assertLess(float(np.max(np.abs(pcm(self.base/'dialogue.wav')[:RATE]))),1e-10)
 def test_ducking_actually_follows_voice_not_a_constant_global_drop(self):
  original=pcm(self.base/'music-unducked.wav')
  ducked=pcm(self.base/'music-ducked.wav')
  def ratio(a,b):
   i,j=round(a*RATE),round(b*RATE)
   return float(np.sqrt(np.mean(ducked[i:j]**2))/np.sqrt(np.mean(original[i:j]**2)))
  self.assertGreater(ratio(.2,.8),.98)
  self.assertLess(ratio(1.4,2.4),.29)
  self.assertGreater(ratio(3.5,3.9),.90) # Release is still active after the voice ends at 3s.
  self.assertGreater(ratio(4.5,5.2),.98) # Actual restored bed well after release.
 def test_loudness_measured_on_exact_export(self):self.assertTrue(math.isfinite(self.actual['lufs']))
 def test_true_peak_below_zero(self):self.assertLess(self.actual['true_peak_dbtp'],-.3)
 def test_real_pcm_stems_preserved(self):
  self.assertEqual(self.plan['stems']['dialogue']['sha256'],sha(RUN/'source/dialogue.wav'))
 def test_mix_cannot_overwrite(self):
  with self.assertRaises(ValueError):mix(RUN/'PLAN.json',self.base)
 def test_changed_source_blocks(self):
  p=RUN/'source/music.wav';a=p.read_bytes();p.write_bytes(a+b'X')
  try:
   with self.assertRaises(ValueError):mix(RUN/'PLAN.json',RUN/'should-not-create')
  finally:p.write_bytes(a)
 def invalid(self,change):
  pl=copy.deepcopy(self.plan);change(pl)
  p=RUN/('invalid-'+str(len(list(RUN.glob('invalid-*'))))+'.json');p.write_text(json.dumps(pl))
  try:
   with self.assertRaises((ValueError,FileNotFoundError)):mix(p,RUN/'invalid-output')
  finally:p.unlink()
 def test_incomplete_stems_blocked(self):self.invalid(lambda p:p['stems'].pop('sfx'))
 def test_bad_duration_blocked(self):self.invalid(lambda p:p.update(duration_seconds=7.7))
 def test_unapproved_voice_production_blocked(self):self.invalid(lambda p:p.update(purpose='client_revision'))
 def test_wrong_sample_rate_blocked(self):self.invalid(lambda p:p.update(sample_rate=44100))
 def test_bad_start_blocked(self):self.invalid(lambda p:p['stems']['sfx'].update(start_seconds=7.95))
 def test_nan_gain_blocked(self):self.invalid(lambda p:p['stems']['music'].update(gain_db=float('nan')))
 def test_unconfigured_ducking_blocked(self):self.invalid(lambda p:p['ducking'].update(reduction_db=0))
 def test_changed_encoded_audio_blocks(self):
  bad=RUN/'bad-no-sfx.wav';write_wav(bad,pcm(self.base/'mix.wav')-pcm(self.base/'sfx.wav'))
  out=RUN/'bad-no-sfx.mp4';encode(bad,out)
  with self.assertRaises(ValueError):inspect(RUN/'PLAN.json',self.base,out)
 def test_no_ducking_blocks(self):
  bad=RUN/'bad-no-duck.wav';write_wav(bad,pcm(self.base/'dialogue.wav')+pcm(self.base/'music-unducked.wav')+pcm(self.base/'sfx.wav'))
  out=RUN/'bad-no-duck.mp4';encode(bad,out)
  with self.assertRaises(ValueError):inspect(RUN/'PLAN.json',self.base,out)
 def test_misaligned_sfx_blocks(self):
  aud=pcm(self.base/'mix.wav');sx=pcm(self.base/'sfx.wav');shift=np.zeros_like(sx)
  shift[round(.18*RATE):]=sx[:-round(.18*RATE)]
  bad=RUN/'bad-late-accent.wav';write_wav(bad,aud-sx+shift)
  out=RUN/'bad-late-accent.mp4';encode(bad,out)
  with self.assertRaises(ValueError):inspect(RUN/'PLAN.json',self.base,out)
 def test_missing_end_audio_blocks(self):
  bad=RUN/'bad-early-end.wav';a=pcm(self.base/'mix.wav');a[-round(1.*RATE):]=0;write_wav(bad,a)
  out=RUN/'bad-early-end.mp4';encode(bad,out)
  with self.assertRaises(ValueError):inspect(RUN/'PLAN.json',self.base,out)
 def test_changed_plan_is_not_trusted(self):
  p=RUN/'PLAN.json';o=p.read_bytes()
  try:
   change=json.loads(o);change['ducking']['reduction_db']=8;p.write_text(json.dumps(change))
   with self.assertRaises(ValueError):inspect(p,self.base,self.good)
  finally:p.write_bytes(o)
 def test_corrupt_stem_receipt_blocks(self):
  p=self.base/'sfx.wav';o=p.read_bytes()
  try:
   p.write_bytes(o+b'FAULT')
   with self.assertRaises(ValueError):inspect(RUN/'PLAN.json',self.base,self.good)
  finally:p.write_bytes(o)
if __name__=='__main__':
 res=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(StemEngineeringTests))
 receipt={'tests_run':res.testsRun,'errors':len(res.errors),'failures':len(res.failures),'passed':res.wasSuccessful(),
 'proof_video':str(RUN/'STEM-TECHNICAL-PROOF.mp4'),'source_kind':'SYNTHETIC_TEST_SIGNALS_NOT_MUSIC_OR_SPEECH','output':'TECHNICAL_ONLY_NOT_CLIENT_APPROVAL'}
 (RUN/'TEST-RESULT.json').write_text(json.dumps(receipt,indent=2))
 raise SystemExit(0 if res.wasSuccessful()else 1)
