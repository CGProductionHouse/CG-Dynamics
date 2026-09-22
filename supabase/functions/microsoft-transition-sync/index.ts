import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { runBoundedWorkers } from './bounded-workers.ts'
import { shouldFetchPlannerTaskDetails } from './planner-details.ts'
import {
  buildAssigneeBatchRequests,
  correlateAssigneeBatchResponses,
  type GraphAssigneeBatchItem,
} from './assignee-lookup.ts'
import {
  accumulateOutlookPage,
  accumulatePlannerPage,
  assembleSnapshot,
  enumerateJobSources,
  type GraphPageResult,
  jobProgress,
  type JobSourceRow,
  nextDetailBatch,
  paginateGraph,
  pickNextSource,
  planSourceUpdate,
  requiredSourcesComplete,
  retrySourceReset,
  type SourceManifest,
  type SourceUnitResult,
  PAGINATION_BATCH_SIZE,
  planAutomaticSourceRecovery,
  planAutomaticApplyRecovery,
} from './job-machine.ts'
import { applyAutomaticMicrosoftMirrors } from './automatic-reconciliation.ts'

interface GraphBatchItem { id: string; status: number; headers?: Record<string, string>; body?: { description?: unknown } }

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0'
const GRAPH_MAX_ATTEMPTS = 5
const GRAPH_BATCH_MAX_ATTEMPTS = 8
const GRAPH_RETRY_CAP_MS = 10_000
const GRAPH_DETAIL_CONCURRENCY = 4

function sleep(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)) }

function retryDelay(response: Response | null, attempt: number): number {
  const retryAfter = response?.headers.get('Retry-After')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1000, 0), GRAPH_RETRY_CAP_MS)
    const date = Date.parse(retryAfter)
    if (!Number.isNaN(date)) return Math.min(Math.max(date - Date.now(), 0), GRAPH_RETRY_CAP_MS)
  }
  return Math.min(500 * (2 ** attempt), GRAPH_RETRY_CAP_MS)
}
function shouldRetry(response: Response): boolean { return shouldRetryStatus(response.status) }
function shouldRetryStatus(status: number): boolean { return status === 408 || status === 429 || status >= 500 }
function batchRetryDelay(items: GraphBatchItem[], attempt: number): number {
  const retryAfterMs = items.reduce((max, item) => {
    const entry = Object.entries(item.headers ?? {}).find(([name]) => name.toLowerCase() === 'retry-after')
    const seconds = Number(entry?.[1])
    return Number.isFinite(seconds) ? Math.max(max, seconds * 1000) : max
  }, 0)
  return Math.min(Math.max(retryAfterMs, retryDelay(null, attempt)), GRAPH_RETRY_CAP_MS)
}

async function fetchGraph(url: string, token: string, prefer?: string, init: RequestInit = {}): Promise<Response | null> {
  for (let attempt = 0; attempt < GRAPH_MAX_ATTEMPTS; attempt += 1) {
    let response: Response | null = null
    try {
      const headers = new Headers(init.headers)
      headers.set('Authorization', `Bearer ${token}`)
      if (prefer) headers.set('Prefer', prefer)
      response = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(30_000) })
      if (response.ok || !shouldRetry(response)) return response
    } catch { /* bounded retry */ }
    if (attempt < GRAPH_MAX_ATTEMPTS - 1) await sleep(retryDelay(response, attempt))
  }
  return null
}

async function graphTaskDescriptions(taskIds: string[], token: string): Promise<{ descriptions: Map<string, string | null>; complete: boolean }> {
  const descriptions = new Map<string, string | null>()
  let complete = true
  const batches: string[][] = []
  for (let index = 0; index < taskIds.length; index += 20) batches.push(taskIds.slice(index, index + 20))
  await runBoundedWorkers(batches, GRAPH_DETAIL_CONCURRENCY, async batch => {
    let pending = batch
    for (let attempt = 0; pending.length > 0 && attempt < GRAPH_BATCH_MAX_ATTEMPTS; attempt += 1) {
      const response = await fetchGraph(`${GRAPH_ROOT}/$batch`, token, undefined, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: pending.map(taskId => ({ id: taskId, method: 'GET', url: `/planner/tasks/${encodeURIComponent(taskId)}/details` })) }),
      })
      if (!response?.ok) { complete = false; break }
      const body = await response.json() as { responses?: GraphBatchItem[] }
      const results = new Map((body.responses ?? []).map(item => [item.id, item]))
      const retry: string[] = []
      const throttled: GraphBatchItem[] = []
      for (const taskId of pending) {
        const item = results.get(taskId)
        if (item?.status === 200) descriptions.set(taskId, typeof item.body?.description === 'string' ? item.body.description : null)
        else if (item && shouldRetryStatus(item.status)) { retry.push(taskId); throttled.push(item) }
        else if (!item) retry.push(taskId)
        else complete = false
      }
      pending = retry
      if (pending.length > 0 && attempt < GRAPH_BATCH_MAX_ATTEMPTS - 1) await sleep(batchRetryDelay(throttled, attempt))
    }
    if (pending.length > 0) complete = false
  })
  return { descriptions, complete }
}

