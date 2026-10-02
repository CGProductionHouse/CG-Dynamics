import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { buildRemediationPacket, compileRemediation } from '../scripts/build-strategy-quality-remediation.mjs'
import { buildReviewedBatch } from '../scripts/build-strategy-quality-batch.mjs'
import { indexOverrides, validateOverride, reviewedPatch, claimSafetyStops } from '../scripts/strategy-quality-reviewed-overrides.mjs'
import { sha } from '../scripts/audit-monthly-strategy-approval-manifest.mjs'
import { isWithinMetaProviderPeriod } from '../supabase/functions/_shared/metaPeriod.ts'
const DIR='artifacts/strategy-quality-amendments/issue-513/', read=p=>JSON.parse(readFileSync(p,'utf8'))
const baseline=read(DIR+'batch-4/canonical-quality-amendment-plan.json'), plan=read(DIR+'remediation-a/canonical-quality-amendment-plan.json'), copy=read(DIR+'remediation-a/reviewed-copy.json'), packet=buildRemediationPacket()
const resign=p=>{for(const r of p.rows){const{reviewed_hash,...core}=r;r.reviewed_hash=sha(core)}const{packet_hash,...core}=p;p.packet_hash=sha(core);return p}
test('targeted remediation is exactly the two authorised clients/four paired months, never Batch 5',()=>{
  assert.deepEqual(packet,read(DIR+'remediation-a/reviewed-overrides.json'));assert.equal(packet.batch,'remediation-a')
  assert.equal(indexOverrides(packet).size,4);assert.equal(packet.baseline_plan_hash,baseline.plan_hash)
  assert.deepEqual(copy.clients.map(c=>c.client_name).sort(),['All Around PVC','Bat Hill Royale'])
  assert.deepEqual([plan.counts.amendment_needed,plan.counts.blocked,plan.counts.non_applicable_untouched],[72,22,20])
  const{plan_hash,...core}=plan;assert.equal(plan_hash,sha(core));assert.equal(plan.write_count,0);assert.equal(plan.counts.approved,0);assert.equal(plan.counts.published,0)
})
test('all 68 accepted rows, four previous packets and twenty exclusions are byte-stable; held clients remain blocked',()=>{
  for(const n of [1,2,3,4])assert.deepEqual(buildReviewedBatch(n),read(DIR+`batch-${n}/reviewed-overrides.json`))
  for(const r of baseline.rows.filter(r=>r.disposition==='amendment_needed'))assert.equal(JSON.stringify(plan.rows.find(p=>p.row_id===r.row_id)),JSON.stringify(r))
  assert.equal(JSON.stringify(plan.excluded),JSON.stringify(baseline.excluded))
  for(const name of ['Zooz Lifestyle WFF','Vrystaat Kunstefees','Red Oak'])assert.ok(plan.rows.filter(r=>r.client_name===name).every(r=>r.disposition==='blocked'))
})

