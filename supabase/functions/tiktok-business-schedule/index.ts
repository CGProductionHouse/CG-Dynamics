import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { requireAdminOrManager } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { tiktokBusinessPublishingEnabled } from '../_shared/tiktok-business.ts'

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)

  const auth = await requireAdminOrManager(request)
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status)
  if (!tiktokBusinessPublishingEnabled()) {
    return jsonResponse({
      ok: false,
      error: 'TikTok Business publishing rollout is disabled.',
    }, 409)
  }

  let body: { monthlyDeliverableId?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400)
  }
  if (!body.monthlyDeliverableId) {
    return jsonResponse({ ok: false, error: 'monthlyDeliverableId is required.' }, 400)
  }

  const { data, error } = await auth.value.supabase.rpc('queue_tiktok_business_publish', {
    p_monthly_deliverable_id: body.monthlyDeliverableId,
    p_requested_by: auth.value.user.id,
  })
  if (error) {
    console.error('TikTok Business schedule validation failed:', error.code ?? 'unknown')
    return jsonResponse({ ok: false, error: error.message }, 400)
  }

  return jsonResponse({
    ok: true,
    jobId: data,
    message: 'Approved TikTok content is scheduled from the canonical Client Schedule item.',
  })
})