function safeMessage(status: number): string {
  if (status === 401 || status === 403) return 'Microsoft permission or connection failure.'
  if (status === 408 || status === 429 || status >= 500) return 'Microsoft temporarily unavailable or timed out.'
  return `Microsoft request failed (${status}).`
}

// Graph I/O around the pure paginator in job-machine.ts, which owns (and tests) the
// checkpointing rules.
async function graphPages(path: string, token: string, prefer?: string, cursor?: string, batchSize = PAGINATION_BATCH_SIZE): Promise<GraphPageResult> {
  const startUrl = cursor ?? (path.startsWith('https://') ? path : `${GRAPH_ROOT}${path}`)
  return paginateGraph(
    startUrl,
    async url => {
      const response = await fetchGraph(url, token, prefer)
      if (!response) return null
      if (!response.ok) return { ok: false, status: response.status, body: null }
      return { ok: true, status: response.status, body: await response.json() as { value?: Array<Record<string, unknown>>; '@odata.nextLink'?: string } }
    },
    status => (status === null ? 'Microsoft connector request failed after bounded retries.' : safeMessage(status)),
    batchSize,
  )
}

function dateOnly(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}
function outlookIso(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const dateTime = (value as { dateTime?: unknown }).dateTime
  if (typeof dateTime !== 'string' || !dateTime) return ''
  if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(dateTime)) return dateTime
  return `${dateTime}+02:00`
}

async function accessToken(tenantId: string, clientId: string, clientSecret: string): Promise<string | null> {
  try {
    const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' })
    const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(30_000) })
    if (!response.ok) return null
    const data = await response.json() as { access_token?: string }
    return data.access_token ?? null
  } catch { return null }
}

function publicSources(manifest: SourceManifest) {
  return [
    ...(manifest.calendar ? [{ id: manifest.calendar.id, name: manifest.calendar.name, type: 'outlook_calendar' as const }] : []),
    ...manifest.plans.map(plan => ({ id: plan.id, name: plan.name, type: 'planner_plan' as const })),
  ]
}

async function resolveAssignees(microsoftIds: string[], token: string): Promise<Record<string, { displayName: string; mail: string | null; userPrincipalName: string | null }>> {
  const assigneeMap: Record<string, { displayName: string; mail: string | null; userPrincipalName: string | null }> = {}
  const idList = [...new Set(microsoftIds)]
  for (let index = 0; index < idList.length; index += 20) {
    const batch = idList.slice(index, index + 20)
    const { requests, sourceIdByRequestId } = buildAssigneeBatchRequests(batch)
    const batchResult = await fetchGraph(`${GRAPH_ROOT}/$batch`, token, undefined, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests }),
    })
    if (batchResult?.ok) {
      const batchBody = await batchResult.json() as { responses?: GraphAssigneeBatchItem[] }
      const correlated = correlateAssigneeBatchResponses(batchBody.responses ?? [], sourceIdByRequestId)
      Object.assign(assigneeMap, correlated.assignees)
    }
    if (index + 20 < idList.length) await sleep(200)
  }
  return assigneeMap
}

async function fetchOutlookUnit(token: string, manifest: SourceManifest, source: JobSourceRow): Promise<SourceUnitResult> {
  const path = `/users/${encodeURIComponent(manifest.userId)}/calendars/${encodeURIComponent(source.source_id)}/calendarView?startDateTime=${encodeURIComponent(source.range_start ?? '')}&endDateTime=${encodeURIComponent(source.range_end ?? '')}&$select=id,subject,bodyPreview,start,end,isAllDay,isCancelled,sensitivity,location,attendees,lastModifiedDateTime`
  const result = await graphPages(path, token, 'IdType="ImmutableId", outlook.timezone="South Africa Standard Time"', source.pagination_cursor ?? undefined)
  const newRecords = result.values.map(event => {
    const privateEvent = Boolean(event.sensitivity && event.sensitivity !== 'normal')
    return {
      sourceType: 'outlook_event', sourceCalendarId: source.source_id, sourceEventId: String(event.id ?? ''),
      title: privateEvent ? 'Private Outlook event' : String(event.subject ?? ''), safeSummary: !privateEvent && typeof event.bodyPreview === 'string' ? event.bodyPreview : null,
      startDate: outlookIso(event.start), endDate: outlookIso(event.end) || null, allDay: Boolean(event.isAllDay),
      location: !privateEvent && typeof (event.location as { displayName?: unknown } | undefined)?.displayName === 'string' ? (event.location as { displayName: string }).displayName : null,
      cancelled: Boolean(event.isCancelled),
      assigneeMicrosoftIds: !privateEvent && Array.isArray(event.attendees) ? event.attendees.map(a => (a as { emailAddress?: { address?: unknown } }).emailAddress?.address).filter((v): v is string => typeof v === 'string') : [],
      sourceModifiedAt: typeof event.lastModifiedDateTime === 'string' ? event.lastModifiedDateTime : null,
      private: privateEvent,
    }
  })
  return accumulateOutlookPage((source.records ?? []) as Array<Record<string, unknown>>, newRecords, result)
}

