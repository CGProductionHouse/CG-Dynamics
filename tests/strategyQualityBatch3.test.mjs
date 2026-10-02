import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { buildReviewedBatch } from '../scripts/build-strategy-quality-batch.mjs'
import { BATCH3_CLIENTS, indexOverrides, validateOverride, reviewedPatch, claimSafetyStops } from '../scripts/strategy-quality-reviewed-overrides.mjs'
import { sha } from '../scripts/audit-monthly-strategy-approval-manifest.mjs'
const DIR='artifacts/strategy-quality-amendments/issue-513/'
const read=p=>JSON.parse(readFileSync(p,'utf8'))
const baseline=read(DIR+'batch-2/canonical-quality-amendment-plan.json')
const plan=read(DIR+'batch-3/canonical-quality-amendment-plan.json')
const copy=read(DIR+'batch-3/reviewed-copy.json')
const packet=buildReviewedBatch(3)
const resign=p=>{for(const r of p.rows){const{reviewed_hash,...core}=r;r.reviewed_hash=sha(core)}const{packet_hash,...core}=p;p.packet_hash=sha(core);return p}
const currentFor=r=>{const b=baseline.rows.find(b=>b.row_id===r.row_id);const current={id:r.row_id,client_id:r.client_id,client_name:r.client_name,strategy_month:r.strategy_month,strategy_data:b.current_strategy_data,seed_context:b.later_guard.seed_context,package_settings:b.package_receipt,internal_notes:b.later_guard.internal_notes};const row=structuredClone(r);row.guard.fingerprint=sha(current);return {current,row,revision:b.current_revision_receipt}}

