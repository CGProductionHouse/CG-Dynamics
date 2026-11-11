"""Nolan M05 acceptance: real Adobe archive + isolated malicious/rights controls."""
from pathlib import Path
import hashlib,json,os,tempfile,unittest,zipfile,sys
from nolan_motion_asset_gate import archive_meta,inspect_asset,evaluate,screen,load_catalog
def source_rec():
 return next(a for a in load_catalog()['assets'] if a['name']=='Basic Lower Third')
def fakezip(path, *, name='project.prgraphic', defn=None, preview=b'not-real-media'):
 data=defn if defn is not None else {'authorApp':'ppro','apiVersion':'1.4','capsuleID':'test-source','usedFontsLocalized':{'en_US':['LicensedSampleFace']}}
 with zipfile.ZipFile(path,'w') as z:
  z.writestr('definition.json',json.dumps(data));z.writestr(name,b'fixture');z.writestr('thumb.mp4',preview)
def fakeasset(path):return {'path':str(path),'asset_id':'unit-test','name':'Fixture','sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
 'native_author_app':'ppro','capsule_id':'test-source'}
class MotionIntakeTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.real=source_rec()
 def setUp(self):
  self.t=tempfile.TemporaryDirectory();self.addCleanup(self.t.cleanup);self.root=Path(self.t.name)
  self.f=self.root/'clip.mogrt';fakezip(self.f)
 def asset(self,**updates):
  a=fakeasset(self.f);a.update(updates);return a
 def inspect(self,**updates):
  return inspect_asset(self.asset(**updates),roots=[self.root])
 def test_all_actual_assets_hash_archive(self):
  r=screen();self.assertEqual((r['records'],r['inspected'],r['blocked']),(77,77,0))
 def test_actual_video_preview_is_not_native_proof(self):
  m=inspect_asset(self.real)
  self.assertTrue(m['preview_video_members'])
  self.assertEqual(m['native_host_test'],'NOT_RUN')
  self.assertFalse(m['client_ready'])
 def test_actual_aefx_font_disclosure(self):
  a=next(a for a in load_catalog()['assets']if a['native_author_app']=='aefx')
  m=inspect_asset(a);self.assertEqual(m['authorApp'],'aefx');self.assertTrue(m['required_fonts_en_US'])
  self.assertIn('NATIVE_PPRO_TEST_REQUIRED',m['compatibility_status'])
 def test_real_alias_copies_match_hash(self):
  p=self.real['aliases'][0]
  self.assertEqual(hashlib.sha256(Path(p).read_bytes()).hexdigest(),self.real['sha256'])
 def test_malformed_catalog_fails(self):
  p=self.root/'bad.json';p.write_text('{}')
  with self.assertRaises(ValueError):load_catalog(p)
 def test_cannot_assert_missing_source(self):
  a=self.asset();self.f.unlink()
  with self.assertRaisesRegex(ValueError,'missing'):inspect_asset(a,roots=[self.root])
 def test_hash_mutation_blocks(self):
  a=self.asset();self.f.write_bytes(self.f.read_bytes()+b'change')
  with self.assertRaisesRegex(ValueError,'hash changed'):inspect_asset(a,roots=[self.root])
 def test_untrusted_path_blocks(self):
  with self.assertRaisesRegex(ValueError,'outside'):inspect_asset(self.asset(),roots=[self.root/'other'])
 def test_unexpected_capsule_blocks(self):
  with self.assertRaisesRegex(ValueError,'Capsule'):self.inspect(capsule_id='forged')
 def test_unexpected_author_blocks(self):
  with self.assertRaisesRegex(ValueError,'Authoring app'):self.inspect(native_author_app='aefx')
 def test_corrupt_zip_blocks(self):
  self.f.write_bytes(b'not an archive')
  with self.assertRaisesRegex(ValueError,'Not a ZIP'):self.inspect()
 def test_missing_definition_blocks(self):
  with zipfile.ZipFile(self.f,'w')as z:z.writestr('project.prgraphic',b'fixture')
  with self.assertRaisesRegex(ValueError,'definition'):self.inspect()
 def test_missing_native_project_blocks(self):
  fakezip(self.f,name='project.txt')
  with self.assertRaisesRegex(ValueError,'graphic project'):self.inspect()
 def test_zip_slip_blocks(self):
  fakezip(self.f,name='../project.prgraphic')
  with self.assertRaisesRegex(ValueError,'Unsafe'):self.inspect()
 def test_fake_zip_bomb_blocks(self):
  with zipfile.ZipFile(self.f,'w',compression=zipfile.ZIP_DEFLATED)as z:
   z.writestr('definition.json',json.dumps({'authorApp':'ppro'}))
   z.writestr('project.prgraphic',b'x'*1024*1024)
  with self.assertRaisesRegex(ValueError,'compression ratio'):self.inspect()
 def test_no_project_blocks(self):
  self.assertIn('exact project not specified',evaluate(self.inspect())['reasons'])
 def test_unlicensed_font_blocks(self):
  r=evaluate(self.inspect(),{'project_id':'p','licensing_provider':'adobe_installed','adobe_content_entitlement_evidence':'receipt'})
  self.assertIn('Unverified required fonts',str(r['reasons']))
 def test_envato_without_certificate_blocks(self):
  r=evaluate(self.inspect(),{'project_id':'p','licensing_provider':'envato_elements','active_subscription_verified':True,
   'certificate_project_id':'other','certificate_sha256':'a'*64,'item_id':'x'})
  self.assertIn('project-specific',str(r['reasons']))
 def test_envato_with_source_license_still_needs_native_review(self):
  r=evaluate(self.inspect(),{'project_id':'p','licensing_provider':'envato_elements','active_subscription_verified':True,
   'certificate_project_id':'p','certificate_sha256':'a'*64,'item_id':'x','licensed_fonts_exact':['LicensedSampleFace']})
  self.assertTrue(any('Premiere' in x for x in r['reasons']))
 def test_native_evidence_must_match_exact_source(self):
  m=self.inspect();r=evaluate(m,{'project_id':'p','licensing_provider':'adobe_installed',
   'adobe_content_entitlement_evidence':'evidence','licensed_fonts_exact':['LicensedSampleFace'],
   'native_test':{'source_sha256':'bad','imported':True,'reopened':True,'export_decoded':True,'evidence_sha256':'x'},
   'exact_client_brand_review':True,'full_motion_review':True})
  self.assertIn('No hash-bound',str(r['reasons']))
 def test_forged_evidence_strings_cannot_pass(self):
  m=self.inspect();r=evaluate(m,{'project_id':'p','licensing_provider':'adobe_installed','adobe_content_entitlement_evidence':'evidence',
   'licensed_fonts_exact':['LicensedSampleFace'],
   'native_test':{'source_sha256':m['source_sha256'],'imported':True,'reopened':True,'export_decoded':True,'evidence_sha256':'x'},
   'exact_client_brand_review':True,'full_motion_review':True})
  self.assertEqual(r['state'],'HOLD_FOR_PRODUCTION_REVIEW')
  self.assertIn('Adobe entitlement evidence absent',r['reasons'])
 def test_all_bound_controls_still_not_client_approved(self):
  m=self.inspect()
  proof=self.root/'SYNTHETIC-UNIT-FIXTURE-NOT-PRODUCTION-PROOF.json';proof.write_text('{"fixture":"not real clearance"}')
  bound={'path':str(proof),'sha256':hashlib.sha256(proof.read_bytes()).hexdigest()}
  r=evaluate(m,{'project_id':'unit-fixture','licensing_provider':'adobe_installed',
   'adobe_content_entitlement_evidence':bound,'font_rights_evidence':{'LicensedSampleFace':bound},
   'native_test':{'source_sha256':m['source_sha256'],'imported':True,'reopened':True,'export_decoded':True,'evidence':bound},
   'exact_client_brand_review':bound,'full_motion_review':bound})
  self.assertEqual(r['state'],'EVIDENCE_COMPLETE_INTERNAL_REVIEW_ONLY')
  self.assertFalse(r['client_ready']);self.assertFalse(r['publication_approved'])
 def test_evidence_mutation_invalidates(self):
  from nolan_motion_asset_gate import actual_evidence
  p=self.root/'evidence.json';p.write_text('{}')
  a={'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
  self.assertTrue(actual_evidence(a));p.write_text('{"changed":true}')
  self.assertFalse(actual_evidence(a))
 def test_unknown_provider_blocks(self):
  self.assertIn('licensing provider unverified',evaluate(self.inspect(),{'project_id':'p','licensing_provider':'unknown'})['reasons'])
if __name__=='__main__':
 suite=unittest.defaultTestLoader.loadTestsFromTestCase(MotionIntakeTests)
 r=unittest.TextTestRunner(verbosity=2).run(suite)
 report={'tests':r.testsRun,'failures':len(r.failures),'errors':len(r.errors),'passed':r.wasSuccessful(),
 'scope':'structural asset gate and installed archive inspection; not native Premiere or artistic acceptance'}
 dest=Path(__file__).parent/'M05-ASSET-GATE-TEST-RESULT-R03.json'
 if dest.exists():raise SystemExit('Protected test receipt exists')
 dest.write_text(json.dumps(report,indent=2),encoding='utf8')
 print(json.dumps(report,indent=2),flush=True)
 raise SystemExit(0 if r.wasSuccessful() else 1)