async function fetchPlannerTasksUnit(token: string, source: JobSourceRow): Promise<SourceUnitResult> {
  const [taskResult, bucketResult] = await Promise.all([
    graphPages(`/planner/plans/${encodeURIComponent(source.source_id)}/tasks`, token, undefined, source.pagination_cursor ?? undefined),
    graphPages(`/planner/plans/${encodeURIComponent(source.source_id)}/buckets`, token),
  ])
  const buckets = new Map(bucketResult.values.map(bucket => [String(bucket.id ?? ''), String(bucket.name ?? '')]))
  const newRecords = taskResult.values.map(task => {
    const taskId = String(task.id ?? '')
    const bucketId = String(task.bucketId ?? '')
    return {
      sourceType: 'planner_task', sourcePlanId: source.source_id, sourcePlanName: source.source_name,
      sourceBucketId: bucketId, sourceBucketName: buckets.get(bucketId) ?? '', sourceTaskId: taskId,
      title: String(task.title ?? ''), description: null as string | null,
      startDate: dateOnly(task.startDateTime), dueDate: dateOnly(task.dueDateTime),
      assigneeMicrosoftIds: task.assignments && typeof task.assignments === 'object' ? Object.keys(task.assignments as Record<string, unknown>) : [],
      percentComplete: typeof task.percentComplete === 'number' ? task.percentComplete : null,
      completedDate: dateOnly(task.completedDateTime),
      sourceModifiedAt: typeof task.lastModifiedDateTime === 'string' ? task.lastModifiedDateTime : null,
      _needsDetail: shouldFetchPlannerTaskDetails(source.source_name, task.percentComplete),
    }
  })
  return accumulatePlannerPage((source.records ?? []) as Array<Record<string, unknown>>, newRecords, taskResult, bucketResult)
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ ok: false, error: 'Server configuration error.' }, 500)
  const sb = createClient(supabaseUrl, serviceRoleKey)
  let body: { action?: string; rangeStart?: string; rangeEnd?: string; jobId?: string }
  try { body = await request.json() } catch { return jsonResponse({ ok: false, error: 'Invalid request body.' }, 400) }
  const suppliedSystemSecret = request.headers.get('x-daily-freshness-secret') ?? ''
  const expectedSystemSecret = Deno.env.get('DAILY_FRESHNESS_WORKER_SECRET') ?? ''
  const systemRequest = body.action === 'system_cycle' && expectedSystemSecret.length >= 32 && suppliedSystemSecret === expectedSystemSecret
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: authData, error: authError } = systemRequest ? { data: { user: null }, error: null } : await sb.auth.getUser(token)
  const systemUserId = Deno.env.get('MICROSOFT_SYNC_SYSTEM_USER_ID') ?? ''
  const user = systemRequest ? (/^[0-9a-f-]{36}$/i.test(systemUserId) ? { id: systemUserId } : null) : authData.user
  if (!user || (!systemRequest && authError)) return jsonResponse({ ok: false, error: systemRequest ? 'Microsoft system sync identity is not configured.' : 'Authentication required.' }, systemRequest ? 503 : 401)
  if (!systemRequest) {
    const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return jsonResponse({ ok: false, error: 'Admin access required.' }, 403)
  }

  const tenantId = Deno.env.get('MICROSOFT_TENANT_ID')
  const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')
  const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET')
  let manifest: SourceManifest | null = null
  try {
    const raw = Deno.env.get('MICROSOFT_SYNC_SOURCES_JSON')
    if (raw) manifest = JSON.parse(raw) as SourceManifest
  } catch { manifest = null }
  if (manifest && Array.isArray(manifest.plans)) {
    try {
      const { data: registryPlans } = await sb.from('microsoft_sync_plan_sources').select('plan_id, plan_name').eq('active', true)
      if (Array.isArray(registryPlans)) {
        const seen = new Set(manifest.plans.map(plan => String(plan.id)))
        for (const row of registryPlans) {
          const id = String((row as { plan_id?: unknown }).plan_id ?? '').trim()
          const name = String((row as { plan_name?: unknown }).plan_name ?? '').trim()
          if (id && name && !seen.has(id)) { manifest.plans.push({ id, name }); seen.add(id) }
        }
      }
    } catch { /* registry optional */ }
  }
  const configured = Boolean(tenantId && clientId && clientSecret && manifest?.userId && Array.isArray(manifest?.plans))
  const { data: setting, error: settingError } = await sb.from('microsoft_sync_settings').select('transition_status').eq('id', true).maybeSingle()
  const transitionStatus = setting?.transition_status ?? 'paused'

  if (body.action === 'status') {
    const [{ data: latestJobs }, { data: latestRuns }, { data: successfulRuns }] = await Promise.all([
      sb.from('microsoft_sync_jobs')
        .select('id, status, created_at, updated_at, exported_at')
        .order('created_at', { ascending: false }).limit(1),
      sb.from('microsoft_sync_runs')
        .select('id, status, created_at, finished_at, source_completeness, summary, safe_error')
        .order('created_at', { ascending: false }).limit(1),
      sb.from('microsoft_sync_runs')
        .select('finished_at').eq('status', 'completed')
        .order('finished_at', { ascending: false, nullsFirst: false }).limit(1),
    ])
    const latestJob = latestJobs?.[0] ?? null
    const latestRun = latestRuns?.[0] ?? null
    let sourceCoverage: Array<{ name: string; complete: boolean; error: string | null; records: number }> = []
    if (latestJob?.id) {
      const { data: sourceRows } = await sb.from('microsoft_sync_job_sources')
        .select('source_name, complete, safe_error, record_count')
        .eq('job_id', latestJob.id).order('position')
      sourceCoverage = (sourceRows ?? []).map(row => ({
        name: String(row.source_name), complete: Boolean(row.complete),
        error: (row.safe_error as string | null) ?? null, records: Number(row.record_count ?? 0),
      }))
    }
    return jsonResponse({
      ok: true,
      connected: !settingError && configured && transitionStatus === 'active',
      transitionStatus,
      message: settingError ? 'Microsoft transition lifecycle status is unavailable.' : !configured ? 'Microsoft transition connection is not configured.' : transitionStatus !== 'active' ? `Microsoft transition sync is ${transitionStatus}.` : 'Microsoft transition connection is available.',
      sources: manifest ? publicSources(manifest) : [],
      freshness: {
        lastJobId: latestJob?.id ?? null,
        lastJobStartedAt: latestJob?.created_at ?? null,
        lastJobCompletedAt: latestJob?.exported_at ?? (latestJob?.status === 'complete' ? latestJob?.updated_at : null),
        lastSuccessfulReconciliationAt: successfulRuns?.[0]?.finished_at ?? null,
        latestApplyStatus: latestRun?.status ?? null,
        latestApplySummary: latestRun?.summary ?? null,
        latestApplyError: latestRun?.safe_error ?? null,
        sourceCoverage,
        recoveryInProgress: latestJob?.status === 'running' || latestRun?.status === 'applying',
        staleAfterMinutes: 180,
      },
    })
  }

  let action = body.action ?? ''
  if (systemRequest) {
    const { data: latestSystemJob } = await sb.from('microsoft_sync_jobs')
      .select('id,status,created_at,exported_at,automatic_retry_count,automatic_retry_after').eq('created_by', user.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    const { data: appliedRun } = latestSystemJob?.id ? await sb.from('microsoft_sync_runs')
      .select('id,status,finished_at').eq('preview_job_id', latestSystemJob.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle() : { data: null }
    const lastSuccess = appliedRun?.status === 'completed' && appliedRun.finished_at ? Date.parse(appliedRun.finished_at) : 0
    const recentTerminal = appliedRun?.finished_at ? Date.now() - Date.parse(appliedRun.finished_at) < 3 * 60 * 60 * 1000 : false
    if (latestSystemJob?.status === 'running') {
      const { data: recoverySources } = await sb.from('microsoft_sync_job_sources')
        .select('required,stage').eq('job_id', latestSystemJob.id)
      const failedRequired = (recoverySources ?? []).filter(source => source.required && source.stage === 'failed').length
      const recovery = planAutomaticSourceRecovery({ failedRequired, retryCount: Number(latestSystemJob.automatic_retry_count ?? 0), retryAfter: latestSystemJob.automatic_retry_after ?? null, now: new Date().toISOString() })
      if (recovery.kind === 'wait') return jsonResponse({ ok: false, phase: 'retry_wait', jobId: latestSystemJob.id, retryAfter: recovery.retryAfter })
      if (recovery.kind === 'exhausted') {
        await sb.from('microsoft_sync_jobs').update({ status: 'failed', automatic_failure: 'Automatic source retry budget exhausted.', updated_at: new Date().toISOString() }).eq('id', latestSystemJob.id)
        return jsonResponse({ ok: false, phase: 'degraded', jobId: latestSystemJob.id, blocker: 'Automatic Microsoft source recovery was exhausted; manual review is required.' })
      }
      if (recovery.kind === 'retry') {
        await sb.from('microsoft_sync_job_sources').update({ ...retrySourceReset(), updated_at: new Date().toISOString() }).eq('job_id', latestSystemJob.id).eq('stage', 'failed')
        await sb.from('microsoft_sync_jobs').update({ automatic_retry_count: recovery.nextRetryCount, automatic_retry_after: recovery.retryAfter, automatic_failure: null, updated_at: new Date().toISOString() }).eq('id', latestSystemJob.id)
      }
      action = 'job_process'; body.jobId = latestSystemJob.id
    } else if (latestSystemJob?.status === 'complete' && (!appliedRun || appliedRun.status === 'applying')) {
      const auto = await automaticallyApplyJob(sb, latestSystemJob.id)
      return jsonResponse({ ok: auto.status === 'completed', phase: 'apply', jobId: latestSystemJob.id, automatic: auto }, auto.status === 'failed' ? 500 : 200)
    } else if (lastSuccess && Date.now() - lastSuccess < 3 * 60 * 60 * 1000) {
      return jsonResponse({ ok: true, phase: 'fresh', jobId: latestSystemJob?.id ?? null, lastSuccessfulAt: appliedRun?.finished_at })
    } else if (appliedRun && recentTerminal) {
      return jsonResponse({ ok: false, phase: 'degraded', jobId: latestSystemJob?.id ?? null, status: appliedRun.status, blocker: 'The latest automatic Microsoft reconciliation needs review; last verified state remains in use.' })
    } else {
      action = 'job_start'
      const today = new Date()
      const rangeStart = new Date(today); rangeStart.setUTCDate(rangeStart.getUTCDate() - 31)
      const rangeEnd = new Date(today); rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 370)
      body.rangeStart = rangeStart.toISOString(); body.rangeEnd = rangeEnd.toISOString()
    }
  }
  const JOB_ACTIONS = new Set(['job_start', 'job_process', 'job_status', 'job_result', 'job_retry', 'job_latest'])
  if (!JOB_ACTIONS.has(action)) {
    if (action === 'fetch') return jsonResponse({ ok: false, error: 'The one-shot fetch is retired. Use a durable preview job (job_start / job_process / job_result).' }, 410)
    return jsonResponse({ ok: false, error: 'Unsupported action.' }, 400)
  }
  if (settingError) return jsonResponse({ ok: false, error: 'Microsoft transition lifecycle status is unavailable.' }, 503)
  if (!configured || !manifest || !tenantId || !clientId || !clientSecret) return jsonResponse({ ok: false, error: 'Microsoft transition connection is not configured.' }, 503)
  if (transitionStatus !== 'active') return jsonResponse({ ok: false, error: `Microsoft transition sync is ${transitionStatus}.` }, 409)

  // Deliberately excludes `records`: status polls and source picking never need the
  // payloads, and a 5,000+ task plan makes them heavy. job_process loads the one
  // source it is fetching explicitly.
  const SOURCE_FIELDS = 'id, position, source_type, source_id, source_name, required, stage, record_count, complete, safe_error, pending_detail_ids, range_start, range_end, attempts, pagination_cursor'
  const statusList = (rows: Array<Record<string, unknown>>) => rows
    .map(r => ({ id: r.id, position: r.position, sourceType: r.source_type, sourceId: r.source_id, sourceName: r.source_name, required: r.required, stage: r.stage, recordCount: r.record_count, complete: r.complete, safeError: r.safe_error, detailsRemaining: Array.isArray(r.pending_detail_ids) ? (r.pending_detail_ids as unknown[]).length : 0, paginationCursor: r.pagination_cursor ?? null }))
    .sort((a, b) => Number(a.position) - Number(b.position))
  const asJobRows = (rows: Array<Record<string, unknown>>): JobSourceRow[] => rows.map(r => ({
    position: Number(r.position), source_type: String(r.source_type), source_id: String(r.source_id), source_name: String(r.source_name),
    required: Boolean(r.required), stage: r.stage as JobSourceRow['stage'], record_count: Number(r.record_count), complete: Boolean(r.complete),
    safe_error: (r.safe_error as string) ?? null, pending_detail_ids: Array.isArray(r.pending_detail_ids) ? (r.pending_detail_ids as string[]) : [],
    range_start: (r.range_start as string) ?? null, range_end: (r.range_end as string) ?? null,
    pagination_cursor: (r.pagination_cursor as string | null) ?? null,
    records: Array.isArray(r.records) ? (r.records as Array<Record<string, unknown>>) : [],
  }))

  if (action === 'job_start') {
    if (!body.rangeStart || !body.rangeEnd || Number.isNaN(Date.parse(body.rangeStart)) || Number.isNaN(Date.parse(body.rangeEnd)) || Date.parse(body.rangeEnd) <= Date.parse(body.rangeStart)) {
      return jsonResponse({ ok: false, error: 'A valid bounded calendar range is required.' }, 400)
    }
    if (Date.parse(body.rangeEnd) - Date.parse(body.rangeStart) > 370 * 24 * 60 * 60 * 1000) return jsonResponse({ ok: false, error: 'Outlook range cannot exceed 370 days.' }, 400)
    await sb.from('microsoft_sync_jobs').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('created_by', user.id).eq('status', 'running')
    const { data: job, error: jobError } = await sb.from('microsoft_sync_jobs').insert({ status: 'running', range_start: body.rangeStart, range_end: body.rangeEnd, created_by: user.id }).select('id').single()
    if (jobError || !job) return jsonResponse({ ok: false, error: 'Could not start the preview job.' }, 500)
    const seeds = enumerateJobSources(manifest, body.rangeStart, body.rangeEnd)
    const { error: seedError } = await sb.from('microsoft_sync_job_sources').insert(seeds.map(s => ({ job_id: job.id, position: s.position, source_type: s.source_type, source_id: s.source_id, source_name: s.source_name, required: s.required, range_start: s.range_start, range_end: s.range_end })))
    if (seedError) return jsonResponse({ ok: false, error: 'Could not enumerate preview sources.' }, 500)
    const { data: rows } = await sb.from('microsoft_sync_job_sources').select(SOURCE_FIELDS).eq('job_id', job.id)
    return jsonResponse({ ok: true, phase: systemRequest ? 'started' : undefined, jobId: job.id, status: 'running', sources: statusList(rows ?? []), progress: jobProgress(asJobRows(rows ?? [])) })
  }

  if (action === 'job_latest') {
    const { data: job } = await sb.from('microsoft_sync_jobs').select('id, status, range_start, range_end, created_at').eq('created_by', user.id).in('status', ['running', 'complete']).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!job) return jsonResponse({ ok: true, job: null })
    const { data: rows } = await sb.from('microsoft_sync_job_sources').select(SOURCE_FIELDS).eq('job_id', job.id)
    return jsonResponse({ ok: true, job: { jobId: job.id, status: job.status, rangeStart: job.range_start, rangeEnd: job.range_end }, sources: statusList(rows ?? []), progress: jobProgress(asJobRows(rows ?? [])) })
  }

  const jobId = typeof body.jobId === 'string' ? body.jobId : ''
  if (!jobId) return jsonResponse({ ok: false, error: 'jobId is required.' }, 400)
  let jobQuery = sb.from('microsoft_sync_jobs').select('id, status, assignee_map, range_start, range_end, exported_at').eq('id', jobId)
  if (action !== 'job_result') jobQuery = jobQuery.eq('created_by', user.id)
  const { data: job } = await jobQuery.maybeSingle()
  if (!job) return jsonResponse({ ok: false, error: 'Preview job not found.' }, 404)

  if (action === 'job_status') {
    const { data: rows } = await sb.from('microsoft_sync_job_sources').select(SOURCE_FIELDS).eq('job_id', jobId)
    return jsonResponse({ ok: true, jobId, status: job.status, sources: statusList(rows ?? []), progress: jobProgress(asJobRows(rows ?? [])) })
  }

  if (action === 'job_retry') {
    await sb.from('microsoft_sync_job_sources').update({ ...retrySourceReset(), updated_at: new Date().toISOString() }).eq('job_id', jobId).eq('stage', 'failed')
    await sb.from('microsoft_sync_jobs').update({ status: 'running', updated_at: new Date().toISOString() }).eq('id', jobId)
    const { data: rows } = await sb.from('microsoft_sync_job_sources').select(SOURCE_FIELDS).eq('job_id', jobId)
    return jsonResponse({ ok: true, jobId, status: 'running', sources: statusList(rows ?? []), progress: jobProgress(asJobRows(rows ?? [])) })
  }

  if (action === 'job_result') {
    const { data: rows } = await sb.from('microsoft_sync_job_sources').select('position, source_type, source_id, source_name, required, stage, record_count, complete, safe_error, records, range_start, range_end, pagination_cursor').eq('job_id', jobId)
    const jobRows = (rows ?? []).map(r => ({ ...asJobRows([r])[0], records: Array.isArray(r.records) ? (r.records as Array<Record<string, unknown>>) : [] }))
    if (!requiredSourcesComplete(jobRows)) return jsonResponse({ ok: false, error: 'Preview is not complete yet.', progress: jobProgress(jobRows) }, 409)
    const exportedAt = (job.exported_at as string | null) ?? new Date().toISOString()
    const snapshot = assembleSnapshot(jobRows, (job.assignee_map as Record<string, unknown>) ?? {}, exportedAt)
    if (!job.exported_at) {
      await sb.from('microsoft_sync_jobs').update({ status: 'complete', exported_at: exportedAt, updated_at: exportedAt }).eq('id', jobId)
    }
    return jsonResponse({ ok: true, jobId, snapshot })
  }

  const { data: rows } = await sb.from('microsoft_sync_job_sources').select(SOURCE_FIELDS).eq('job_id', jobId)
  const jobRows = asJobRows(rows ?? [])
  const rowIndex = new Map((rows ?? []).map(r => [`${r.source_type}:${r.source_id}`, r]))
  const pick = pickNextSource(jobRows)
  if (!pick) {
    const done = requiredSourcesComplete(jobRows)
    await sb.from('microsoft_sync_jobs').update({ status: done ? 'complete' : (jobProgress(jobRows).anyFailed ? 'running' : 'complete'), updated_at: new Date().toISOString() }).eq('id', jobId)
    if (systemRequest && done) {
      const automatic = await automaticallyApplyJob(sb, jobId)
      return jsonResponse({ ok: automatic.status !== 'failed', phase: 'apply', jobId, finished: true, sources: statusList(rows ?? []), progress: jobProgress(jobRows), automatic }, automatic.status === 'failed' ? 500 : 200)
    }
    return jsonResponse({ ok: true, jobId, finished: true, sources: statusList(rows ?? []), progress: jobProgress(jobRows) })
  }
  const dbRow = rowIndex.get(`${pick.source_type}:${pick.source_id}`) as Record<string, unknown>
  const dbId = String(dbRow.id)
  const graphToken = await accessToken(tenantId, clientId, clientSecret)
  if (!graphToken) return jsonResponse({ ok: false, error: 'Microsoft connection could not be authenticated.' }, 503)
  const now = () => new Date().toISOString()

  try {
    if (pick.source_type === 'outlook_calendar' || pick.stage === 'queued' || pick.stage === 'fetching_tasks') {
      const attempts = (Number(dbRow.attempts) || 0) + 1
      await sb.from('microsoft_sync_job_sources').update({ stage: 'fetching_tasks', attempts, updated_at: now() }).eq('id', dbId)
      // Only the source being fetched needs its accumulated records (SOURCE_FIELDS omits them).
      const { data: current } = await sb.from('microsoft_sync_job_sources').select('records').eq('id', dbId).single()
      const source: JobSourceRow = { ...pick, records: Array.isArray(current?.records) ? current!.records as Array<Record<string, unknown>> : [] }
      const result = pick.source_type === 'outlook_calendar'
        ? await fetchOutlookUnit(graphToken, manifest, source)
        : await fetchPlannerTasksUnit(graphToken, source)
      // planSourceUpdate (job-machine.ts) owns the transition: a Graph error fails the
      // source (retryable) instead of pinning it in fetching_tasks; a cursor keeps
      // paging; pending detail work moves to fetching_details; otherwise complete.
      const update = planSourceUpdate(result, attempts)
      if (pick.source_type === 'planner_plan' && update.stage === 'complete') {
        const assignees = await resolveAssignees(update.records.flatMap(r => (r.assigneeMicrosoftIds as string[]) ?? []), graphToken)
        await mergeAssignees(sb, jobId, job.assignee_map as Record<string, unknown>, assignees)
      }
      await sb.from('microsoft_sync_job_sources').update({ ...update, updated_at: now() }).eq('id', dbId)
    } else {
      const { data: full } = await sb.from('microsoft_sync_job_sources').select('records, pending_detail_ids, safe_error').eq('id', dbId).single()
      const records = Array.isArray(full?.records) ? full!.records as Array<Record<string, unknown>> : []
      const pending = Array.isArray(full?.pending_detail_ids) ? full!.pending_detail_ids as string[] : []
      const { batch, rest } = nextDetailBatch(pending)
      const { descriptions, complete } = await graphTaskDescriptions(batch, graphToken)
      for (const record of records) {
        const taskId = String(record.sourceTaskId ?? '')
        if (descriptions.has(taskId)) record.description = descriptions.get(taskId) ?? null
      }
      if (rest.length === 0) {
        const assignees = await resolveAssignees(records.flatMap(r => (r.assigneeMicrosoftIds as string[]) ?? []), graphToken)
        await mergeAssignees(sb, jobId, job.assignee_map as Record<string, unknown>, assignees)
        await sb.from('microsoft_sync_job_sources').update({ stage: 'complete', complete: complete && (full?.safe_error ?? null) === null, records, pending_detail_ids: [], updated_at: now() }).eq('id', dbId)
      } else {
        await sb.from('microsoft_sync_job_sources').update({ records, pending_detail_ids: rest, safe_error: complete ? (full?.safe_error ?? null) : 'Some Planner task details could not be fetched.', updated_at: now() }).eq('id', dbId)
      }
    }
  } catch {
    await sb.from('microsoft_sync_job_sources').update({ stage: 'failed', safe_error: 'The source could not be fetched. Retry the failed source.', updated_at: now() }).eq('id', dbId)
  }

  const { data: after } = await sb.from('microsoft_sync_job_sources').select(SOURCE_FIELDS).eq('job_id', jobId)
  const afterRows = asJobRows(after ?? [])
  const progress = jobProgress(afterRows)
  if (progress.finished) {
    await sb.from('microsoft_sync_jobs').update({ status: requiredSourcesComplete(afterRows) ? 'complete' : 'running', updated_at: now() }).eq('id', jobId)
  }
  if (systemRequest && progress.finished && requiredSourcesComplete(afterRows)) {
    const automatic = await automaticallyApplyJob(sb, jobId)
    return jsonResponse({ ok: automatic.status !== 'failed', phase: 'apply', jobId, finished: true, sources: statusList(after ?? []), progress, automatic }, automatic.status === 'failed' ? 500 : 200)
  }
  return jsonResponse({ ok: true, jobId, finished: progress.finished, sources: statusList(after ?? []), progress })
})

