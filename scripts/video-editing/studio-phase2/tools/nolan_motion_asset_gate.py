"""Nolan M05: non-destructive, source-bound motion-template eligibility review.

Reads the existing Adobe MOGRT catalog. Does not install templates, download,
change client records, claim creative approval or run an employee's UI.
"""
from __future__ import annotations
import argparse, hashlib, json, sys, zipfile
from pathlib import Path, PurePosixPath

CATALOG=Path(r'D:\OneDrive\CG Production House\Video Editing System\licensed-assets\adobe-installed-mogrt\CATALOG.json')
DEFAULT_ROOTS=(
 Path(r'C:\Program Files\Adobe\Adobe Premiere Pro 2026\Essential Graphics'),
 Path.home()/'AppData/Roaming/Adobe/Common/Motion Graphics Templates',
)
MAX_ENTRIES=256
MAX_SINGLE=40*1024*1024
MAX_TOTAL=150*1024*1024
MAX_RATIO=150
def sha(p:Path)->str:
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def within(path:Path,roots)->bool:
 return any(path.is_relative_to(Path(r).resolve()) for r in roots)
def load_catalog(path=CATALOG)->dict:
 j=json.loads(Path(path).read_text(encoding='utf-8-sig'))
 if j.get('schema')!=1 or j.get('kind')!='installed_native_mogrt_catalog' or j.get('provider')!='Adobe':
  raise ValueError('Expected existing Adobe catalog; do not create another library')
 rows=j.get('assets',[])
 if not isinstance(rows,list) or not rows:raise ValueError('Empty Adobe catalog')
 if len({a.get('asset_id') for a in rows})!=len(rows):raise ValueError('Duplicate catalog asset IDs')
 if len({a.get('sha256') for a in rows})!=len(rows):raise ValueError('Unreconciled duplicate source hashes')
 return j
def archive_meta(p:Path)->dict:
 if not zipfile.is_zipfile(p):raise ValueError('Not a ZIP-format MOGRT')
 with zipfile.ZipFile(p) as z:
  entries=z.infolist()
  if len(entries)>MAX_ENTRIES:raise ValueError('Too many members; inspect manually')
  total=0
  for e in entries:
   n=e.filename.replace('\\','/')
   path=PurePosixPath(n)
   if n.startswith('/') or path.is_absolute() or '..' in path.parts or ':' in path.parts[0] or '\x00' in n:
    raise ValueError('Unsafe archive member path')
   if e.file_size<0 or e.file_size>MAX_SINGLE:raise ValueError('Oversize archive member')
   if e.compress_size==0 and e.file_size:raise ValueError('Impossible compressed size')
   if e.compress_size and e.file_size/max(e.compress_size,1)>MAX_RATIO:raise ValueError('Extreme compression ratio')
   total+=e.file_size
  if total>MAX_TOTAL:raise ValueError('Oversize archive expansion')
  names=set(z.namelist())
  if 'definition.json' not in names:raise ValueError('Missing definition.json')
  d=z.getinfo('definition.json')
  if d.file_size>2_000_000:raise ValueError('Excessive definition payload')
  item=json.loads(z.read(d).decode('utf-8-sig'))
  if item.get('authorApp') not in ('ppro','aefx'):raise ValueError('Unrecognised authoring application')
  expected={'ppro':'.prgraphic','aefx':'.aegraphic'}[item['authorApp']]
  if not any(n.lower().endswith(expected) for n in names):raise ValueError('Missing actual graphic project')
  fonts=item.get('usedFontsLocalized') or {}
  if not isinstance(fonts,dict):raise ValueError('Malformed font list')
  en=fonts.get('en_US',[])
  if not isinstance(en,list) or any(not isinstance(x,str) for x in en):raise ValueError('Malformed locale font list')
  return {
   'authorApp':item['authorApp'],'apiVersion':str(item.get('apiVersion','')),
   'capsuleID':item.get('capsuleID'),'capsuleName':item.get('capsuleName'),
   'required_fonts_en_US':sorted(set(en)),
   'all_declared_fonts':sorted(set(str(f) for v in fonts.values() if isinstance(v,list) for f in v)),
   'used_effects':item.get('usedEffects',[]),
   'used_file_types':item.get('usedFileTypes',[]),
   'used_comp_renderers':item.get('usedCompRenderers',[]),
   'platform_support':item.get('platformSupport',[]),
   'archive_entries':len(entries),'total_declared_uncompressed':total,
   'preview_video_members':[n for n in sorted(names) if n.lower().endswith(('.mp4','.mov','.webm')) and n.startswith('thumb')],
   'preview_image_members':[n for n in sorted(names) if n.lower().endswith(('.png','.jpg')) and n.startswith('thumb')],
  }
