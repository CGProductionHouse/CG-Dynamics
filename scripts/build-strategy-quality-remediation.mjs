// Offline targeted review, never a production amendment or a new report store.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { sha } from './audit-monthly-strategy-approval-manifest.mjs'
import { reviewedPatch, sourceReceipt, indexOverrides, REMEDIATION_A_CLIENTS, REMEDIATION_A_EVIDENCE } from './strategy-quality-reviewed-overrides.mjs'
import { buildQualityPlan, assertNoDrift } from './build-strategy-quality-amendment-plan.mjs'
import { buildBlockedInventory } from './strategy-quality-blocked-inventory.mjs'
const ROOT=resolve(import.meta.dirname,'..'), DIR='artifacts/strategy-quality-amendments/issue-513/', FROZEN='artifacts/client-strategy-dossiers/issue-513/'
const read=p=>JSON.parse(readFileSync(resolve(ROOT,p),'utf8'))
export function buildRemediationPacket() {
  const baseline=read(DIR+'batch-4/canonical-quality-amendment-plan.json'), copy=read(DIR+'remediation-a/reviewed-copy.json'), evidence=read(REMEDIATION_A_EVIDENCE), index=read(FROZEN+'index.json')
  if (sha(copy.clients.map(c=>c.client_id).sort())!==sha(Object.keys(REMEDIATION_A_CLIENTS).sort()) || copy.clients.some(c=>REMEDIATION_A_CLIENTS[c.client_id]!==c.client_name)) throw new Error('Exact approved Wave A clients only')
  const rows=copy.clients.flatMap(c=>{
    const client=index.clients.find(i=>i.id===c.client_id)
    const receipts=[sourceReceipt(FROZEN+client.file),sourceReceipt(FROZEN+'runtime-guides/'+client.file,c.guide_quotes),sourceReceipt(FROZEN+'index.json'),sourceReceipt('artifacts/report-truth/issue-501-recovery-pass-1-snapshot.json'),sourceReceipt(REMEDIATION_A_EVIDENCE)]
    return ['2026-09-01','2026-10-01'].map(month=>{
      const b=baseline.rows.find(r=>r.client_id===c.client_id&&r.strategy_month===month)
      if (b.disposition!=='blocked' || b.original_reviewed_provenance.source_evidence_hash!==client.evidence_hash) throw new Error('Targeted provenance drift')
      const row={row_id:b.row_id,client_id:c.client_id,client_name:c.client_name,strategy_month:month,review_state:copy.review_state,source_receipts:receipts,specificity_anchors:c.specificity_anchors,report_context:evidence.rows.filter(r=>r.client_id===c.client_id),guard:{fingerprint:b.later_guard.expected_fingerprint,revision_hash:sha(b.current_revision_receipt),strategy_hash:b.current_strategy_hash,seed_hash:sha(b.later_guard.seed_context),package_hash:b.package_hash,internal_notes:b.later_guard.internal_notes},patch:reviewedPatch(c,month,b.package_receipt)}
      return {...row,reviewed_hash:sha(row)}
    })
  })
  const core={schema_version:1,issue:513,batch:'remediation-a',mode:'ZERO_WRITE_REVIEWED_OVERRIDES',write_count:0,baseline_plan_hash:baseline.plan_hash,authored_copy_hash:sha(copy),selection:{selected:Object.keys(REMEDIATION_A_CLIENTS),rule:'#513:5958838698 explicitly reviewed Wave A; no ranked batch or substitution'},blocked_clients:[],rows}
  const packet={...core,packet_hash:sha(core)};indexOverrides(packet);return packet
}
export function compileRemediation(snapshot, regenerated) {
  const baseline=read(DIR+'batch-4/canonical-quality-amendment-plan.json');assertNoDrift(baseline,snapshot)
  const packet=buildRemediationPacket(), prior=[1,2,3,4].map(n=>read(DIR+`batch-${n}/reviewed-overrides.json`))
  const plan=buildQualityPlan({snapshot,fleet:JSON.parse(readFileSync(resolve(regenerated,'sep-oct-strategy-mutation-dry-run.json'),'utf8')),neshora:read(FROZEN+'neshora-strategy-readiness-dry-run.json'),manifest:read(FROZEN+'sep-oct-approval-publication-manifest.json'),quality:read(FROZEN+'issue-567-sep-oct-strategy-quality-readiness.json'),reviewedOverrides:[...prior,packet],preservedPlan:baseline})
  return {packet,plan,inventory:buildBlockedInventory(plan)}
}
if (process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  if(process.argv.length!==4)throw new Error('Usage: SELECT_SNAPSHOT ISOLATED_REGENERATED_DIRECTORY; no apply mode')
  const result=compileRemediation(read(process.argv[2]),resolve(process.argv[3]))
  for(const [key,file] of [['packet','reviewed-overrides.json'],['plan','canonical-quality-amendment-plan.json'],['inventory','blocked-client-evidence-inventory.json']])writeFileSync(resolve(ROOT,DIR,'remediation-a',file),JSON.stringify(result[key],null,2)+'\n')
  console.log(JSON.stringify({packet_hash:result.packet.packet_hash,plan_hash:result.plan.plan_hash,...result.plan.counts}))
}