test('offline compiler refuses an incomplete live read before compiling or writing; no production apply path',()=>{
  assert.throws(()=>compileRemediation({strategies:[],revisions:[]},'must-not-be-read'),/Snapshot partition drift/)
  const code=readFileSync('scripts/build-strategy-quality-remediation.mjs','utf8')
  assert.doesNotMatch(code,/\.rpc\(|\.from\(|fetch\(|SUPABASE_SERVICE_ROLE_KEY|--apply/)
})
test('substitution, missing paired month, context/client/report/provider-period tampering fail closed even re-signed',()=>{
  for(const edit of [p=>p.rows[0].client_id='cdb11a82-339e-4b46-9b09-bde1a23efeaf',p=>p.rows.pop(),p=>p.rows[0].strategy_month='2026-11-01',p=>p.rows[0].client_name='Wrong client',p=>p.rows[0].report_context[1].report.client_id=p.rows[2].client_id,p=>p.rows[0].report_context[1].posts[0].publish_time='2026-07-01T01:00:00Z',p=>p.rows[0].source_receipts[0].sha256='bad',p=>p.selection.selected.pop()]) {
    const p=structuredClone(packet);edit(p);assert.throws(()=>indexOverrides(resign(p)))
  }
})
test('Pacific correction and calendar-month vs published-report cutoff remain separate; missing July is unavailable',()=>{
  for(const r of packet.rows){assert.equal(r.report_context[0].report,null);assert.equal(r.report_context[0].coverage,'unavailable');assert.equal(r.report_context[0].posts.length,0)}
  const pvc=packet.rows.find(r=>r.client_name==='All Around PVC').report_context
  assert.equal(pvc[1].posts.length,1);assert.ok(isWithinMetaProviderPeriod(pvc[1].posts[0].publish_time,'2026-08-01','2026-08-31'))
  assert.equal(isWithinMetaProviderPeriod(pvc[1].posts[0].publish_time,'2026-09-01','2026-09-30'),false)
  const bat=packet.rows.find(r=>r.client_name==='Bat Hill Royale').report_context[2]
  assert.equal(bat.posts.length,25);assert.equal(bat.report.period_end,'2026-09-23')
  assert.equal(bat.posts.filter(p=>!isWithinMetaProviderPeriod(p.publish_time,bat.report.period_start,bat.report.period_end)).length,4)
})
test('materially different month copy, exact format capacity, flexible Bat Hill service without guessed allocations',()=>{
  for(const c of copy.clients){const pkg=plan.rows.find(r=>r.client_id===c.client_id).package_receipt
    for(const month of ['2026-09-01','2026-10-01']){const patch=reviewedPatch(c,month,pkg)
      assert.deepEqual(claimSafetyStops(patch),[]);assert.doesNotMatch(JSON.stringify(patch),/\b(?:repo|repository|evidence|dossier|github|seed_context)\b|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/i)
      for(const other of plan.rows.filter(r=>r.client_id!==c.client_id&&r.client_name!=='CG Production House'))assert.ok(!JSON.stringify(patch).includes(other.client_name))
      if(c.client_name==='All Around PVC')assert.deepEqual(['professional_video','photo_content','design_poster'].map(f=>patch.actionPlan[f].items.length),[1,3,3])
      else {assert.ok(Object.values(patch.actionPlan).every(a=>!a.enabled&&!a.items.length));assert.match(patch.goldStandard.formatsAndRationale,/Recurring social content is included/)}
    }
    for(const f of ['objective','coreMessage','pillarsAndHooks','testAndChange','nextMonthGamePlan'])assert.notEqual(c.months['2026-09-01'][f],c.months['2026-10-01'][f])
  }
})
test('real override validator refuses later staff/seed/package/revision drift and generic or unsupported copy',()=>{
  for(const r of packet.rows){const b=baseline.rows.find(b=>b.row_id===r.row_id)
    const current={id:r.row_id,client_id:r.client_id,client_name:r.client_name,strategy_month:r.strategy_month,strategy_data:b.current_strategy_data,seed_context:b.later_guard.seed_context,package_settings:b.package_receipt,internal_notes:b.later_guard.internal_notes},row=structuredClone(r)
    row.guard.fingerprint=sha(current);assert.deepEqual(validateOverride(current,row,b.current_revision_receipt),[])
    for(const edit of [c=>c.internal_notes='staff edit',c=>c.package_settings.photo_posts_per_month=99,c=>c.seed_context.changed=true,c=>c.strategy_data.strategyGoingForward='staff amend']){const c=structuredClone(current);edit(c);assert.ok(validateOverride(c,row,b.current_revision_receipt).includes('REVIEWED_OVERRIDE_LIVE_DRIFT'))}
    assert.ok(validateOverride(current,row,{...b.current_revision_receipt,record_version:3}).includes('REVIEWED_OVERRIDE_LIVE_DRIFT'))
    const generic=structuredClone(row);for(const f of ['objective','coreMessage','pillarsAndHooks'])generic.patch.goldStandard[f]='Make a stronger presence by posting useful things for customers each month.'
    assert.ok(validateOverride(current,generic,b.current_revision_receipt).includes('REVIEWED_OVERRIDE_NOT_CLIENT_SPECIFIC'))
    const claim=structuredClone(row);claim.patch.goldStandard.coreMessage+=' In stock now and guaranteed savings.'
    assert.ok(validateOverride(current,claim,b.current_revision_receipt).includes('REVIEWED_OVERRIDE_UNSUPPORTED_CLAIM'))
  }
})
