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
  assembleSnapshot,
  enumerateJobSources,
  jobProgress,
  type JobSourceRow,
  nextDetailBatch,
  pickNextSource,
  requiredSourcesComplete,
  type SourceManifest,
} from './job-machine.ts'

interface GraphPageResult { values: Array<Record<string, unknown>>; complete: boolean; safeError: string | null }
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

async function graphPages(path: string, token: string, prefer?: string): Promise<GraphPageResult> {
  const values: Array<Record<string, unknown>> = []
  let next: string | null = path.startsWith('https://') ? path : `${GRAPH_ROOT}${path}`
  while (next) {
    const response = await fetchGraph(next, token, prefer)
    if (!response) return { values, complete: false, safeError: 'Microsoft connector request failed after bounded retries.' }
    if (!response.ok) return { values, complete: false, safeError: safeMessage(response.status) }
    const body = await response.json() as { value?: Array<Record<string, unknown>>; '@odata.nextLink'?: string }
    values.push(...(body.value ?? []))
    if (values.length > 5000) return { values: values.slice(0, 5000), complete: false, safeError: 'Microsoft source exceeded the 5,000 record safety cap.' }
    next = body['@odata.nextLink'] ?? null
  }
  return { values, complete: true, safeError: null }
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

// Resolve Planner assignee display names for a batch of Microsoft user ids.
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

// ── Per-source bounded fetch units ───────────────────────────────────────────
async function fetchOutlookUnit(token: string, manifest: SourceManifest, source: JobSourceRow) {
  const path = `/users/${encodeURIComponent(manifest.userId)}/calendars/${encodeURIComponent(source.source_id)}/calendarView?startDateTime=${encodeURIComponent(source.range_start ?? '')}&endDateTime=${encodeURIComponent(source.range_end ?? '')}&$select=id,subject,bodyPreview,start,end,isAllDay,isCancelled,sensitivity,location,attendees,lastModifiedDateTime`
  const result = await graphPages(path, token, 'IdType="ImmutableId", outlook.timezone="South Africa Standard Time"')
  const records = result.values.map(event => {
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
  return { records, complete: result.complete, safeError: result.safeError }
}

async function fetchPlannerTasksUnit(token: string, source: JobSourceRow) {
  const [taskResult, bucketResult] = await Promise.all([
    graphPages(`/planner/plans/${encodeURIComponent(source.source_id)}/tasks`, token),
    graphPages(`/planner/plans/${encodeURIComponent(source.source_id)}/buckets`, token),
  ])
  const buckets = new Map(bucketResult.values.map(bucket => [String(bucket.id ?? ''), String(bucket.name ?? '')]))
  const records = taskResult.values.map(task => {
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
  const detailIds = records.filter(r => r._needsDetail).map(r => r.sourceTaskId).filter(Boolean)
  return {
    records: records.map(({ _needsDetail: _drop, ...record }) => record),
    detailIds,
    complete: taskResult.complete && bucketResult.complete,
    safeError: taskResult.safeError ?? bucketResult.safeError,
  }
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ ok: false, error: 'Server configuration error.' }, 500)
  const sb = createClient(supabaseUrl, serviceRoleKey)
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: { user }, error: authError } = await sb.auth.getUser(token)
  if (authError || !user) return jsonResponse({ ok: false, error: 'Authentication required.' }, 401)
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return jsonResponse({ ok: false, error: 'Admin access required.' }, 403)

  let body: { action?: string; rangeStart?: string; rangeEnd?: string; jobId?: string }
  try { body = await request.json() } catch { return jsonResponse({ ok: false, error: 'Invalid request body.' }, 400) }

  const tenantId = Deno.env.get('MICROSOFT_TENANT_ID')
  const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')
  const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET')
  let manifest: SourceManifest | null = null
  try {
    const raw = Deno.env.get('MICROSOFT_SYNC_SOURCES_JSON')
    if (raw) manifest = JSON.parse(raw) as SourceManifest
  } catch { manifest = null }
  // Merge admin-managed plan sources so a plan (e.g. "2025 CLIENTS SCHEDULE") is
  // fetched without editing the secret. Dedup by id; env wins. Read-only to MS.
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
    return jsonResponse({
      ok: true,
      connected: !settingError && configured && transitionStatus === 'active',
      transitionStatus,
      message: settingError ? 'Microsoft transition lifecycle status is unavailable.' : !configured ? 'Microsoft transition connection is not configured.' : transitionStatus !== 'active' ? `Microsoft transition sync is ${transitionStatus}.` : 'Microsoft transition connection is available.',
      sources: manifest ? publicSources(manifest) : [],
    })
  }

  const action = body.action ?? ''
  const JOB_ACTIONS = new Set(['job_start', 'job_process', 'job_status', 'job_result', 'job_retry', 'job_latest'])
  if (!JOB_ACTIONS.has(action)) {
    if (action === 'fetch') return jsonResponse({ ok: false, error: 'The one-shot fetch is retired. Use a durable preview job (job_start / job_process / job_result).' }, 410)
    return jsonResponse({ ok: false, error: 'Unsupported action.' }, 400)
  }
  if (settingError) return jsonResponse({ ok: false, error: 'Microsoft transition lifecycle status is unavailable.' }, 503)
  if (!configured || !manifest || !tenantId || !clientId || !clientSecret) return jsonResponse({ ok: false, error: 'Microsoft transition connection is not configured.' }, 503)
  if (transitionStatus !== 'active') return jsonResponse({ ok: false, error: `Microsoft transition sync is ${transitionStatus}.` }, 409)

  const SOURCE_FIELDS = 'id, position, source_type, source_id, source_name, required, stage, record_count, complete, safe_error, pending_detail_ids, range_start, range_end, attempts'
  const statusList = (rows: Array<Record<string, unknown>>) => rows
    .map(r => ({ id: r.id, position: r.position, sourceType: r.source_type, sourceId: r.source_id, sourceName: r.source_name, required: r.required, stage: r.stage, recordCount: r.record_count, complete: r.complete, safeError: r.safe_error, detailsRemaining: Array.isArray(r.pending_detail_ids) ? (r.pending_detail_ids as unknown[]).length : 0 }))
    .sort((a, b) => Number(a.position) - Number(b.position))
  const asJobRows = (rows: Array<Record<string, unknown>>): JobSourceRow[] => rows.map(r => ({
    position: Number(r.position), source_type: String(r.source_type), source_id: String(r.source_id), source_name: String(r.source_name),
    required: Boolean(r.required), stage: r.stage as JobSourceRow['stage'], record_count: Number(r.record_count), complete: Boolean(r.complete),
    safe_error: (r.safe_error as string) ?? null, pending_detail_ids: Array.isArray(r.pending_detail_ids) ? (r.pending_detail_ids as string[]) : [],
    range_start: (r.range_start as string) ?? null, range_end: (r.range_end as string) ?? null,
  }))

  // ── job_start ───────────────────────────────────────────────────────────────
  if (action === 'job_start') {
    if (!body.rangeStart || !body.rangeEnd || Number.isNaN(Date.parse(body.rangeStart)) || Number.isNaN(Date.parse(body.rangeEnd)) || Date.parse(body.rangeEnd) <= Date.parse(body.rangeStart)) {
      return jsonResponse({ ok: false, error: 'A valid bounded calendar range is required.' }, 400)
    }
    if (Date.parse(body.rangeEnd) - Date.parse(body.rangeStart) > 370 * 24 * 60 * 60 * 1000) return jsonResponse({ ok: false, error: 'Outlook range cannot exceed 370 days.' }, 400)
    // Supersede any earlier running job for this admin so status is unambiguous.
    await sb.from('microsoft_sync_jobs').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('created_by', user.id).eq('status', 'running')
    const { data: job, error: jobError } = await sb.from('microsoft_sync_jobs').insert({ status: 'running', range_start: body.rangeStart, range_end: body.rangeEnd, created_by: user.id }).select('id').single()
    if (jobError || !job) return jsonResponse({ ok: false, error: 'Could not start the preview job.' }, 500)
    const seeds = enumerateJobSources(manifest, body.rangeStart, body.rangeEnd)
    const { error: seedError } = await sb.from('microsoft_sync_job_sources').insert(seeds.map(s => ({ job_id: job.id, position: s.position, source_type: s.source_type, source_id: s.source_id, source_name: s.source_name, required: s.required, range_start: s.range_start, range_end: s.range_end })))
    if (seedError) return jsonResponse({ ok: false, error: 'Could not enumerate preview sources.' }, 500)
    const { data: rows } = await sb.from('microsoft_sync_job_sources').select(SOURCE_FIELDS).eq('job_id', job.id)
    return jsonResponse({ ok: true, jobId: job.id, status: 'running', sources: statusList(rows ?? []), progress: jobProgress(asJobRows(rows ?? [])) })
  }

  // ── job_latest (resume) ──────────────────────────────────────────────────────
  if (action === 'job_latest') {
    const { data: job } = await sb.from('microsoft_sync_jobs').select('id, status, range_start, range_end, created_at').eq('created_by', user.id).in('status', ['running', 'complete']).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!job) return jsonResponse({ ok: true, job: null })
    const { data: rows } = await sb.from('microsoft_sync_job_sources').select(SOURCE_FIELDS).eq('job_id', job.id)
    return jsonResponse({ ok: true, job: { jobId: job.id, status: job.status, rangeStart: job.range_start, rangeEnd: job.range_end }, sources: statusList(rows ?? []), progress: jobProgress(asJobRows(rows ?? [])) })
  }

  const jobId = typeof body.jobId === 'string' ? body.jobId : ''
  if (!jobId) return jsonResponse({ ok: false, error: 'jobId is required.' }, 400)
  const { data: job } = await sb.from('microsoft_sync_jobs').select('id, status, assignee_map, range_start, range_end').eq('id', jobId).eq('created_by', user.id).maybeSingle()
  if (!job) return jsonResponse({ ok: false, error: 'Preview job not found.' }, 404)

  // ── job_status ───────────────────────────────────────────────────────────────
  if (action === 'job_status') {
    const { data: rows } = await sb.from('microsoft_sync_job_sources').select(SOURCE_FIELDS).eq('job_id', jobId)
    return jsonResponse({ ok: true, jobId, status: job.status, sources: statusList(rows ?? []), progress: jobProgress(asJobRows(rows ?? [])) })
  }

  // ── job_retry (failed sources only) ──────────────────────────────────────────
  if (action === 'job_retry') {
    await sb.from('microsoft_sync_job_sources').update({ stage: 'queued', safe_error: null, records: [], pending_detail_ids: [], record_count: 0, complete: false, updated_at: new Date().toISOString() }).eq('job_id', jobId).eq('stage', 'failed')
    await sb.from('microsoft_sync_jobs').update({ status: 'running', updated_at: new Date().toISOString() }).eq('id', jobId)
    const { data: rows } = await sb.from('microsoft_sync_job_sources').select(SOURCE_FIELDS).eq('job_id', jobId)
    return jsonResponse({ ok: true, jobId, status: 'running', sources: statusList(rows ?? []), progress: jobProgress(asJobRows(rows ?? [])) })
  }

  // ── job_result (assemble once every required source completes) ───────────────
  if (action === 'job_result') {
    const { data: rows } = await sb.from('microsoft_sync_job_sources').select('position, source_type, source_id, source_name, required, stage, record_count, complete, safe_error, records, range_start, range_end').eq('job_id', jobId)
    const jobRows = (rows ?? []).map(r => ({ ...asJobRows([r])[0], records: Array.isArray(r.records) ? (r.records as Array<Record<string, unknown>>) : [] }))
    if (!requiredSourcesComplete(jobRows)) return jsonResponse({ ok: false, error: 'Preview is not complete yet.', progress: jobProgress(jobRows) }, 409)
    const exportedAt = new Date().toISOString()
    const snapshot = assembleSnapshot(jobRows, (job.assignee_map as Record<string, unknown>) ?? {}, exportedAt)
    await sb.from('microsoft_sync_jobs').update({ status: 'complete', exported_at: exportedAt, updated_at: exportedAt }).eq('id', jobId)
    return jsonResponse({ ok: true, jobId, snapshot })
  }

  // ── job_process (one bounded unit) ───────────────────────────────────────────
  // Claim the next source and do exactly ONE bounded unit of work, then return.
  // The admin page polls this until the job is finished — every invocation stays
  // well under the Edge time budget even for a 4,000-task plan.
  const { data: rows } = await sb.from('microsoft_sync_job_sources').select(SOURCE_FIELDS).eq('job_id', jobId)
  const jobRows = asJobRows(rows ?? [])
  const rowIndex = new Map((rows ?? []).map(r => [`${r.source_type}:${r.source_id}`, r]))
  const pick = pickNextSource(jobRows)
  if (!pick) {
    const done = requiredSourcesComplete(jobRows)
    await sb.from('microsoft_sync_jobs').update({ status: done ? 'complete' : (jobProgress(jobRows).anyFailed ? 'running' : 'complete'), updated_at: new Date().toISOString() }).eq('id', jobId)
    return jsonResponse({ ok: true, jobId, finished: true, sources: statusList(rows ?? []), progress: jobProgress(jobRows) })
  }
  const dbRow = rowIndex.get(`${pick.source_type}:${pick.source_id}`) as Record<string, unknown>
  const dbId = String(dbRow.id)
  const graphToken = await accessToken(tenantId, clientId, clientSecret)
  if (!graphToken) return jsonResponse({ ok: false, error: 'Microsoft connection could not be authenticated.' }, 503)
  const now = () => new Date().toISOString()

  try {
    if (pick.source_type === 'outlook_calendar') {
      await sb.from('microsoft_sync_job_sources').update({ stage: 'fetching_tasks', attempts: (Number(dbRow.attempts) || 0) + 1, updated_at: now() }).eq('id', dbId)
      const result = await fetchOutlookUnit(graphToken, manifest, pick)
      await sb.from('microsoft_sync_job_sources').update({ stage: 'complete', complete: result.complete, safe_error: result.safeError, records: result.records, record_count: result.records.length, updated_at: now() }).eq('id', dbId)
    } else if (pick.stage === 'queued') {
      await sb.from('microsoft_sync_job_sources').update({ stage: 'fetching_tasks', attempts: (Number(dbRow.attempts) || 0) + 1, updated_at: now() }).eq('id', dbId)
      const result = await fetchPlannerTasksUnit(graphToken, pick)
      if (result.detailIds.length === 0) {
        const assignees = await resolveAssignees(result.records.flatMap(r => (r.assigneeMicrosoftIds as string[]) ?? []), graphToken)
        await mergeAssignees(sb, jobId, job.assignee_map as Record<string, unknown>, assignees)
        await sb.from('microsoft_sync_job_sources').update({ stage: 'complete', complete: result.complete, safe_error: result.safeError, records: result.records, record_count: result.records.length, pending_detail_ids: [], updated_at: now() }).eq('id', dbId)
      } else {
        await sb.from('microsoft_sync_job_sources').update({ stage: 'fetching_details', safe_error: result.safeError, records: result.records, record_count: result.records.length, pending_detail_ids: result.detailIds, updated_at: now() }).eq('id', dbId)
      }
    } else {
      // fetching_details: one bounded batch of descriptions
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
  } catch (_error) {
    await sb.from('microsoft_sync_job_sources').update({ stage: 'failed', safe_error: 'The source could not be fetched. Retry the failed source.', updated_at: now() }).eq('id', dbId)
  }

  const { data: after } = await sb.from('microsoft_sync_job_sources').select(SOURCE_FIELDS).eq('job_id', jobId)
  const afterRows = asJobRows(after ?? [])
  const progress = jobProgress(afterRows)
  if (progress.finished) {
    await sb.from('microsoft_sync_jobs').update({ status: requiredSourcesComplete(afterRows) ? 'complete' : 'running', updated_at: now() }).eq('id', jobId)
  }
  return jsonResponse({ ok: true, jobId, finished: progress.finished, sources: statusList(after ?? []), progress })
})

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
