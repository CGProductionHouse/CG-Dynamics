import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { buildQualityPlan, assertNoDrift, assertIsolated, piekCorrection } from '../scripts/build-strategy-quality-amendment-plan.mjs'
import { sha } from '../scripts/audit-monthly-strategy-approval-manifest.mjs'
import { strategyArtifactSandbox } from './helpers/strategyArtifactSandbox.mjs'
import { buildReviewedBatch } from '../scripts/build-strategy-quality-batch.mjs'

const read = strategyArtifactSandbox(['build-client-strategy-mutation-dry-run', 'build-issue-567-strategy-quality-readiness'])
const fleet = JSON.parse(read('sep-oct-strategy-mutation-dry-run.json'))
const neshora = JSON.parse(read('neshora-strategy-readiness-dry-run.json'))
const quality = JSON.parse(read('issue-567-sep-oct-strategy-quality-readiness.json'))
const source = JSON.parse(read('strategy-source-snapshot.json'))
const neshoraSource = JSON.parse(read('neshora-strategy-source-snapshot.json'))
const manifest = JSON.parse(read('sep-oct-approval-publication-manifest.json'))

function fixture() {
  const snapshot = { captured_at: 'offline-regression-fixture', strategies: source.rows.map(r=>({ ...structuredClone(r), id:r.strategy_id, client_name:r.name, client_active:true, published_strategy_data:null })), revisions:[] }
  for (const p of fleet.rows.filter(r=>r.disposition==='ready')) {
    const row = snapshot.strategies.find(r=>r.id===p.strategy_id)
    Object.assign(row,{version:2,staff_amended_at:'fixture',strategy_data:structuredClone(p.proposed_strategy_data),seed_context:structuredClone(p.proposed_seed_context)})
  }
  for (const p of neshora.rows) {
    const receipt = neshoraSource.client.package_settings.verification
    const reviewed = manifest.rows.find(r=>r.client_id===p.client_id && r.strategy_month===p.strategy_month)
    snapshot.strategies.push({ id:reviewed.strategy_id, client_id:p.client_id, client_name:p.client_name, client_active:true, strategy_month:p.strategy_month, version:2, workflow_status:'draft', staff_amended_at:'fixture', approved_at:null,published_at:null,published_strategy_data:null,internal_notes:'Preserve staff note',updated_at:'fixture',strategy_data:{...structuredClone(p.proposed_strategy_data),topContent:{whatThisTellsUs:'Staff-authored context preserved'}},package_settings:structuredClone(neshoraSource.client.package_settings),seed_context:{client_id:p.client_id,strategy_month:p.strategy_month,sources:{ issue_513_evidence_hash:p.source_evidence_hash,package_verification_version:receipt.version,package_verification_confirmed_at:receipt.confirmed_at,package_verification_actor_id:receipt.confirmed_by_profile_id,package_source_references:receipt.source_references,issue_513_neshora_plan_hash:neshora.plan_hash }} })
  }
  const baseline = structuredClone(manifest)
  for (const row of snapshot.strategies.filter(r=>r.version===2)) {
    const r = baseline.rows.find(r=>r.strategy_id===row.id)
    r.strategy_hash=sha(row.strategy_data);r.seed_context_hash=sha(row.seed_context)
    snapshot.revisions.push({strategy_id:row.id,client_id:row.client_id,strategy_month:row.strategy_month,event_kind:'amended',record_version:2,id:`revision-${row.id}`})
  }
  return {snapshot,fleet:structuredClone(fleet),neshora:structuredClone(neshora),manifest:baseline,quality:structuredClone(quality)}
}

