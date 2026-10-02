import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { buildReviewedBatch } from '../scripts/build-strategy-quality-batch.mjs'
import { BATCH4_CLIENTS, indexOverrides, validateOverride, reviewedPatch, claimSafetyStops } from '../scripts/strategy-quality-reviewed-overrides.mjs'
import { buildBlockedInventory } from '../scripts/strategy-quality-blocked-inventory.mjs'
import { sha } from '../scripts/audit-monthly-strategy-approval-manifest.mjs'
const DIR='artifacts/strategy-quality-amendments/issue-513/', read=p=>JSON.parse(readFileSync(p,'utf8'))
const baseline=read(DIR+'batch-3/canonical-quality-amendment-plan.json'),plan=read(DIR+'batch-4/canonical-quality-amendment-plan.json')
const packet=buildReviewedBatch(4),copy=read(DIR+'batch-4/reviewed-copy.json')
const resign=p=>{for(const r of p.rows){const{reviewed_hash,...core}=r;r.reviewed_hash=sha(core)}const{packet_hash,...core}=p;p.packet_hash=sha(core);return p}
test('exact three remaining clients, six paired months, no padding, deterministic packet/68+26 plan',()=>{
  assert.deepEqual(packet,read(DIR+'batch-4/reviewed-overrides.json'))
  assert.deepEqual(copy.clients.map(c=>c.client_name).sort(),Object.values(BATCH4_CLIENTS).sort())
  assert.equal(packet.selection.qualifying.length,3);assert.equal(indexOverrides(packet).size,6)
  assert.equal(packet.baseline_plan_hash,baseline.plan_hash)
  assert.deepEqual([plan.counts.reviewed,plan.counts.amendment_needed,plan.counts.blocked,plan.counts.non_applicable_untouched],[94,68,26,20])
  const{plan_hash,...core}=plan;assert.equal(plan_hash,sha(core));assert.equal(plan.write_count,0)
  assert.equal(plan.counts.approved,0);assert.equal(plan.counts.published,0)
})
test('62 predecessor accepted rows, all twenty exclusions, three prior packets byte-stable; Zooz not retried',()=>{
  for(const n of [1,2,3])assert.deepEqual(buildReviewedBatch(n),read(DIR+`batch-${n}/reviewed-overrides.json`))
  for(const r of baseline.rows.filter(r=>r.disposition==='amendment_needed'))assert.equal(JSON.stringify(plan.rows.find(p=>p.row_id===r.row_id)),JSON.stringify(r))
  assert.equal(JSON.stringify(plan.excluded),JSON.stringify(baseline.excluded))
  assert.equal(packet.held_clients[0].client_name,'Zooz Lifestyle WFF')
  assert.ok(plan.rows.filter(r=>r.client_name==='Zooz Lifestyle WFF').every(r=>r.disposition==='blocked'&&!r.reviewed_override))
})
test('substitution, extra identities, missing paired months, renamed months and changed source/held binding rejected',()=>{
  const edits=[p=>p.rows[0].client_id=p.held_clients[0].client_id,p=>p.rows[0].client_name='Wrong practice',p=>p.selection.selected.pop(),p=>p.selection.qualifying.push(p.selection.qualifying[0]),p=>p.held_clients=[],p=>p.rows.pop(),p=>p.rows[1].strategy_month='2026-11-01',p=>p.rows[1]=structuredClone(p.rows[0]),p=>p.rows[0].source_receipts[0].sha256='changed',p=>p.rows[0].source_receipts[1]=p.rows.at(-1).source_receipts[1],p=>p.rows[0].source_receipts[1].quotes[0]='Invented quotation',p=>p.rows[1].patch.goldStandard.coreMessage=p.rows[0].patch.goldStandard.coreMessage]
  for(const edit of edits){const p=structuredClone(packet);edit(p);assert.throws(()=>indexOverrides(resign(p)))}
  for(const c of copy.clients)for(const f of ['objective','coreMessage','pillarsAndHooks','testAndChange','nextMonthGamePlan'])assert.notEqual(c.months['2026-09-01'][f],c.months['2026-10-01'][f])
})
test('a stopped exact client stays stopped for both months, with receipts/detail; never substituted',()=>{
  const p=structuredClone(packet),r=p.rows[0]
  p.rows=p.rows.filter(x=>x.client_id!==r.client_id)
  p.blocked_clients=[{client_id:r.client_id,client_name:r.client_name,months:['2026-09-01','2026-10-01'],reason:'INSUFFICIENT_EXACT_CLIENT_EVIDENCE',detail:'Regression fixture only: current topic evidence requires confirmation; both months stopped, never replaced.',source_receipts:r.source_receipts}]
  assert.equal(indexOverrides(resign(p)).size,4)
  p.blocked_clients[0].client_name='Substitute';assert.throws(()=>indexOverrides(resign(p)),/evidence gap/)
})
test('exact package capacities, unconfirmed formats disabled and no generic or unsupported client copy',()=>{
  const expected={'HMHI':[null,null,3],'Ehrlich Park Butchery':[1,3,4],'Bohemia Quick Stop':[null,null,2]}
  for(const c of copy.clients){const pkg=baseline.rows.find(r=>r.client_id===c.client_id).package_receipt
    assert.deepEqual([pkg.professional_videos_per_month,pkg.photo_posts_per_month,pkg.design_posters_per_month],expected[c.client_name])
    for(const month of ['2026-09-01','2026-10-01']){
      const patch=reviewedPatch(c,month,pkg);assert.deepEqual(claimSafetyStops(patch),[])
      assert.equal(patch.actionPlan.reels.enabled,false);assert.equal(patch.actionPlan.animated_poster.enabled,false)
      const text=JSON.stringify(patch);assert.doesNotMatch(text,/\b(?:repo|repository|evidence|dossier|github|seed_context)\b|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/i)
      for(const other of plan.rows.filter(r=>r.client_id!==c.client_id&&r.client_name!=='CG Production House'))assert.ok(!text.includes(other.client_name))
    }
    const changed=structuredClone(c);changed.months['2026-10-01'].items.reels=['extra']
    for(const value of [null,0])assert.throws(()=>reviewedPatch(changed,'2026-10-01',{...pkg,reels_per_month:value}),/inflation/)
  }
})
test('real validator refuses package, source/live, staff-note and revision drift and generic claims',()=>{
  for(const r of packet.rows){const b=baseline.rows.find(b=>b.row_id===r.row_id)
    const current={id:r.row_id,client_id:r.client_id,client_name:r.client_name,strategy_month:r.strategy_month,strategy_data:b.current_strategy_data,seed_context:b.later_guard.seed_context,package_settings:b.package_receipt,internal_notes:b.later_guard.internal_notes}
    const row=structuredClone(r);row.guard.fingerprint=sha(current);assert.deepEqual(validateOverride(current,row,b.current_revision_receipt),[])
    for(const edit of [c=>c.internal_notes='later edit',c=>c.package_settings.design_posters_per_month=99,c=>c.seed_context.new='later source',c=>c.strategy_data.strategyGoingForward='later staff amendment']){const c=structuredClone(current);edit(c);assert.ok(validateOverride(c,row,b.current_revision_receipt).includes('REVIEWED_OVERRIDE_LIVE_DRIFT'))}
    assert.ok(validateOverride(current,row,{...b.current_revision_receipt,record_version:3}).includes('REVIEWED_OVERRIDE_LIVE_DRIFT'))
    const generic=structuredClone(row);for(const f of ['objective','coreMessage','pillarsAndHooks'])generic.patch.goldStandard[f]='Make a stronger presence by posting useful things for customers each month.'
    assert.ok(validateOverride(current,generic,b.current_revision_receipt).includes('REVIEWED_OVERRIDE_NOT_CLIENT_SPECIFIC'))
    const claim=structuredClone(row);claim.patch.goldStandard.coreMessage+=' Guaranteed approval and in stock now.'
    assert.ok(validateOverride(current,claim,b.current_revision_receipt).includes('REVIEWED_OVERRIDE_UNSUPPORTED_CLAIM'))
  }
})
test('inventory covers EVERY remaining paired blocked client, distinguishes report gaps from missing post evidence',()=>{
  const inventory=buildBlockedInventory(plan);assert.deepEqual(inventory,read(DIR+'batch-4/blocked-client-evidence-inventory.json'))
  assert.deepEqual(inventory.counts,{clients:13,rows:26,held:1})
  assert.deepEqual(inventory.clients.map(c=>c.client_id).sort(),[...new Set(plan.rows.filter(r=>r.disposition==='blocked').map(r=>r.client_id))].sort())
  for(const c of inventory.clients){assert.equal(c.months.length,2);assert.ok(c.evidence_gaps.length);assert.ok(c.source_receipts.length>=4)}
  const pvc=inventory.clients.find(c=>c.client_name==='All Around PVC');assert.deepEqual(pvc.history.map(h=>h.gap),['MISSING_CANONICAL_REPORT','NO_IN_MONTH_POST_EVIDENCE',null])
  const red=inventory.clients.find(c=>c.client_name==='Red Oak');assert.deepEqual(red.history.map(h=>h.gap),[null,'NO_IN_MONTH_POST_EVIDENCE','NO_IN_MONTH_POST_EVIDENCE'])
  const zooz=inventory.clients.find(c=>c.client_name==='Zooz Lifestyle WFF');assert.equal(zooz.guide_present,false);assert.equal(zooz.held,true);assert.ok(zooz.evidence_gaps.includes('MISSING_EXACT_CLIENT_RUNTIME_GUIDE'))
  assert.ok(inventory.clients.find(c=>c.client_name==='WiseRide').copy_rejections.includes('FOREIGN_CLIENT_COPY:Wiseman Group'))
  const changed=structuredClone(plan);changed.rows.find(r=>r.disposition==='blocked').client_name='Wrong';assert.throws(()=>buildBlockedInventory(changed),/Invalid zero-write/)
})
