"""Local asset/technique discovery over existing stores. No remote search, downloads or subscriptions.
Does not create client libraries or approve any source for use.
"""
from pathlib import Path
import argparse,json,re,hashlib
S=Path(r'D:\OneDrive\CG Production House\Video Editing System')
R=Path(__file__).resolve().parent
CARDS=R.parents[1]/'office-research/scripts/video-editing/studio-phase2/skills'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))if p.is_file()else None
def sources():
 yield 'adobe-mogrt',S/'licensed-assets/adobe-installed-mogrt/CATALOG.json'
 yield 'adobe-content',S/'licensed-assets/adobe-content-sfx-20261110/CATALOG.json'
 yield 'poly-haven',R/'overall-development-20261110/licensed-3d/CATALOG.json'
 yield 'existing-sfx',S/'research/2026-11-10-Overall-Nolan-Development/ASSET-INTAKE-INVENTORY.json'
def asset_rows():
 for kind,p in sources():
  data=read(p)
  if data is None:continue
  rows=data.get('existing_sfx',[])if kind=='existing-sfx'else data.get('assets',[])
  for row in rows:yield kind,p,row
def rank(query,text):
 tokens=re.findall(r'[a-z0-9]+',query.lower()); hay=text.lower()
 hits=sum(t in hay for t in tokens)
 return sum(3 if re.search(r'\b'+re.escape(t)+r'\b',hay)else 1 if t in hay else 0 for t in tokens)+(12 if tokens and hits==len(tokens)else 0)+(8 if query.lower()in hay else 0)
def search(query,limit=15,kind=None,allow_partial=False):
 candidates=[];seen=set()
 for source,p,a in asset_rows():
  if kind and kind!=source:continue
  text=' '.join(str(a.get(k,''))for k in ['name','pack','category','search_terms','asset_id'])
  terms=re.findall(r'[a-z0-9]+',query.lower());missing=[t for t in terms if t not in text.lower()]
  score=rank(query,text)
  if not terms or not score or (missing and not allow_partial):continue
  identity=a.get('sha256')or a.get('asset_id')
  if identity in seen:continue
  seen.add(identity)
  candidates.append({'score':score,'missing_query_terms':missing,'match':'partial'if missing else'all_terms','source':source,'asset_id':a['asset_id'],'name':a.get('name'),'path':a.get('path')or a.get('files',[{}])[0].get('path'),
   'sha256':a.get('sha256'),'duration':a.get('audio',{}).get('duration'),'licence':a.get('licence')or a.get('rights_status'),
   'creative_status':a.get('creative_status')or a.get('audition_status')or'NOT_REVIEWED','source_manifest':str(p),'credit':a.get('api_credit')})
 return sorted(candidates,key=lambda x:-x['score'])[:limit]
def techniques(query,limit=12):
 results=[]
 if not CARDS.is_dir():raise FileNotFoundError('Canonical Nolan technique source unavailable: '+str(CARDS))
 for p in sorted(CARDS.glob('*/SKILL.md')):
  s=p.read_text(encoding='utf8');d=re.search(r'^description:\s*(.+)$',s,re.M)
  text=p.parent.name+' '+(d.group(1)if d else s[:1200]);score=rank(query,text)
  if score:
   results.append({'score':score,'family':p.parent.name,'path':str(p),'sha256':hashlib.sha256(s.encode()).hexdigest(),'description':d.group(1)if d else'',
    'status':'DOCUMENTED_TECHNIQUE_NOT_AUTOMATICALLY_QUALIFIED','next_step':'Read exact card, prerequisite assets, proof controls and failed boundaries; bind actual implementation to storyboard'})
 return sorted(results,key=lambda r:-r['score'])[:limit]
def inventory():
 out=[]
 for name,p in sources():
  data=read(p);out.append({'source':name,'path':str(p),'available':data is not None,'sha256':hashlib.file_digest(p.open('rb'),'sha256').hexdigest()if data else None,
   'records':len(data.get('existing_sfx',[])if name=='existing-sfx'else data.get('assets',[]))if data else 0})
 return {'sources':out,'canonical_technique_cards':len(list(CARDS.glob('*/SKILL.md')))if CARDS.is_dir()else None,'note':'Counts describe available records, not auditioned or universally usable assets. Existing client router stays authoritative. Powered by Poly Haven.'}
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('command',choices=['find','techniques','inventory','assess']);p.add_argument('query',nargs='?',default='');p.add_argument('--limit',type=int,default=12);p.add_argument('--any-term',action='store_true',help='Show partial matches explicitly; never silently treat them as the requested sound');p.add_argument('--kind',choices=['adobe-content','adobe-mogrt','poly-haven','existing-sfx']);p.add_argument('--usage-file',type=Path,help='Exact-project evidence JSON for M05 asset eligibility review');a=p.parse_args()
 if not 1<=a.limit<=50:raise ValueError('Bounded result limit1-50 required')
 if a.command=='assess':
  from nolan_motion_asset_gate import load_catalog,inspect_asset,evaluate
  matches=[x for x in load_catalog()['assets']if x['asset_id']==a.query]
  if len(matches)!=1:raise ValueError('Assess requires exact existing Adobe MOGRT asset ID')
  info=inspect_asset(matches[0])
  usage=json.loads(a.usage_file.read_text(encoding='utf8'))if a.usage_file else {}
  data={'source':info,'production_eligibility':evaluate(info,usage)}
 else:
  data=inventory()if a.command=='inventory'else techniques(a.query,a.limit)if a.command=='techniques'else search(a.query,a.limit,a.kind,a.any_term)
 print(json.dumps(data,indent=2,ensure_ascii=False))
