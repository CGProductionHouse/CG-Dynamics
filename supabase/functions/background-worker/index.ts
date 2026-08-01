// CG Assistant durable background worker (DEPLOYED, verify_jwt=false).
// Drains the background_jobs queue server-side using the injected service role,
// so jobs continue after the app closes. Invoked on a schedule (pg_cron ->
// pg_net) and opportunistically by the app. verify_jwt is false because it only
// drains the durable queue with its own service role; it performs no action on
// behalf of the caller and trusts nothing from the request body.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const MAX_RUNTIME_MS = 25_000
const MAX_JOBS_PER_RUN = 25

interface JobRow {
  id: string
  job_type: string
  payload: Record<string, unknown>
  requested_by: string | null
  requested_by_name: string | null
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
      const result = await runJob(supabase, job as JobRow, url)
      await supabase.rpc('complete_background_job', { p_id: job.id, p_result: result })
      processed.push({ id: job.id, job_type: job.job_type, ok: true })
    } catch (err) {
      await supabase.rpc('fail_background_job', { p_id: job.id, p_error: String(err instanceof Error ? err.message : err).slice(0, 500) })
      processed.push({ id: job.id, job_type: job.job_type, ok: false })
    }
  }

  return new Response(JSON.stringify({ ok: true, worker, processed }), { headers: { 'Content-Type': 'application/json' } })
})

// Runs one job to its real completion and returns a TRUTHFUL result summary that
// is stored on the job row. Throwing marks the job failed (with retry/backoff).
async function runJob(
  supabase: ReturnType<typeof createClient>,
  job: JobRow,
  url: string,
): Promise<Record<string, unknown>> {
  await supabase.rpc('update_background_job_progress', { p_id: job.id, p_progress: 10 })
  const payload = (job.payload ?? {}) as Record<string, unknown>

  switch (job.job_type) {
    case 'meta_sync': {
      // REAL Meta sync, headless: drive the existing durable batch engine
      // (meta_sync_batches + meta-sync-worker). meta-sync-worker runs the full
      // connector — posts, mappings and syncAccountFacts truth — authorised by
      // the shared META_SYNC_WORKER_SECRET project secret (the same secret the
      // engine already uses to self-continue). The durable job stays truthful:
      // it only succeeds once the batch finishes with at least one completed
      // item, throws (-> retry with backoff) while items are still processing,
      // and fails when the whole batch failed.
      return await runMetaSyncBatch(supabase, job, url, payload)
    }
    case 'report_prep': {
      // Real report preparation: idempotent find-or-create of the previous-month
      // master draft report per active client via a SECURITY DEFINER RPC. Running
      // it twice creates nothing the second time (reused count rises instead).
      await supabase.rpc('update_background_job_progress', { p_id: job.id, p_progress: 40 })
      const args = typeof payload.month === 'string' ? { p_month: payload.month } : {}
      const { data, error } = await supabase.rpc('prepare_monthly_reports', args)
      if (error) throw new Error(error.message)
      await supabase.rpc('update_background_job_progress', { p_id: job.id, p_progress: 90 })
      return { ok: true, ...(data as Record<string, unknown>) }
    }
    default:
      return { ok: true, skipped: `unknown job_type ${job.job_type}` }
  }
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
): Promise<Record<string, unknown>> {
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

  await supabase.rpc('update_background_job_progress', { p_id: job.id, p_progress: 30 })

  // Drive the engine: invoke meta-sync-worker for this batch and wait for the
  // synchronous part. The worker self-continues for large batches.
  const workerSecret = (Deno.env.get('META_SYNC_WORKER_SECRET') ?? '').trim()
  if (!workerSecret) throw new Error('META_SYNC_WORKER_SECRET is not configured; headless Meta sync cannot authorise.')
  const res = await fetch(`${url}/functions/v1/meta-sync-worker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-worker-secret': workerSecret },
    body: JSON.stringify({ batchId }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`meta-sync-worker HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  await res.json().catch(() => null)
  await supabase.rpc('update_background_job_progress', { p_id: job.id, p_progress: 70 })

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
    // Still processing — fail the attempt so the durable queue retries with
    // backoff and this handler resumes the SAME batch (idempotent above).
    throw new Error(`Meta sync batch is still processing (${pending} item(s) remaining). Retrying.`)
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

  await supabase.rpc('update_background_job_progress', { p_id: job.id, p_progress: 95 })
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
