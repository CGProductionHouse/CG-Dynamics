// Offline evidence inventory, not an approval or a reporting-recovery system.
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { sha } from './audit-monthly-strategy-approval-manifest.mjs'
import { sourceReceipt, verifySources } from './strategy-quality-reviewed-overrides.mjs'
const ROOT=resolve(import.meta.dirname,'..'), DIR='artifacts/client-strategy-dossiers/issue-513'
const REPORTS='artifacts/report-truth/issue-501-recovery-pass-1-snapshot.json'
const read=p=>JSON.parse(readFileSync(resolve(ROOT,p),'utf8'))
export function buildBlockedInventory(plan) {
  const {plan_hash,...core}=plan
  if (sha(core)!==plan_hash || plan.write_count!==0 || plan.counts.reviewed!==94) throw new Error('Invalid zero-write plan')
  const index=read(`${DIR}/index.json`), history=read(REPORTS)
  const blocked=plan.rows.filter(r=>r.disposition==='blocked')
  const ids=[...new Set(blocked.map(r=>r.client_id))]
  const clients=ids.map(id=>{
    const rows=blocked.filter(r=>r.client_id===id), client=index.clients.find(c=>c.id===id)
    if (!client || rows.length!==2 || sha(rows.map(r=>r.strategy_month).sort())!==sha(['2026-09-01','2026-10-01']) || rows.some(r=>r.client_name!==client.name)) throw new Error('Blocked exact-client/month partition drift')
    const months=['2026-07','2026-08','2026-09'].map(month=>{
      const matches=history.rows.filter(r=>r.client.id===id && r.month.slice(0,7)===month)
      if (matches.length!==1) throw new Error('Missing/duplicate exact historical month evidence')
      const h=matches[0]
      if (h.included_posts.some(p=>p.report_id!==h.report?.id)) throw new Error('Cross-report post identity')
      return {month,report_id:h.report?.id??null,post_identity_count:h.included_posts.length,
        gap:!h.report?.id?'MISSING_CANONICAL_REPORT':!h.included_posts.length?'NO_IN_MONTH_POST_EVIDENCE':null}
    })
    const guide=`${DIR}/runtime-guides/${client.file}`, guidePresent=existsSync(resolve(ROOT,guide))
    const receipts=[sourceReceipt(`${DIR}/${client.file}`),sourceReceipt(`${DIR}/index.json`),sourceReceipt(REPORTS),sourceReceipt(`${DIR}/sep-oct-approval-publication-manifest.json`),...(guidePresent?[sourceReceipt(guide)]:[])]
    verifySources(receipts)
    const held=id==='0c01d90f-ba5e-4251-a597-bf3c83f990fa'
    const evidenceGaps=[...months.filter(m=>m.gap).map(m=>`${m.month}: ${m.gap}`),...(!guidePresent?['MISSING_EXACT_CLIENT_RUNTIME_GUIDE']:[]),'SEPARATE_EXACT_CLIENT_SEPTEMBER_AND_OCTOBER_QUALITY_REVIEW_NOT_ACCEPTED']
    if(held) evidenceGaps.push('APPROVED_CURRENT_ZOOZ_BRAND_VOICE_PRODUCT_PROGRAMME_AND_WFF_EVENT_ATHLETE_CONSTRAINTS_REQUIRED')
    return {client_id:id,client_name:client.name,months:rows.map(r=>({row_id:r.row_id,month:r.strategy_month,current_revision:r.current_revision,current_strategy_hash:r.current_strategy_hash,stop_reasons:r.stop_reasons})),
      source_receipts:receipts,guide_present:guidePresent,history:months,evidence_gaps:evidenceGaps,
      held,review_status:'STOPPED_NOT_REVIEWED_IN_BATCH_4',
      package_status:'Confirmed receipt exists; unknown/flexible capacities remain unknown/flexible, never inferred from posts.',
      next_evidence_action:held?'Obtain an approved exact-client guide and separate current ZooZ/WFF constraints; do not retry until that evidence exists.':`Resolve or explicitly document unavailable ${months.filter(m=>m.gap).map(m=>m.month).join(', ')} history for this exact client, then request a targeted separate Sep/Oct quality review using the existing guide. Do not clear the gate automatically.`,
      copy_rejections:[...new Set(rows.flatMap(r=>r.stop_reasons))].filter(r=>r!=='CLIENT_SPECIFIC_MONTHLY_QUALITY_REVIEW_REQUIRED_567_IS_NOT_ACCEPTANCE')}
  }).sort((a,b)=>a.client_name.localeCompare(b.client_name))
  const result={schema_version:1,issue:513,mode:'ZERO_WRITE_BLOCKED_EVIDENCE_INVENTORY',write_count:0,plan_hash,
    source_scope:'Committed exact July/August/September snapshot; September MTD as of 2026-09-23. Not a fresh provider/report completeness audit. Zero post identities means missing evidence here, never zero performance.',
    counts:{clients:clients.length,rows:blocked.length,held:clients.filter(c=>c.held).length},clients}
  return {...result,inventory_hash:sha(result)}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(process.argv.length!==4)throw new Error('Usage: PLAN OUTPUT; offline only')
  const result=buildBlockedInventory(read(process.argv[2]))
  writeFileSync(resolve(process.argv[3]),`${JSON.stringify(result,null,2)}\n`)
  console.log(JSON.stringify({inventory_hash:result.inventory_hash,...result.counts}))
}
