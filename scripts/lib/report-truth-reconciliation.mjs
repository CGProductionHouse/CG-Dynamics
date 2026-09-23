import { createHash } from 'node:crypto'

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

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]))
  }
  return value
}

export function stableJson(value) {
  return JSON.stringify(stableValue(value))
}

export function verifiedEvidence(post) {
  const raw = post.raw && typeof post.raw === 'object' ? post.raw : {}
  const engagement = raw.engagement_evidence && typeof raw.engagement_evidence === 'object'
    ? raw.engagement_evidence
    : {}
  const candidates = [
    ['engagement_observed_at', engagement.observed_at],
    ['engagement_observed_at', raw.engagement_observed_at],
    ['provider_observed_at', raw.provider_observed_at],
  ]
  if (raw.source === 'meta_sync') candidates.push(['meta_sync_synced_at', raw.synced_at])
  if (raw.evidence_verified === true) {
    candidates.push(['verified_at', raw.verified_at], ['import_observed_at', raw.import_observed_at])
  }
  for (const [kind, value] of candidates) {
    if (!value) continue
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return { kind, value: parsed.toISOString() }
  }
  return null
}

export function verifiedEvidenceTimestamp(post) {
  const evidence = verifiedEvidence(post)
  return evidence ? new Date(evidence.value) : null
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
  const latestEvidence = reportPosts.map(verifiedEvidenceTimestamp).filter(Boolean).sort((a, b) => b.getTime() - a.getTime())[0]
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
  const factualReflection = buildFactualReflection(reportPosts)
  const reflection = report.previous_month_reflection?.trim() || factualReflection
  const sourceFingerprint = sha256(stableJson({
    report: {
      id: report.id,
      client_id: report.client_id,
      platform: report.platform,
      strategy_next_month: report.strategy_next_month ?? null,
      content_direction_next_month: report.content_direction_next_month ?? null,
      previous_month_reflection: reflection,
    },
    posts: reportPosts.map(post => ({
      id: post.id,
      meta_post_id: post.meta_post_id,
      platform: post.platform,
      publish_time: post.publish_time,
      meta_post_type: post.meta_post_type,
      verified_evidence_at: verifiedEvidenceTimestamp(post)?.toISOString() ?? null,
    })).sort((left, right) => left.id.localeCompare(right.id)),
    strategy: strategy ? { workflow_status: strategy.workflow_status } : null,
  }))
  const alreadySatisfied = report.status === 'published'
    && report.period_start === bounds.start
    && report.period_end === periodEnd
    && report.report_title === title
    && (report.previous_month_reflection?.trim() || '') === reflection

  return {
    state: alreadySatisfied ? 'already_satisfied' : 'mutation_target', client_id: client.id, client_name: client.name, month,
    report_id: report.id, post_count: reportPosts.length, period_start: bounds.start,
    period_end: periodEnd, report_title: title, previous_month_reflection: reflection,
    source_fingerprint: sourceFingerprint,
    plan_token: sha256(stableJson({ report_id: report.id, client_id: client.id, month, period_start: bounds.start, period_end: periodEnd, report_title: title, previous_month_reflection: reflection, source_fingerprint: sourceFingerprint })),
    expected: {
      status: report.status,
      updated_at: report.updated_at ?? null,
      previous_month_reflection: report.previous_month_reflection ?? null,
    },
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
    const alreadySatisfied = rows.filter(row => row.state === 'already_satisfied').length
    const mutationTargets = rows.filter(row => row.state === 'mutation_target').length
    return [month, { target: rows.length, safe_to_publish: alreadySatisfied + mutationTargets, already_satisfied: alreadySatisfied, mutation_targets: mutationTargets, withheld: rows.filter(row => row.state === 'withheld').length }]
  }))
  const reasons = results.filter(row => row.state === 'withheld').reduce((counts, row) => {
    counts[row.reason] = (counts[row.reason] ?? 0) + 1
    return counts
  }, {})
  const publishableRows = results.filter(row => row.state === 'already_satisfied' || row.state === 'mutation_target')
  const planHash = sha256(publishableRows.map(row => row.plan_token).sort().join('\n'))
  return {
    generated_at: new Date().toISOString(), target_months: TARGET_MONTHS,
    active_client_count: activeClients.length, target_client_months: activeClients.length * TARGET_MONTHS.length,
    plan_hash: planHash,
    safe_to_publish: publishableRows.length,
    already_satisfied: results.filter(row => row.state === 'already_satisfied').length,
    mutation_targets: results.filter(row => row.state === 'mutation_target').length,
    withheld: results.filter(row => row.state === 'withheld').length,
    by_month: byMonth, withheld_reasons: reasons, rows: results,
  }
}

function reportSnapshot(report) {
  if (!report) return null
  const precondition = {
    id: report.id,
    client_id: report.client_id,
    platform: report.platform ?? null,
    period_start: report.period_start ?? null,
    period_end: report.period_end ?? null,
    status: report.status,
    report_title: report.report_title ?? null,
    previous_month_reflection: report.previous_month_reflection ?? null,
    strategy_next_month: report.strategy_next_month ?? null,
    content_direction_next_month: report.content_direction_next_month ?? null,
    updated_at: report.updated_at ?? null,
  }
  return { ...precondition, source_version: sha256(stableJson(precondition)) }
}

