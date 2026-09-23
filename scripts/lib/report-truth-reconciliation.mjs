const TARGET_MONTHS = ['2026-07', '2026-08', '2026-09']
const GENERIC_STRATEGY_PATTERNS = [
  /increase engagement/i,
  /build brand awareness/i,
  /post consistently/i,
  /grow (?:the )?(?:brand|audience|following)/i,
]

function monthBounds(month) {
  const [year, monthNumber] = month.split('-').map(Number)
  const end = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10)
  return { start: `${month}-01`, end }
}

function isoDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

function postMonth(post) {
  return isoDate(post.publish_time)?.slice(0, 7) ?? null
}

function formatType(value) {
  const normalized = String(value ?? 'unspecified').trim().toLowerCase().replaceAll('_', ' ')
  return normalized || 'unspecified'
}

function evidenceTimestamp(post) {
  const raw = post.raw && typeof post.raw === 'object' ? post.raw : {}
  const engagement = raw.engagement_evidence && typeof raw.engagement_evidence === 'object'
    ? raw.engagement_evidence
    : {}
  return [engagement.observed_at, raw.engagement_observed_at, raw.provider_observed_at, post.created_at, post.publish_time]
    .map(value => value ? new Date(value) : null)
    .filter(value => value && !Number.isNaN(value.getTime()))
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? null
}

export function isGenericStrategyCopy(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length > 0 && GENERIC_STRATEGY_PATTERNS.some(pattern => pattern.test(text))
}

export function buildFactualReflection(posts) {
  const byPlatform = new Map()
  const byType = new Map()
  for (const post of posts) {
    const platform = formatType(post.platform)
    const type = formatType(post.meta_post_type)
    byPlatform.set(platform, (byPlatform.get(platform) ?? 0) + 1)
    byType.set(type, (byType.get(type) ?? 0) + 1)
  }
  const describe = map => [...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, count]) => `${count} ${label}`)
    .join(', ')
  return `Published-content record: ${posts.length} post${posts.length === 1 ? '' : 's'} (${describe(byPlatform)}). Recorded formats: ${describe(byType)}. This factual summary does not infer campaign intent, performance causes or unavailable metrics.`
}

export function reconcileClientMonth({ client, month, reports, posts, strategy }) {
  if (!TARGET_MONTHS.includes(month)) throw new Error(`Unsupported reconciliation month: ${month}`)
  if (!client?.active) return { state: 'excluded', reason: 'CLIENT_INACTIVE', client_id: client?.id, month }

  const candidates = reports.filter(report => report.client_id === client.id && report.period_start?.slice(0, 7) === month)
  const masterReports = candidates.filter(report => report.platform == null)
  if (masterReports.length === 0) {
    return { state: 'withheld', reason: 'MISSING_CANONICAL_REPORT', client_id: client.id, client_name: client.name, month }
  }
  if (masterReports.length > 1) {
    return { state: 'withheld', reason: 'DUPLICATE_CANONICAL_REPORT', client_id: client.id, client_name: client.name, month }
  }

  const report = masterReports[0]
  const reportPosts = posts.filter(post => post.report_id === report.id && postMonth(post) === month)
  if (reportPosts.length === 0) {
    return { state: 'withheld', reason: 'NO_IN_MONTH_POST_EVIDENCE', client_id: client.id, client_name: client.name, month, report_id: report.id }
  }
  if (reportPosts.some(post => !post.meta_post_id || !post.publish_time)) {
    return { state: 'withheld', reason: 'POST_IDENTITY_OR_DATE_UNVERIFIED', client_id: client.id, client_name: client.name, month, report_id: report.id }
  }

  const strategyText = [report.strategy_next_month, report.content_direction_next_month].filter(Boolean).join(' ')
  if (strategyText && (!strategy || strategy.workflow_status !== 'published')) {
    return { state: 'withheld', reason: 'UNPUBLISHED_STRATEGY_COPY_PRESENT', client_id: client.id, client_name: client.name, month, report_id: report.id }
  }
  if (isGenericStrategyCopy(strategyText)) {
    return { state: 'withheld', reason: 'GENERIC_STRATEGY_COPY', client_id: client.id, client_name: client.name, month, report_id: report.id }
  }

  const bounds = monthBounds(month)
  const latestEvidence = reportPosts.map(evidenceTimestamp).filter(Boolean).sort((a, b) => b.getTime() - a.getTime())[0]
  const asOf = isoDate(latestEvidence)
  if (month === '2026-09' && !asOf) {
    return { state: 'withheld', reason: 'MISSING_SEPTEMBER_AS_OF_EVIDENCE', client_id: client.id, client_name: client.name, month, report_id: report.id }
  }

  const titleMonth = new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00Z`))
  const title = month === '2026-09'
    ? `${client.name} ${titleMonth} Month-to-Date Report (as of ${asOf})`
    : `${client.name} ${titleMonth} Report`
  const periodEnd = month === '2026-09' ? asOf : bounds.end
  const reflection = buildFactualReflection(reportPosts)
  const fingerprint = `${report.id}:${month}:${reportPosts.map(post => post.id).sort().join(',')}:${periodEnd}`

  return {
    state: 'safe_to_publish', client_id: client.id, client_name: client.name, month,
    report_id: report.id, post_count: reportPosts.length, period_start: bounds.start,
    period_end: periodEnd, report_title: title, strategy_reflection: reflection, fingerprint,
  }
}

export function buildReconciliationPlan({ clients, reports, posts, strategies = [] }) {
  const activeClients = clients.filter(client => client.active).sort((a, b) => a.name.localeCompare(b.name))
  const results = []
  for (const client of activeClients) {
    for (const month of TARGET_MONTHS) {
      const strategy = strategies.find(row => row.client_id === client.id && row.strategy_month?.slice(0, 7) === month) ?? null
      results.push(reconcileClientMonth({ client, month, reports, posts, strategy }))
    }
  }
  const byMonth = Object.fromEntries(TARGET_MONTHS.map(month => {
    const rows = results.filter(row => row.month === month)
    return [month, { target: rows.length, safe_to_publish: rows.filter(row => row.state === 'safe_to_publish').length, withheld: rows.filter(row => row.state === 'withheld').length }]
  }))
  const reasons = results.filter(row => row.state === 'withheld').reduce((counts, row) => {
    counts[row.reason] = (counts[row.reason] ?? 0) + 1
    return counts
  }, {})
  return {
    generated_at: new Date().toISOString(), target_months: TARGET_MONTHS,
    active_client_count: activeClients.length, target_client_months: activeClients.length * TARGET_MONTHS.length,
    safe_to_publish: results.filter(row => row.state === 'safe_to_publish').length,
    withheld: results.filter(row => row.state === 'withheld').length,
    by_month: byMonth, withheld_reasons: reasons, rows: results,
  }
}
