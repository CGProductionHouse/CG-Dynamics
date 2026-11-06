"""Check an evidenced client release record; never certify artistic taste from metadata.

This is a local gate around the existing context/audio/story workflow, not an editor.
The JSON points to actual files and review records kept in the private job folder.
"""
from pathlib import Path
import argparse,json,re,sys,math,shutil,subprocess
from load_client_library import read,sha,verify
from audio_review import gate as audio_gate
from preflight_story import validate as validate_story
from edit_contract import check_render, sha as bound_sha
from client_copy import validate as validate_client_copy

AREAS=('approved_reference_comparison','source_and_rights','orientation_and_stabilisation','colour_match',
       'brand_typography_motion','rendered_spelling_and_copy','picture_at_normal_speed','sound_and_sync',
       'cover_and_small_grid','cross_client_distinctness','portrait_outro',
       'hook_and_story','skill_application','beat_timing')

def duration_gate(video,ffprobe='ffprobe'):
    """CA3Nov: roughly30s. Read actual bytes, never a self-authored duration reason."""
    binary=shutil.which(str(ffprobe))
    if not binary:raise ValueError('ffprobe unavailable; actual duration unverified')
    probe=subprocess.run([binary,'-v','error','-show_entries','format=duration','-of','json',str(video)],capture_output=True,text=True,check=True,timeout=30)
    seconds=float(json.loads(probe.stdout)['format']['duration'])
    if not math.isfinite(seconds) or not 27<=seconds<=33:
        raise ValueError(f'Actual film {seconds:.3f}s violates CA roughly30s requirement (operational27-33s band); no padding or self-approved compact-cut exception')
    return seconds

def production_prefix(identity):
    code=identity['client_short_code']
    if identity.get('verified') is not True or not isinstance(code,str):
        raise ValueError('unverified canonical code/sequence')
    # Mirror src/lib/onedriveCanonical.ts, the CA-locked naming authority.
    code=code.strip().upper()
    if not re.fullmatch(r'[A-Z0-9][A-Z0-9_-]{0,31}',code):raise ValueError('invalid configured client code')
    values=[identity[k] for k in ['year','month','video_number']]
    try:year,month,number=[int(v) for v in values]
    except (TypeError,ValueError,OverflowError) as error:raise ValueError('invalid production date/sequence') from error
    if any(isinstance(v,bool) or float(v)!=n for v,n in zip(values,[year,month,number])):
        raise ValueError('production date/sequence must be whole numbers')
    if not 2000<=year<=2100 or not 1<=month<=12 or not 1<=number<=99:
        raise ValueError('production date/sequence outside canonical bounds')
    return f"{year:04d}_{month:02d}_{code}_VIDEO_{number:02d}"

def named_for_prefix(path,prefix):
    stem=Path(path).stem
    return stem==prefix or stem.startswith(prefix+'_')

