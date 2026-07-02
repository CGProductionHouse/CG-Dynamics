import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface EnqueueBody {
  mode: 'all' | 'selected'
  clientId?: string
  syncRangeMonths: number
  months: string[]
  items: Array<{ clientId: string; clientName: string }>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'Server configuration error.' }, 500)
  }

  const sb = createClient(supabaseUrl, serviceRoleKey)

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await sb.auth.getUser(token)
  if (authError || !user) {
    return jsonResponse({ ok: false, error: 'Authentication required.' }, 401)
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'team'].includes(profile.role)) {
    return jsonResponse({ ok: false, error: 'Staff access required.' }, 403)
  }

  let body: EnqueueBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400)
  }

  if (!body.months || body.months.length === 0 || !body.items || body.items.length === 0) {
    return jsonResponse({ ok: false, error: 'No months or clients to sync.' }, 400)
  }

  const totalItems = body.months.length * body.items.length

  const { data: batch, error: insertError } = await sb
    .from('meta_sync_batches')
    .insert({
      mode: body.mode,
      requested_by: user.id,
      status: 'queued',
      sync_range_months: body.syncRangeMonths,
      total_items: totalItems,
      completed_items: 0,
      failed_items: 0,
      summary: { months: body.months, clientCount: body.items.length },
    })
    .select('id')
    .single()

  if (insertError || !batch) {
    return jsonResponse({ ok: false, error: 'Could not create sync batch. Queue table may not exist yet.' }, 500)
  }

  const batchId = batch.id
  const itemRows: Array<{
    batch_id: string
    client_id: string
    client_name: string
    month: string
    status: string
  }> = []

  for (const month of body.months) {
    for (const item of body.items) {
      itemRows.push({
        batch_id: batchId,
        client_id: item.clientId,
        client_name: item.clientName,
        month,
        status: 'queued',
      })
    }
  }

  const { error: itemsError } = await sb
    .from('meta_sync_batch_items')
    .insert(itemRows)

  if (itemsError) {
    return jsonResponse({ ok: false, error: 'Could not create sync batch items.' }, 500)
  }

  return jsonResponse({
    ok: true,
    batchId,
    totalItems,
    months: body.months,
    clientCount: body.items.length,
    message: `Sync batch queued: ${body.items.length} client(s) × ${body.months.length} month(s) = ${totalItems} item(s).`,
  })
})