def inspect_asset(asset:dict,*,roots=DEFAULT_ROOTS)->dict:
 p=Path(asset['path']).resolve()
 out={'asset_id':asset['asset_id'],'name':asset.get('name'),
      'source_sha256':asset.get('sha256'),'source_path':str(p),
      'asset_kind':'adobe_installed_mogrt','provider':'Adobe',
      'source_validation':'UNVERIFIED','native_host_test':'NOT_RUN',
      'client_ready':False,'creative_review':'NOT_DONE','rights_status':'APPLICATION_CONTENT_ENTITLEMENT_REVIEW'}
 if p.suffix.lower()!='.mogrt' or not within(p,roots):raise ValueError('Asset path outside installed MOGRT sources')
 if not p.is_file():raise ValueError('Catalog asset missing')
 if sha(p)!=asset.get('sha256'):raise ValueError('Catalog hash changed: STOP')
 m=archive_meta(p)
 if asset.get('native_author_app')!=m['authorApp']:raise ValueError('Authoring app differs from catalog')
 if asset.get('capsule_id') and m['capsuleID']!=asset['capsule_id']:raise ValueError('Capsule identity changed')
 out['source_validation']='HASH_AND_ARCHIVE_VERIFIED'
 out.update(m)
 out['preview_status']='EMBEDDED_NOT_VERIFIED_IN_NATIVE_HOST' if m['preview_video_members'] else 'NO_VIDEO_PREVIEW'
 out['format_status']='DECLARED_NOT_NATIVE_VERIFIED'
 out['font_status']='NEEDS_EXACT_FONT_EVIDENCE' if m['required_fonts_en_US'] else 'NO_EN_US_FONT_DECLARED'
 out['compatibility_status']='AFTER_EFFECTS_AUTHORED_NATIVE_PPRO_TEST_REQUIRED' if m['authorApp']=='aefx' else 'PREMIERE_AUTHORED_NATIVE_PPRO_TEST_REQUIRED'
 out['rights_status']='BUNDLED_ADOBE_CONTENT_CONFIRM_APP_ENTITLEMENT_AND_PROJECT_TERMS'
 return out
def actual_evidence(binding)->bool:
 """A user-supplied label is not evidence. Validate real source bytes each time."""
 if not isinstance(binding,dict):return False
 name,digest=binding.get('path'),binding.get('sha256')
 if not isinstance(name,str) or not isinstance(digest,str) or len(digest)!=64:return False
 if not all(c in '0123456789abcdef' for c in digest.lower()):return False
 try:
  p=Path(name).resolve()
  return p.is_file() and sha(p)==digest.lower()
 except (OSError,ValueError):return False
