import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    // Malformed JSON — return what we received
  }

  return jsonResponse({
    ok: false,
    status: 'not_implemented',
    message: 'Meta sync is not active yet.',
    received: body,
  })
})
