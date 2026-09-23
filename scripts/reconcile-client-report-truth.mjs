import { createClient } from '@supabase/supabase-js'
import { buildReconciliationPlan } from './lib/report-truth-reconciliation.mjs'

const apply = process.argv.includes('--apply')
const confirmed = process.argv.includes('--confirm-reviewed-plan')
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) throw new Error('SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required.')
if (apply && !confirmed) throw new Error('--apply requires --confirm-reviewed-plan. Run the default dry run and obtain supervisor review first.')

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
const reports = await allRows('reports', 'id,client_id,platform,period_start,period_end,status,published_at,report_title,strategy_reflection,strategy_next_month,content_direction_next_month,ai_draft', query => query.gte('period_start', '2026-07-01').lt('period_start', '2026-10-01'))
const reportIds = reports.map(report => report.id)
const posts = reportIds.length === 0 ? [] : await allRows('posts', 'id,report_id,meta_post_id,platform,publish_time,meta_post_type,raw,created_at', query => query.in('report_id', reportIds))
const strategies = await allRows('monthly_client_strategies', 'client_id,strategy_month,workflow_status', query => query.gte('strategy_month', '2026-07-01').lt('strategy_month', '2026-10-01'))
const plan = buildReconciliationPlan({ clients, reports, posts, strategies })

if (!apply) {
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`)
  process.exit(0)
}

const appliedAt = new Date().toISOString()
for (const row of plan.rows.filter(item => item.state === 'safe_to_publish')) {
  const report = reports.find(item => item.id === row.report_id)
  const existingAudit = report?.ai_draft && typeof report.ai_draft === 'object' ? report.ai_draft : {}
  const payload = {
    period_start: row.period_start, period_end: row.period_end, report_title: row.report_title,
    strategy_reflection: row.strategy_reflection, status: 'published',
    published_at: report?.published_at ?? appliedAt,
    ai_draft: { ...existingAudit, report_truth_reconciliation: {
      issue: 492, fingerprint: row.fingerprint, applied_at: appliedAt,
      evidence_post_count: row.post_count, period_kind: row.month === '2026-09' ? 'month_to_date' : 'completed_month',
    } },
  }
  const { error } = await supabase.from('reports').update(payload).eq('id', row.report_id).eq('client_id', row.client_id)
  if (error) throw new Error(`${row.client_name} ${row.month}: ${error.message}`)
}
process.stdout.write(`${JSON.stringify({ ...plan, applied_at: appliedAt }, null, 2)}\n`)