test('Batch 3 executes cumulative compiler, preserves all 42 accepted rows and refuses staff/exclusion drift',()=>{
  const input=fixture(),packets=[1,2,3].map(buildReviewedBatch)
  for(const packet of packets){
    for(const row of packet.rows){
      const live=input.snapshot.strategies.find(r=>r.id===row.row_id)
      row.guard={fingerprint:sha(live),revision_hash:sha(input.snapshot.revisions.find(r=>r.strategy_id===live.id)),strategy_hash:sha(live.strategy_data),seed_hash:sha(live.seed_context),package_hash:sha(live.package_settings),internal_notes:live.internal_notes}
      const{reviewed_hash,...core}=row;row.reviewed_hash=sha(core)
    }
    const{packet_hash,...core}=packet;packet.packet_hash=sha(core)
  }
  const previous=buildQualityPlan({...input,reviewedOverrides:packets.slice(0,2)})
  const result=buildQualityPlan({...input,reviewedOverrides:packets,preservedPlan:previous})
  assert.equal(result.counts.amendment_needed,62);assert.equal(result.counts.blocked,32)
  for(const row of previous.rows.filter(r=>r.disposition==='amendment_needed'))assert.equal(JSON.stringify(result.rows.find(r=>r.row_id===row.row_id)),JSON.stringify(row))
  assert.equal(JSON.stringify(result.excluded),JSON.stringify(previous.excluded));assertNoDrift(result,input.snapshot)
  const target=packets[2].rows[0]
  for(const text of [' Supa Quick Centurion.',' Repository worker.',' Guaranteed returns.']){
    const changed=structuredClone(packets),r=changed[2].rows[0];r.patch.goldStandard.coreMessage+=text
    const{reviewed_hash,...core}=r;r.reviewed_hash=sha(core)
    const{packet_hash,...packetCore}=changed[2];changed[2].packet_hash=sha(packetCore)
    assert.equal(buildQualityPlan({...input,reviewedOverrides:changed,preservedPlan:previous}).rows.find(r=>r.row_id===target.row_id).disposition,'blocked')
  }
  for(const edit of [r=>r.internal_notes='later note',r=>r.version=3,r=>r.package_settings.design_posters_per_month=99,r=>r.strategy_data.strategyGoingForward='staff edit']){
    const changed=structuredClone(input);edit(changed.snapshot.strategies.find(r=>r.id===target.row_id))
    assert.throws(()=>buildQualityPlan({...changed,reviewedOverrides:packets,preservedPlan:previous}),/Drift refusal/)
  }
  const excluded=structuredClone(input);excluded.snapshot.strategies.find(r=>r.id===result.excluded[0].row_id).internal_notes='change'
  assert.throws(()=>buildQualityPlan({...excluded,reviewedOverrides:packets,preservedPlan:previous}),/Drift refusal/)
})

test('Batch 2 cumulative compiler derives 42/52, preserves prior rows and rejects duplicate/foreign/internal/drift',()=>{
  const input=fixture(),packets=[buildReviewedBatch(),buildReviewedBatch(2)]
  for(const packet of packets){
    for(const row of packet.rows){
      const live=input.snapshot.strategies.find(r=>r.id===row.row_id)
      row.guard={fingerprint:sha(live),revision_hash:sha(input.snapshot.revisions.find(r=>r.strategy_id===live.id)),strategy_hash:sha(live.strategy_data),seed_hash:sha(live.seed_context),package_hash:sha(live.package_settings),internal_notes:live.internal_notes}
      const{reviewed_hash,...core}=row;row.reviewed_hash=sha(core)
    }
    const{packet_hash,...core}=packet;packet.packet_hash=sha(core)
  }
  const before=sha(input),first=buildQualityPlan({...input,reviewedOverrides:packets[0]}),result=buildQualityPlan({...input,reviewedOverrides:packets})
  assert.equal(sha(input),before);assert.equal(result.counts.amendment_needed,42);assert.equal(result.counts.blocked,52)
  for(const row of first.rows.filter(r=>r.disposition==='amendment_needed'))assert.deepEqual(result.rows.find(r=>r.row_id===row.row_id),row)
  assert.deepEqual(result.excluded,first.excluded)
  const stable=buildQualityPlan({...input,reviewedOverrides:packets,preservedPlan:first})
  for(const row of first.rows.filter(r=>r.disposition==='amendment_needed'))assert.equal(JSON.stringify(stable.rows.find(r=>r.row_id===row.row_id)),JSON.stringify(row))
  const changedPrior=structuredClone(first);changedPrior.rows.find(r=>r.disposition==='amendment_needed').proposed_strategy_data.goldStandard.objective+=' changed'
  const{plan_hash,...priorCore}=changedPrior;changedPrior.plan_hash=sha(priorCore)
  assert.throws(()=>buildQualityPlan({...input,reviewedOverrides:packets,preservedPlan:changedPrior}),/Accepted quality row drift/)
  assert.throws(()=>buildQualityPlan({...input,reviewedOverrides:[...packets,packets[0]]}),/Duplicate cumulative/)
  const target=packets[1].rows[0]
  for(const text of [' Repository worker queue.',' Emmanuel Funerals.',' Guaranteed approval.']){
    const changed=structuredClone(packets),r=changed[1].rows[0];r.patch.goldStandard.coreMessage+=text
    const{reviewed_hash,...rowCore}=r;r.reviewed_hash=sha(rowCore)
    const{packet_hash,...core}=changed[1];changed[1].packet_hash=sha(core)
    const blocked=buildQualityPlan({...input,reviewedOverrides:changed}).rows.find(r=>r.row_id===target.row_id)
    assert.equal(blocked.disposition,'blocked')
  }
  for(const edit of [r=>r.internal_notes='later edit',r=>r.version=3,r=>r.strategy_data.goldStandard.objective='later staff text',r=>r.package_settings.photo_posts_per_month=100,r=>r.seed_context.new='later provenance']){
    const drift=structuredClone(input),r=drift.snapshot.strategies.find(r=>r.id===target.row_id);edit(r)
    assert.equal(buildQualityPlan({...drift,reviewedOverrides:packets}).rows.find(row=>row.row_id===r.id).disposition,'blocked')
    assert.throws(()=>assertNoDrift(result,drift.snapshot),/Drift refusal/)
  }
})

