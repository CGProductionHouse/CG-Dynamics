// Issue #405: website enquiry notification worker.
//
// Drains the transactional outbox created by submit_website_enquiry. Fail-closed:
// unless WEBSITE_ENQUIRY_EMAIL_ENABLED/PROVIDER/FROM and the provider's own values are set it
// claims nothing, so pending jobs (and every stored enquiry) simply wait.
// Auth: x-worker-secret == WEBSITE_ENQUIRY_WORKER_SECRET (scheduler only). The gateway
// does not verify a JWT for this function (supabase/config.toml verify_jwt = false), so
// the secret check below is the sole and required authority; an unset secret rejects all.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { jsonResponse } from '../_shared/cors.ts'
import {
  classifyResendResponse,
  composeEnquiryEmail,
  type ClaimedDelivery,
  type DeliveryOutcome,
} from '../_shared/websiteEnquiryDelivery.ts'
import { resolveProviderConfig, type ProviderConfig } from '../_shared/websiteEnquiryProviders.ts'
import { buildSesSendRequest, classifySesResponse, type SesConfig } from '../_shared/websiteEnquirySes.ts'

const CLAIM_LIMIT = 10
const LEASE_SECONDS = 120
const SEND_TIMEOUT_MS = 20_000
const REPLAY_WINDOW_MS = 23 * 60 * 60 * 1000

function constantTimeEqual(a: string, b: string) {
  if (!a || a.length !== b.length) return false
  let diff = 0
  for (let index = 0; index < a.length; index++) diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return diff === 0
}

async function sendViaResend(job: ClaimedDelivery, from: string, apiKey: string): Promise<DeliveryOutcome> {
  let email
  try {
    email = composeEnquiryEmail(job, from)
  } catch {
    return { outcome: 'permanent_failure', errorCode: 'invalid_recipient_snapshot' }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': job.delivery_key,
      },
      body: JSON.stringify(email),
      signal: controller.signal,
    })
    const body = await response.json().catch(() => null)
    return classifyResendResponse({ status: response.status, body, requestSent: true })
  } catch {
    // Timeout or connection loss after the request may have reached the provider.
    return classifyResendResponse({ requestSent: true })
  } finally {
    clearTimeout(timer)
  }
}

async function sendViaSes(job: ClaimedDelivery, config: SesConfig): Promise<DeliveryOutcome> {
  let request
  try {
    request = await buildSesSendRequest(job, config)
  } catch {
    return { outcome: 'permanent_failure', errorCode: 'invalid_recipient_snapshot' }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)
  try {
    const response = await fetch(request.url, { method: request.method, headers: request.headers, body: request.body, signal: controller.signal })
    const body = await response.json().catch(() => null)
    return classifySesResponse({ status: response.status, body, requestSent: true })
  } catch {
    // SES has no idempotency key: a lost response is ambiguous -> reconcile, never resent.
    return classifySesResponse({ requestSent: true })
  } finally {
    clearTimeout(timer)
  }
}

function send(job: ClaimedDelivery, config: Exclude<ProviderConfig, { state: 'disabled' }>): Promise<DeliveryOutcome> {
  return config.provider === 'ses' ? sendViaSes(job, config) : sendViaResend(job, config.from, config.apiKey)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed' }, 405)
  const expected = Deno.env.get('WEBSITE_ENQUIRY_WORKER_SECRET') ?? ''
  if (!constantTimeEqual(req.headers.get('x-worker-secret') ?? '', expected)) {
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
  }

  const config = resolveProviderConfig((name) => Deno.env.get(name))
  if (config.state === 'disabled') {
    return jsonResponse({ ok: true, state: 'disabled', gate: config.reason, claimed: 0 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ ok: false, error: 'Server configuration missing' }, 500)
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  // Reconcile: only providers that dedupe on the delivery_key (Resend) get the same key
  // replayed inside their idempotency window. SES has no idempotency key, so SES reconcile
  // jobs are resolved only from SES event evidence or by staff — never resent.
  let replayed = 0
  if (config.supportsIdempotentReplay) {
    const replayCutoff = new Date(Date.now() - REPLAY_WINDOW_MS).toISOString()
    const { data: reconcileJobs, error: reconcileError } = await admin
      .from('website_enquiry_delivery_jobs')
      .select('id')
      .eq('delivery_state', 'reconcile')
      .eq('provider', config.provider)
      .gt('created_at', replayCutoff)
      .limit(CLAIM_LIMIT)
    if (reconcileError) return jsonResponse({ ok: false, error: 'Reconcile scan failed' }, 500)
    for (const job of reconcileJobs ?? []) {
      const { data } = await admin.rpc('resolve_website_enquiry_delivery_reconcile', {
        p_job_id: job.id, p_resolution: 'idempotent_replay', p_provider_message_id: null,
      })
      if (data?.applied) replayed++
    }
  }

  // Belt and braces: apply any stored provider events whose job is now accepted.
  const { data: swept, error: sweepError } = await admin.rpc('sweep_website_enquiry_provider_events', { p_limit: 50 })
  if (sweepError) return jsonResponse({ ok: false, error: 'Provider event sweep failed' }, 500)

  const { data: claimed, error: claimError } = await admin.rpc('claim_website_enquiry_deliveries', {
    p_provider: config.provider, p_limit: CLAIM_LIMIT, p_lease_seconds: LEASE_SECONDS,
  })
  if (claimError) return jsonResponse({ ok: false, error: 'Claim failed' }, 500)

  const results: Record<string, number> = { accepted: 0, retryable_failure: 0, permanent_failure: 0, ambiguous: 0, stale: 0 }
  for (const job of (claimed ?? []) as ClaimedDelivery[]) {
    const outcome = await send(job, config)
    const { data, error } = await admin.rpc('complete_website_enquiry_delivery', {
      p_job_id: job.job_id,
      p_lease_token: job.lease_token,
      p_outcome: outcome.outcome,
      p_provider_message_id: outcome.outcome === 'accepted' ? outcome.providerMessageId : null,
      p_error_code: outcome.outcome === 'accepted' ? null : outcome.errorCode,
    })
    // An unrecorded completion leaves the lease to expire into reconcile — never a blind resend.
    if (error || !data?.applied) results.stale++
    else results[outcome.outcome]++
  }

  // Counts only: no recipient, visitor or message content in logs or responses.
  return jsonResponse({ ok: true, state: 'ready', replayed, swept: swept ?? 0, claimed: (claimed ?? []).length, results })
})
