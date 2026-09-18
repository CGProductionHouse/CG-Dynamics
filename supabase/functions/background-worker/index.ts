// CG Assistant durable background worker (DEPLOYED, verify_jwt=false).
// Drains the background_jobs queue server-side using the injected service role,
// so jobs continue after the app closes. Invoked on a schedule (pg_cron ->
// pg_net) and opportunistically by the app. verify_jwt is false because it only
// drains the durable queue with its own service role; it performs no action on
// behalf of the caller and trusts nothing from the request body.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { dispatchMetaWorker } from '../_shared/metaWorkerDispatch.ts'

const MAX_RUNTIME_MS = 25_000
const MAX_JOBS_PER_RUN = 25
// A live worker heartbeats every item (a few seconds apart) and each invocation
// runs ~35s. 120s is comfortably longer than one invocation plus its hand-off,
// so a healthy batch is never double-driven, while a dead one is picked up on
// the second or third cron tick.
const META_SYNC_STALE_SECONDS = 120
// Fleet freshness: enqueue proactive sync for assets whose checkpoint is due.
// Runs every background-worker invocation (every minute via cron). The check is
// cheap; if no assets are due it returns immediately. Bounded to 2 batches per
// invocation to avoid starving the job queue.
const META_FLEET_FRESHNESS_MAX_BATCHES = 2

interface JobRow {
  id: string
  job_type: string
  payload: Record<string, unknown>
  requested_by: string | null
  requested_by_name: string | null
}

interface JobResult extends Record<string, unknown> {
  waiting?: boolean
  progress?: number
}

Deno.serve(async () => {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_env' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
  const worker = `edge-${crypto.randomUUID().slice(0, 8)}`
  const processed: Array<{ id: string; job_type: string; ok: boolean }> = []
  const deadline = Date.now() + MAX_RUNTIME_MS

  while (Date.now() < deadline && processed.length < MAX_JOBS_PER_RUN) {
    const { data: job, error } = await supabase.rpc('claim_next_background_job', { p_worker: worker })
    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message, processed }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
    // claim returns an all-null composite row when the queue is empty; treat a
    // missing id as "nothing to do".
    if (!job || !job.id) break
    try {
      const result = await runJob(supabase, job as JobRow, url, worker)
      if (result.waiting === true) {
        const { error: deferError } = await supabase.rpc('defer_background_job', {
          p_id: job.id,
          p_locked_by: worker,
          p_progress: typeof result.progress === 'number' ? result.progress : 70,
          p_delay_seconds: 30,
        })
        if (deferError) throw new Error(`Could not defer background job: ${deferError.message}`)
        processed.push({ id: job.id, job_type: job.job_type, ok: true })
        continue
      }
      const { error: completeError } = await supabase.rpc('complete_background_job', {
        p_id: job.id,
        p_locked_by: worker,
        p_result: result,
      })
      if (completeError) throw new Error(`Could not complete background job: ${completeError.message}`)
      processed.push({ id: job.id, job_type: job.job_type, ok: true })
    } catch (err) {
      const failure = String(err instanceof Error ? err.message : err).slice(0, 500)
      const { error: failError } = await supabase.rpc('fail_background_job', {
        p_id: job.id,
        p_locked_by: worker,
        p_error: failure,
      })
      if (failError) {
        return new Response(JSON.stringify({ ok: false, error: `Could not fail background job: ${failError.message}`, processed }), { status: 500, headers: { 'Content-Type': 'application/json' } })
      }
      processed.push({ id: job.id, job_type: job.job_type, ok: false })
    }
  }

  // ── Meta sync batch reaper ────────────────────────────────────────────────
  // The durable safety net for production blocker #161.
  //
  // Previously the ONLY thing that could drive a Meta sync batch was its
  // background_jobs row. Once that row exhausted its 3 attempts it became
  // terminally 'failed', and the batch was left 'running' with 69 items queued
  // and nothing on earth able to invoke a worker for it. The worker's own
  // self-continuation could not save it either — that chain dies after a few
  // hops.
  //
  // This runs on the existing per-minute cron tick and is deliberately
  // independent of background_jobs: any batch whose worker heartbeat has gone
  // stale while real work remains gets a worker, forever, until it finishes or
  // the bounded recovery budget declares it unrecoverable.
  const reaped = await reapStalledMetaSyncBatches(supabase, url)
  const laneRecoveries = await recoverMetaSyncLanes(supabase, url)

  // ── Fleet freshness enqueue ──────────────────────────────────────────────
  // Proactively create sync batches for assets whose per-platform checkpoint
  // next_due_at has passed. This implements automatic background freshness so
  // routine operation does not depend on a person pressing Sync.
  // Bounded to META_FLEET_FRESHNESS_MAX_BATCHES per invocation to avoid
  // starving the job queue. The checkpoints table already tracks freshness
  // state (Access/Coverage/Completeness/Freshness) independently.
  const fleetFreshness = await enqueueFleetMetaFreshness(supabase, url)

  return new Response(JSON.stringify({ ok: true, worker, processed, reaped, laneRecoveries, fleetFreshness }), { headers: { 'Content-Type': 'application/json' } })
})