test('reviewed batch runs through actual 94-row compiler with staff context preservation and drift refusal',()=>{
  const input=fixture(),packet=buildReviewedBatch()
  // Synthetic fixture rows have intentionally different receipts/timestamps from production.
  // Bind only the test packet to those exact fixtures; production packet remains immutable.
  for(const row of packet.rows){
    const live=input.snapshot.strategies.find(r=>r.id===row.row_id)
    row.guard={fingerprint:sha(live),revision_hash:sha(input.snapshot.revisions.find(r=>r.strategy_id===live.id)),strategy_hash:sha(live.strategy_data),seed_hash:sha(live.seed_context),package_hash:sha(live.package_settings),internal_notes:live.internal_notes}
    const {reviewed_hash,...core}=row;row.reviewed_hash=sha(core)
  }
  const {packet_hash,...core}=packet;packet.packet_hash=sha(core)
  const before=sha(input),baseline=buildQualityPlan(input),plan=buildQualityPlan({...input,reviewedOverrides:packet})
  assert.equal(sha(input),before);assert.equal(plan.counts.amendment_needed,24);assert.equal(plan.counts.blocked,70)
  assert.deepEqual(plan.excluded,baseline.excluded)
  for(const name of ['Piek Group','Neshora Oxygen']) assert.deepEqual(plan.rows.filter(r=>r.client_name===name),baseline.rows.filter(r=>r.client_name===name))
  for(const row of plan.rows.filter(r=>r.reviewed_override)){
    assert.equal(row.disposition,'amendment_needed')
    const live=input.snapshot.strategies.find(r=>r.id===row.row_id)
    assert.deepEqual(row.later_guard.seed_context,live.seed_context)
    assert.equal(row.later_guard.internal_notes,live.internal_notes)
    for(const field of ['topContent','calendarSelections','clientDirection','clientRequestNotes']) assert.deepEqual(row.proposed_strategy_data[field],live.strategy_data[field])
  }
  const live=input.snapshot.strategies.find(r=>r.id===packet.rows[0].row_id)
  live.internal_notes='Later staff note'
  const drift=buildQualityPlan({...input,reviewedOverrides:packet}).rows.find(r=>r.row_id===live.id)
  assert.equal(drift.disposition,'blocked');assert.ok(drift.stop_reasons.includes('REVIEWED_OVERRIDE_LIVE_DRIFT'))
  assert.throws(()=>assertNoDrift(plan,input.snapshot),/Drift refusal/)
})

