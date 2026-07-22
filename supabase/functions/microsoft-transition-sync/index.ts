import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface SourceManifest {
  userId: string
  calendar?: { id: string; name: string }
  plans: Array<{ id: string; name: string }>
}

interface GraphPageResult {
  values: Array<Record<string, unknown>>
  complete: boolean
  safeError: string | null
}

interface GraphBatchItem {
  id: string
  status: number
  headers?: Record<string, string>
  body?: { description?: unknown }
}

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0'
const GRAPH_MAX_ATTEMPTS = 5
const GRAPH_BATCH_MAX_ATTEMPTS = 8
const GRAPH_RETRY_CAP_MS = 10_000

function sleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

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

function shouldRetry(response: Response): boolean {
  return shouldRetryStatus(response.status)
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

function batchRetryDelay(items: GraphBatchItem[], attempt: number): number {
  const retryAfterMilliseconds = items.reduce((maximum, item) => {
    const entry = Object.entries(item.headers ?? {}).find(([name]) => name.toLowerCase() === 'retry-after')
    const seconds = Number(entry?.[1])
    return Number.isFinite(seconds) ? Math.max(maximum, seconds * 1000) : maximum
  }, 0)
  return Math.min(Math.max(retryAfterMilliseconds, retryDelay(null, attempt)), GRAPH_RETRY_CAP_MS)
}

async function fetchGraph(url: string, token: string, prefer?: string, init: RequestInit = {}): Promise<Response | null> {
  for (let attempt = 0; attempt < GRAPH_MAX_ATTEMPTS; attempt += 1) {
    let response: Response | null = null
    try {
      const headers = new Headers(init.headers)
      headers.set('Authorization', `Bearer ${token}`)
      if (prefer) headers.set('Prefer', prefer)
      response = await fetch(url, {
        ...init,
        headers,
        signal: AbortSignal.timeout(30_000),
      })
      if (response.ok || !shouldRetry(response)) return response
    } catch {
      // A bounded retry handles transient network and timeout failures.
    }
    if (attempt < GRAPH_MAX_ATTEMPTS - 1) await sleep(retryDelay(response, attempt))
  }
  return null
}

async function graphTaskDescriptions(taskIds: string[], token: string): Promise<{ descriptions: Map<string, string | null>; complete: boolean }> {
  const descriptions = new Map<string, string | null>()
  let complete = true
  for (let index = 0; index < taskIds.length; index += 20) {
    let pending = taskIds.slice(index, index + 20)
    for (let attempt = 0; pending.length > 0 && attempt < GRAPH_BATCH_MAX_ATTEMPTS; attempt += 1) {
      const response = await fetchGraph(`${GRAPH_ROOT}/$batch`, token, undefined, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: pending.map(taskId => ({ id: taskId, method: 'GET', url: `/planner/tasks/${encodeURIComponent(taskId)}/details` })) }),
      })
      if (!response?.ok) { complete = false; break }
      const body = await response.json() as { responses?: GraphBatchItem[] }
      const results = new Map((body.responses ?? []).map(item => [item.id, item]))
      const retry: string[] = []
      const throttled: GraphBatchItem[] = []
      for (const taskId of pending) {
        const item = results.get(taskId)
        if (item?.status === 200) {
          descriptions.set(taskId, typeof item.body?.description === 'string' ? item.body.description : null)
        } else if (item && shouldRetryStatus(item.status)) {
          retry.push(taskId)
          throttled.push(item)
        } else if (!item) {
          retry.push(taskId)
        } else {
          complete = false
        }
      }
      pending = retry
      if (pending.length > 0 && attempt < GRAPH_BATCH_MAX_ATTEMPTS - 1) await sleep(batchRetryDelay(throttled, attempt))
    }
    if (pending.length > 0) complete = false
    if (index + 20 < taskIds.length) await sleep(250)
  }
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
  } catch {
    return null
  }
}

