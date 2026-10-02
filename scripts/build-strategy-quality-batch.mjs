// Deterministic offline packet builder. Never reads credentials or invokes an RPC.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { sha } from './audit-monthly-strategy-approval-manifest.mjs'
import { reviewedPatch, sourceReceipt, indexOverrides } from './strategy-quality-reviewed-overrides.mjs'
const ROOT=resolve(import.meta.dirname,'..')
const FROZEN='artifacts/client-strategy-dossiers/issue-513'
const REPORTS='artifacts/report-truth/issue-501-recovery-pass-1-snapshot.json'
const read=p=>JSON.parse(readFileSync(resolve(ROOT,p),'utf8'))
export function buildReviewedBatch(batch = 1) {
  if (![1,2,3].includes(batch)) throw new Error('Unsupported review batch')
  const directory = `artifacts/strategy-quality-amendments/issue-513/batch-${batch}`
  const copy=read(`${directory}/reviewed-copy.json`), baseline=read(batch === 1 ? 'artifacts/strategy-quality-amendments/issue-513/canonical-quality-amendment-plan.json' : `artifacts/strategy-quality-amendments/issue-513/batch-${batch-1}/canonical-quality-amendment-plan.json`), index=read(`${FROZEN}/index.json`), history=read(REPORTS)
  // Batch 2's stopped client is held, not retried or replaced by inferred facts.
  const held = batch === 3 ? read('artifacts/strategy-quality-amendments/issue-513/batch-2/reviewed-overrides.json').blocked_clients : []
  const candidates=index.clients.filter(c=>!held.some(h=>h.client_id===c.id) && baseline.rows.filter(r=>r.client_id===c.id && r.disposition==='blocked' && r.package_receipt?.verification?.status==='confirmed').length===2 && c.strategy_status==='ready' && c.reports===3).sort((a,b)=>b.posts-a.posts || a.id.localeCompare(b.id))
  const selected=candidates.slice(0,10)
  const blocked = batch >= 2 ? copy.blocked_clients : []
  const requested = [...copy.clients,...blocked]
  if (requested.length!==10 || sha(requested.map(c=>c.client_id).sort())!==sha(selected.map(c=>c.id).sort()) || requested.some(c=>index.clients.find(i=>i.id===c.client_id)?.name!==c.client_name)) throw new Error('Reviewed copy does not match strongest ten qualifying clients')
  if (batch === 2 && (blocked.length !== 1 || blocked[0].client_name !== 'Zooz Lifestyle WFF' || blocked[0].reason !== 'MISSING_EXACT_CLIENT_RUNTIME_GUIDE' || !blocked[0].source_receipts.length)) throw new Error('Invalid bounded evidence gap')
  if (batch === 3 && blocked.length) throw new Error('Stopped Batch 3 clients require an explicit reviewed evidence-gap contract; never substitute')
  const rows=selected.filter(c=>!blocked.some(b=>b.client_id===c.id)).flatMap(c=>{
    const authored=copy.clients.find(a=>a.client_id===c.id)
    if (authored.client_name!==c.name) throw new Error('Exact dossier name mismatch')
    const sources=[sourceReceipt(`${FROZEN}/${c.file}`),sourceReceipt(`${FROZEN}/runtime-guides/${c.file}`,authored.guide_quotes),sourceReceipt(`${FROZEN}/index.json`),sourceReceipt(REPORTS)]
    const reports=history.rows.filter(r=>r.client.id===c.id && ['2026-07','2026-08','2026-09'].includes(r.month.slice(0,7)))
    if (reports.length!==3 || reports.some(r=>!r.report?.id || !r.included_posts.length || r.included_posts.some(p=>p.report_id!==r.report.id))) throw new Error(`Incomplete exact report history: ${c.name}`)
    return ['2026-09-01','2026-10-01'].map(month=>{
      const b=baseline.rows.find(r=>r.client_id===c.id && r.strategy_month===month)
      if (b.original_reviewed_provenance.source_evidence_hash!==c.evidence_hash) throw new Error('Dossier provenance mismatch')
      const core={row_id:b.row_id,client_id:c.id,client_name:c.name,strategy_month:month,
        review_state:copy.review_state,source_receipts:sources,specificity_anchors:authored.specificity_anchors,
        report_context:reports.map(r=>({month:r.month,report_id:r.report.id,post_count:r.included_posts.length,post_identity_hash:sha(r.included_posts),coverage:'Frozen identities only; September is month-to-date as of 2026-09-23. No creative winner or conversion claim.'})),
        guard:{fingerprint:b.later_guard.expected_fingerprint,revision_hash:sha(b.current_revision_receipt),strategy_hash:b.current_strategy_hash,seed_hash:sha(b.later_guard.seed_context),package_hash:b.package_hash,internal_notes:b.later_guard.internal_notes},
        patch:reviewedPatch(authored,month,b.package_receipt)}
      return {...core,reviewed_hash:sha(core)}
    })
  })
  const core={schema_version:1,issue:513,batch,mode:'ZERO_WRITE_REVIEWED_OVERRIDES',write_count:0,baseline_plan_hash:baseline.plan_hash,authored_copy_hash:sha(copy),selection:{rule:'Among blocked clients with confirmed package, ready exact dossier/guide and three frozen monthly reports, rank post identity coverage descending, then exact UUID. Coverage is not performance.',qualifying:candidates.map(c=>({client_id:c.id,name:c.name,reports:c.reports,posts:c.posts})),selected:selected.map(c=>c.id)},rows,...(batch >= 2 ? {blocked_clients:blocked} : {}),...(batch === 3 ? {held_clients:held.map(h=>({client_id:h.client_id,client_name:h.client_name,reason:h.reason}))} : {})}
  const packet={...core,packet_hash:sha(core)}
  indexOverrides(packet)
  return packet
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length>3 || (process.argv[2] && !['2','3'].includes(process.argv[2]))) throw new Error('Offline build accepts only optional batch 2 or 3; no apply mode')
  const packet=buildReviewedBatch(process.argv[2] ? Number(process.argv[2]) : 1)
  writeFileSync(resolve(ROOT,`artifacts/strategy-quality-amendments/issue-513/batch-${packet.batch}`,'reviewed-overrides.json'),`${JSON.stringify(packet,null,2)}\n`)
  console.log(JSON.stringify({packet_hash:packet.packet_hash,clients:packet.selection.selected.length,rows:packet.rows.length}))
}