export function buildReviewedSnapshot({ clients, reports, posts, strategies = [], snapshotCutoff }) {
  const cutoff = new Date(snapshotCutoff)
  if (Number.isNaN(cutoff.getTime())) throw new Error('Snapshot cutoff must be a valid timestamp.')
  const cutoffIso = cutoff.toISOString()
  const eligiblePosts = posts.filter(post => {
    const created = new Date(post.created_at)
    if (Number.isNaN(created.getTime()) || created > cutoff) return false
    const evidence = verifiedEvidence(post)
    return !evidence || new Date(evidence.value) <= cutoff
  })
  const plan = buildReconciliationPlan({ clients, reports, posts: eligiblePosts, strategies })
  const reportById = new Map(reports.map(report => [report.id, report]))
  const strategyByClientMonth = new Map(strategies.map(strategy => [
    `${strategy.client_id}:${strategy.strategy_month?.slice(0, 7)}`,
    { client_id: strategy.client_id, strategy_month: strategy.strategy_month, workflow_status: strategy.workflow_status },
  ]))
  const clientById = new Map(clients.map(client => [client.id, client]))
  const rows = plan.rows.map(row => {
    const client = clientById.get(row.client_id)
    const report = row.report_id ? reportById.get(row.report_id) : null
    const includedPosts = report
      ? eligiblePosts.filter(post => post.report_id === report.id && postMonth(post) === row.month)
        .map(post => ({
          id: post.id,
          report_id: post.report_id,
          meta_post_id: post.meta_post_id,
          platform: post.platform,
          publish_time: post.publish_time,
          meta_post_type: post.meta_post_type ?? null,
          created_at: post.created_at,
          verified_evidence: verifiedEvidence(post),
        })).sort((left, right) => left.id.localeCompare(right.id))
      : []
    return {
      client: { id: client.id, name: client.name, active: client.active },
      month: row.month,
      state: row.state,
      reason: row.reason ?? null,
      report: reportSnapshot(report),
      included_posts: includedPosts,
      strategy: strategyByClientMonth.get(`${row.client_id}:${row.month}`) ?? null,
      derived: row.state === 'mutation_target' || row.state === 'already_satisfied' ? {
        period_start: row.period_start,
        period_end: row.period_end,
        report_title: row.report_title,
        previous_month_reflection: row.previous_month_reflection,
        post_count: row.post_count,
      } : null,
    }
  })
  const payload = {
    schema_version: 1,
    snapshot_cutoff: cutoffIso,
    target_months: [...TARGET_MONTHS],
    active_client_count: plan.active_client_count,
    target_client_months: plan.target_client_months,
    rows,
  }
  return { ...payload, snapshot_hash: sha256(stableJson(payload)) }
}

export function verifyReviewedSnapshot(snapshot, expectedHash = null) {
  if (!snapshot || snapshot.schema_version !== 1 || !Array.isArray(snapshot.rows)) {
    throw new Error('Unsupported or malformed reviewed-plan snapshot.')
  }
  const { snapshot_hash: recordedHash, ...payload } = snapshot
  const actualHash = sha256(stableJson(payload))
  if (!recordedHash || recordedHash !== actualHash) {
    throw new Error(`Snapshot integrity mismatch. Recorded ${recordedHash ?? 'none'}; actual ${actualHash}.`)
  }
  if (expectedHash && actualHash !== expectedHash) {
    throw new Error(`Reviewed snapshot hash mismatch. Expected ${expectedHash}; actual ${actualHash}. No writes were attempted.`)
  }
  return actualHash
}

export function summarizeReviewedSnapshot(snapshot) {
  const byMonth = Object.fromEntries(snapshot.target_months.map(month => {
    const rows = snapshot.rows.filter(row => row.month === month)
    const safe = rows.filter(row => row.state === 'mutation_target' || row.state === 'already_satisfied')
    return [month, {
      target: rows.length,
      safe_to_publish: safe.length,
      mutation_targets: rows.filter(row => row.state === 'mutation_target').length,
      already_satisfied: rows.filter(row => row.state === 'already_satisfied').length,
      withheld: rows.filter(row => row.state === 'withheld').length,
    }]
  }))
  const withheldReasons = snapshot.rows.filter(row => row.state === 'withheld').reduce((counts, row) => {
    counts[row.reason] = (counts[row.reason] ?? 0) + 1
    return counts
  }, {})
  return {
    snapshot_cutoff: snapshot.snapshot_cutoff,
    snapshot_hash: snapshot.snapshot_hash,
    active_client_count: snapshot.active_client_count,
    target_client_months: snapshot.target_client_months,
    safe_to_publish: snapshot.rows.filter(row => row.state === 'mutation_target' || row.state === 'already_satisfied').length,
    mutation_targets: snapshot.rows.filter(row => row.state === 'mutation_target').length,
    already_satisfied: snapshot.rows.filter(row => row.state === 'already_satisfied').length,
    withheld: snapshot.rows.filter(row => row.state === 'withheld').length,
    by_month: byMonth,
    withheld_reasons: withheldReasons,
  }
}
