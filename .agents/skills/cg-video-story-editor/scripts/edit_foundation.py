"""Reuse editorial research/brand evidence and check explicit craft choices.

Local files only; no models, network, renderer, scheduler or new job tracker.
"""
from pathlib import Path
from datetime import date,datetime,timezone
import argparse, json, hashlib, re

DOMAINS=('typography','composition_motion','transitions','ui','sound')
def read(path):return json.loads(Path(path).read_text(encoding='utf-8-sig'))
def sha(path):
 with Path(path).open('rb')as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
def bind(path):return dict(path=str(Path(path).resolve()),sha256=sha(path))
def bound(value):
 p=Path(value['path'])
 if not p.is_file() or sha(p)!=value['sha256']:raise ValueError('Changed/missing planning evidence: '+str(p))
 return p
def inventory(root):
 rows=[]
 for card in sorted(Path(root).glob('*/SKILL.md')):
  text=card.read_text(encoding='utf8');m=re.search(r'^description:\s*(.+)$',text,re.M)
  rows.append(dict(id=card.parent.name,description=m.group(1).strip()if m else'Read card for exact scope',card=bind(card),state='Documented mechanism; read actual source/native/rights/review gates, not mastery',implementations=[p.name for p in card.parent.glob('*.py')]))
 return rows
def packet(envelope):return envelope.get('packet',envelope)
def strategy_window(envelope,month):
 p=packet(envelope)
 if p.get('strategy_month')!=month+'-01':raise ValueError('Dynamics strategy month differs from this research/job month')
 observed=datetime.fromisoformat(envelope['retrieved_at'].replace('Z','+00:00'))
 if observed.tzinfo is None:raise ValueError('Strategy retrieval needs an explicit timezone')
 age=(datetime.now(timezone.utc)-observed.astimezone(timezone.utc)).total_seconds()
 if not -300<=age<=86400:raise ValueError('Strategy snapshot is stale; refresh its fingerprint/state, not the brand research')
def prepare(context_path,intel_path,strategy_path,root):
 from load_client_library import verify
 context=verify(context_path);strategy=read(strategy_path);p=packet(strategy)
 if strategy.get('client_id')!=context['client_id'] or p.get('client',{}).get('id')!=context['client_id']:raise ValueError('Strategy belongs to another client')
 strategy_window(strategy,read(intel_path)['month'])
 baseline=context.get('creative_baseline');cards=inventory(root)
 return dict(schema=1,status='INPUTS_LOADED_STORY_NOT_YET_DESIGNED',client_id=context['client_id'],context=bind(context_path),baseline=baseline,month_intel=bind(intel_path),dynamics_strategy=bind(strategy_path),strategy_state=dict(state=p.get('state'),version=p.get('canonical_draft',{}).get('version'),workflow_status=p.get('canonical_draft',{}).get('workflow_status'),blockers=p.get('blockers',[]),use_as='supporting_draft'if p.get('canonical_draft',{}).get('workflow_status')=='draft'else'check_recorded_authority'),approved_references=context['approved_references'],active_assets=[a for a in context['assets']if a.get('status')!='rejected'],excluded_assets=[a for a in context['assets']if a.get('status')=='rejected'],skill_inventory=cards,decisions_required=list(DOMAINS),remaining=['Current owner assignment/goal','Choose relevant dated angle or justified evergreen','Source-bound observable0–3s event and payoff','Brand-bound type/layout decisions, selected mechanisms/parameters/control','Sound purpose/licence/use exclusions and exact-export review'],limits='Loaded inputs do not establish a good hook, approved strategy, usable source or permission to produce/send')