interface LaneRecoveryRow {
  batch_id: string
  lane_id: number
  lane_count: number
}

async function recoverMetaSyncLanes(
  supabase: ReturnType<typeof createClient>,
  url: string,
): Promise<Array<{ batchId: string; laneId: number; invoked: boolean }>> {
  const { data, error } = await supabase.rpc('meta_sync_lane_recovery_candidates', { p_limit: 8 })
  if (error || !Array.isArray(data)) return []
  const workerSecret = (Deno.env.get('META_SYNC_WORKER_SECRET') ?? '').trim()
  if (!workerSecret) return []
  const results: Array<{ batchId: string; laneId: number; invoked: boolean }> = []
  for (const row of data as LaneRecoveryRow[]) {
    const invoked = await dispatchMetaWorker(`${url}/functions/v1/meta-sync-worker`, workerSecret, {
      batchId: row.batch_id,
      workerLane: row.lane_id,
      workerLanes: row.lane_count,
    })
    results.push({ batchId: row.batch_id, laneId: row.lane_id, invoked })
  }
  return results
}

interface StalledBatchRow {
  batch_id: string
  queued_items: number
  stale_running_items: number
  recovery_attempts: number
  seconds_since_heartbeat: number
}

async function reapStalledMetaSyncBatches(
  supabase: ReturnType<typeof createClient>,
  url: string,
): Promise<Array<{ batchId: string; queued: number; staleRunning: number; invoked: boolean; detail?: string }>> {
  const out: Array<{ batchId: string; queued: number; staleRunning: number; invoked: boolean; detail?: string }> = []

  const { data, error } = await supabase.rpc('meta_sync_stalled_batches', {
    p_stale_seconds: META_SYNC_STALE_SECONDS,
    p_limit: 2,
  })
  if (error || !Array.isArray(data) || data.length === 0) return out

  const workerSecret = (Deno.env.get('META_SYNC_WORKER_SECRET') ?? '').trim()

  for (const row of data as StalledBatchRow[]) {
    // Without the shared secret the reaper cannot authorise a worker. Record it
    // on the batch so the failure is visible in the UI rather than silent.
    if (!workerSecret) {
      await supabase.rpc('meta_sync_note_recovery', {
        p_batch_id: row.batch_id,
        p_error: 'META_SYNC_WORKER_SECRET is not configured, so the recovery worker cannot authorise.',
      })
      out.push({ batchId: row.batch_id, queued: row.queued_items, staleRunning: row.stale_running_items, invoked: false, detail: 'missing_secret' })
      continue
    }

    // Count the attempt BEFORE invoking. A worker that dies without reporting
    // must still consume recovery budget, otherwise an unrecoverable batch
    // would be retried every minute forever.
    const { data: note } = await supabase.rpc('meta_sync_note_recovery', { p_batch_id: row.batch_id, p_error: null })
    if (note && note.exhausted === true) {
      out.push({ batchId: row.batch_id, queued: row.queued_items, staleRunning: row.stale_running_items, invoked: false, detail: 'recovery_exhausted' })
      continue
    }

    let detail: string | undefined
    const invoked = await dispatchMetaWorker(
      `${url}/functions/v1/meta-sync-worker`, workerSecret, { batchId: row.batch_id },
    )
    if (!invoked) {
      detail = 'worker_admission_unconfirmed'
      await supabase.rpc('meta_sync_note_recovery', { p_batch_id: row.batch_id, p_error: detail })
    }

    out.push({ batchId: row.batch_id, queued: row.queued_items, staleRunning: row.stale_running_items, invoked, detail })
  }

  return out
}

