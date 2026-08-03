import {
  getMicrosoftConnectionStatus,
  startMicrosoftPreviewJob,
  processMicrosoftPreviewJob,
  getMicrosoftPreviewResult,
  type MicrosoftJobProgress,
} from './microsoftImportData'

// CG Assistant → Microsoft 365 controlled sync.
//
// The assistant must never assert connection state from a model guess: every
// run starts by reading the SAME live status the Integrations page reads
// (microsoft-transition-sync `status`), then drives the existing durable
// preview job (job_start → job_process ×N → job_result).
//
// This produces a reviewed reconciliation PREVIEW. It deliberately does not
// apply anything to the Client Schedule — apply stays behind the existing
// reviewed, admin-gated flow on the Microsoft Import page. Permissions (admin
// only), audit, idempotency and client/staff protections are all enforced
// server-side by the Edge Function; this module only orchestrates and reports.

export interface MicrosoftSyncOutcome {
  ok: boolean
  /** Truthful, user-facing summary of what actually happened. */
  message: string
  jobId?: string
  /** Set when the integration itself is unavailable, so the UI can be precise. */
  notConnected?: boolean
  progress?: MicrosoftJobProgress
  recordCount?: number
  sources?: Array<{ name: string; recordCount: number; complete: boolean; error: string | null }>
}

// Hard ceiling on process iterations. Each call performs exactly one bounded
// unit of work server-side, so this only bounds pathological loops; the real
// terminal condition is `finished` / `allRequiredComplete`.
const MAX_PROCESS_STEPS = 400

export interface MicrosoftSyncCallbacks {
  onProgress?: (progress: MicrosoftJobProgress, note: string) => void
}

/**
 * Verify the live Microsoft integration before offering to run anything.
 * Returns the real status message from the server — never an invented one.
 */
export async function checkMicrosoftSyncAvailability(): Promise<{
  connected: boolean
  message: string
  sourceCount: number
  error: string | null
}> {
  const { data, error } = await getMicrosoftConnectionStatus()
  if (error || !data) {
    return { connected: false, message: error ?? 'Microsoft connection status is unavailable.', sourceCount: 0, error: error ?? 'unavailable' }
  }
  return { connected: data.connected, message: data.message, sourceCount: data.sources.length, error: null }
}

/**
 * Run the controlled Microsoft sync end to end and return a truthful result.
 * Reports progress as each bounded source unit completes.
 */
export async function runMicrosoftSync(
  rangeStart: string,
  rangeEnd: string,
  callbacks: MicrosoftSyncCallbacks = {},
): Promise<MicrosoftSyncOutcome> {
  // 1. Real integration state first — this is what the old chat answer guessed.
  const availability = await checkMicrosoftSyncAvailability()
  if (!availability.connected) {
    return { ok: false, notConnected: true, message: availability.message }
  }

  // 2. Start the durable preview job over the confirmed bounded range.
  const startIso = new Date(`${rangeStart}T00:00:00`).toISOString()
  const endIso = new Date(`${rangeEnd}T00:00:00`).toISOString()
  const started = await startMicrosoftPreviewJob(startIso, endIso)
  if (started.error || !started.job) {
    return { ok: false, message: started.error ?? 'The Microsoft preview job could not be started.' }
  }
  const jobId = started.job.jobId
  let progress = started.job.progress
  callbacks.onProgress?.(progress, `Started — ${progress.total} source${progress.total === 1 ? '' : 's'} queued.`)

  // 3. Drive bounded units until every required source finishes.
  let steps = 0
  let lastJob = started.job
  while (!progress.finished && steps < MAX_PROCESS_STEPS) {
    steps += 1
    const step = await processMicrosoftPreviewJob(jobId)
    if (step.error) {
      return { ok: false, jobId, progress, message: `Microsoft sync stopped: ${step.error}` }
    }
    if (step.job) {
      lastJob = step.job
      progress = step.job.progress
      callbacks.onProgress?.(
        progress,
        `${progress.complete}/${progress.total} sources complete${progress.detailsRemaining > 0 ? ` · ${progress.detailsRemaining} details remaining` : ''}${progress.failed > 0 ? ` · ${progress.failed} failed` : ''}.`,
      )
    }
    if (step.finished) break
  }

  const sources = lastJob.sources.map(s => ({
    name: s.sourceName,
    recordCount: s.recordCount,
    complete: s.complete,
    error: s.safeError,
  }))

  // 4. Truthful terminal reporting — never claim success on a partial run.
  if (!progress.allRequiredComplete) {
    const failedNames = sources.filter(s => s.error).map(s => `${s.name} (${s.error})`)
    if (steps >= MAX_PROCESS_STEPS && progress.failed === 0) {
      return { ok: false, jobId, progress, sources, message: `Microsoft sync did not finish within the safety limit — ${progress.complete}/${progress.total} sources completed. Resume it on the Microsoft Import page.` }
    }
    return {
      ok: false,
      jobId,
      progress,
      sources,
      message: failedNames.length > 0
        ? `Microsoft sync could not complete every required source: ${failedNames.join('; ')}. Retry the failed sources on the Microsoft Import page.`
        : `Microsoft sync did not complete — ${progress.complete}/${progress.total} sources finished.`,
    }
  }

  // 5. Assemble the reviewed preview snapshot.
  const { snapshot, error: resultError } = await getMicrosoftPreviewResult(jobId)
  if (resultError || !snapshot) {
    return { ok: false, jobId, progress, sources, message: resultError ?? 'The Microsoft preview could not be assembled.' }
  }

  const recordCount = snapshot.records.length
  const partial = progress.failed > 0
  return {
    ok: true,
    jobId,
    progress,
    sources,
    recordCount,
    message:
      `Microsoft sync complete — ${progress.complete}/${progress.total} source${progress.total === 1 ? '' : 's'} pulled, ` +
      `${recordCount} record${recordCount === 1 ? '' : 's'} in the reconciliation preview` +
      `${partial ? ` (${progress.failed} optional source${progress.failed === 1 ? '' : 's'} failed)` : ''}. ` +
      `Nothing has been changed yet — review and apply it on the Microsoft Import page.`,
  }
}