async function automaticallyApplyJob(sb: ReturnType<typeof createClient>, jobId: string) {
  const { data: existing } = await sb.from('microsoft_sync_runs').select('id,status,summary,safe_error,started_at,automatic_recovery_count,automatic_recovery_after').eq('preview_job_id', jobId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  let recoveryRunId: string | undefined
  let recoveryGeneration = 0
  if (existing) {
    const recovery = planAutomaticApplyRecovery({ status: existing.status, startedAt: existing.started_at, recoveryCount: Number(existing.automatic_recovery_count ?? 0), recoveryAfter: existing.automatic_recovery_after ?? null, now: new Date().toISOString() })
    if (recovery.kind === 'terminal' || recovery.kind === 'fresh') return { status: existing.status, runId: existing.id, ...(existing.summary ?? {}), error: existing.safe_error ?? null }
    if (recovery.kind === 'exhausted') {
      const error = 'Automatic Microsoft apply recovery was exhausted; the last verified mirror remains in use.'
      await sb.from('microsoft_sync_runs').update({ status: 'failed', safe_error: error, finished_at: new Date().toISOString() }).eq('id', existing.id).eq('status', 'applying')
      return { status: 'failed' as const, runId: existing.id, ...(existing.summary ?? {}), error }
    }
    const { data: claimed } = await sb.rpc('claim_microsoft_automatic_apply_recovery', { p_run_id: existing.id })
    if (!claimed) return { status: 'applying' as const, runId: existing.id, ...(existing.summary ?? {}), error: null }
    recoveryRunId = existing.id
    recoveryGeneration = Number(existing.automatic_recovery_count ?? 0) + 1
  }
  const [{ data: job }, { data: rows }] = await Promise.all([
    sb.from('microsoft_sync_jobs').select('assignee_map,exported_at').eq('id', jobId).single(),
    sb.from('microsoft_sync_job_sources').select('position,source_type,source_id,source_name,required,stage,record_count,complete,safe_error,records,range_start,range_end,pagination_cursor').eq('job_id', jobId),
  ])
  const jobRows = (rows ?? []).map((row: Record<string, unknown>) => ({
    position: Number(row.position), source_type: String(row.source_type), source_id: String(row.source_id), source_name: String(row.source_name), required: Boolean(row.required), stage: row.stage as JobSourceRow['stage'], record_count: Number(row.record_count), complete: Boolean(row.complete), safe_error: row.safe_error as string | null, pending_detail_ids: [], range_start: row.range_start as string | null, range_end: row.range_end as string | null, pagination_cursor: row.pagination_cursor as string | null, records: Array.isArray(row.records) ? row.records as Array<Record<string, unknown>> : [],
  }))
  if (!job || !requiredSourcesComplete(jobRows)) return { status: 'failed' as const, runId: null, applied: 0, skipped: 0, failed: 1, conflicts: 0, clientScheduleExcluded: 0, error: 'Required Microsoft sources are incomplete.' }
  const exportedAt = (job.exported_at as string | null) ?? new Date().toISOString()
  const snapshot = assembleSnapshot(jobRows, (job.assignee_map as Record<string, unknown>) ?? {}, exportedAt)
  if (!job.exported_at) await sb.from('microsoft_sync_jobs').update({ exported_at: exportedAt, status: 'complete', updated_at: exportedAt }).eq('id', jobId)
  return applyAutomaticMicrosoftMirrors(sb, snapshot, jobId, Deno.env.get('MICROSOFT_SYNC_SYSTEM_USER_ID') ?? '', recoveryRunId, recoveryGeneration)
}

async function mergeAssignees(
  sb: ReturnType<typeof createClient>,
  jobId: string,
  current: Record<string, unknown>,
  additions: Record<string, unknown>,
): Promise<void> {
  if (Object.keys(additions).length === 0) return
  const merged = { ...(current ?? {}), ...additions }
  await sb.from('microsoft_sync_jobs').update({ assignee_map: merged, updated_at: new Date().toISOString() }).eq('id', jobId)
}