interface FleetFreshnessBatch {
  batchId: string
  clientCount: number
  months: string[]
  assetCount: number
}

async function enqueueFleetMetaFreshness(
  supabase: ReturnType<typeof createClient>,
  url: string,
): Promise<Array<FleetFreshnessBatch | { detail: string }>> {
  const out: Array<FleetFreshnessBatch | { detail: string }> = []
  const workerSecret = (Deno.env.get('META_SYNC_WORKER_SECRET') ?? '').trim()
  if (!workerSecret) {
    return [{ detail: 'META_SYNC_WORKER_SECRET not configured' }]
  }

  // 1. Find asset/platform checkpoints that are due for sync.
  // Join with meta_client_assets to get client info and verify the asset is still active.
  // Only consider platforms that are actually linked (facebook_page_id or instagram_account_id not null).
  const { data: dueCheckpoints, error: checkpointError } = await supabase
    .from('meta_asset_sync_checkpoints')
    .select(`
      asset_id,
      client_id,
      platform,
      next_due_at,
      last_sync_kind,
      last_status,
      last_health_state,
      meta_client_assets!inner (
        id,
        client_id,
        facebook_page_id,
        instagram_account_id,
        is_active
      )
    `)
    .lte('next_due_at', new Date().toISOString())
    .order('next_due_at', { ascending: true })
    .limit(50)

  if (checkpointError || !dueCheckpoints || dueCheckpoints.length === 0) {
    return out
  }

  // Filter to only assets where the platform is actually linked
  const linkedDue = (dueCheckpoints as Array<{
    asset_id: string
    client_id: string
    platform: string
    next_due_at: string
    last_sync_kind: string
    last_status: string
    last_health_state: string
    meta_client_assets: {
      id: string
      client_id: string
      facebook_page_id: string | null
      instagram_account_id: string | null
      is_active: boolean
    }
  }>).filter(cp => {
    const asset = cp.meta_client_assets
    if (!asset.is_active) return false
    if (cp.platform === 'facebook' && !asset.facebook_page_id) return false
    if (cp.platform === 'instagram' && !asset.instagram_account_id) return false
    return true
  })

  if (linkedDue.length === 0) {
    return out
  }

  // 2. Group by client to create efficient multi-asset batches.
  // Each batch will sync the current period (incremental) for due assets.
  // For completed-month reconciliation, we also sync the previous completed month
  // if the last successful month is older than that (catches late Meta revisions).
  const byClient = new Map<string, Array<typeof linkedDue[0]>>()
  for (const cp of linkedDue) {
    const arr = byClient.get(cp.client_id) ?? []
    arr.push(cp)
    byClient.set(cp.client_id, arr)
  }

  const clientIds = Array.from(byClient.keys())
  const { data: clientRows } = await supabase
    .from('clients')
    .select('id, name')
    .in('id', clientIds)
  const clientNameMap = new Map<string, string>((clientRows ?? []).map(c => [c.id, c.name]))

  // 3. Determine months to sync for each client.
  // - Always sync the current period (incremental) for due assets.
  // - Also sync the previous completed month if last_successful_month is older
  //   (reconciliation for late Meta revisions).
  const currentMonth = currentMonthStr()
  const prevCompletedMonth = previousMonthStr(1)

  let batchesCreated = 0
  for (const [clientId, checkpoints] of byClient.entries()) {
    if (batchesCreated >= META_FLEET_FRESHNESS_MAX_BATCHES) break

    const clientName = clientNameMap.get(clientId) ?? 'Unknown'
    const assets = checkpoints.map(cp => ({
      assetId: cp.asset_id,
      clientId,
      clientName,
      platform: cp.platform,
    }))

    // Determine months: current period (incremental) + previous completed month if needed
    const months: string[] = [currentMonth]
    const needsReconciliation = checkpoints.some(cp => {
      if (!cp.last_successful_month) return true
      return cp.last_successful_month < prevCompletedMonth
    })
    if (needsReconciliation) months.push(prevCompletedMonth)

    // 4. Create the batch directly (bypassing meta-sync-enqueue HTTP to avoid auth overhead).
    // This mirrors the logic in meta-sync-enqueue but runs with service role.
    const uniqueAssets = [...new Map(assets.map(a => [a.assetId, a])).values()]
    const totalItems = months.length * uniqueAssets.length

    const { data: batch, error: batchError } = await supabase
      .from('meta_sync_batches')
      .insert({
        mode: 'all',
        requested_by: null, // system-initiated
        status: 'queued',
        sync_range_months: months.length,
        total_items: totalItems,
        completed_items: 0,
        failed_items: 0,
        summary: { months, clientCount: uniqueAssets.length, via: 'fleet_freshness' },
      })
      .select('id')
      .single()

    if (batchError || !batch) {
      out.push({ detail: `Failed to create batch for ${clientName}: ${batchError?.message ?? 'no id'}` })
      continue
    }

    const batchId = batch.id

    // Create batch items with sync_kind = 'incremental' for current period,
    // 'historical' for reconciliation month.
    const itemRows: Array<{
      batch_id: string
      client_id: string
      client_name: string
      asset_id: string
      sync_kind: string
      month: string
      status: string
    }> = []

    for (const month of months) {
      const kind = month === currentMonth ? 'incremental' : 'historical'
      for (const asset of uniqueAssets) {
        itemRows.push({
          batch_id: batchId,
          client_id: asset.clientId,
          client_name: asset.clientName,
          asset_id: asset.assetId,
          sync_kind: kind,
          month,
          status: 'queued',
        })
      }
    }

    const { error: itemsError } = await supabase
      .from('meta_sync_batch_items')
      .insert(itemRows)

    if (itemsError) {
      out.push({ detail: `Failed to create batch items for ${clientName}: ${itemsError.message}` })
      continue
    }

    // 5. Trigger the worker for this batch (fire-and-forget with short timeout).
    const workerUrl = Deno.env.get('META_SYNC_WORKER_URL') ?? `${url}/functions/v1/meta-sync-worker`
    try {
      await Promise.race([
        fetch(workerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-worker-secret': workerSecret,
          },
          body: JSON.stringify({ batchId, maxItems: 1, startLanes: true }),
        }),
        new Promise(resolve => setTimeout(resolve, 3_000)),
      ])
    } catch {
      // Worker may not be deployed yet — batch stays queued; reaper will pick it up.
    }

    batchesCreated++
    out.push({ batchId, clientCount: uniqueAssets.length, months, assetCount: uniqueAssets.length })
  }

  return out
}

