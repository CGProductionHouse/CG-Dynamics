from pathlib import Path
from tempfile import TemporaryDirectory
import unittest,json,copy
from datetime import datetime,timezone
from edit_foundation import validate,bind

class FoundationTests(unittest.TestCase):
 def setUp(self):
  self.temp=TemporaryDirectory();self.root=Path(self.temp.name);self.skills=Path(__file__).resolve().parents[4]/'scripts/video-editing/studio-phase2/skills'
  self.asset=self.root/'font-evidence.bin';self.asset.write_bytes(b'fixed fixture bytes, not a production font')
  self.baseline=self.put('baseline.json',dict(client_id='exact-client',typography={'family':'Fixture'},assets=[dict(key='font',path=self.asset.name,sha256=bind(self.asset)['sha256'],status='approved_baseline')]))
  self.context=self.put('context.json',dict(library=str(self.root),creative_baseline=bind(self.baseline),owner_rules=[{'id':'UI-01'}]))
  self.month=self.put('month.json',dict(country='ZA',month='2026-11',compiled_at='2026-11-01',review_by='2026-11-30',opportunities=[dict(id='election',use_from='2026-10-01',use_until='2026-11-04')]))
  self.strategy=self.put('strategy.json',dict(client_id='exact-client',retrieved_at=datetime.now(timezone.utc).isoformat(),packet=dict(client={'id':'exact-client'},strategy_month='2026-11-01',state='blocked',canonical_draft={'workflow_status':'draft'})))
 def tearDown(self):self.temp.cleanup()
 def put(self,name,value):p=self.root/name;p.write_text(json.dumps(value));return p
 def plan(self):
  craft={k:dict(decision='omit',reason='Not useful to this scene')for k in ['composition_motion','transitions']}
  craft.update(typography=dict(decision='use',cards=['staggered-type'],reason='Reveal the precise question'),ui=dict(decision='use',cards=['stateful-ui-motion'],reason='Show persistent focus'),sound=dict(decision='use',cards=['sound-led-cuts'],reason='Actual button state only, no automaticwhoosh'))
  f=dict(schema=1,release_date='2026-11-06',month_intel=bind(self.month),timely_angle=dict(decision='evergreen',reason='Current assignment has no useful event link'),baseline=bind(self.baseline),client_library=str(self.root),dynamics_strategy=bind(self.strategy),strategy_use='supporting_draft',opener=dict(kind='graphic_construction',source_binding='Fixture licensed action source',beats=[dict(start=0,end=1,visible_change='Actual action starts',viewer_reason='See the cause'),dict(start=1,end=3,visible_change='Reveal the consequence',viewer_reason='Resolve the question')]),craft=craft,design=dict(baseline_sha256=bind(self.baseline)['sha256'],word_hierarchy='Bold contrast',layout='Common baseline',reveal='Measured rise',face_clearance='Separate from all faces'))
  hook=f.pop('opener');hook['id']='chosen';return dict(client_id='exact-client',client_context_snapshot=str(self.context),skill_library_root=str(self.skills),skill_applications=[dict(skill_id=x)for x in ['staggered-type','stateful-ui-motion']],hooks=[hook],chosen_hook_id='chosen',foundation=f)
 def test_draft_remains_draft_but_inputs_can_be_used(self):self.assertEqual(validate(self.plan()),[])
 def test_expired_election_cannot_be_current_hook(self):
  p=self.plan();p['foundation']['timely_angle']=dict(decision='use',id='election',reason='Vote today');self.assertTrue(any('expired'in x for x in validate(p)))
 def test_wrong_month_research_is_rejected(self):
  p=self.plan();p['foundation']['release_date']='2026-12-01';self.assertTrue(validate(p))
 def test_changed_brand_file_is_not_silently_accepted(self):
  p=self.plan();self.asset.write_bytes(b'new unapproved bytes');self.assertTrue(any('asset'in x for x in validate(p)))
 def test_old_baseline_cannot_replace_the_loaded_one(self):
  p=self.plan();p['foundation']['baseline']=bind(self.put('different.json',json.loads(self.baseline.read_text())));self.assertTrue(any('inherit'in x for x in validate(p)))
 def test_draft_cannot_be_called_approved(self):
  p=self.plan();p['foundation']['strategy_use']='approved_direction';self.assertTrue(any('promoted'in x for x in validate(p)))
 def test_selected_skill_cannot_be_dropped_from_execution(self):
  p=self.plan();p['skill_applications']=[];self.assertTrue(any('carried'in x for x in validate(p)))
 def test_poster_label_and_missing_visible_beats_fail(self):
  p=self.plan();p['hooks'][0]['kind']='poster_only';self.assertTrue(validate(p));p=self.plan();p['hooks'][0]['beats'][0]['end']=2;self.assertTrue(validate(p))
 def test_wrong_client_strategy_fails(self):
  p=self.plan();p['foundation']['dynamics_strategy']=bind(self.put('wrong.json',dict(client_id='sibling',packet=dict(client={'id':'sibling'}))));self.assertTrue(any('Wrong-client'in x for x in validate(p)))
 def test_same_client_wrong_month_strategy_fails(self):
  p=self.plan();v=json.loads(self.strategy.read_text());v['packet']['strategy_month']='2026-12-01';p['foundation']['dynamics_strategy']=bind(self.put('wrong-month.json',v));self.assertTrue(any('strategy month'in x for x in validate(p)))
 def test_stale_strategy_cannot_be_reused_as_current(self):
  p=self.plan();v=json.loads(self.strategy.read_text());v['retrieved_at']='2020-01-01T00:00:00Z';p['foundation']['dynamics_strategy']=bind(self.put('stale.json',v));self.assertTrue(any('stale'in x for x in validate(p)))
 def test_owner_required_ui_cannot_be_omitted(self):
  p=self.plan();p['foundation']['craft']['ui']=dict(decision='omit',reason='I prefer a plain page');self.assertTrue(any('UI rule'in x for x in validate(p)))
if __name__=='__main__':unittest.main()
