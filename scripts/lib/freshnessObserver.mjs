import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { microsoftFreshnessEvidence, metaFleetFreshnessEvidence } from '../../src/lib/dailyDynamicsFreshness.ts'
import { resolveMicrosoftPlanMapping } from '../../src/lib/microsoftImportMap.ts'
import { metaTerminalAccessBlocks } from '../../supabase/functions/_shared/metaFleetTerminalBackoff.ts'

export const PROJECT = 'ehtjfntukiwbgptqgbzy'
export const VERSION = 1
export const MAX_ROWS = 20_000
export const FUNCTIONS = [
  {slug:'microsoft-transition-sync',id:'97f981ed-4172-47bd-bbbc-b88c0b91fe23',verify_jwt:true},
  {slug:'background-worker',id:'422b392c-42f0-4929-af5b-87fd75d25402',verify_jwt:false},
  {slug:'meta-connection-status',id:'b8602ce4-2bba-4afa-b570-36e27b0e414e',verify_jwt:false},
]
const sqlTemplate = readFileSync(new URL('../freshness-observer.sql', import.meta.url), 'utf8')
const arrays = ['jobs','sources','runs','mirror_observations','planner_plan_guards','protected','assets','checkpoints','facts','items','batches','ticks','scheduler','platform_runs']
const scopes = ['monthly_deliverables','native_planner','native_calendar','july_manual_apply']
const shaPattern = /^[a-f0-9]{64}$/
const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
export const canonical = value => JSON.stringify(value, (_, v) => v && !Array.isArray(v) && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b))) : v)
export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex')
export function windowOptions(from, to) {
  for (const v of [from,to]) if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/.test(v ?? '') || !iso(v) || new Date(v).toISOString() !== v.replace('Z','.000Z')) throw new Error('INVALID_WINDOW')
  const minutes = (Date.parse(to)-Date.parse(from))/60_000
  if (minutes < 10 || minutes > 60) throw new Error('WINDOW_MUST_BE_10_TO_60_MINUTES')
  return { from,to,minutes }
}
export function databaseQuery(from, to) {
  windowOptions(from,to)
  return sqlTemplate.replace('{{FROM}}',from).replace('{{TO}}',to)
}
export const logsQuery = `select source, log_attributes['function_id'] as function_id,
 count() as events,
 countIf(log_attributes['response.status_code'] = '546') as http_546,
 countIf(match(event_message, '(?i)CPU Time exceeded') or log_attributes['reason'] = 'CPUTime') as cpu_exceeded,
 countIf(log_attributes['response.status_code'] != '' and toInt32OrZero(log_attributes['response.status_code']) >= 500) as http_5xx
 from logs where source in ('function_edge_logs','function_logs')
 and log_attributes['function_id'] in ('97f981ed-4172-47bd-bbbc-b88c0b91fe23','422b392c-42f0-4929-af5b-87fd75d25402','b8602ce4-2bba-4afa-b570-36e27b0e414e')
 group by source,function_id order by source,function_id limit 10`

function validateEvidence(db, window) {
  if (!db || db.unfiltered !== true || !iso(db.observed_at)) throw new Error('DB_ACCESS_OR_SNAPSHOT_UNVERIFIED')
  if (!['active','paused','completed'].includes(db.microsoft_lifecycle?.transition_status)) throw new Error('MICROSOFT_LIFECYCLE_UNAVAILABLE')
  if (Date.parse(window.to)>Date.parse(db.observed_at) || Date.parse(db.window?.from)!==Date.parse(window.from) || Date.parse(db.window?.to)!==Date.parse(window.to)) throw new Error('DB_WINDOW_MISMATCH')
  for (const key of arrays) if (!Array.isArray(db[key]) || db[key].length>MAX_ROWS) throw new Error('MISSING_OR_TRUNCATED_EVIDENCE')
  if (db.ticks.length !== window.minutes || db.scheduler.length!==1) throw new Error('INCOMPLETE_SCHEDULER_EVIDENCE')
  if (db.protected.length!==scopes.length || scopes.some(s => db.protected.filter(g => g.scope===s && Number.isSafeInteger(g.count) && g.count>=0 && shaPattern.test(g.hash)).length!==1)) throw new Error('PROTECTED_FINGERPRINT_MISSING')
  if (db.sources.some(s => !Number.isSafeInteger(s.record_count) || s.record_count<0 || !Number.isSafeInteger(s.records_count))) throw new Error('INVALID_SOURCE_COUNTS')
}

