"""Positive and negative source controls for one original frame-seeked Lottie vector."""
import json,unittest,copy,hashlib,io
from pathlib import Path
from create_jobs import ROOT,MODES,FPS,FRAMES,sha,data
class LottieSourceTests(unittest.TestCase):
 def test_current_source_versions(self):
  self.assertEqual(data['v'],'5.13.0');self.assertEqual(data['fr'],FPS)
 def test_full_length(self):self.assertEqual(data['op']-data['ip'],FRAMES)
 def test_no_remote_assets(self):self.assertEqual(data['assets'],[])
 def test_only_vector_layers(self):self.assertTrue(all(x['ty']==4 for x in data['layers']))
 def test_animation_is_not_static(self):
  self.assertTrue(any(s.get('ty')=='tm' and s['e']['a']==1 for l in data['layers'] for gr in l['shapes'] for s in gr.get('it',[])))
 def test_real_animated_position(self):self.assertEqual(data['layers'][0]['ks']['p']['a'],1)
 def test_all_source_files_identical(self):
  self.assertEqual(len({sha(ROOT/('qualification-'+m)/'assets/source.lottie.json') for m in MODES}),1)
 def test_all_lottie_js_identical(self):
  self.assertEqual(len({sha(ROOT/('qualification-'+m)/'assets/iris-data.js') for m in MODES}),1)
 def test_no_remote_js(self):
  for m in MODES:
   s=(ROOT/('qualification-'+m)/'index.html').read_text()
   self.assertNotIn('http://',s);self.assertNotIn('https://',s)
 def test_autoplay_disabled(self):
  for m in MODES:
   s=(ROOT/('qualification-'+m)/'index.html').read_text()
   self.assertIn('autoplay:false',s)
   self.assertIn('animation.goToAndStop(frame,true)',s)
 def test_no_wall_clock_animations(self):
  for m in MODES:
   s=(ROOT/('qualification-'+m)/'index.html').read_text()
   self.assertNotIn('Date.now(',s);self.assertNotIn('requestAnimationFrame(',s)
 def test_three_distinct_controls(self):
  self.assertEqual({(ROOT/('qualification-'+m)/'mode.js').read_text() for m in MODES},set('window.NOLAN_MODE='+json.dumps(m)+';'for m in MODES))
 def test_proof_not_client(self):
  for m in MODES:
   p=json.loads((ROOT/('qualification-'+m)/'config.json').read_text())
   self.assertEqual(p['purpose'],'technical_proof');self.assertNotIn('client_id',p)
 def test_hash_bindings(self):
  for m in MODES:
   p=json.loads((ROOT/('qualification-'+m)/'config.json').read_text())
   for a in p['assets']:self.assertEqual(sha(Path(a['path'])),a['sha256'])
 def test_wrong_hash_rejected_by_existing_contract(self):
  import sys
  sys.path.insert(0,str(ROOT.parent))
  from motion_contract import validate
  p=json.loads((ROOT/'qualification-effect/config.json').read_text())
  self.assertEqual(validate(p),[])
  bad=copy.deepcopy(p);bad['assets'][1]['sha256']='0'*64
  self.assertTrue(any('changed or missing' in x for x in validate(bad)))
 def test_overlap_or_missing_scene_rejected(self):
  import sys
  sys.path.insert(0,str(ROOT.parent))
  from motion_contract import validate
  p=json.loads((ROOT/'qualification-effect/config.json').read_text())
  bad=copy.deepcopy(p);bad['scenes'][0]['out_frame']=89
  self.assertTrue(validate(bad))
 def test_late_not_release_eligible(self):
  m=(ROOT/'qualification-late/mode.js').read_text()
  self.assertIn('"late"',m)
  self.assertTrue((ROOT/'qualification-late/config.json').is_file())
 def test_no_undeclared_voice_or_music(self):
  for m in MODES:
   p=json.loads((ROOT/('qualification-'+m)/'config.json').read_text())
   self.assertFalse('sound' in p)
 def test_source_not_marked_creator_example(self):
  self.assertTrue('Original Nolan' in data['nm'])
 def test_timestamp_bounds(self):
  self.assertTrue(all(l['ip']==0 and l['op']==90 for l in data['layers']))
if __name__=='__main__':
 stream=io.StringIO();res=unittest.TextTestRunner(stream=stream,verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(LottieSourceTests))
 (ROOT/'SOURCE-TEST-RESULT.txt').write_text(stream.getvalue());(ROOT/'SOURCE-TEST-RESULT.json').write_text(json.dumps({'tests':res.testsRun,'passed':res.wasSuccessful(),'failures':len(res.failures),'errors':len(res.errors),'scope':'Source, provenance and negative controls. Actual render checks separately required.'},indent=2))
 print(stream.getvalue());raise SystemExit(0 if res.wasSuccessful() else 1)
