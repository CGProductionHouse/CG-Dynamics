import { supabase } from './supabase'

// Durable background jobs. Staff enqueue via the RLS-safe SECURITY DEFINER
// enqueue RPC (idempotent by key); a server-side worker Edge Function drains the
// queue on a schedule so jobs continue after the app closes. Users read only
// their own jobs (RLS); managers/admins read all.

export type BackgroundJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export interface BackgroundJob {
  id: string
  job_type: string
  status: BackgroundJobStatus
  payload: Record<string, unknown>
  result: Record<string, unknown> | null
  progress: number
  attempts: number
  max_attempts: number
  idempotency_key: string | null
  requested_by: string | null
  requested_by_name: string | null
  error: string | null
  run_after: string
  created_at: string
  updated_at: string
  finished_at: string | null
}

export interface EnqueueJobInput {
  jobType: string
  payload?: Record<string, unknown>
  idempotencyKey?: string | null
  maxAttempts?: number
}

export async function enqueueBackgroundJob(input: EnqueueJobInput) {
  return supabase.rpc('enqueue_background_job', {
    p_job_type: input.jobType,
    p_payload: input.payload ?? {},
    p_idempotency_key: input.idempotencyKey ?? null,
    p_max_attempts: input.maxAttempts ?? 3,
  })
}

export async function listMyBackgroundJobs(limit = 25) {
  return supabase
    .from('background_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
}

export async function getBackgroundJob(id: string) {
  return supabase.from('background_jobs').select('*').eq('id', id).single()
}

// Opportunistic nudge so a freshly enqueued job starts without waiting for the
// next scheduled tick. Fire-and-forget; the scheduled worker is the durable
// guarantee. Never throws.
export async function nudgeBackgroundWorker() {
  try {
    await supabase.functions.invoke('background-worker', { body: {} })
  } catch {
    /* the pg_cron schedule will drain it regardless */
  }
}