/** Persist only structured observations; no raw errors, bodies, cursors or tokens. */
function rejectSecrets(value) {
  if (value && typeof value === 'object') for (const [key,v] of Object.entries(value)) {
    if (/token|secret|password|authorization|raw_snapshot|provenance|request\.url/i.test(key)) throw new Error('UNSAFE_RECEIPT_FIELD')
    rejectSecrets(v)
  }
  if (typeof value==='string' && /Bearer\s|access_token=|sbp_[a-z0-9]|eyJ[a-zA-Z0-9_-]+\./.test(value)) throw new Error('UNSAFE_RECEIPT_VALUE')
}

export function projectEvidence(db) {
  const job = db.jobs[0] ?? null
  const sources = db.sources.filter(s => s.job_id===job?.id)
  const linked = db.runs.filter(r => r.trigger_type==='agent' && r.preview_job_id===job?.id).sort((a,b) => Date.parse(b.created_at)-Date.parse(a.created_at) || b.id.localeCompare(a.id))[0] ?? null
  const successful = db.runs.filter(r => r.trigger_type==='agent' && r.status==='completed' && !r.has_error && r.failed===0 && Number.isSafeInteger(r.applied) && Number.isSafeInteger(r.skipped) && iso(r.applied_at) && Date.parse(r.applied_at)<=Date.parse(db.observed_at)
    && Array.isArray(r.source_completeness) && r.source_completeness.filter(s=>s.required!==false).length===6
    && r.source_completeness.filter(s=>s.required!==false).every(s=>s.complete===true && !s.has_error && Number.isSafeInteger(s.recordCount)))
    .sort((a,b)=>Date.parse(b.applied_at)-Date.parse(a.applied_at))[0] ?? null
  const covered = sources.filter(s=>s.required).length===6 && sources.filter(s=>s.required).every(s=>s.complete && !s.has_error && !s.has_cursor && s.records_count===s.record_count && s.pending_details===0)
  const microsoft = microsoftFreshnessEvidence({ now:db.observed_at,connected:db.microsoft_lifecycle.transition_status==='active',lastJobStartedAt:job?.created_at ?? null,lastJobCompletedAt:job?.exported_at ?? null,
    lastSuccessfulReconciliationAt:successful?.applied_at ?? null,applyStatus:linked?.status ?? null,
    requiredSources:covered ? sources.filter(s=>s.required).map(s=>({name:s.source_name,complete:true,error:null})) : [{name:'Six required sources not verified',complete:false,error:null}],
    recoveryInProgress:job?.status==='running' || linked?.status==='applying' })
  // An old success cannot certify the newest fetch-only job as applied.
  if (microsoft.verdict==='PASS' && (!linked || linked.status!=='completed' || linked.id!==successful?.id)) { microsoft.verdict='PARTIAL'; microsoft.blocker='Latest job has no verified terminal automatic APPLY.' }
  const inventory = db.assets.map(a=>({clientId:a.client_id,assetId:a.id,facebookMapped:!!a.facebook_page_id,instagramMapped:!!a.instagram_account_id}))
  const blocked = db.assets.flatMap(a=>[...new Set(db.items.filter(i=>i.asset_id===a.id && i.client_id===a.client_id).map(i=>i.month))].flatMap(month=>metaTerminalAccessBlocks({...a,meta_asset_sync_checkpoints:db.checkpoints.filter(c=>c.asset_id===a.id && c.client_id===a.client_id)},month,
    db.items.map(i=>({...i,meta_sync_batches:{summary:{via:i.via}}})),db.observed_at,a.last_connected_at).map(b=>({...b,assetId:a.id,clientId:a.client_id,month}))))
  const checkpoints = inventory.flatMap(a=>['facebook','instagram'].filter(p=>a[`${p}Mapped`]).map(platform=>{
    const c=db.checkpoints.find(c=>c.asset_id===a.assetId && c.client_id===a.clientId && c.platform===platform)
    const block=blocked.find(b=>b.assetId===a.assetId && b.platform===platform)
    return {clientId:a.clientId,assetId:a.assetId,platform,mapped:true,lastAttemptedAt:c?.last_attempted_at ?? null,lastSuccessfulAt:c?.last_successful_at ?? null,lastSuccessfulMonth:c?.last_successful_month ?? null,
      highWatermarkAt:c?.high_watermark_at ?? null,nextDueAt:c?.next_due_at ?? null,status:c?.last_status ?? null,healthState:c?.last_health_state ?? null,
      errorCode:block?.blocker ?? (c?.has_error ? 'Checkpoint failure (details withheld)' : null),retrying:db.items.some(i=>i.asset_id===a.assetId && i.client_id===a.clientId && ['queued','running'].includes(i.status) && !['complete','not_applicable'].includes(i[`${platform}_sync_state`]))}
  }))
  const mirrors=db.mirror_observations.filter(m=>m.source_type==='outlook_event' || resolveMicrosoftPlanMapping(m.source_name).target==='planner')
  return { microsoft:{...microsoft,jobId:job?.id ?? null,applyRunId:linked?.id ?? null,coverageComplete:covered,fetchIsNotApply:true},
    mirrors:{basis:'Stored fetched records, NOT a new Microsoft upstream read',observations:mirrors,mismatches:mirrors.filter(m=>m.source_type==='planner_task' ? m.planner_status!=='done' : m.calendar_status!=='cancelled')},
    meta:{...metaFleetFreshnessEvidence(checkpoints,db.observed_at,inventory,true),blocked,
      emptyFleetBatches:db.batches.filter(b=>b.via==='fleet_freshness' && b.actual_items===0).map(b=>b.id),
      consecutiveDispatchMinutes:db.ticks.every(t=>t.dispatches>0),ticks:db.ticks},
    uiComparison:'Canonical evidence only; no diagnostic status endpoint invoked' }
}

