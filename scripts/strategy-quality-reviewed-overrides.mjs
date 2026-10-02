// Offline only. Reviewed copy is not approval and cannot execute an amendment.
import { readFileSync, realpathSync, existsSync } from 'node:fs'
import { resolve, relative, isAbsolute } from 'node:path'
import { createHash } from 'node:crypto'
import { sha } from './audit-monthly-strategy-approval-manifest.mjs'

const ROOT = resolve(import.meta.dirname, '..')
export const FORMAT_FIELDS = { professional_video:'professional_videos_per_month', reels:'reels_per_month', photo_content:'photo_posts_per_month', design_poster:'design_posters_per_month', animated_poster:'animated_posters_per_month' }
const PATCH_FIELDS = ['strategyDrivers','strategyGoingForward','clientActionsRequired','goldStandard','actionPlan']
const GOLD_FIELDS = ['objective','audienceAndIntent','coreMessage','formatsAndRationale','mustAvoid','channelIntegration','pillarsAndHooks','testAndChange','successSignals','nextMonthGamePlan']
export const REMEDIATION_A_CLIENTS = {
  '32bd9db3-5339-4404-825b-5a615cadec6a':'Bat Hill Royale',
  'fd16ebae-a50b-4920-afe0-94c2631f8f06':'All Around PVC',
}
export const REMEDIATION_A_EVIDENCE = 'artifacts/strategy-quality-amendments/issue-513/remediation-a/evidence.json'
// Supervisor's exact Batch 3 identity contract; creative copy stays in the artifact.
export const BATCH3_CLIENTS = {
  'afb62c53-d6d3-4ef8-9393-def88ed899d8':'C&L Innovations',
  '6b313cac-283e-48c4-9df6-ba43af2f7353':'Central Canvas',
  '8e448cf9-1534-4ba1-89a4-93e4c8b83d2f':'Bouwer & Coetzee Attorneys',
  '2b953772-e791-4dff-a278-d4dd3521f02e':'We Ar Fuels',
  '4236a60a-990f-484f-8d19-13d2f92fbe3b':'Novus Steel',
  'e1cb958e-3f68-4a77-b5ea-b471ea62bdef':'Watch Addict',
  '29a28efd-c998-45e2-a57c-4a751e779e66':'PSG Bloemfontein',
  '3404f726-a693-4b2d-8c13-c9d3dfd17bbc':'Daisy & Co',
  'a60b4d07-0a30-4f1c-8d48-7bd9ea649c97':'Supa Quick BFN',
  'e2870110-930c-4e63-b2fe-c858030f7258':'Supa Quick Centurion',
}
const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
export const BATCH4_CLIENTS = {
  '572555e0-d4d0-404a-8d67-beeeeed6a1f2':'HMHI',
  'ec643c75-51f5-4839-829f-3f5b7f48829a':'Ehrlich Park Butchery',
  '5dfdf4bd-9d94-4cc6-9dee-0e480a2234cb':'Bohemia Quick Stop',
}
// Git checkouts may use CRLF on Windows and LF in CI; content identity is LF-normalised.
export const fileHash = path => createHash('sha256').update(readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')
export function sourceReceipt(path, quotes = []) { return { path, sha256:fileHash(resolve(ROOT,path)), quotes } }
export function verifySources(receipts) {
  if (!Array.isArray(receipts) || receipts.length < 4) throw new Error('Missing reviewed source receipts')
  for (const receipt of receipts) {
    if (!receipt.path.startsWith('artifacts/client-strategy-dossiers/issue-513/') && receipt.path !== 'artifacts/report-truth/issue-501-recovery-pass-1-snapshot.json' && receipt.path !== REMEDIATION_A_EVIDENCE) throw new Error('Unapproved source path')
    const path = realpathSync(resolve(ROOT,receipt.path)), rel = relative(realpathSync(resolve(ROOT,'artifacts')),path)
    if (rel.startsWith('..') || isAbsolute(rel) || fileHash(path) !== receipt.sha256) throw new Error('Reviewed source drift')
    const text = readFileSync(path,'utf8')
    if (receipt.quotes.some(quote => !text.includes(quote))) throw new Error(`Missing exact source quotation: ${receipt.path}`)
  }
}
export function indexOverrides(packet) {
  if (!packet) return new Map()
  const {packet_hash,...core} = packet
  const blocked = packet.batch === 2 ? packet.blocked_clients : []
  const validGap = packet.batch === 2 && Array.isArray(blocked) && blocked.length === 1 && blocked[0].client_id === '0c01d90f-ba5e-4251-a597-bf3c83f990fa' && blocked[0].client_name === 'Zooz Lifestyle WFF' && blocked[0].reason === 'MISSING_EXACT_CLIENT_RUNTIME_GUIDE' && packet.rows.every(r=>r.client_id!==blocked[0].client_id)
  const stopped4 = packet.batch === 4 ? packet.blocked_clients : []
  if (!Array.isArray(stopped4) || stopped4.some(c=>BATCH4_CLIENTS[c.client_id]!==c.client_name || !['MISSING_EXACT_CLIENT_RUNTIME_GUIDE','INSUFFICIENT_EXACT_CLIENT_EVIDENCE'].includes(c.reason) || typeof c.detail!=='string' || c.detail.length<40 || sha(c.months)!==sha(['2026-09-01','2026-10-01']) || !c.source_receipts?.length) || new Set(stopped4.map(c=>c.client_id)).size!==stopped4.length) throw new Error('Invalid Batch 4 stopped-client evidence gap')
  const remediation = packet.batch === 'remediation-a'
  const expectedClients = remediation ? 2 : packet.batch === 4 ? 3-stopped4.length : validGap ? 9 : 10
  if (![1,2,3,4,'remediation-a'].includes(packet.batch) || sha(core) !== packet_hash || packet.mode !== 'ZERO_WRITE_REVIEWED_OVERRIDES' || packet.write_count !== 0 || packet.rows.length !== expectedClients*2 || new Set(packet.rows.map(r=>r.client_id)).size !== expectedClients || (packet.batch === 2 && !validGap)) throw new Error('Invalid reviewed batch packet')
  if (remediation) {
    const expected=Object.keys(REMEDIATION_A_CLIENTS).sort()
    if (sha([...new Set(packet.rows.map(r=>r.client_id))].sort())!==sha(expected) || sha([...packet.selection.selected].sort())!==sha(expected) || packet.rows.some(r=>REMEDIATION_A_CLIENTS[r.client_id]!==r.client_name) || packet.blocked_clients?.length!==0) throw new Error('Remediation A exact approved clients; no substitution')
    const evidence=JSON.parse(readFileSync(resolve(ROOT,REMEDIATION_A_EVIDENCE),'utf8'))
    const {evidence_hash,...data}=evidence
    if (sha(data)!==evidence_hash || evidence.write_count!==0 || evidence.authority!=='#513:5958838698') throw new Error('Remediation evidence hash/authority drift')
    for (const row of packet.rows) {
      if (!row.source_receipts.some(r=>r.path===REMEDIATION_A_EVIDENCE)) throw new Error('Missing remediation evidence receipt')
      const contexts=evidence.rows.filter(r=>r.client_id===row.client_id)
      if (contexts.length!==3 || sha(row.report_context)!==sha(contexts) || new Set(contexts.map(r=>r.month)).size!==3 || contexts.some(r=>!['2026-07','2026-08','2026-09'].includes(r.month))) throw new Error('Exact remediation month/context drift')
      for (const context of contexts) {
        if (context.report && (context.report.client_id!==row.client_id || context.report.period_start.slice(0,7)!==context.month)) throw new Error('Cross-client report evidence')
        if (context.posts.some(p=>p.client_id!==row.client_id || p.report_id!==context.report?.id || new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit'}).format(new Date(p.publish_time))!==context.month)) throw new Error('Cross-client/provider-period post evidence')
        if (!context.report && (context.posts.length || context.coverage!=='unavailable')) throw new Error('Missing report is unavailable, never zero performance')
      }
    }
  }
  if (packet.batch === 4) {
    const expected=Object.keys(BATCH4_CLIENTS).sort(), actual=[...new Set(packet.rows.map(r=>r.client_id)),...stopped4.map(c=>c.client_id)].sort()
    if (sha(actual)!==sha(expected) || sha([...packet.selection.selected].sort())!==sha(expected) || sha(packet.selection.qualifying.map(c=>c.client_id).sort())!==sha(expected) || packet.rows.some(r=>BATCH4_CLIENTS[r.client_id]!==r.client_name || stopped4.some(c=>c.client_id===r.client_id)) || sha(packet.held_clients)!==sha([{client_id:'0c01d90f-ba5e-4251-a597-bf3c83f990fa',client_name:'Zooz Lifestyle WFF',reason:'MISSING_EXACT_CLIENT_RUNTIME_GUIDE'}])) throw new Error('Batch 4 exact three-client/held-client contract')
    for (const gap of stopped4) verifySources(gap.source_receipts)
  }
  if (packet.batch === 3) {
    const expected=Object.keys(BATCH3_CLIENTS).sort()
    if (sha([...new Set(packet.rows.map(r=>r.client_id))].sort())!==sha(expected) || sha([...packet.selection.selected].sort())!==sha(expected) || packet.rows.some(r=>BATCH3_CLIENTS[r.client_id]!==r.client_name) || packet.blocked_clients?.length!==0 || sha(packet.held_clients)!==sha([{client_id:'0c01d90f-ba5e-4251-a597-bf3c83f990fa',client_name:'Zooz Lifestyle WFF',reason:'MISSING_EXACT_CLIENT_RUNTIME_GUIDE'}])) throw new Error('Batch 3 exact identity/held-client contract')
  }
  if ([3,4,'remediation-a'].includes(packet.batch)) {
    const index=JSON.parse(readFileSync(resolve(ROOT,'artifacts/client-strategy-dossiers/issue-513/index.json'),'utf8'))
    for (const row of packet.rows) {
      const client=index.clients.find(c=>c.id===row.client_id)
      const paths=row.source_receipts.map(r=>r.path)
      if (!paths.includes(`artifacts/client-strategy-dossiers/issue-513/${client.file}`) || !paths.includes(`artifacts/client-strategy-dossiers/issue-513/runtime-guides/${client.file}`) || row.source_receipts.find(r=>r.path.includes('/runtime-guides/'))?.quotes.length<3) throw new Error(`Batch ${packet.batch} exact-client source contract`)
    }
  }
  if (validGap) {
    if (sha(blocked[0].months)!==sha(['2026-09-01','2026-10-01']) || existsSync(resolve(ROOT,'artifacts/client-strategy-dossiers/issue-513/runtime-guides/zooz-lifestyle-wff.md'))) throw new Error('Evidence gap changed; re-review required')
    verifySources(blocked[0].source_receipts)
  }
  const result = new Map(), signatures = new Set()
  for (const row of packet.rows) {
    const key = `${row.client_id}:${row.strategy_month}`
    if (result.has(key) || !['2026-09-01','2026-10-01'].includes(row.strategy_month) || ['Piek Group','Neshora Oxygen'].includes(row.client_name)) throw new Error('Invalid exact override identity')
    const {reviewed_hash,...data} = row
    if (sha(data) !== reviewed_hash) throw new Error('Reviewed row hash mismatch')
    verifySources(row.source_receipts)
    const signature = sha(row.patch.goldStandard)
    if (signatures.has(signature)) throw new Error('Duplicated monthly review')
    signatures.add(signature); result.set(key,row)
  }
  for (const row of packet.rows) {
    const other = result.get(`${row.client_id}:${row.strategy_month==='2026-09-01'?'2026-10-01':'2026-09-01'}`)
    if (!other) throw new Error('Missing paired month review')
    for (const field of ['objective','coreMessage','pillarsAndHooks','testAndChange','nextMonthGamePlan']) {
      const strip = s => norm(s).replace(/september|october|2026|review|plan/g,'').replace(/\s+/g,' ').trim()
      if (strip(row.patch.goldStandard[field]) === strip(other.patch.goldStandard[field])) throw new Error(`Rename-only monthly copy: ${field}`)
    }
  }
  return result
}
export function validateOverride(current, row, revision) {
  const stop = []
  if (row.row_id !== current.id || row.client_id !== current.client_id || row.client_name !== current.client_name || row.strategy_month !== current.strategy_month) stop.push('REVIEWED_OVERRIDE_IDENTITY_DRIFT')
  const g = row.guard
  if (g.fingerprint !== sha(current) || g.revision_hash !== sha(revision ?? null) || g.strategy_hash !== sha(current.strategy_data) || g.seed_hash !== sha(current.seed_context) || g.package_hash !== sha(current.package_settings) || g.internal_notes !== current.internal_notes) stop.push('REVIEWED_OVERRIDE_LIVE_DRIFT')
  if (Object.keys(row.patch).sort().join() !== [...PATCH_FIELDS].sort().join() || Object.keys(row.patch.goldStandard).sort().join() !== [...GOLD_FIELDS].sort().join() || GOLD_FIELDS.some(f=>typeof row.patch.goldStandard[f] !== 'string' || row.patch.goldStandard[f].length < 40)) stop.push('REVIEWED_OVERRIDE_CONTRACT')
  const creative = norm(['objective','coreMessage','pillarsAndHooks'].map(f=>row.patch.goldStandard[f]).join(' '))
  if (/\bfrozen\b|\bpost identit(?:y|ies)\b|\breviewed_hash\b/i.test(JSON.stringify(row.patch))) stop.push('REVIEWED_OVERRIDE_INTERNAL_COPY')
  if (claimSafetyStops(row.patch).length) stop.push('REVIEWED_OVERRIDE_UNSUPPORTED_CLAIM')
  if (row.specificity_anchors.length < 3 || row.specificity_anchors.filter(a=>creative.includes(norm(a))).length < 2) stop.push('REVIEWED_OVERRIDE_NOT_CLIENT_SPECIFIC')
  const actions = row.patch.actionPlan
  if (Object.keys(actions).sort().join() !== [...Object.keys(FORMAT_FIELDS),'campaign_recommendation'].sort().join()) stop.push('REVIEWED_OVERRIDE_ACTION_KEYS')
  for (const [action,field] of Object.entries(FORMAT_FIELDS)) {
    const quantity = current.package_settings?.[field], enabled = Number.isInteger(quantity) && quantity>0, value=actions[action]
    if (!value || value.enabled!==enabled || !Array.isArray(value.items) || (enabled ? value.items.length<1 || value.items.length>quantity : value.items.length>0 || value.notes!=='')) stop.push(`REVIEWED_OVERRIDE_PACKAGE:${field}`)
  }
  if (actions.campaign_recommendation?.enabled!==false || actions.campaign_recommendation?.items?.length || actions.campaign_recommendation?.notes!=='') stop.push('REVIEWED_OVERRIDE_CAMPAIGN')
  return stop
}

// Conservative offline claim gate, not a replacement for human/source review.
// Examine affirmative creative statements, not the separate must-avoid instructions.
export function claimSafetyStops(patch) {
  const content = {drivers:patch.strategyDrivers,going:patch.strategyGoingForward,
    gold:Object.fromEntries(Object.entries(patch.goldStandard).filter(([key])=>key!=='mustAvoid')),
    items:Object.values(patch.actionPlan).flatMap(a=>a.items)}
  const strings = value => typeof value==='string' ? [value] : value && typeof value==='object' ? Object.values(value).flatMap(strings) : []
  // Never discard a whole sentence just because it starts with a negation: an
  // unsupported affirmative promise could follow it in the same sentence.
  // Put prohibited-claim explanations in mustAvoid, not affirmative creative.
  const clauses = strings(content).flatMap(s=>s.split(/[.!?;]\s+/))
  const prohibited = /\b(?:guaranteed (?:approval|savings|returns|safety)|(?:lowest|best) (?:interest )?rate|(?:we|Peyper) (?:guarantee|approve)|cures?\b|treats? (?:dry eye|keratoconus)|OCT (?:scans?|services?)|retinal tomography|in stock now|same.day lenses|zero blind spots|failure.proof|every (?:Friday|Saturday)|sponsored by|Windhoek|Rundu)\b|\b\d{1,2} (?:October|November)\b|\bR\s*\d+|\b\d+% (?:ROI|savings|return)|\b2 for 1\b/i
  return clauses.filter(s=>prohibited.test(s))
}
export function reviewedPatch(client, month, pkg) {
  const m=client.months[month]
  if (!m) throw new Error('Missing exact month')
  const goldStandard=Object.fromEntries(GOLD_FIELDS.map(f=>[f,m[f] ?? client[f]]))
  const actionPlan=Object.fromEntries(Object.entries(FORMAT_FIELDS).map(([action,field])=>{
    const enabled=Number.isInteger(pkg[field]) && pkg[field]>0
    const items=m.items[action] ?? []
    if ((!enabled && items.length) || items.length > (pkg[field] ?? 0)) throw new Error(`Package inflation: ${client.client_name}/${action}`)
    return [action,{enabled,items,notes:enabled?`Monthly capacity: ${pkg[field]}. These are proposed creative angles within that capacity, not booked or scheduled posts.`:''}]
  }))
  actionPlan.campaign_recommendation={enabled:false,items:[],notes:''}
  return {strategyDrivers:[m.objective,m.pillarsAndHooks],strategyGoingForward:m.coreMessage,clientActionsRequired:m.clientActionsRequired,goldStandard,actionPlan}
}
