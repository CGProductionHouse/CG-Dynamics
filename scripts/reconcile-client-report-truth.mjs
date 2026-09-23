import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { buildReconciliationPlan, buildReviewedSnapshot, sha256, stableJson, summarizeReviewedSnapshot, verifyReviewedSnapshot } from './lib/report-truth-reconciliation.mjs'

function option(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

const createSnapshotPath = option('--create-snapshot')
const applySnapshotPath = option('--apply-snapshot')
const verifySnapshotPath = option('--verify-snapshot')
const expectedSnapshotHash = option('--expected-snapshot-hash')
if (process.argv.includes('--apply') || process.argv.includes('--expected-plan-hash')) {
  throw new Error('Live-plan apply is disabled. Create and approve an immutable snapshot, then use --apply-snapshot with --expected-snapshot-hash.')
}
const modes = [createSnapshotPath, applySnapshotPath, verifySnapshotPath].filter(Boolean)
if (modes.length > 1) throw new Error('Choose only one snapshot mode.')
if (applySnapshotPath && !expectedSnapshotHash) throw new Error('--apply-snapshot requires --expected-snapshot-hash <reviewed hash>.')

if (verifySnapshotPath) {
  const snapshot = JSON.parse(readFileSync(resolve(verifySnapshotPath), 'utf8'))
  const actualHash = verifyReviewedSnapshot(snapshot, expectedSnapshotHash)
  process.stdout.write(`${JSON.stringify({ integrity_verified: true, snapshot_hash: actualHash, ...summarizeReviewedSnapshot(snapshot) }, null, 2)}\n`)
  process.exit(0)
}

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) throw new Error('SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required.')

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
async function allRows(table, select, configure = query => query) {
  const pageSize = 1000
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await configure(supabase.from(table).select(select)).range(from, from + pageSize - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) return rows
  }
}

async function loadLiveSources() {
  const clients = await allRows('clients', 'id,name,active', query => query.eq('active', true).order('name'))
  const reports = await allRows('reports', 'id,client_id,platform,period_start,period_end,status,published_at,report_title,previous_month_reflection,strategy_next_month,content_direction_next_month,ai_draft,updated_at', query => query.gte('period_start', '2026-07-01').lt('period_start', '2026-10-01'))
  const reportIds = reports.map(report => report.id)
  const posts = reportIds.length === 0 ? [] : await allRows('posts', 'id,report_id,meta_post_id,platform,publish_time,meta_post_type,raw,created_at', query => query.in('report_id', reportIds))
  const strategies = await allRows('monthly_client_strategies', 'client_id,strategy_month,workflow_status', query => query.gte('strategy_month', '2026-07-01').lt('strategy_month', '2026-10-01'))
  return { clients, reports, posts, strategies }
}

if (createSnapshotPath) {
  const snapshotCutoff = new Date().toISOString()
  const sources = await loadLiveSources()
  const snapshot = buildReviewedSnapshot({ ...sources, snapshotCutoff })
  const target = resolve(createSnapshotPath)
  if (existsSync(target)) throw new Error(`Snapshot artifact already exists and is immutable: ${target}`)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx' })
  verifyReviewedSnapshot(JSON.parse(readFileSync(target, 'utf8')), snapshot.snapshot_hash)
  process.stdout.write(`${JSON.stringify({ artifact_path: target, integrity_verified: true, ...summarizeReviewedSnapshot(snapshot) }, null, 2)}\n`)
  process.exit(0)
}