test('Batch 3 exact ten/20 pairs, deterministic packet and truthful 62/32 cumulative counts',()=>{
  assert.deepEqual(packet,read(DIR+'batch-3/reviewed-overrides.json'))
  assert.deepEqual(copy.clients.map(c=>c.client_name).sort(),Object.values(BATCH3_CLIENTS).sort())
  assert.equal(indexOverrides(packet).size,20);assert.equal(packet.blocked_clients.length,0)
  assert.equal(packet.baseline_plan_hash,baseline.plan_hash)
  assert.equal(plan.counts.reviewed,94);assert.equal(plan.counts.amendment_needed,62);assert.equal(plan.counts.blocked,32)
  assert.equal(plan.write_count,0);assert.equal(plan.counts.approved,0);assert.equal(plan.counts.published,0)
  const{plan_hash,...core}=plan;assert.equal(plan_hash,sha(core))
})
test('all 42 accepted rows, predecessor packets and all 20 exclusions byte-stable; Zooz held',()=>{
  for(const n of [1,2])assert.deepEqual(buildReviewedBatch(n),read(DIR+`batch-${n}/reviewed-overrides.json`))
  for(const r of baseline.rows.filter(r=>r.disposition==='amendment_needed'))assert.equal(JSON.stringify(plan.rows.find(p=>p.row_id===r.row_id)),JSON.stringify(r))
  assert.equal(JSON.stringify(plan.excluded),JSON.stringify(baseline.excluded))
  assert.equal(plan.excluded.length,20)
  assert.equal(packet.held_clients[0].client_name,'Zooz Lifestyle WFF')
  assert.ok(!packet.selection.qualifying.some(c=>c.name==='Zooz Lifestyle WFF'))
  assert.ok(plan.rows.filter(r=>r.client_name==='Zooz Lifestyle WFF').every(r=>r.disposition==='blocked'&&!r.reviewed_override))
})
test('month distinction and exact identity, paired month, held client and source binding fail closed',()=>{
  const checks=[
    [p=>p.rows[0].client_name='Another client',/identity/],
    [p=>p.rows[0].client_id=p.held_clients[0].client_id,/Invalid reviewed batch packet/],
    [p=>p.rows[1].strategy_month='2026-11-01',/identity/],
    [p=>p.rows[1]=structuredClone(p.rows[0]),/identity/],
    [p=>p.held_clients=[],/identity/],
    [p=>p.rows[0].source_receipts[0].sha256='changed',/drift/],
    [p=>p.rows[0].source_receipts[1]=structuredClone(p.rows.at(-1).source_receipts[1]),/source contract/],
    [p=>p.rows[0].source_receipts[1].quotes[0]='Invented quote',/quotation/],
    [p=>p.rows[1].patch.goldStandard.objective=p.rows[0].patch.goldStandard.objective,/Rename-only/],
  ]
  for(const[edit,reason]of checks){const p=structuredClone(packet);edit(p);assert.throws(()=>indexOverrides(resign(p)),reason)}
  for(const c of copy.clients)for(const field of ['objective','coreMessage','pillarsAndHooks','testAndChange','nextMonthGamePlan'])assert.notEqual(c.months['2026-09-01'][field],c.months['2026-10-01'][field])
})
test('enabled actions fit confirmed packages; C&L video excluded; unknown/zero never inflated',()=>{
  for(const c of copy.clients){const pkg=baseline.rows.find(r=>r.client_id===c.client_id).package_receipt
    const patch=reviewedPatch(c,'2026-10-01',pkg);assert.deepEqual(claimSafetyStops(patch),[])
    assert.equal(patch.actionPlan.reels.enabled,false);assert.equal(patch.actionPlan.animated_poster.enabled,false)
    for(const value of [null,0]){const changed=structuredClone(c);changed.months['2026-10-01'].items.reels=['extra'];assert.throws(()=>reviewedPatch(changed,'2026-10-01',{...pkg,reels_per_month:value}),/inflation/)}
  }
  const cl=plan.rows.find(r=>r.client_name==='C&L Innovations');assert.equal(cl.package_receipt.professional_videos_per_month,null)
  assert.match(cl.package_receipt.package_exclusions,/No recurring professional-video/)
  assert.equal(cl.proposed_strategy_data.actionPlan.professional_video.enabled,false)
  assert.equal(cl.package_receipt.photo_posts_per_month,2);assert.equal(cl.package_receipt.design_posters_per_month,2)
})
test('actual validator rejects generic specificity, later notes/package/seed/revision/identity changes',()=>{
  const{current,row,revision}=currentFor(packet.rows[0]);assert.deepEqual(validateOverride(current,row,revision),[])
  const generic=structuredClone(row);for(const f of ['objective','coreMessage','pillarsAndHooks'])generic.patch.goldStandard[f]='Build a stronger presence with useful stories for customers every month.'
  assert.ok(validateOverride(current,generic,revision).includes('REVIEWED_OVERRIDE_NOT_CLIENT_SPECIFIC'))
  for(const edit of [r=>r.client_id='foreign',r=>r.strategy_month='2026-11-01',r=>r.internal_notes='staff edit',r=>r.seed_context.new='change',r=>r.package_settings.photo_posts_per_month=99,r=>r.strategy_data.strategyGoingForward='staff change']){
    const changed=structuredClone(current);edit(changed);assert.ok(validateOverride(changed,row,revision).length)
  }
  assert.ok(validateOverride(current,row,{...revision,record_version:3}).includes('REVIEWED_OVERRIDE_LIVE_DRIFT'))
})
test('regulatory/safety/stock promises rejected rather than excused by negated prefix',()=>{
  for(const name of ['PSG Bloemfontein','Bouwer & Coetzee Attorneys','Supa Quick Centurion']){
    const{current,row,revision}=currentFor(packet.rows.find(r=>r.client_name===name))
    for(const text of ['Guaranteed returns for everyone.','No delay, guaranteed approval.','Guaranteed safety on every journey.','In stock now.','Tickets R500.']){
      const changed=structuredClone(row);changed.patch.goldStandard.coreMessage+=text
      assert.ok(validateOverride(current,changed,revision).includes('REVIEWED_OVERRIDE_UNSUPPORTED_CLAIM'))
    }
  }
})
test('client copy contains no foreign/internal identities or metric winners; branch scopes distinct',()=>{
  for(const r of plan.rows.filter(r=>r.reviewed_override?.packet_hash===packet.packet_hash)){
    assert.equal(r.disposition,'amendment_needed');const text=JSON.stringify(r.proposed_strategy_data.goldStandard)
    assert.doesNotMatch(text,/\b(repo|repository|github|dossier|evidence|workflow|migration|worker)\b|[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}/i)
    for(const other of baseline.rows)if(other.client_id!==r.client_id&&other.client_name!=='CG Production House')assert.ok(!text.toLowerCase().includes(other.client_name.toLowerCase()))
    assert.ok(r.reviewed_override.report_context.every(h=>h.coverage.includes('No creative winner')))
    assert.equal(r.current_revision,2);assert.equal(r.current_revision_receipt.strategy_id,r.row_id)
  }
  const bfn=copy.clients.find(c=>c.client_name==='Supa Quick BFN'),cent=copy.clients.find(c=>c.client_name==='Supa Quick Centurion')
  assert.match(bfn.months['2026-10-01'].pillarsAndHooks,/alignment\/balancing/)
  assert.match(cent.months['2026-10-01'].pillarsAndHooks,/tyre\/wheel/i)
  assert.match(cent.mustAvoid,/No unverified alignment/)
  const psg=copy.clients.find(c=>c.client_name==='PSG Bloemfontein');assert.match(psg.mustAvoid,/national wealth\/investment/)
})
test('production-read plan retains staff fields and source/live/revision guards without execution',()=>{
  for(const r of plan.rows.filter(r=>r.reviewed_override?.packet_hash===packet.packet_hash)){
    const old=baseline.rows.find(b=>b.row_id===r.row_id)
    assert.equal(r.current_strategy_hash,old.current_strategy_hash);assert.deepEqual(r.current_revision_receipt,old.current_revision_receipt)
    assert.deepEqual(r.later_guard.seed_context,old.later_guard.seed_context);assert.equal(r.later_guard.internal_notes,old.later_guard.internal_notes)
    for(const f of ['topContent','calendarSelections','clientDirection','clientRequestNotes'])assert.deepEqual(r.proposed_strategy_data[f],r.current_strategy_data[f])
    assert.equal(r.package_hash,sha(r.package_receipt));assert.equal(r.proposed_strategy_hash,sha(r.proposed_strategy_data))
  }
  assert.equal(new Set(plan.rows.map(r=>r.later_guard.idempotency_key)).size,94)
  assert.doesNotMatch(readFileSync('scripts/build-strategy-quality-amendment-plan.mjs','utf8'),/\.rpc\(|fetch\(|--apply/)
})
