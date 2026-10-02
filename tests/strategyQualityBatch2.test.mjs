import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { buildReviewedBatch } from '../scripts/build-strategy-quality-batch.mjs'
import { indexOverrides, validateOverride, reviewedPatch, claimSafetyStops } from '../scripts/strategy-quality-reviewed-overrides.mjs'
import { sha } from '../scripts/audit-monthly-strategy-approval-manifest.mjs'
const DIR='artifacts/strategy-quality-amendments/issue-513/'
const read=p=>JSON.parse(readFileSync(p,'utf8'))
const baseline=read(DIR+'batch-1/canonical-quality-amendment-plan.json')
const plan=read(DIR+'batch-2/canonical-quality-amendment-plan.json')
const copy=read(DIR+'batch-2/reviewed-copy.json')
const batch2Packet=buildReviewedBatch(2)
const expected=['The Staffordshire','Delta Gas','CG Production House','RC-Polypipe','Zooz Lifestyle WFF','Peyper Bonds','Loraclox','Tobich Optics','AV Event Life','Braize']
const resign=p=>{for(const row of p.rows){const{reviewed_hash,...core}=row;row.reviewed_hash=sha(core)}const{packet_hash,...core}=p;p.packet_hash=sha(core);return p}
test('exact next ten requested; nine paired reviews, one truthful gap, no substitution',()=>{
  const p=buildReviewedBatch(2)
  assert.deepEqual(p,read(DIR+'batch-2/reviewed-overrides.json'))
  assert.deepEqual([...copy.clients,...copy.blocked_clients].map(c=>c.client_name).sort(),expected.sort())
  assert.equal(p.selection.selected.length,10);assert.equal(indexOverrides(p).size,18)
  assert.equal(p.blocked_clients.length,1);assert.equal(p.blocked_clients[0].client_name,'Zooz Lifestyle WFF')
  assert.deepEqual(p.blocked_clients[0].months,['2026-09-01','2026-10-01'])
  assert.equal(existsSync('artifacts/client-strategy-dossiers/issue-513/runtime-guides/zooz-lifestyle-wff.md'),false)
  assert.ok(plan.rows.filter(r=>r.client_name==='Zooz Lifestyle WFF').every(r=>r.disposition==='blocked' && !r.reviewed_override))
  assert.equal(plan.counts.amendment_needed,42);assert.equal(plan.counts.blocked,52)
  const{plan_hash,...core}=plan;assert.equal(plan_hash,sha(core));assert.equal(plan.write_count,0)
})
test('Batch 1 packet remains deterministic and all accepted rows, Piek/Neshora, exclusions byte-stable',()=>{
  assert.deepEqual(buildReviewedBatch(),read(DIR+'batch-1/reviewed-overrides.json'))
  for(const row of baseline.rows.filter(r=>r.disposition==='amendment_needed')) {
    assert.equal(JSON.stringify(plan.rows.find(r=>r.row_id===row.row_id)),JSON.stringify(row))
  }
  assert.equal(JSON.stringify(plan.excluded),JSON.stringify(baseline.excluded))
  assert.equal(plan.counts.approved,0);assert.equal(plan.counts.published,0)
})
test('both months have genuinely different objective, message, pillars, test and game plan',()=>{
  for(const client of copy.clients)for(const field of ['objective','coreMessage','pillarsAndHooks','testAndChange','nextMonthGamePlan']){
    const norm=s=>s.toLowerCase().replace(/september|october|review|plan|2026/g,'').replace(/[^a-z0-9]/g,'')
    assert.notEqual(norm(client.months['2026-09-01'][field]),norm(client.months['2026-10-01'][field]))
  }
  const p=buildReviewedBatch(2);p.rows[1].patch.goldStandard.testAndChange=p.rows[0].patch.goldStandard.testAndChange
  assert.throws(()=>indexOverrides(resign(p)),/Rename-only/)
})
test('invalid gap, missing paired month, changed source and duplicate identity fail closed',()=>{
  const gap=buildReviewedBatch(2);gap.blocked_clients[0].client_name='Another Client';assert.throws(()=>indexOverrides(resign(gap)),/packet/)
  const missing=buildReviewedBatch(2);missing.rows.pop();assert.throws(()=>indexOverrides(resign(missing)),/packet/)
  const source=buildReviewedBatch(2);source.rows[0].source_receipts[0].sha256='changed';assert.throws(()=>indexOverrides(resign(source)),/drift/)
  const duplicate=buildReviewedBatch(2);duplicate.rows[1]=structuredClone(duplicate.rows[0]);assert.throws(()=>indexOverrides(resign(duplicate)),/identity/)
})
test('bounded packages preserve null/zero/flexible and CGPH collaboration capacity',()=>{
  for(const c of copy.clients){
    const pkg=baseline.rows.find(r=>r.client_id===c.client_id).package_receipt
    const patch=reviewedPatch(c,'2026-10-01',pkg)
    assert.deepEqual(claimSafetyStops(patch),[])
    assert.equal(patch.actionPlan.reels.enabled,false);assert.equal(patch.actionPlan.animated_poster.enabled,false)
    const inflated=structuredClone(c);inflated.months['2026-10-01'].items.reels=['extra'];assert.throws(()=>reviewedPatch(inflated,'2026-10-01',{...pkg,reels_per_month:0}),/inflation/)
  }
  const cg=plan.rows.find(r=>r.client_name==='CG Production House'&&r.strategy_month==='2026-10-01')
  assert.equal(cg.package_receipt.photo_posts_per_month,8)
  assert.match(cg.proposed_strategy_data.goldStandard.formatsAndRationale,/not twelve/)
  const zoo=plan.rows.find(r=>r.client_name==='Zooz Lifestyle WFF')
  for(const f of ['professional_videos_per_month','photo_posts_per_month','design_posters_per_month'])assert.equal(zoo.package_receipt[f],null)
  assert.match(zoo.package_receipt.other_agreed_deliverables,/Recurring social-media/)
})
test('finance, clinical, branch, stock, pricing and future-event claims rejected in real validator',()=>{
  const p=buildReviewedBatch(2),r=p.rows[0],b=baseline.rows.find(b=>b.row_id===r.row_id)
  const current={id:r.row_id,client_id:r.client_id,client_name:r.client_name,strategy_month:r.strategy_month,strategy_data:b.current_strategy_data,seed_context:b.later_guard.seed_context,package_settings:b.package_receipt,internal_notes:b.later_guard.internal_notes}
  r.guard.fingerprint=sha(current)
  for(const unsafe of ['Guaranteed approval for every buyer.','The lowest interest rate is ours.','This cures dry eye.','OCT scans available here.','Visit Windhoek for your Tobich appointment.','In stock now.','Tickets R500.','Concert 18 October.','Every Friday we host the same show.','Sponsored by an invented brand.','Enjoy 2 for 1 cocktails.','No stock has been confirmed. In stock now.','No delay, guaranteed approval for every buyer.']){
    const changed=structuredClone(r);changed.patch.goldStandard.coreMessage+=' '+unsafe
    assert.ok(validateOverride(current,changed,b.current_revision_receipt).includes('REVIEWED_OVERRIDE_UNSUPPORTED_CLAIM'),unsafe)
  }
})
test('new accepted copy excludes foreign identities, internal language and fabricated metric wins',()=>{
  for(const r of plan.rows.filter(r=>r.reviewed_override?.packet_hash===batch2Packet.packet_hash)){
    assert.equal(r.disposition,'amendment_needed')
    const text=JSON.stringify(r.proposed_strategy_data.goldStandard)
    assert.doesNotMatch(text,/\b(repo|repository|github|dossier|evidence|workflow|migration|worker)\b|[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}/i)
    for(const other of baseline.rows)if(other.client_id!==r.client_id&&other.client_name!=='CG Production House')assert.ok(!text.toLowerCase().includes(other.client_name.toLowerCase()))
    assert.ok(r.reviewed_override.report_context.every(h=>h.coverage.includes('No creative winner')))
  }
})