export function makeReceipt({db,logs,functions,from,to,sourceSha,phase}) {
  const window=windowOptions(from,to)
  if (!/^[a-f0-9]{40}$/.test(sourceSha ?? '') || !['pre','post'].includes(phase)) throw new Error('INVALID_RECEIPT_PIN')
  validateEvidence(db,window)
  if (!Array.isArray(functions) || functions.length!==3 || FUNCTIONS.some(f=>functions.filter(r=>r.slug===f.slug && r.id===f.id && r.verify_jwt===f.verify_jwt && Number.isSafeInteger(r.version) && r.version>0 && shaPattern.test(r.ezbr_sha256)).length!==1)) throw new Error('FUNCTION_IDENTITY_OR_AUTH_DRIFT')
  if (!Array.isArray(logs) || logs.length>10 || logs.some(r=>!FUNCTIONS.some(f=>f.id===r.function_id) || !['function_edge_logs','function_logs'].includes(r.source) || !['events','http_546','cpu_exceeded','http_5xx'].every(k=>(typeof r[k]==='number' || typeof r[k]==='string' && /^\d+$/.test(r[k])) && Number.isSafeInteger(Number(r[k])) && Number(r[k])>=0))) throw new Error('LOG_EVIDENCE_UNAVAILABLE')
  rejectSecrets(db); rejectSecrets(logs); rejectSecrets(functions)
  const body=structuredClone({version:VERSION,project:PROJECT,sourceSha,phase,window,queryHash:hash(databaseQuery(from,to)),logsQueryHash:hash(logsQuery),db,logs,functions,projection:projectEvidence(db),
    limits:{maxRows:MAX_ROWS,logWindowOnly:true,logsEmptyMeansNoObservedEventsNotRuntimePass:true},readOnly:true})
  return {...body,receiptHash:hash(body)}
}
export function verifyReceipt(receipt) {
  const {receiptHash,...body}=receipt ?? {}
  if (receiptHash!==hash(body) || receipt?.project!==PROJECT || receipt?.version!==VERSION || receipt?.readOnly!==true) throw new Error('INVALID_RECEIPT_HASH_OR_IDENTITY')
  const recreated=makeReceipt({...body,db:body.db,logs:body.logs,from:body.window.from,to:body.window.to})
  if (recreated.receiptHash!==receiptHash) throw new Error('RECEIPT_CONTRACT_DRIFT')
  return receipt
}
export function compareReceipts(before,after) {
  verifyReceipt(before); verifyReceipt(after)
  if (before.phase!=='pre' || after.phase!=='post' || Date.parse(after.db.observed_at)<=Date.parse(before.db.observed_at) || before.window.minutes!==after.window.minutes || Date.parse(after.window.from)<Date.parse(before.window.to)) throw new Error('INCOMPARABLE_RECEIPTS')
  const guards=before.db.protected.map(b=>({scope:b.scope,unchanged:after.db.protected.some(a=>a.scope===b.scope && a.count===b.count && a.hash===b.hash)}))
  const protectedPlans=[...new Set(before.db.sources.filter(s=>s.source_type==='planner_plan' && resolveMicrosoftPlanMapping(s.source_name).target==='client_schedule').map(s=>s.source_id))]
  for (const plan of protectedPlans) guards.push({scope:`protected_planner_plan:${plan}`,unchanged:canonical(before.db.planner_plan_guards.find(g=>g.plan_id===plan) ?? null)===canonical(after.db.planner_plan_guards.find(g=>g.plan_id===plan) ?? null)})
  const key=f=>canonical([f.client_id,f.asset_id,f.platform,f.period_month,f.metric_key,f.comparable_group])
  const afterFacts=new Map(after.db.facts.map(f=>[key(f),f]))
  const ageChanges=before.db.facts.filter(b=>['complete','valid_zero'].includes(b.availability)).flatMap(b=>{
    const a=afterFacts.get(key(b))
    if (!a || a.verified_at===b.verified_at) return []
    const run=after.db.platform_runs.find(r=>r.id===a.sync_run_id && r.client_id===a.client_id && r.asset_id===a.asset_id && r.platform===a.platform)
    return [{id:b.id,before:b.verified_at,after:a.verified_at,matchingTerminalRun:!!run && ['success','partial'].includes(run.status) && iso(run.finished_at) && run.period_month===a.period_month}]
  })
  const factRegressions=before.db.facts.filter(b=>['complete','valid_zero'].includes(b.availability)).flatMap(b=>{
    const a=afterFacts.get(key(b))
    return !a || !['complete','valid_zero'].includes(a.availability) || !iso(a.verified_at) || Date.parse(a.verified_at)<Date.parse(b.verified_at)
      || a.verified_at===b.verified_at && (a.value!==b.value || a.source_metric!==b.source_metric) ? [b.id] : []
  })
  const watermarks=before.db.checkpoints.filter(c=>c.high_watermark_at).filter(b=>{
    const a=after.db.checkpoints.find(a=>a.asset_id===b.asset_id && a.client_id===b.client_id && a.platform===b.platform)
    return !a?.high_watermark_at || Date.parse(a.high_watermark_at)<Date.parse(b.high_watermark_at)
  }).map(c=>({assetId:c.asset_id,platform:c.platform}))
  return {beforeHash:before.receiptHash,afterHash:after.receiptHash,guards,protectedUnchanged:guards.every(g=>g.unchanged),factRegressions,factAgeChanges:ageChanges,unverifiedFactAgeChanges:ageChanges.filter(c=>!c.matchingTerminalRun),watermarkRegressions:watermarks,
    schedulerUnchanged:canonical(before.db.scheduler)===canonical(after.db.scheduler),
    runtimeAfter:after.logs,microsoft:after.projection.microsoft,meta:after.projection.meta,
    acceptance:'Evidence comparison only; not deployment authorization or blanket launch PASS. Changed rows require attribution/review, never automatic repair.'}
}

