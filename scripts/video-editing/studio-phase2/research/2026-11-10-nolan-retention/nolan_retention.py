"""Nolan same-job music retention: strict source-bound exception, never approval by a loose filename.
A valid STRUCTURAL receipt records an external owner-approved keep decision.
The operator still must verify the actual decision source; self-attestation is not authority.
"""
from __future__ import annotations
import json,re
from datetime import datetime
from pathlib import Path

def validated_retention(plan:dict,previous:dict)->bool:
    """Fail closed unless exact recording, job, prior record and source evidence all match."""
    from nolan_guard import evidence,read_json
    if plan.get('mode')!='retain_revision':return False
    ref=plan.get('retention_evidence')
    if not evidence(ref):return False
    try: r=read_json(Path(ref['path']))
    except (OSError,ValueError,TypeError,KeyError):return False
    if not isinstance(r,dict):return False
    c=plan.get('candidate',{})
    raw=c.get('sha256','')
    if not isinstance(raw,str) or not re.fullmatch(r'[0-9a-fA-F]{64}',raw):return False
    prior=previous.get('sha256','')
    if not isinstance(prior,str) or raw.lower()!=prior.lower():return False
    expected={
        'schema':1,
        'decision':'OWNER_APPROVED_RETAIN_EXACT_RECORDING',
        'scope':'same_job_revision_only',
        'client_id':plan.get('client_id'),
        'job_id':plan.get('job_id'),
        'asset_sha256':raw.lower(),
        'previous_record_id':previous.get('record_id'),
        'source_kind':'direct_owner_feedback',
    }
    if not expected['client_id'] or not expected['job_id'] or not expected['previous_record_id']:return False
    if any(r.get(k)!=v for k,v in expected.items()):return False
    if not isinstance(r.get('source_reference_id'),str) or not r['source_reference_id'].strip():return False
    if not isinstance(r.get('decision_excerpt'),str) or not r['decision_excerpt'].strip():return False
    if not evidence(r.get('source_evidence')):return False
    try:
        stamp=datetime.fromisoformat(r['recorded_at'].replace('Z','+00:00'))
        if not stamp.tzinfo:return False
    except (ValueError,TypeError,AttributeError,KeyError):return False
    return True
