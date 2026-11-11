"""Contract and negative controls for Nolan's additive long-audio identification path."""
import io,json,math,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from nolan_audio_windows import plan_windows,compare_windows

A=[0x1f0f0f0f + ((i*1234567)%0xffff) for i in range(160)]
B=[0x79797979 + ((i*456789)%0xffff) for i in range(160)]
SHA='a'*64
def w(v,at=0,sha=SHA):
 return {'start_seconds':at,'seconds':20,'source_sha256':sha,'fingerprint':{'algorithm':'chromaprint_raw_v1','values':v}}
def source(vs=None,coverage=True):
 return {'schema':1,'source_sha256':SHA,'windows':vs if vs is not None else [w(A)],
         'coverage_complete':coverage}
def old(f=A,status='REJECTED'):
 return {'record_id':'legacy:42','title':'A','status':status,'sha256':'b'*64,
         'fingerprint':{'algorithm':'chromaprint_raw_v1','values':f}}

class WindowContract(unittest.TestCase):
 def test_short_source(self):
  q=plan_windows(22);self.assertEqual(len(q['windows']),1);self.assertTrue(q['coverage_complete'])
 def test_invalid_duration(self):
  for x in [-1,0,8,float('nan'),float('inf')]:
   with self.subTest(x=x),self.assertRaises(ValueError):plan_windows(x)
 def test_invalid_window_parameters(self):
  for k in [{'overlap':5},{'max_windows':0},{'window':0},{'max_windows':9}]:
   with self.subTest(k=k),self.assertRaises(ValueError):plan_windows(220,**k)
 def test_long_source_tiled(self):
  p=plan_windows(330)
  self.assertTrue(p['coverage_complete'])
  self.assertEqual(p['windows'][0]['start_seconds'],0)
  self.assertAlmostEqual(p['windows'][-1]['start_seconds']+p['windows'][-1]['seconds'],330)
  self.assertTrue(all(b['start_seconds'] <= a['start_seconds']+a['seconds']-19
                      for a,b in zip(p['windows'],p['windows'][1:])))
 def test_incomplete_long_source_reported(self):
  p=plan_windows(1000);self.assertFalse(p['coverage_complete'])
  self.assertLess(p['covered_until_seconds'],1000)
  self.assertEqual(len(p['windows']),8)
 def test_exact_identical_hold(self):
  v=compare_windows(source(),[old()])
  self.assertEqual(v['state'],'RECORDING_MATCH_REVIEW_HOLD')
  self.assertEqual(len(v['matches']),1)
 def test_later_window_same_song_hold(self):
  v=compare_windows(source([w(B,0),w(A,120)]),[old()])
  self.assertEqual(len(v['matches']),1)
  self.assertEqual(v['matches'][0]['comparison']['source_start_seconds'],120)
 def test_different_recording_no_clearance(self):
  v=compare_windows(source([w(B)]),[old()])
  self.assertIn('NOT_CLEARANCE',v['state'])
  self.assertFalse(v['creative_approval'])
 def test_missing_history_coverage(self):
  v=compare_windows(source(),[{'record_id':'z','title':'unknown'}])
  self.assertFalse(v['historical_coverage_complete'])
  self.assertEqual(v['history_rows_without_usable_fingerprints'],1)
 def test_unknown_old_algorithm_not_clearance(self):
  h=old();h['fingerprint']['algorithm']='unknown'
  v=compare_windows(source(),[h])
  self.assertFalse(v['historical_coverage_complete'])
 def test_incomplete_source_flags(self):
  v=compare_windows(source(coverage=False),[old()])
  self.assertFalse(v['source_coverage_complete'])
 def test_changed_window_sha_rejected(self):
  with self.assertRaises(ValueError):compare_windows(source([w(A,sha='b'*64)]),[old()])
 def test_too_short_fingerprint_rejected(self):
  with self.assertRaises(ValueError):compare_windows(source([w(A[:30])]),[old()])
 def test_wrong_algorithm_rejected(self):
  r=source();r['windows'][0]['fingerprint']['algorithm']='new'
  with self.assertRaises(ValueError):compare_windows(r,[old()])
 def test_bad_source_sha_rejected(self):
  r=source();r['source_sha256']='hey'
  with self.assertRaises(ValueError):compare_windows(r,[old()])
 def test_bad_schema_rejected(self):
  r=source();r['schema']=99
  with self.assertRaises(ValueError):compare_windows(r,[old()])
 def test_bad_threshold_rejected(self):
  with self.assertRaises(ValueError):compare_windows(source(),[old()],threshold=.5)
 def test_duplicate_history_dedup(self):
  h=old();v=compare_windows(source(),[h,h])
  self.assertEqual(v['unique_recordings_compared'],1)
 def test_incompatible_source_fingerprint_rejected(self):
  with self.assertRaises(ValueError):compare_windows(source([{'start_seconds':0,'source_sha256':SHA,'fingerprint':{}}]),[old()])
 def test_match_does_not_override_approval(self):
  v=compare_windows(source(),[old(status='OWNER_REJECTED')])
  self.assertFalse(v['creative_approval']);self.assertEqual(v['matches'][0]['history_status'],'OWNER_REJECTED')

if __name__=='__main__':
 s=io.StringIO();suite=unittest.defaultTestLoader.loadTestsFromTestCase(WindowContract)
 r=unittest.TextTestRunner(stream=s,verbosity=2).run(suite);print(s.getvalue())
 result={'tests':r.testsRun,'passed':r.wasSuccessful(),'failures':len(r.failures),'errors':len(r.errors),
         'scope':'Only structural and synthetic alignment controls; real audio tests separate'}
 Path(__file__).with_name('M04-UNIT-TESTS.json').write_text(json.dumps(result,indent=2),encoding='utf8')
 sys.exit(not r.wasSuccessful())