/** Three fixed reads. No custom URL, SQL, credential recovery or retries. */
export async function capture({from,to,sourceSha,phase,accessToken,fetchImpl=fetch}) {
  const query=databaseQuery(from,to)
  if (!accessToken || /\s/.test(accessToken)) throw new Error('READ_ONLY_MANAGEMENT_ACCESS_REQUIRED')
  const headers={Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'}
  async function request(url,options) {
    let response
    try { response=await fetchImpl(url,{...options,headers,redirect:'error',signal:AbortSignal.timeout(30_000)}) } catch { throw new Error('READ_ONLY_TRANSPORT_FAILED') }
    if (!response.ok) throw new Error('READ_ONLY_ACCESS_OR_SCHEMA_FAILED')
    try { return await response.json() } catch { throw new Error('INVALID_READ_RESPONSE') }
  }
  const rows=await request(`https://api.supabase.com/v1/projects/${PROJECT}/database/query/read-only`,{method:'POST',body:JSON.stringify({query})})
  if (!Array.isArray(rows) || rows.length!==1 || !rows[0].evidence) throw new Error('INVALID_DB_ENVELOPE')
  validateEvidence(rows[0].evidence,windowOptions(from,to))
  const url=new URL(`https://api.supabase.com/v1/projects/${PROJECT}/analytics/endpoints/logs`)
  url.searchParams.set('sql',logsQuery); url.searchParams.set('iso_timestamp_start',from); url.searchParams.set('iso_timestamp_end',to)
  const response=await request(url.href,{method:'GET'})
  if (response.error || !Array.isArray(response.result)) throw new Error('LOG_EVIDENCE_UNAVAILABLE')
  const inventory=await request(`https://api.supabase.com/v1/projects/${PROJECT}/functions`,{method:'GET'})
  if (!Array.isArray(inventory)) throw new Error('FUNCTION_INVENTORY_UNAVAILABLE')
  const functions=inventory.filter(f=>FUNCTIONS.some(expected=>expected.slug===f.slug)).map(f=>({slug:f.slug,id:f.id,version:f.version,verify_jwt:f.verify_jwt,ezbr_sha256:f.ezbr_sha256}))
  return makeReceipt({db:rows[0].evidence,logs:response.result,functions,from,to,sourceSha,phase})
}