if (!applySnapshotPath) {
  const sources = await loadLiveSources()
  const plan = buildReconciliationPlan(sources)
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`)
  process.exit(0)
}

const snapshot = JSON.parse(readFileSync(resolve(applySnapshotPath), 'utf8'))
verifyReviewedSnapshot(snapshot, expectedSnapshotHash)
const safeRows = snapshot.rows.filter(row => row.state === 'mutation_target' || row.state === 'already_satisfied')
const clientIds = [...new Set(safeRows.map(row => row.client.id))]
const reportIds = safeRows.map(row => row.report.id)
const { data: liveClients, error: clientsError } = await supabase.from('clients').select('id,name,active').in('id', clientIds)
if (clientsError) throw new Error(`clients preflight: ${clientsError.message}`)
const { data: liveReports, error: reportsError } = await supabase.from('reports').select('id,client_id,platform,period_start,period_end,status,published_at,report_title,previous_month_reflection,strategy_next_month,content_direction_next_month,ai_draft,updated_at').in('id', reportIds)
if (reportsError) throw new Error(`reports preflight: ${reportsError.message}`)
const { data: canonicalReports, error: duplicateError } = await supabase.from('reports').select('id,client_id,period_start,platform').in('client_id', clientIds).gte('period_start', '2026-07-01').lt('period_start', '2026-10-01').is('platform', null)
if (duplicateError) throw new Error(`duplicate preflight: ${duplicateError.message}`)

function expectedReportVersion(report) {
  const fields = ['id', 'client_id', 'platform', 'period_start', 'period_end', 'status', 'report_title', 'previous_month_reflection', 'strategy_next_month', 'content_direction_next_month', 'updated_at']
  return sha256(stableJson(Object.fromEntries(fields.map(field => [field, report[field] ?? null]))))
}
function satisfied(row, report) {
  return report.status === 'published' && report.client_id === row.client.id && report.platform == null
    && report.period_start === row.derived.period_start && report.period_end === row.derived.period_end
    && report.report_title === row.derived.report_title
    && (report.previous_month_reflection?.trim() || '') === row.derived.previous_month_reflection
    && (report.strategy_next_month ?? null) === row.report.strategy_next_month
    && (report.content_direction_next_month ?? null) === row.report.content_direction_next_month
}

const preflight = []
for (const row of safeRows) {
  const client = liveClients?.find(item => item.id === row.client.id)
  const report = liveReports?.find(item => item.id === row.report.id)
  if (!client || client.active !== true || client.name !== row.client.name) throw new Error(`${row.client.name} ${row.month}: client identity/active-state drift. No writes were attempted.`)
  if (!report || report.client_id !== row.client.id || report.platform != null || report.period_start?.slice(0, 7) !== row.month) throw new Error(`${row.client.name} ${row.month}: report identity drift. No writes were attempted.`)
  const duplicates = canonicalReports?.filter(item => item.client_id === row.client.id && item.period_start?.slice(0, 7) === row.month) ?? []
  if (duplicates.length !== 1 || duplicates[0].id !== row.report.id) throw new Error(`${row.client.name} ${row.month}: duplicate or replaced canonical report. No writes were attempted.`)
  const isSatisfied = satisfied(row, report)
  if (!isSatisfied && expectedReportVersion(report) !== row.report.source_version) throw new Error(`${row.client.name} ${row.month}: report source-version drift. No writes were attempted.`)
  preflight.push({ row, report, isSatisfied })
}

const appliedAt = new Date().toISOString()
let applied = 0
for (const item of preflight.filter(item => !item.isSatisfied)) {
  const { row, report } = item
  const existingAudit = report?.ai_draft && typeof report.ai_draft === 'object' ? report.ai_draft : {}
  const payload = {
    period_start: row.derived.period_start, period_end: row.derived.period_end, report_title: row.derived.report_title,
    previous_month_reflection: row.derived.previous_month_reflection, status: 'published',
    published_at: report?.published_at ?? appliedAt,
    ai_draft: { ...existingAudit, report_truth_reconciliation: {
      issue: 501, snapshot_hash: snapshot.snapshot_hash, snapshot_cutoff: snapshot.snapshot_cutoff, applied_at: appliedAt,
      evidence_post_count: row.derived.post_count, period_kind: row.month === '2026-09' ? 'month_to_date' : 'completed_month',
    } },
  }
  let update = supabase.from('reports').update(payload)
    .eq('id', row.report.id).eq('client_id', row.client.id).is('platform', null)
    .eq('period_start', row.report.period_start).eq('status', row.report.status)
  update = row.report.updated_at == null ? update.is('updated_at', null) : update.eq('updated_at', row.report.updated_at)
  update = row.report.previous_month_reflection == null
    ? update.is('previous_month_reflection', null)
    : update.eq('previous_month_reflection', row.report.previous_month_reflection)
  const { data, error } = await update.select('id').maybeSingle()
  if (error) throw new Error(`${row.client.name} ${row.month}: ${error.message}`)
  if (!data) throw new Error(`${row.client.name} ${row.month}: concurrent report change detected; stop and rerun this same frozen snapshot. Previously completed rows remain already satisfied.`)
  applied += 1
}
process.stdout.write(`${JSON.stringify({ snapshot_hash: snapshot.snapshot_hash, snapshot_cutoff: snapshot.snapshot_cutoff, applied_at: appliedAt, applied, already_satisfied: preflight.length - applied, ...summarizeReviewedSnapshot(snapshot) }, null, 2)}\n`)