function publicSources(manifest: SourceManifest) {
  return [
    ...(manifest.calendar ? [{ id: manifest.calendar.id, name: manifest.calendar.name, type: 'outlook_calendar' as const }] : []),
    ...manifest.plans.map(plan => ({ id: plan.id, name: plan.name, type: 'planner_plan' as const })),
  ]
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

  let body: { action?: string; rangeStart?: string; rangeEnd?: string }
  try { body = await request.json() } catch { return jsonResponse({ ok: false, error: 'Invalid request body.' }, 400) }

  const tenantId = Deno.env.get('MICROSOFT_TENANT_ID')
  const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')
  const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET')
  let manifest: SourceManifest | null = null
  try {
    const raw = Deno.env.get('MICROSOFT_SYNC_SOURCES_JSON')
    if (raw) manifest = JSON.parse(raw) as SourceManifest
  } catch {
    manifest = null
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
  if (body.action !== 'fetch') return jsonResponse({ ok: false, error: 'Unsupported action.' }, 400)
  if (settingError) return jsonResponse({ ok: false, error: 'Microsoft transition lifecycle status is unavailable.' }, 503)
  if (!configured || !manifest || !tenantId || !clientId || !clientSecret) return jsonResponse({ ok: false, error: 'Microsoft transition connection is not configured.' }, 503)
  if (transitionStatus !== 'active') return jsonResponse({ ok: false, error: `Microsoft transition sync is ${transitionStatus}.` }, 409)
  if (!body.rangeStart || !body.rangeEnd || Number.isNaN(Date.parse(body.rangeStart)) || Number.isNaN(Date.parse(body.rangeEnd)) || Date.parse(body.rangeEnd) <= Date.parse(body.rangeStart)) {
    return jsonResponse({ ok: false, error: 'A valid bounded calendar range is required.' }, 400)
  }
  if (Date.parse(body.rangeEnd) - Date.parse(body.rangeStart) > 370 * 24 * 60 * 60 * 1000) return jsonResponse({ ok: false, error: 'Outlook range cannot exceed 370 days.' }, 400)

  const graphToken = await accessToken(tenantId, clientId, clientSecret)
  if (!graphToken) return jsonResponse({ ok: false, error: 'Microsoft connection could not be authenticated.' }, 503)
  const records: Array<Record<string, unknown>> = []
  const sources: Array<Record<string, unknown>> = []

  if (manifest.calendar) {
    const path = `/users/${encodeURIComponent(manifest.userId)}/calendars/${encodeURIComponent(manifest.calendar.id)}/calendarView?startDateTime=${encodeURIComponent(body.rangeStart)}&endDateTime=${encodeURIComponent(body.rangeEnd)}&$select=id,subject,bodyPreview,start,end,isAllDay,isCancelled,sensitivity,location,attendees,lastModifiedDateTime`
    const result = await graphPages(path, graphToken, 'IdType="ImmutableId", outlook.timezone="South Africa Standard Time"')
    for (const event of result.values) {
      const privateEvent = Boolean(event.sensitivity && event.sensitivity !== 'normal')
      records.push({
        sourceType: 'outlook_event', sourceCalendarId: manifest.calendar.id, sourceEventId: String(event.id ?? ''),
        title: privateEvent ? 'Private Outlook event' : String(event.subject ?? ''), safeSummary: !privateEvent && typeof event.bodyPreview === 'string' ? event.bodyPreview : null,
        startDate: outlookIso(event.start), endDate: outlookIso(event.end) || null, allDay: Boolean(event.isAllDay),
        location: !privateEvent && typeof (event.location as { displayName?: unknown } | undefined)?.displayName === 'string' ? (event.location as { displayName: string }).displayName : null,
        cancelled: Boolean(event.isCancelled),
        assigneeMicrosoftIds: !privateEvent && Array.isArray(event.attendees) ? event.attendees.map(attendee => (attendee as { emailAddress?: { address?: unknown } }).emailAddress?.address).filter((value): value is string => typeof value === 'string') : [],
        sourceModifiedAt: typeof event.lastModifiedDateTime === 'string' ? event.lastModifiedDateTime : null,
        private: privateEvent,
      })
    }
    sources.push({ sourceType: 'outlook_calendar', sourceId: manifest.calendar.id, sourceName: manifest.calendar.name, complete: result.complete, rangeStart: body.rangeStart, rangeEnd: body.rangeEnd, recordCount: result.values.length, safeError: result.safeError })
  }

  for (const plan of manifest.plans) {
    const [taskResult, bucketResult] = await Promise.all([
      graphPages(`/planner/plans/${encodeURIComponent(plan.id)}/tasks`, graphToken),
      graphPages(`/planner/plans/${encodeURIComponent(plan.id)}/buckets`, graphToken),
    ])
    const buckets = new Map(bucketResult.values.map(bucket => [String(bucket.id ?? ''), String(bucket.name ?? '')]))
    const detailResult = await graphTaskDescriptions(taskResult.values.map(task => String(task.id ?? '')).filter(Boolean), graphToken)
    for (const task of taskResult.values) {
      const taskId = String(task.id ?? '')
      const bucketId = String(task.bucketId ?? '')
      records.push({
        sourceType: 'planner_task', sourcePlanId: plan.id, sourcePlanName: plan.name,
        sourceBucketId: bucketId, sourceBucketName: buckets.get(bucketId) ?? '', sourceTaskId: taskId,
        title: String(task.title ?? ''), description: detailResult.descriptions.get(taskId) ?? null,
        startDate: dateOnly(task.startDateTime), dueDate: dateOnly(task.dueDateTime),
        assigneeMicrosoftIds: task.assignments && typeof task.assignments === 'object' ? Object.keys(task.assignments as Record<string, unknown>) : [],
        percentComplete: typeof task.percentComplete === 'number' ? task.percentComplete : null,
        completedDate: dateOnly(task.completedDateTime),
        sourceModifiedAt: typeof task.lastModifiedDateTime === 'string' ? task.lastModifiedDateTime : null,
      })
    }
    const complete = taskResult.complete && bucketResult.complete && detailResult.complete
    sources.push({ sourceType: 'planner_plan', sourceId: plan.id, sourceName: plan.name, complete, rangeStart: null, rangeEnd: null, recordCount: taskResult.values.length, safeError: taskResult.safeError ?? bucketResult.safeError ?? (detailResult.complete ? null : 'Some Planner task details could not be fetched.') })
  }

  const assigneeIds = new Set<string>()
  for (const record of records) {
    if (record.sourceType === 'planner_task') {
      const ids = record.assigneeMicrosoftIds as string[]
      for (const id of ids) assigneeIds.add(id)
    }
  }
  const assigneeMap: Record<string, { displayName: string; mail: string | null; userPrincipalName: string | null }> = {}
  const idList = [...assigneeIds]
  for (let index = 0; index < idList.length; index += 20) {
    const batch = idList.slice(index, index + 20)
    const batchResult = await fetchGraph(`${GRAPH_ROOT}/$batch`, graphToken, undefined, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: batch.map(id => ({ id, method: 'GET', url: `/users/${encodeURIComponent(id)}?$select=id,displayName,mail,userPrincipalName` })) }),
    })
    if (batchResult?.ok) {
      const batchBody = await batchResult.json() as { responses?: Array<{ id: string; status: number; body?: { id?: string; displayName?: string; mail?: string; userPrincipalName?: string } }> }
      for (const item of batchBody.responses ?? []) {
        if (item.status === 200 && item.body) {
          const user = item.body
          assigneeMap[user.id ?? item.id] = { displayName: user.displayName ?? 'Unknown', mail: user.mail ?? null, userPrincipalName: user.userPrincipalName ?? null }
        }
      }
    }
    if (index + 20 < idList.length) await sleep(250)
  }

  return jsonResponse({
    ok: true,
    snapshot: { format: 'cg-dynamics-microsoft-snapshot', version: 3, exportedAt: new Date().toISOString(), exportedBy: 'CG Dynamics Microsoft transition sync', triggerType: 'admin', sources, records, assigneeMap },
  })
})
