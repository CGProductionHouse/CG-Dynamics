// Issue #405: provider delivery events (Resend/Svix-signed) for website enquiry email.
// Records delivered/bounced distinctly from accepted. Unsigned or stale requests are
// rejected. Every verified event is stored durably (keyed by svix-id) BEFORE it is
// acknowledged; events that arrive before the worker has persisted the accepted
// provider message id wait in the inbox and are applied on acceptance. Any storage
// failure returns 5xx so the provider retries.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { jsonResponse } from '../_shared/cors.ts'
import { parseResendWebhookEvent, verifySvixSignature } from '../_shared/websiteEnquiryDelivery.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed' }, 405)
  const secret = Deno.env.get('WEBSITE_ENQUIRY_RESEND_WEBHOOK_SECRET') ?? ''
  if (!secret) return jsonResponse({ ok: false, error: 'Webhook is not configured' }, 503)

  const eventId = req.headers.get('svix-id')
  const body = await req.text()
  if (body.length > 64_000) return jsonResponse({ ok: false, error: 'Payload too large' }, 413)
  const verified = await verifySvixSignature({
    secret,
    id: eventId,
    timestamp: req.headers.get('svix-timestamp'),
    signatureHeader: req.headers.get('svix-signature'),
    body,
    nowSeconds: Math.floor(Date.now() / 1000),
  })
  if (!verified) return jsonResponse({ ok: false, error: 'Invalid signature' }, 401)

  let payload: unknown
  try { payload = JSON.parse(body) } catch { return jsonResponse({ ok: false, error: 'Invalid JSON' }, 400) }
  const event = parseResendWebhookEvent(payload)
  if (!event) return jsonResponse({ ok: true, applied: false, reason: 'ignored_event' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ ok: false, error: 'Server configuration missing' }, 500)
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const { data, error } = await admin.rpc('apply_website_enquiry_delivery_event', {
    p_provider: 'resend',
    p_provider_event_id: eventId,
    p_provider_message_id: event.providerMessageId,
    p_event: event.event,
    p_occurred_at: event.occurredAt,
  })
  // Acknowledge only a durably stored event; otherwise 500 so the provider retries.
  // The RPC is idempotent on (provider, svix-id), so retries never double-apply.
  if (error || data?.stored !== true) return jsonResponse({ ok: false, error: 'Event could not be recorded' }, 500)
  return jsonResponse({ ok: true, stored: true, state: data.state ?? null })
})