def check(record):
    errors=[];result={'status':'BLOCKED','errors':errors,'creative_approval_inferred':False}
    try:result['actual_duration_seconds']=duration_gate(record['video'],record.get('ffprobe_path','ffprobe'))
    except (KeyError,ValueError,OSError,subprocess.SubprocessError) as e:errors.append('Duration blocked: '+str(e))
    if 'actual_duration_seconds' in result:
        errors.extend(check_render(record,result['actual_duration_seconds'],validate_story))
    if record.get('resend_blocked') or record.get('creative_status')!='creative_review_passed':errors.append('Owner-rejected or uncleared creative work cannot be sent')
    context=None
    try:
        context=verify(record['client_context_snapshot'])
        if context['client_id']!=record['client_id']:errors.append('Release belongs to a different client')
        if not context['brand_ready']:errors.append('Established brand has unresolved saved fields; generic substitution is blocked')
    except (KeyError,ValueError,OSError) as e:errors.append('Current client library evidence missing/invalid: '+str(e))
    for field in ['video','cover','caption_path']:
        try:
            p=Path(record[field])
            if not p.is_file():raise ValueError('missing '+field)
            key='caption_sha256' if field=='caption_path' else field+'_sha256'
            if sha(p)!=record[key]:errors.append('Exact '+field+' changed after review')
        except (KeyError,ValueError,OSError) as e:errors.append('Missing exact '+field+' identity: '+str(e))
    try:
        caption=Path(record['caption_path']).read_text(encoding='utf-8-sig')
        if context is not None:
            try:
                plan=read(record['story_plan']['path'])
                errors.extend(validate_client_copy(plan,context,caption))
            except (KeyError,ValueError,OSError,TypeError) as e:
                errors.append('Client copy inventory missing/invalid: '+str(e))
        if re.search(r'^\s*(Music:|Source:|Licence:|License:|From Nolan|SHA.?256|QA:)',caption,re.M|re.I) or re.search(r'creativecommons\.org|CC BY|incompetech\.com',caption,re.I):
            errors.append('Forwardable caption contains internal/licensing prose; replace the cue or establish compatible lawful credit placement, never strip required credit silently')
    except (KeyError,OSError):pass
    try:
        identity=record['production_identity'];prefix=production_prefix(identity)
        proof=Path(identity['source_evidence'])
        if not proof.is_file() or sha(proof)!=identity['source_evidence_sha256']:raise ValueError('identity source record missing/changed')
        if not named_for_prefix(record['video'],prefix):raise ValueError('actual video basename differs from canonical identity')
        if Path(record['video']).suffix.lower()!='.mp4':raise ValueError('review/original video must be the required MP4')
        if not named_for_prefix(record['cover'],prefix):raise ValueError('cover production identity does not match video')
    except (KeyError,ValueError,OSError,TypeError) as e:errors.append('Production naming blocked: '+str(e))
    try:
        proof=Path(record['exact_export_creative_review_evidence']);review=read(proof)
        if review.get('video_sha256')!=record['video_sha256'] or review.get('cover_sha256')!=record['cover_sha256']:errors.append('Creative review belongs to different picture/cover bytes')
        if not review.get('reviewer') or not review.get('reviewed_at'):errors.append('Actual creative reviewer/method/date missing')
        if review.get('reviewer_kind') not in ('author_editorial','independent_editor'):
            errors.append('Attribute the real editorial reviewer; model/metadata checks are not independent creative acceptance')
        for area in AREAS:
            entry=review.get('areas',{}).get(area,{})
            if entry.get('status')!='pass' or not entry.get('method') or not entry.get('finding'):errors.append('Unresolved actual review: '+area)
            evidence=entry.get('evidence_file')
            if not evidence or not Path(evidence).is_file():errors.append('Missing actual review artifact: '+area)
            elif entry.get('evidence_sha256')!=bound_sha(evidence):errors.append('Changed/unbound review artifact: '+area)
        if review.get('picture_review_muted') and review.get('sound_review_complete') is not True:errors.append('Muted picture playback cannot clear sound')
    except (KeyError,ValueError,OSError) as e:errors.append('Exact creative review evidence missing/invalid: '+str(e))
    try:
        a=audio_gate(record['audio_packet'],record['audio_review'])
        if a['video_sha256']!=record['video_sha256']:errors.append('Audio review belongs to a different export')
        errors.extend('Audio: '+x for x in a['errors'])
    except (KeyError,ValueError,OSError,TypeError) as e:errors.append('Exact-export perceptual audio gate missing/invalid: '+str(e))
    if not errors:result['status']='CANDIDATE_FOR_INTERNAL_REVIEW'
    result['state_limit']='Implementation/timing/identity evidence only. This command cannot approve the story, taste or music; author editorial judgment is not independent approval.'
    return result
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('release_record');a=p.parse_args()
    try:result=check(read(a.release_record))
    except (OSError,ValueError) as e:result={'status':'BLOCKED','errors':[str(e)]}
    print(json.dumps(result,indent=2,ensure_ascii=False));return int(result['status']=='BLOCKED')
if __name__=='__main__':raise SystemExit(main())
