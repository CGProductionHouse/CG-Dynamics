"""Load an existing exact-client asset library; never discover or recreate a brand.

Local evidence only. Live business facts remain in CG Dynamics, not this registry.
Use the host's get_client_context tool once for this task and supply its dated packet.
"""
from __future__ import annotations
import argparse,hashlib,json,sys
from pathlib import Path
from datetime import datetime,timezone

def read(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def sha(p):
    with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def resolve(base,value):
    if isinstance(value,dict):
        if value.get('kind')=='shared_skill':return Path(__file__).resolve().parents[1]/value['path']
        raise ValueError('Unknown resource binding kind; do not guess its location')
    p=Path(value)
    return p if p.is_absolute() else (base/p).resolve()
def load(library,client_id,live_context):
    root=Path(library).resolve();index=root/'CLIENT_CONTEXT.json';m=read(index)
    if m.get('client_id')!=client_id:raise ValueError('Exact client identity mismatch; no sibling or fuzzy fallback')
    envelope=read(live_context);packet=envelope.get('packet',{})
    if envelope.get('client_id')!=client_id or packet.get('client',{}).get('id')!=client_id:
        raise ValueError('Live CG Dynamics packet belongs to a different client')
    if packet.get('runtime_readiness')!='ready' or packet.get('errors'):
        raise ValueError('CLIENT CONTEXT NOT READY: resolve the bounded live runtime gap')
    date=datetime.fromisoformat(envelope['retrieved_at'].replace('Z','+00:00'))
    age=(datetime.now(timezone.utc)-date.astimezone(timezone.utc)).total_seconds()
    if age< -300 or age>86400:raise ValueError('Task-scoped live packet is stale; refresh mutable facts only, not the brand library')
    required=['feedback_file','source_brief','music_ledger','rule_catalog','brand_decisions']
    paths={key:resolve(root,m[key]) for key in required}
    for key,p in paths.items():
        if not p.is_file():raise ValueError(f'Missing saved {key}: {p}; recover this exact record, do not restart brand research')
    decisions=read(paths['feedback_file']);rules=read(paths['rule_catalog'])
    if decisions.get('client_id')!=client_id:raise ValueError('Feedback belongs to a different client')
    if not rules.get('rules') or not all(x.get('id') and x.get('requirement') and x.get('evidence_source') for x in rules['rules']):
        raise ValueError('Owner-rule catalogue is incomplete')
    baseline=None
    if m.get('baseline_file'):
        baseline_path=resolve(root,m['baseline_file']);value=read(baseline_path)
        if value.get('client_id')!=client_id:raise ValueError('Approved creative baseline belongs to a different client')
        for a in value.get('assets',[]):
            p=resolve(root,a['path'])
            if not p.is_file()or sha(p)!=a['sha256']or a.get('status')=='rejected':raise ValueError('Current baseline asset changed/missing/rejected: '+a['key'])
        if not value.get('assets')or not value.get('typography'):raise ValueError('Current creative baseline is incomplete')
        baseline={'path':str(baseline_path),'sha256':sha(baseline_path)}
        paths['creative_baseline']=baseline_path
    assets=[]
    for a in m.get('assets',[]):
        p=resolve(root,a['path'])
        if not p.is_file():raise ValueError(f"Missing saved asset {a['key']}: {p}; retrieve that exact known asset only")
        if a.get('sha256') and sha(p)!=a['sha256']:raise ValueError(f"Saved asset changed: {a['key']}; compare that version, do not silently replace approved work")
        assets.append({**a,'resolved_path':str(p)})
    if not m.get('canva_sources') or not assets:raise ValueError('Saved brand-asset bindings missing')
    # Assets and prior approvals are stable. This command performs no network search,
    # writes no brand design, and does not copy phone/contact facts into the library.
    # Logical keys, not installation paths: the identical shared skill in the
    # repository and installed location must not invent a brand-context change.
    fingerprint=hashlib.sha256(('CLIENT_CONTEXT='+sha(index)+'\n'+'\n'.join(key+'='+sha(p) for key,p in paths.items())).encode()).hexdigest()
    return dict(client_id=client_id,client_name=m['client_name'],library=str(root),context_fingerprint=fingerprint,
        reuse_state='LOADED_EXISTING_LIBRARY',brand_ready=bool(m.get('brand_ready')),assets=assets,canva_sources=m['canva_sources'],
        approved_references=m.get('approved_references',[]),owner_decisions=decisions,creative_baseline=baseline,
        owner_rules=rules['rules'],brand_decisions=paths['brand_decisions'].read_text(encoding='utf-8-sig'),
        source_brief=paths['source_brief'].read_text(encoding='utf-8-sig'),
        music_ledger=paths['music_ledger'].read_text(encoding='utf-8-sig'),
        unresolved=m.get('unresolved',[]),live_context_path=str(Path(live_context).resolve()),
        live_guide_id=packet.get('client_guide',{}).get('id'),live_context_sha256=sha(live_context),
        changed_asset_action='Refresh only a specifically changed/missing asset; keep the existing client standard otherwise',
        state_limit='Context load is not creative approval, a cleared soundtrack or permission to resend rejected files')
def verify(snapshot):
    old=read(snapshot)
    now=load(old['library'],old['client_id'],old['live_context_path'])
    if old['context_fingerprint']!=now['context_fingerprint'] or old['live_context_sha256']!=now['live_context_sha256']:
        raise ValueError('Client rules/feedback/assets changed after job load; finish active operation safely and reload before continuing')
    return now
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--library');p.add_argument('--registry');p.add_argument('--client-id');p.add_argument('--live-context');p.add_argument('--output');p.add_argument('--verify');a=p.parse_args()
    try:
        if a.verify:q=verify(a.verify)
        else:
            if a.registry:
                if a.library:raise ValueError('Use registry or library, not both')
                registry=Path(a.registry).resolve();items=[x for x in read(registry)['clients'] if x['client_id']==a.client_id]
                if len(items)!=1:raise ValueError('Exact client registry binding missing or duplicated; no fuzzy match')
                a.library=resolve(registry.parent,items[0]['library'])
            if not all([a.library,a.client_id,a.live_context,a.output]):p.error('load needs library, exact client-id, live-context and output')
            q=load(a.library,a.client_id,a.live_context);out=Path(a.output).resolve()
            if any((x/'.git').exists() for x in [out,*out.parents]):raise ValueError('Private context output must be outside a Git checkout')
            out.mkdir(parents=True,exist_ok=True)
            (out/'client-context.json').write_text(json.dumps(q,indent=2,ensure_ascii=False),encoding='utf-8')
            text=f"# {q['client_name']} — load the existing standard\n\n"+q['brand_decisions']+'\n\n## Owner decisions\n'+json.dumps(q['owner_decisions'],indent=2,ensure_ascii=False)+'\n\n## All owner rules\n'+'\n'.join(f"- {x['id']}: {x['requirement']}" for x in q['owner_rules'])+'\n\n## Current assignment\n'+q['source_brief']+'\n\n## Music use/rejections\n'+q['music_ledger']
            (out/'READ-BEFORE-EDIT.md').write_text(text,encoding='utf-8')
        print(json.dumps({k:q[k] for k in ['client_id','client_name','reuse_state','context_fingerprint','unresolved']},ensure_ascii=False))
    except (ValueError,KeyError,FileNotFoundError,json.JSONDecodeError) as e:print('CLIENT LIBRARY BLOCKED: '+str(e),file=sys.stderr);return 1
    return 0
if __name__=='__main__':raise SystemExit(main())
