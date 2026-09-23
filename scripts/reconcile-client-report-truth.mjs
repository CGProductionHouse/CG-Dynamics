import { createClient } from '@supabase/supabase-js'
import { buildReconciliationPlan } from './lib/report-truth-reconciliation.mjs'

const apply = process.argv.includes('--apply')
const expectedHashIndex = process.argv.indexOf('--expected-plan-hash')
const expectedPlanHash = expectedHashIndex >= 0 ? process.argv[expectedHashIndex + 1] : null
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) throw new Error('SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required.')
if (apply && !expectedPlanHash) throw new Error('--apply requires --expected-plan-hash <reviewed hash>. Run the default dry run and obtain supervisor review first.')

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

const clients = await allRows('clients', 'id,name,active', query => query.eq('active', true).order('name'))
const reports = await allRows('reports', 'id,client_id,platform,period_start,period_end,status,published_at,report_title,previous_month_reflection,strategy_next_month,content_direction_next_month,ai_draft,updated_at', query => query.gte('period_start', '2026-07-01').lt('period_start', '2026-10-01'))
const reportIds = reports.map(report => report.id)
const posts = reportIds.length === 0 ? [] : await allRows('posts', 'id,report_id,meta_post_id,platform,publish_time,meta_post_type,raw,created_at', query => query.in('report_id', reportIds))
const strategies = await allRows('monthly_client_strategies', 'client_id,strategy_month,workflow_status', query => query.gte('strategy_month', '2026-07-01').lt('strategy_month', '2026-10-01'))
const plan = buildReconciliationPlan({ clients, reports, posts, strategies })

if (!apply) {
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`)
  process.exit(0)
}

if (plan.plan_hash !== expectedPlanHash) {
  throw new Error(`Reviewed plan hash mismatch. Expected ${expectedPlanHash}; current dry run is ${plan.plan_hash}. No writes were attempted.`)
}

const appliedAt = new Date().toISOString()
for (const row of plan.rows.filter(item => item.state === 'mutation_target')) {
  const report = reports.find(item => item.id === row.report_id)
  const existingAudit = report?.ai_draft && typeof report.ai_draft === 'object' ? report.ai_draft : {}
  const payload = {
    period_start: row.period_start, period_end: row.period_end, report_title: row.report_title,
    previous_month_reflection: row.previous_month_reflection, status: 'published',
    published_at: report?.published_at ?? appliedAt,
    ai_draft: { ...existingAudit, report_truth_reconciliation: {
      issue: 492, plan_hash: plan.plan_hash, source_fingerprint: row.source_fingerprint, applied_at: appliedAt,
      evidence_post_count: row.post_count, period_kind: row.month === '2026-09' ? 'month_to_date' : 'completed_month',
    } },
  }
  let update = supabase.from('reports').update(payload)
    .eq('id', row.report_id)
    .eq('client_id', row.client_id)
    .eq('status', row.expected.status)
  update = row.expected.updated_at == null ? update.is('updated_at', null) : update.eq('updated_at', row.expected.updated_at)
  update = row.expected.previous_month_reflection == null
    ? update.is('previous_month_reflection', null)
    : update.eq('previous_month_reflection', row.expected.previous_month_reflection)
  const { data, error } = await update.select('id').maybeSingle()
  if (error) throw new Error(`${row.client_name} ${row.month}: ${error.message}`)
  if (!data) throw new Error(`${row.client_name} ${row.month}: concurrent report change detected; stop and rerun the dry run. Previously completed rows remain already satisfied.`)
}
process.stdout.write(`${JSON.stringify({ ...plan, applied_at: appliedAt }, null, 2)}\n`)
