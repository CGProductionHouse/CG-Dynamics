import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildReviewedBatch } from '../scripts/build-strategy-quality-batch.mjs'
import { indexOverrides, validateOverride, reviewedPatch, verifySources, fileHash } from '../scripts/strategy-quality-reviewed-overrides.mjs'
import { sha } from '../scripts/audit-monthly-strategy-approval-manifest.mjs'
const read=p=>JSON.parse(readFileSync(p,'utf8'))
const DIR='artifacts/strategy-quality-amendments/issue-513/'
const baseline=read(`${DIR}canonical-quality-amendment-plan.json`),plan=read(`${DIR}batch-1/canonical-quality-amendment-plan.json`),copy=read(`${DIR}batch-1/reviewed-copy.json`)
function resign(packet){for(const r of packet.rows){const {reviewed_hash,...core}=r;r.reviewed_hash=sha(core)}const {packet_hash,...core}=packet;packet.packet_hash=sha(core);return packet}
test('source hashes are deterministic across Windows CRLF and CI LF checkouts',()=>{
  const directory=mkdtempSync(join(tmpdir(),'cg-quality-hash-'))
  try{
    const a=join(directory,'windows.md'),b=join(directory,'ci.md')
    writeFileSync(a,'Actual approved source\r\nExact client scope\r\n');writeFileSync(b,'Actual approved source\nExact client scope\n')
    assert.equal(fileHash(a),fileHash(b))
    writeFileSync(b,'Changed client scope\n');assert.notEqual(fileHash(a),fileHash(b))
  }finally{rmSync(directory,{recursive:true,force:true})}
})
test('deterministic strongest ten exact clients, twenty paired months, committed packet matches',()=>{
  const packet=buildReviewedBatch()
  assert.deepEqual(packet,read(`${DIR}batch-1/reviewed-overrides.json`));assert.equal(indexOverrides(packet).size,20)
  assert.equal(packet.selection.selected.length,10);assert.ok(packet.rows.every(r=>!['Piek Group','Neshora Oxygen'].includes(r.client_name)))
  assert.equal(packet.selection.qualifying.filter(c=>c.reports===3).length,packet.selection.qualifying.length)
  assert.equal(plan.counts.amendment_needed,24);assert.equal(plan.counts.blocked,70);assert.equal(plan.write_count,0)
  const {plan_hash,...core}=plan;assert.equal(plan_hash,sha(core))
})
test('Sep retrospective and Oct forward intents differ in all five meaningful direction fields',()=>{
  for(const client of copy.clients) for(const f of ['objective','coreMessage','pillarsAndHooks','testAndChange','nextMonthGamePlan']) assert.notEqual(client.months['2026-09-01'][f],client.months['2026-10-01'][f])
  const p=buildReviewedBatch();p.rows[1].patch.goldStandard.coreMessage=p.rows[0].patch.goldStandard.coreMessage
  assert.throws(()=>indexOverrides(resign(p)),/Rename-only/)
})
test('duplicate/cross-client/month swaps and changed reviewed hash fail closed',()=>{
  const p=buildReviewedBatch();p.rows[0].patch.goldStandard.coreMessage+=' tampered';assert.throws(()=>indexOverrides(p),/packet/)
  const duplicate=buildReviewedBatch();duplicate.rows[1]=structuredClone(duplicate.rows[0]);assert.throws(()=>indexOverrides(resign(duplicate)),/identity/)
  const wrongMonth=buildReviewedBatch();wrongMonth.rows[0].strategy_month='2026-11-01';assert.throws(()=>indexOverrides(resign(wrongMonth)),/identity/)
  const wrongClient=buildReviewedBatch();wrongClient.rows[0].client_name='Neshora Oxygen';assert.throws(()=>indexOverrides(resign(wrongClient)),/identity/)
})
test('each source reference and quoted brand constraint really exists; drift and traversal refused',()=>{
  for(const row of buildReviewedBatch().rows) verifySources(row.source_receipts)
  const p=buildReviewedBatch(),receipts=p.rows[0].source_receipts
  receipts[0].sha256='wrong';assert.throws(()=>verifySources(receipts),/drift/)
  receipts[0].path='../../.env';assert.throws(()=>verifySources(receipts),/path/)
})
test('all copy is client-specific and free of internal/foreign copy; no invented metric wins',()=>{
  for(const row of plan.rows.filter(r=>r.reviewed_override)){
    assert.equal(row.disposition,'amendment_needed');assert.deepEqual(row.stop_reasons,[])
    const text=JSON.stringify(row.proposed_strategy_data.goldStandard)
    assert.doesNotMatch(text,/\b(repo|repository|evidence|dossier|github|workflow)\b|[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}|increase engagement|build brand awareness/i)
    for(const other of baseline.rows) if(other.client_id!==row.client_id && other.client_name!=='CG Production House') assert.ok(!text.toLowerCase().includes(other.client_name.toLowerCase()))
    assert.ok(row.reviewed_override.report_context.every(r=>r.coverage.includes('No creative winner')))
  }
})
test('fixed scope never inflates and null/zero/flexible remain truthful',()=>{
  for(const client of copy.clients){
    const b=baseline.rows.find(r=>r.client_id===client.client_id)
    const patch=reviewedPatch(client,'2026-10-01',b.package_receipt)
    assert.equal(patch.actionPlan.reels.enabled,false);assert.equal(patch.actionPlan.animated_poster.enabled,false)
    const pkg=structuredClone(b.package_receipt);pkg.reels_per_month=0
    assert.equal(reviewedPatch(client,'2026-10-01',pkg).actionPlan.reels.enabled,false)
    const inflated=structuredClone(client);inflated.months['2026-10-01'].items.reels=['Extra reel'];assert.throws(()=>reviewedPatch(inflated,'2026-10-01',pkg),/inflation/)
  }
  const tbs=plan.rows.find(r=>r.client_name==='TBS Brokers' && r.reviewed_override)
  assert.equal(tbs.proposed_strategy_data.actionPlan.professional_video.enabled,false)
  assert.equal(tbs.package_receipt.professional_videos_per_month,null)
  assert.match(tbs.proposed_strategy_data.goldStandard.formatsAndRationale,/swap/i)
})
test('guard refuses exact row/client/month/package/seed/staff/revision drift',()=>{
  const row=buildReviewedBatch().rows[0],b=baseline.rows.find(r=>r.row_id===row.row_id)
  const current={id:row.row_id,client_id:row.client_id,client_name:row.client_name,strategy_month:row.strategy_month,strategy_data:b.current_strategy_data,seed_context:b.later_guard.seed_context,package_settings:b.package_receipt,internal_notes:b.later_guard.internal_notes}
  const valid=structuredClone(row);valid.guard.fingerprint=sha(current)
  assert.deepEqual(validateOverride(current,valid,b.current_revision_receipt),[])
  for(const mutate of [c=>c.id='other',c=>c.client_id='other',c=>c.strategy_month='2026-10-01',c=>c.package_settings.photo_posts_per_month=100,c=>c.seed_context.later='edit',c=>c.internal_notes='later']){
    const changed=structuredClone(current);mutate(changed);assert.ok(validateOverride(changed,valid,b.current_revision_receipt).length)
  }
  assert.ok(validateOverride(current,valid,{...b.current_revision_receipt,record_version:3}).length)
  const generic=structuredClone(valid)
  for(const f of ['objective','coreMessage','pillarsAndHooks']) generic.patch.goldStandard[f]='Useful content for customers who want to know more about the company and its products.'
  assert.ok(validateOverride(current,generic,b.current_revision_receipt).includes('REVIEWED_OVERRIDE_NOT_CLIENT_SPECIFIC'))
  const jargon=structuredClone(valid);jargon.patch.goldStandard.testAndChange+=' Frozen post identities.'
  assert.ok(validateOverride(current,jargon,b.current_revision_receipt).includes('REVIEWED_OVERRIDE_INTERNAL_COPY'))
  const wrongFormat=structuredClone(valid);wrongFormat.patch.actionPlan.reels.enabled=true
  assert.ok(validateOverride(current,wrongFormat,b.current_revision_receipt).includes('REVIEWED_OVERRIDE_PACKAGE:reels_per_month'))
  const staffOverwrite=structuredClone(valid);staffOverwrite.patch.internal_notes='overwrite'
  assert.ok(validateOverride(current,staffOverwrite,b.current_revision_receipt).includes('REVIEWED_OVERRIDE_CONTRACT'))
})
test('Piek/Neshora exact rows and all twenty exclusion fingerprints unchanged',()=>{
  for(const name of ['Piek Group','Neshora Oxygen']) assert.deepEqual(plan.rows.filter(r=>r.client_name===name),baseline.rows.filter(r=>r.client_name===name))
  assert.deepEqual(plan.excluded,baseline.excluded)
})