function currentMonthStr(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

function previousMonthStr(offset = 1): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// Runs one job to its real completion and returns a TRUTHFUL result summary that
// is stored on the job row. Throwing marks the job failed (with retry/backoff).
async function runJob(
  supabase: ReturnType<typeof createClient>,
  job: JobRow,
  url: string,
  worker: string,
): Promise<JobResult> {
  await updateJobProgress(supabase, job.id, worker, 10)
  const payload = (job.payload ?? {}) as Record<string, unknown>

  switch (job.job_type) {
    case 'meta_sync': {
      // REAL Meta sync, headless: drive the existing durable batch engine
      // (meta_sync_batches + meta-sync-worker). meta-sync-worker runs the full
      // connector — posts, mappings and syncAccountFacts truth — authorised by
      // the shared META_SYNC_WORKER_SECRET project secret (the same secret the
      // engine already uses to self-continue). The durable job stays truthful:
      // it only succeeds once the batch finishes with at least one completed
      // item, defers without consuming attempts while items are still running,
      // and fails when the whole batch failed.
      return await runMetaSyncBatch(supabase, job, url, payload, worker)
    }
    case 'web_push_delivery': {
      return await runWebPushDelivery(supabase, payload)
    }
    case 'report_prep': {
      // Real report preparation: idempotent find-or-create of the previous-month
      // master draft report per active client via a SECURITY DEFINER RPC. Running
      // it twice creates nothing the second time (reused count rises instead).
      await updateJobProgress(supabase, job.id, worker, 40)
      const args = typeof payload.month === 'string' ? { p_month: payload.month } : {}
      const { data, error } = await supabase.rpc('prepare_monthly_reports', args)
      if (error) throw new Error(error.message)
      await updateJobProgress(supabase, job.id, worker, 90)
      return { ok: true, ...(data as Record<string, unknown>) }
    }
    default:
      throw new Error(`Unsupported background job type: ${job.job_type}`)
  }
}

async function updateJobProgress(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  worker: string,
  progress: number,
): Promise<void> {
  const { error } = await supabase.rpc('update_background_job_progress', {
    p_id: jobId,
    p_locked_by: worker,
    p_progress: progress,
  })
  if (error) throw new Error(`Could not update background job progress: ${error.message}`)
}

function previousMonthStr(offset = 1): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

async function runMetaSyncBatch(
  supabase: ReturnType<typeof createClient>,
  job: JobRow,
  url: string,
  payload: Record<string, unknown>,
  worker: string,
): Promise<JobResult> {
  // Months to sync: an explicit completed month, else the previous completed
  // month; a baseline request adds the month before that for comparison.
  const months: string[] = []
  if (typeof payload.month === 'string' && /^\d{4}-\d{2}$/.test(payload.month)) months.push(payload.month)
  else months.push(previousMonthStr(1))
  if (payload.baseline === true) months.push(previousMonthStr(2))

  // Idempotent per durable job: a retry continues the SAME batch instead of
  // creating a duplicate (the batch id is stamped with this job's id).
  let batchId: string | null = null
  {
    const { data: existing } = await supabase
      .from('meta_sync_batches')
      .select('id')
      .contains('summary', { background_job_id: job.id })
      .limit(1)
    if (existing && existing.length > 0) batchId = existing[0].id
  }

  if (!batchId) {
    // Linked, active clients only — the same population the sync engine serves.
    const { data: assets, error: assetsError } = await supabase
      .from('meta_client_assets')
      .select('client_id')
      .eq('is_active', true)
    if (assetsError) throw new Error(`Could not load linked Meta clients: ${assetsError.message}`)
    const clientIds = [...new Set((assets ?? []).map(a => a.client_id))]
    if (clientIds.length === 0) throw new Error('No clients are linked to Meta yet — nothing to sync.')
    const { data: clientRows } = await supabase.from('clients').select('id, name').in('id', clientIds)
    const nameMap = new Map<string, string>((clientRows ?? []).map(c => [c.id, c.name]))

    const { data: batch, error: batchError } = await supabase
      .from('meta_sync_batches')
      .insert({
        mode: 'all',
        requested_by: job.requested_by,
        status: 'queued',
        sync_range_months: months.length,
        total_items: months.length * clientIds.length,
        completed_items: 0,
        failed_items: 0,
        summary: { months, clientCount: clientIds.length, background_job_id: job.id, via: 'cg_assistant' },
      })
      .select('id')
      .single()
    if (batchError || !batch) throw new Error(`Could not create sync batch: ${batchError?.message ?? 'no id'}`)
    batchId = batch.id

    const items = months.flatMap(month => clientIds.map(clientId => ({
      batch_id: batchId,
      client_id: clientId,
      client_name: nameMap.get(clientId) ?? 'Unknown',
      month,
      status: 'queued',
    })))
    const { error: itemsError } = await supabase.from('meta_sync_batch_items').insert(items)
    if (itemsError) throw new Error(`Could not create sync batch items: ${itemsError.message}`)
  }

  await updateJobProgress(supabase, job.id, worker, 30)

  // Drive the engine: invoke meta-sync-worker for this batch and wait for the
  // synchronous part. The worker self-continues for large batches.
  const workerSecret = (Deno.env.get('META_SYNC_WORKER_SECRET') ?? '').trim()
  if (!workerSecret) throw new Error('META_SYNC_WORKER_SECRET is not configured; headless Meta sync cannot authorise.')
  let res: Response | null = null
  try {
    res = await fetch(`${url}/functions/v1/meta-sync-worker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-worker-secret': workerSecret },
      body: JSON.stringify({ batchId, startLanes: true }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (error) {
    if (!(error instanceof DOMException && ['TimeoutError', 'AbortError'].includes(error.name))) throw error
  }
  if (res && !res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`meta-sync-worker HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  if (res) await res.json().catch(() => null)
  await updateJobProgress(supabase, job.id, worker, 70)

  // Truthful terminal check from the batch itself.
  const { data: batchRow, error: batchReadError } = await supabase
    .from('meta_sync_batches')
    .select('status, total_items, completed_items, failed_items')
    .eq('id', batchId)
    .single()
  if (batchReadError || !batchRow) throw new Error('Could not read sync batch status.')

  const { count: pending } = await supabase
    .from('meta_sync_batch_items')
    .select('id', { count: 'exact', head: true })
    .eq('batch_id', batchId)
    .in('status', ['queued', 'running'])

  if ((pending ?? 0) > 0) {
    // Waiting for the durable batch is not a job failure. The caller releases
    // this lease without consuming an attempt and resumes the same batch later.
    return { waiting: true, progress: 70, batchId, itemsRemaining: pending }
  }

  const completed = batchRow.completed_items ?? 0
  const failed = batchRow.failed_items ?? 0
  if (completed === 0) {
    const { data: failedItems } = await supabase
      .from('meta_sync_batch_items')
      .select('client_name, month, error')
      .eq('batch_id', batchId)
      .eq('status', 'failed')
      .limit(3)
    const detail = (failedItems ?? []).map(i => `${i.client_name} ${i.month}: ${i.error ?? 'failed'}`).join('; ')
    throw new Error(`Meta sync failed for all items. ${detail}`.slice(0, 480))
  }

  await updateJobProgress(supabase, job.id, worker, 95)
  return {
    ok: true,
    batchId,
    months,
    status: failed > 0 ? 'partial' : 'success',
    itemsCompleted: completed,
    itemsFailed: failed,
    itemsTotal: batchRow.total_items ?? completed + failed,
  }
}

interface WebPushDeliveryRow {
  id: string
  subscription_id: string
  attempts: number
}

interface WebPushSubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth_secret: string
  is_active: boolean
}

function safePushLink(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/admin/assistant'
  return value.startsWith('/admin/') || value.startsWith('/dashboard') ? value : '/admin/assistant'
}

async function runWebPushDelivery(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
): Promise<JobResult> {
  const notificationId = typeof payload.notification_id === 'string' ? payload.notification_id : ''
  if (!/^[0-9a-f-]{36}$/i.test(notificationId)) throw new Error('Push job has no valid notification id.')
  const publicKey = (Deno.env.get('VAPID_PUBLIC_KEY') ?? '').trim()
  const privateKey = (Deno.env.get('VAPID_PRIVATE_KEY') ?? '').trim()
  const subject = (Deno.env.get('VAPID_SUBJECT') ?? 'mailto:info@cgproductionhouse.com').trim()
  if (!publicKey || !privateKey) throw new Error('Web Push VAPID keys are not configured.')

  const { data: notification, error: notificationError } = await supabase
    .from('notifications')
    .select('id,user_id,type,title,body,entity_type,entity_id,link')
    .eq('id', notificationId)
    .maybeSingle()
  if (notificationError) throw new Error(`Could not load push notification: ${notificationError.message}`)
  if (!notification) return { ok: true, skipped: 'notification_missing' }

  const { data: deliveries, error: deliveriesError } = await supabase
    .from('web_push_deliveries')
    .select('id,subscription_id,attempts')
    .eq('notification_id', notificationId)
    .in('status', ['queued', 'failed'])
    .lt('attempts', 4)
  if (deliveriesError) throw new Error(`Could not load push deliveries: ${deliveriesError.message}`)
  if (!deliveries?.length) return { ok: true, delivered: 0, remaining: 0 }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  const pushPayload = JSON.stringify({
    notificationId: notification.id,
    type: notification.type,
    title: String(notification.title ?? 'CG Dynamics').slice(0, 120),
    body: String(notification.body ?? 'You have a new notification.').slice(0, 240),
    url: safePushLink(notification.link),
  })
  let delivered = 0
  let expired = 0
  let transientFailures = 0

  for (const row of deliveries as WebPushDeliveryRow[]) {
    const { data: claimed } = await supabase.from('web_push_deliveries').update({
      status: 'processing', locked_at: new Date().toISOString(), attempts: row.attempts + 1,
    }).eq('id', row.id).in('status', ['queued', 'failed']).select('id').maybeSingle()
    if (!claimed) continue

    const { data: subscriptionData } = await supabase
      .from('web_push_subscriptions')
      .select('id,user_id,endpoint,p256dh,auth_secret,is_active')
      .eq('id', row.subscription_id)
      .eq('user_id', notification.user_id)
      .maybeSingle()
    const subscription = subscriptionData as WebPushSubscriptionRow | null
    if (!subscription?.is_active) {
      await supabase.from('web_push_deliveries').update({ status: 'expired', error_code: 'inactive_subscription' }).eq('id', row.id)
      expired += 1
      continue
    }

    try {
      const result = await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth_secret },
      }, pushPayload, { TTL: 300 })
      await supabase.from('web_push_deliveries').update({
        status: 'sent', provider_status: result.statusCode ?? 201,
        error_code: null, sent_at: new Date().toISOString(), locked_at: null,
      }).eq('id', row.id)
      await supabase.from('web_push_subscriptions').update({
        failure_count: 0, last_error_code: null, last_seen_at: new Date().toISOString(),
      }).eq('id', subscription.id)
      delivered += 1
    } catch (cause) {
      const error = cause as { statusCode?: number; body?: string; message?: string }
      const status = Number(error.statusCode ?? 0)
      if (status === 404 || status === 410) {
        await supabase.from('web_push_subscriptions').update({
          is_active: false, expires_at: new Date().toISOString(),
          failure_count: row.attempts + 1, last_error_code: `http_${status}`,
        }).eq('id', subscription.id)
        await supabase.from('web_push_deliveries').update({
          status: 'expired', provider_status: status, error_code: `http_${status}`, locked_at: null,
        }).eq('id', row.id)
        expired += 1
      } else {
        const errorCode = status ? `http_${status}` : 'delivery_error'
        await supabase.from('web_push_subscriptions').update({
          failure_count: row.attempts + 1, last_error_code: errorCode,
        }).eq('id', subscription.id)
        await supabase.from('web_push_deliveries').update({
          status: 'failed', provider_status: status || null, error_code: errorCode, locked_at: null,
        }).eq('id', row.id)
        transientFailures += 1
      }
    }
  }

  if (transientFailures > 0) throw new Error(`${transientFailures} Web Push delivery attempt(s) need retry.`)
  return { ok: true, delivered, expired }
}
