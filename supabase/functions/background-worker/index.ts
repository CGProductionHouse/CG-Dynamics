// CG Assistant durable background worker (DEPLOYED, verify_jwt=false).
// Drains the background_jobs queue server-side using the injected service role,
// so jobs continue after the app closes. Invoked on a schedule (pg_cron ->
// pg_net) and opportunistically by the app. verify_jwt is false because it only
// drains the durable queue with its own service role; it performs no action on
// behalf of the caller and trusts nothing from the request body.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const MAX_RUNTIME_MS = 25_000
const MAX_JOBS_PER_RUN = 25

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
      await runJob(supabase, job, url, serviceKey)
      await supabase.rpc('complete_background_job', { p_id: job.id, p_result: { ok: true } })
      processed.push({ id: job.id, job_type: job.job_type, ok: true })
    } catch (err) {
      await supabase.rpc('fail_background_job', { p_id: job.id, p_error: String(err instanceof Error ? err.message : err).slice(0, 500) })
      processed.push({ id: job.id, job_type: job.job_type, ok: false })
    }
  }

  return new Response(JSON.stringify({ ok: true, worker, processed }), { headers: { 'Content-Type': 'application/json' } })
})

async function runJob(supabase: ReturnType<typeof createClient>, job: { id: string; job_type: string; payload: Record<string, unknown> }, url: string, serviceKey: string): Promise<void> {
  await supabase.rpc('update_background_job_progress', { p_id: job.id, p_progress: 10 })
  switch (job.job_type) {
    case 'meta_sync': {
      const res = await fetch(`${url}/functions/v1/meta-sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(job.payload ?? {}),
      })
      if (!res.ok) throw new Error(`meta-sync returned ${res.status}`)
      break
    }
    case 'report_prep': {
      await supabase.rpc('update_background_job_progress', { p_id: job.id, p_progress: 60 })
      break
    }
    default:
      break
  }
}
