// Private local review packet only. Never an apply script or a second authority.
import {readFileSync,writeFileSync,realpathSync,existsSync} from 'node:fs'
import {resolve,relative,isAbsolute,dirname,basename,join} from 'node:path'
import {createHash} from 'node:crypto'
import {microsoftConflictCount} from '../src/lib/microsoftRunReview.ts'

const baselinePath=process.argv[2],auditPath=process.argv[3],out=process.argv[4]
const canonical=p=>{const full=existsSync(p)?realpathSync(p):join(realpathSync(dirname(resolve(p))),basename(p));return process.platform==='win32'?full.toLowerCase():full}
if(!baselinePath||!auditPath||!out||!isAbsolute(out)||!relative(canonical(process.cwd()),canonical(out)).startsWith('..')
  ||[baselinePath,auditPath].some(p=>canonical(p)===canonical(out))||existsSync(out))throw Error('New private output outside the repository required; never overwrite inputs or receipts.')
const baselineBytes=readFileSync(baselinePath,'utf8'),auditBytes=readFileSync(auditPath,'utf8')
const baseline=JSON.parse(baselineBytes),audit=JSON.parse(auditBytes),expected=microsoftConflictCount(baseline.run?.summary??{})
if(expected===null||!/^[0-9a-f-]{36}$/i.test(baseline.run?.id??'')||!Number.isFinite(Date.parse(baseline.run.snapshot_exported_at))
  ||!Number.isFinite(Date.parse(baseline.run.finished_at))||Date.parse(baseline.run.finished_at)<Date.parse(baseline.run.snapshot_exported_at)
  ||audit.writes!==0||!Array.isArray(audit.months)||!baseline.journal_observation
  ||baseline.journal_observation.run_id!==baseline.run.id||baseline.journal_observation.source_exported_at!==baseline.run.snapshot_exported_at
  ||!Number.isSafeInteger(baseline.journal_observation.conflicts)||baseline.journal_observation.conflicts<0||!/^[a-f0-9]{64}$/.test(baseline.journal_observation.projection_sha256??''))throw Error('Exact read-only run observation and zero-write package audit required')
const holds=[]
const seen=new Set()
for(const month of audit.months)for(const bucket of month.buckets??[])for(const field of bucket.comparison??[]){
  const key=JSON.stringify([month.month,bucket.bucket_id,field.field])
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month.month)||!bucket.bucket_id||!field.field||seen.has(key))throw Error('Exact unique client-month-bucket-field review references required')
  seen.add(key)
  if(!['count_aligned_only'].includes(field.verdict))holds.push({client_id:bucket.client_id??null,client:bucket.client??null,month:month.month,plan_id:bucket.plan_id??null,bucket_id:bucket.bucket_id,
    field:field.field,package_state:field.package_state??'unknown',confirmed_quantity:field.confirmed_quantity??null,verdict:field.verdict,
    next_evidence:field.verdict==='discuss_difference'?'exact_agreement_and_slot_allocation_review':field.verdict==='package_unresolved'?'explicit_approved_package_receipt':field.verdict==='period_unverified'?'exact_owner_confirmed_plan_period':field.verdict==='identity_review_held'?'exact_active_client_bucket_binding':field.verdict==='allocation_review_held'?'exact_non_additive_numbered_slot_allocation':'complete_exact_bound_source_capture',
    proposed_package_changes:0,proposed_schedule_writes:0})
}
const hash=s=>createHash('sha256').update(s).digest('hex')
const packet={contract:'teams_resolution_preflight_v1',run_id:baseline.run.id,source_exported_at:baseline.run.snapshot_exported_at,
  expected_conflicts:expected,observed_journal_conflicts:baseline.journal_observation.conflicts,summary_journal_difference:expected-baseline.journal_observation.conflicts,
  conflict_state:'held_requires_complete_row_backed_fresh_canonical_preview',journal_observation:baseline.journal_observation,
  conflict_rows_embedded:false,safe_apply_candidates:0,package_holds:holds,package_hold_count:holds.length,
  proof_hashes:{baseline_sha256:hash(baselineBytes),package_audit_sha256:hash(auditBytes)},writes:0,apply_ready:false,
  next_steps:['Read exact durable source + current target revisions; refuse stale prior-run replay.','Reconcile preview-entry count versus distinct journal/source keys; never invent missing row identities.','Keep uncoded causes unknown until the existing canonical preview reproduces them.','Collect complete master/month pages and independent bucket receipts before any package question or change.','Keep private accounting, native lookalikes, source removals and staff edits held for their explicit proof.'],
  limitation:'This is a resolution-readiness inventory, not a row-backed apply packet. No inferred dates, client identities, quantities, completion or publication.'}
writeFileSync(out,JSON.stringify(packet,null,2))
console.log(JSON.stringify({output:out,expected_conflicts:expected,observed_journal_conflicts:packet.observed_journal_conflicts,summary_journal_difference:packet.summary_journal_difference,package_holds:holds.length,writes:0,apply_ready:false,packet_sha256:hash(JSON.stringify(packet))}))
