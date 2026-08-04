import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const STAFF_ROLES = new Set(['admin', 'manager', 'staff', 'team'])

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return jsonResponse({ ok: false, error: 'Authentication required.' }, 401)
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const publicKey = (Deno.env.get('VAPID_PUBLIC_KEY') ?? '').trim()
  if (!url || !anonKey) return jsonResponse({ ok: false, error: 'Server setup is incomplete.' }, 500)

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const token = authHeader.slice(7)
  const { data: { user }, error: userError } = await client.auth.getUser(token)
  if (userError || !user) return jsonResponse({ ok: false, error: 'Session is invalid.' }, 401)
  const { data: profile } = await client.from('profiles').select('role,is_active').eq('id', user.id).maybeSingle()
  if (!profile?.is_active || !STAFF_ROLES.has(profile.role)) return jsonResponse({ ok: false, error: 'Staff access required.' }, 403)

  return jsonResponse({ ok: true, configured: Boolean(publicKey), publicKey: publicKey || undefined })
})