test('94 exact rows, 47 clients, 20 excluded; deterministic and no input mutation',()=>{
  const input=fixture(),before=sha(input),a=buildQualityPlan(input),b=buildQualityPlan(input)
  assert.equal(a.rows.length,94);assert.equal(a.counts.clients,47);assert.equal(a.excluded.length,20)
  assert.equal(a.write_count,0);assert.equal(a.plan_hash,b.plan_hash);assert.equal(sha(input),before)
  assert.equal(a.counts.amendment_needed,4);assert.equal(a.counts.blocked,90)
  assert.ok(a.rows.every(r=>r.later_guard.expected_version===2))
  assertNoDrift(a,input.snapshot)
})
test('Piek correction is four-mode client-ready and not caption-process boilerplate',()=>{
  const input=fixture(),plan=buildQualityPlan(input),rows=plan.rows.filter(r=>r.client_name==='Piek Group')
  assert.equal(rows.length,2)
  for(const row of rows){
    assert.equal(row.disposition,'amendment_needed');assert.match(row.proposed_strategy_data.strategyGoingForward,/Engen and Sasol/)
    assert.match(row.proposed_strategy_data.goldStandard.coreMessage,/Get Together/)
    assert.doesNotMatch(JSON.stringify(row.proposed_strategy_data.goldStandard),/repository|dossier|evidence|caption\/content idea|start from the actual|[a-f0-9]{8}-[a-f0-9]{4}-/i)
    assert.equal(row.proposed_strategy_data.actionPlan.professional_video.items.length,4)
    assert.match(row.proposed_strategy_data.actionPlan.design_poster.notes,/Twelve/)
    assert.notEqual(row.proposed_strategy_hash,row.committed_567_proposed_hash)
  }
  assert.match(piekCorrection(rows[0].current_strategy_data,'2026-09').goldStandard.mustAvoid,/transfer a partner/)
})
test('Neshora preserves #546 provenance, exact 1/4/4, unknown nulls and staff extras',()=>{
  const input=fixture(),plan=buildQualityPlan(input)
  for(const row of plan.rows.filter(r=>r.client_name==='Neshora Oxygen')){
    const live=input.snapshot.strategies.find(r=>r.id===row.row_id)
    assert.deepEqual(row.later_guard.seed_context,live.seed_context)
    assert.equal(row.package_receipt.professional_videos_per_month,1)
    assert.equal(row.package_receipt.photo_posts_per_month,4);assert.equal(row.package_receipt.design_posters_per_month,4)
    assert.equal(row.package_receipt.reels_per_month,null);assert.equal(row.package_receipt.campaign_management_included,null)
    assert.equal(row.proposed_strategy_data.topContent.whatThisTellsUs,'Staff-authored context preserved')
    assert.equal(row.later_guard.internal_notes,'Preserve staff note')
    assert.deepEqual(row.fields_changed.filter(r=>r.field.endsWith('.enabled')),[])
  }
})
test('null, zero and flexible package truth never becomes a new enabled format',()=>{
  for(const value of [null,0]){
    const input=fixture(),p=input.fleet.rows.find(r=>r.disposition==='ready'),live=input.snapshot.strategies.find(r=>r.id===p.strategy_id)
    live.package_settings.reels_per_month=value;live.package_settings.other_agreed_deliverables='Flexible: agreed per brief, no numeric quota'
    p.proposed_strategy_data.actionPlan.reels={enabled:false,items:[],notes:''}
    input.quality.rows.find(r=>r.client_id===p.client_id && r.strategy_month===p.strategy_month).reviewed_strategy_hash=sha(p.proposed_strategy_data)
    const row=buildQualityPlan(input).rows.find(r=>r.row_id===p.strategy_id)
    assert.equal(row.package_receipt.reels_per_month,value);assert.match(row.package_receipt.other_agreed_deliverables,/Flexible/)
    assert.equal(row.proposed_strategy_data.actionPlan.reels.enabled,false)
    p.proposed_strategy_data.actionPlan.reels.enabled=true
    assert.ok(buildQualityPlan(input).rows.find(r=>r.row_id===p.strategy_id).stop_reasons.includes('PACKAGE_FORMAT_MISMATCH:reels_per_month'))
  }
})
test('foreign UUID/client text and mismatched proposal hashes are rejected',()=>{
  for(const text of ['Foreign 00000000-0000-4000-8000-000000000000','Strategy for Madison Wear']){
    const input=fixture(),p=input.fleet.rows.find(r=>r.disposition==='ready' && r.client_name!=='Madison Wear')
    p.proposed_strategy_data.strategyGoingForward=text
    input.quality.rows.find(r=>r.client_id===p.client_id && r.strategy_month===p.strategy_month).reviewed_strategy_hash=sha(p.proposed_strategy_data)
    const row=buildQualityPlan(input).rows.find(r=>r.row_id===p.strategy_id)
    assert.ok(row.stop_reasons.some(s=>s==='PROPOSED_INTERNAL_OR_UUID_COPY'||s==='FOREIGN_CLIENT_COPY:Madison Wear'))
  }
  const input=fixture();input.fleet.rows.find(r=>r.disposition==='ready').proposed_strategy_data.strategyGoingForward='Unexpected replacement'
  assert.ok(buildQualityPlan(input).rows.some(r=>r.stop_reasons.includes('COMMITTED_567_PROPOSAL_HASH_DRIFT')))
})
test('staff edits and revision drift stop; never overwrite or silently reconcile',()=>{
  const input=fixture(),plan=buildQualityPlan(input),live=input.snapshot.strategies.find(r=>r.id===plan.rows[0].row_id)
  live.strategy_data.strategyGoingForward='Later staff amendment'
  assert.ok(buildQualityPlan(input).rows[0].stop_reasons.includes('LIVE_REVIEWED_HASH_DRIFT_PRESERVE_STAFF_CONTENT'))
  assert.throws(()=>assertNoDrift(plan,input.snapshot),/Drift refusal/)
  const revised=fixture(),p=buildQualityPlan(revised);revised.snapshot.revisions[0].record_version=3
  assert.throws(()=>assertNoDrift(p,revised.snapshot),/Revision drift/)
})
test('all 20 non-applicable rows are excluded and any later change refuses the plan',()=>{
  const input=fixture(),plan=buildQualityPlan(input)
  assert.equal(plan.excluded.length,20);assert.ok(plan.excluded.every(e=>!plan.rows.some(r=>r.row_id===e.row_id)))
  input.snapshot.strategies.find(r=>r.id===plan.excluded[0].row_id).strategy_data.clientRequestNotes='Changed'
  assert.throws(()=>buildQualityPlan(input),/Frozen non-applicable hash drift/)
  assert.throws(()=>assertNoDrift(plan,input.snapshot),/Drift refusal/)
})
test('frozen artifact output denied; compiler contains no RPC apply path',()=>{
  assert.throws(()=>assertIsolated('artifacts/client-strategy-dossiers/issue-513'),/forbidden/)
  const code=readFileSync('scripts/build-strategy-quality-amendment-plan.mjs','utf8')
  assert.doesNotMatch(code,/\.rpc\(|\.from\(|fetch\(|SUPABASE_SERVICE_ROLE_KEY|--apply/)
})
test('durable production-read plan hashes, receipts and counts independently read back',()=>{
  const plan=JSON.parse(readFileSync('artifacts/strategy-quality-amendments/issue-513/canonical-quality-amendment-plan.json','utf8'))
  const {plan_hash,...core}=plan
  assert.equal(sha(core),plan_hash)
  assert.equal(plan.counts.reviewed,94);assert.equal(plan.counts.clients,47)
  assert.equal(plan.counts.amendment_needed,4);assert.equal(plan.counts.already_quality_equal,0);assert.equal(plan.counts.blocked,90)
  assert.equal(plan.counts.non_applicable_untouched,20);assert.equal(plan.counts.approved,0);assert.equal(plan.counts.published,0)
  for(const row of plan.rows){
    const review=manifest.rows.find(r=>r.strategy_id===row.row_id)
    assert.equal(row.current_strategy_hash,review.strategy_hash)
    assert.equal(sha(row.current_strategy_data),review.strategy_hash)
    assert.equal(sha(row.proposed_strategy_data),row.proposed_strategy_hash)
    assert.equal(sha(row.later_guard.seed_context),review.seed_context_hash)
    assert.equal(row.current_revision_receipt.strategy_id,row.row_id)
    assert.equal(row.current_revision_receipt.client_id,row.client_id)
    assert.equal(row.current_revision_receipt.record_version,2)
    assert.equal(row.current_revision_receipt.event_kind,'amended')
    assert.equal(row.committed_567_proposed_hash,quality.rows.find(r=>r.client_id===row.client_id && r.strategy_month===row.strategy_month).reviewed_strategy_hash)
    if(row.disposition!=='blocked') assert.ok(['Piek Group','Neshora Oxygen'].includes(row.client_name))
  }
})