def validate(plan):
 errors=[]
 try:
  f=plan['foundation']
  if f.get('schema')!=1:raise ValueError('Unknown foundation schema')
  release=date.fromisoformat(f['release_date']);intel=read(bound(f['month_intel']))
  if intel['country']!='ZA' or intel['month']!=release.strftime('%Y-%m'):raise ValueError('Wrong country/month research')
  if not date.fromisoformat(intel['compiled_at'][:10])<=release<=date.fromisoformat(intel['review_by']):raise ValueError('Monthly research needs its bounded refresh')
  angle=f['timely_angle']
  if angle['decision']=='use':
   opportunity=next((x for x in intel['opportunities']if x['id']==angle['id']),None)
   if not opportunity or not date.fromisoformat(opportunity['use_from'])<=release<=date.fromisoformat(opportunity['use_until']):raise ValueError('Opportunity expired/not yet appropriate for release')
  elif angle['decision']!='evergreen':raise ValueError('Choose timely use or explicit evergreen')
  if not angle.get('reason'):raise ValueError('Missing brand/audience relevance for timely/evergreen choice')
  baseline=read(bound(f['baseline']))
  if baseline['client_id']!=plan['client_id']:raise ValueError('Wrong-client approved baseline')
  root=Path(f['client_library'])
  loaded=read(plan['client_context_snapshot'])
  if loaded.get('creative_baseline')!=f['baseline']or Path(loaded['library']).resolve()!=root.resolve():raise ValueError('Foundation did not inherit the loaded client baseline/library')
  for a in baseline['assets']:
   p=(root/a['path']).resolve()
   if a.get('status')=='rejected' or not p.is_file()or sha(p)!=a['sha256']:raise ValueError('Approved baseline asset rejected/missing/changed: '+a['key'])
  strategy=read(bound(f['dynamics_strategy']));p=packet(strategy)
  if strategy.get('client_id')!=plan['client_id'] or p.get('client',{}).get('id')!=plan['client_id']:raise ValueError('Wrong-client Dynamics strategy')
  strategy_window(strategy,intel['month'])
  if f['strategy_use']=='approved_direction'and(p.get('state')!='ready'or p.get('canonical_draft',{}).get('workflow_status')not in ['approved','published']):raise ValueError('Draft/incomplete Dynamics game plan cannot be promoted to approved')
  if f['strategy_use']not in ['supporting_draft','approved_direction','owner_assignment_with_recorded_strategy_gap']:raise ValueError('Missing honest strategy authority')
  hook=next(h for h in plan['hooks']if h['id']==plan['chosen_hook_id'])
  if hook['kind']not in ['source_action','anticipation','graphic_construction','contrast_reveal','question_with_visible_proof','human_detail']:raise ValueError('Poster-only/slogan-only opener is not a developed hook')
  beats=hook['beats'];cursor=0
  for b in beats:
   if b['start']!=cursor or not cursor<b['end']<=3 or not b.get('visible_change')or not b.get('viewer_reason'):raise ValueError('Opening must map actual visible changes continuously through0–3s')
   cursor=b['end']
  if cursor!=3 or len(beats)<2 or not hook.get('source_binding'):raise ValueError('Opening needs distinct changes/source evidence, not a title label')
  ids={x['id']for x in inventory(plan['skill_library_root'])};used=set()
  for domain in DOMAINS:
   decision=f['craft'][domain]
   if decision['decision']not in ['use','omit']or not decision.get('reason'):raise ValueError('Every craft domain needs an explicit story-fit decision: '+domain)
   if domain=='ui'and decision['decision']!='use'and any(r.get('id')=='UI-01'for r in loaded.get('owner_rules',[])):raise ValueError('Current owner UI rule requires a purposeful selected UI mechanism')
   if decision['decision']=='use':
    if not decision.get('cards')or not set(decision['cards'])<=ids:raise ValueError('Unknown/empty selected shared skill: '+domain)
    if domain!='sound':used.update(decision['cards'])
  actual={x['skill_id']for x in plan['skill_applications']}
  if not used<=actual:raise ValueError('Selected craft was not carried into actual skill applications: '+','.join(sorted(used-actual)))
  design=f['design']
  if design['baseline_sha256']!=f['baseline']['sha256']or not all(design.get(k)for k in ['word_hierarchy','layout','reveal','face_clearance']):raise ValueError('Typography/design not tied to the existing approved baseline')
 except (KeyError,TypeError,ValueError,OSError,IndexError,StopIteration)as e:errors.append('Editorial foundation: '+str(e))
 return errors
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--context',required=True);p.add_argument('--month-intel',required=True);p.add_argument('--strategy',required=True);p.add_argument('--skills',required=True);p.add_argument('--output',required=True);a=p.parse_args()
 out=Path(a.output).resolve()
 if any((x/'.git').exists()for x in [out,*out.parents]):raise ValueError('Private client planning output must remain outside Git')
 result=prepare(a.context,a.month_intel,a.strategy,a.skills);out.mkdir(parents=True,exist_ok=True);(out/'FOUNDATION-INPUTS.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
 lines=['# Load once, then design the story',f"Client: {result['client_id']}",f"Dynamics game plan: {result['strategy_state']}",f"Existing skill cards: {len(result['skill_inventory'])}; this is not a mastery count.",'','## Craft available']
 lines +=[f"- {x['id']}: {x['description']}"for x in result['skill_inventory']]
 lines+=['','## Still required']+['- '+s for s in result['remaining']];(out/'PLAN-FROM-HERE.md').write_text('\n'.join(lines)+'\n',encoding='utf8');print(json.dumps(dict(status=result['status'],cards=len(result['skill_inventory']),strategy=result['strategy_state'])))
if __name__=='__main__':main()