def evaluate(out:dict,usage:dict|None=None)->dict:
 """Never grants client/publication permission. All material proof is byte-bound."""
 u=usage or {}
 reasons=[]
 if out.get('source_validation')!='HASH_AND_ARCHIVE_VERIFIED':reasons.append('source hash/archive not verified')
 if not u.get('project_id'):reasons.append('exact project not specified')
 prov=u.get('licensing_provider')
 if prov not in ('adobe_installed','envato_elements','other'):reasons.append('licensing provider unverified')
 elif prov=='envato_elements':
  if out.get('asset_kind')=='adobe_installed_mogrt':
   reasons.append('Adobe installed asset cannot be relabelled as Envato stock')
  if not (u.get('active_subscription_verified') is True and u.get('certificate_project_id')==u.get('project_id')
          and u.get('item_id') and actual_evidence(u.get('license_certificate'))):
   reasons.append('Envato project-specific active licence/certificate not verified')
 elif prov=='adobe_installed':
  if not actual_evidence(u.get('adobe_content_entitlement_evidence')):reasons.append('Adobe entitlement evidence absent')
  if out.get('provider')!='Adobe':reasons.append('catalog provider mismatch')
 elif not actual_evidence(u.get('source_license_evidence')):reasons.append('third-party licence evidence absent')
 fonts=out.get('required_fonts_en_US',[])
 proved=u.get('font_rights_evidence',{})
 if not isinstance(proved,dict):proved={}
 missing=[x for x in fonts if not actual_evidence(proved.get(x))]
 if missing:reasons.append('Unverified required fonts: '+', '.join(sorted(missing)))
 native=u.get('native_test',{})
 if not isinstance(native,dict):native={}
 if not (native.get('source_sha256')==out.get('source_sha256')
         and native.get('imported') is True and native.get('reopened') is True
         and native.get('export_decoded') is True and actual_evidence(native.get('evidence'))):
  reasons.append('No hash-bound Premiere import/reopen/export test')
 if not actual_evidence(u.get('exact_client_brand_review')):reasons.append('Client-specific art direction/brand check pending')
 if not actual_evidence(u.get('full_motion_review')):reasons.append('Full-motion export review pending')
 return {'asset_id':out.get('asset_id'),'project_id':u.get('project_id'),
         'state':'HOLD_FOR_PRODUCTION_REVIEW' if reasons else 'EVIDENCE_COMPLETE_INTERNAL_REVIEW_ONLY',
         'client_ready':False,'publication_approved':False,'reasons':reasons,
         'note':'Evidence can be structurally verified without proving creative fit, client permission or publisher approval.'}
def screen(catalog_path=CATALOG,*,roots=DEFAULT_ROOTS):
 j=load_catalog(catalog_path)
 out=[];errors=[]
 for a in j['assets']:
  try:out.append(inspect_asset(a,roots=roots))
  except Exception as exc:errors.append({'asset_id':a.get('asset_id'),'error':str(exc)})
 return {'schema':1,'catalog_path':str(catalog_path),'catalog_sha256':sha(Path(catalog_path)),
         'records':len(j['assets']),'inspected':len(out),'blocked':len(errors),
         'assets':out,'errors':errors,'origin':'existing catalog, original installed files',
         'not_approved':True,'no_client_mutation':True}
def main():
 ap=argparse.ArgumentParser(description=__doc__)
 ap.add_argument('command',choices=['screen','asset','evaluate'])
 ap.add_argument('--asset-id')
 ap.add_argument('--usage',type=Path)
 ap.add_argument('--output',type=Path)
 a=ap.parse_args()
 j=load_catalog()
 if a.command=='screen':result=screen()
 else:
  matches=[x for x in j['assets'] if x['asset_id']==a.asset_id]
  if len(matches)!=1:raise ValueError('Exact catalog asset ID needed')
  m=inspect_asset(matches[0])
  result=m if a.command=='asset' else evaluate(m,json.loads(a.usage.read_text()) if a.usage else {})
 if a.output:
  if a.output.exists():raise ValueError('Output exists: preserve prior receipt')
  a.output.parent.mkdir(parents=True,exist_ok=True)
  a.output.write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf8')
 print(json.dumps({k:v for k,v in result.items() if k!='assets'},indent=2,ensure_ascii=False))
 return 0 if (a.command!='screen' or result['blocked']==0) else 2
if __name__=='__main__':raise SystemExit(main())
