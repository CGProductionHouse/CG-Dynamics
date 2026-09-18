/* global Deno */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

type AdminClient = ReturnType<typeof createClient>

const USERNAME_PATTERN = /^[a-z0-9]{3,64}$/
const ACTIVE_PACKAGE_STATUSES = ['active', 'current', 'live']

function normalizeUsername(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    : ''
}

function proposedUsername(clientName: string): string {
  if (clientName.trim().toLowerCase() === 'braize') return 'braizepromotions'
  return normalizeUsername(clientName)
}

function starterPassword(username: string): string {
  return `${username}_cg$`
}

function syntheticEmail(clientId: string): string {
  return `client-${clientId}@portal.cgdynamics.co.za`
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization') ?? ''
  return header.match(/^Bearer\s+(.+)$/i)?.[1] ?? null
}

async function requireAdmin(request: Request, admin: AdminClient) {
  const token = bearerToken(request)
  if (!token) return { ok: false as const, response: jsonResponse({ ok: false, error: 'Authentication required.' }, 401) }

  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return { ok: false as const, response: jsonResponse({ ok: false, error: 'Authentication required.' }, 401) }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || profile?.role !== 'admin') {
    return { ok: false as const, response: jsonResponse({ ok: false, error: 'Admin access required.' }, 403) }
  }

  return { ok: true as const, userId: user.id }
}

async function eligibleClient(admin: AdminClient, clientId: string) {
  const [{ data: client, error: clientError }, { data: packages, error: packageError }] = await Promise.all([
    admin.from('clients').select('id, name, active').eq('id', clientId).maybeSingle(),
    admin.from('client_packages')
      .select('id, status, archived_at')
      .eq('client_id', clientId)
      .is('archived_at', null)
      .in('status', ACTIVE_PACKAGE_STATUSES)
      .limit(1),
  ])

  if (clientError || packageError) return { client: null, error: 'Client eligibility could not be verified.' }
  if (!client?.active || !packages?.length) return { client: null, error: 'Client is not eligible for portal provisioning.' }
  return { client, error: null }
}

async function findAuthUserByEmail(admin: AdminClient, email: string) {
  const needle = email.trim().toLowerCase()
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) return { user: null, error }
    const match = data.users.find(user => user.email?.trim().toLowerCase() === needle)
    if (match) return { user: match, error: null }
    if (data.users.length < 1000) break
  }
  return { user: null, error: null }
}

async function handleLogin(requestBody: Record<string, unknown>, admin: AdminClient, supabaseUrl: string, anonKey: string) {
  const username = normalizeUsername(requestBody.username)
  const password = typeof requestBody.password === 'string' ? requestBody.password : ''

  if (!USERNAME_PATTERN.test(username) || !password) {
    return jsonResponse({ ok: false, error: 'Invalid username or password.' }, 401)
  }

  const { data: access, error: accessError } = await admin
    .from('client_portal_access')
    .select('client_id, auth_user_id, enabled')
    .eq('username', username)
    .maybeSingle()

  if (accessError || !access?.enabled) {
    return jsonResponse({ ok: false, error: 'Invalid username or password.' }, 401)
  }

  const { data: client, error: clientError } = await admin
    .from('clients')
    .select('id, active')
    .eq('id', access.client_id)
    .maybeSingle()

  if (clientError || !client?.active) {
    return jsonResponse({ ok: false, error: 'Invalid username or password.' }, 401)
  }

  const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(access.auth_user_id)
  const email = authUser.user?.email ?? null
  if (authUserError || !email) {
    return jsonResponse({ ok: false, error: 'Invalid username or password.' }, 401)
  }

  const publicAuth = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: signIn, error: signInError } = await publicAuth.auth.signInWithPassword({ email, password })

  if (signInError || !signIn.session || signIn.user?.id !== access.auth_user_id) {
    return jsonResponse({ ok: false, error: 'Invalid username or password.' }, 401)
  }

  return jsonResponse({
    ok: true,
    session: {
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
      expires_in: signIn.session.expires_in,
      expires_at: signIn.session.expires_at,
    },
  })
}

async function handleList(admin: AdminClient) {
  const [clientsRes, packagesRes, mappingsRes, profilesRes] = await Promise.all([
    admin.from('clients').select('id, name, active').eq('active', true).order('name'),
    admin.from('client_packages').select('client_id, status, archived_at').is('archived_at', null).in('status', ACTIVE_PACKAGE_STATUSES),
    admin.from('client_portal_access').select('client_id, username, enabled, created_at, updated_at'),
    admin.from('profiles').select('client_id').eq('role', 'client').eq('is_active', true),
  ])

  const error = clientsRes.error ?? packagesRes.error ?? mappingsRes.error ?? profilesRes.error
  if (error) return jsonResponse({ ok: false, error: 'Client access inventory could not be loaded.' }, 503)

  const eligibleIds = new Set((packagesRes.data ?? []).map(row => row.client_id as string))
  const mappings = new Map((mappingsRes.data ?? []).map(row => [row.client_id as string, row]))
  const profileCounts = new Map<string, number>()
  for (const row of profilesRes.data ?? []) {
    if (!row.client_id) continue
    profileCounts.set(row.client_id, (profileCounts.get(row.client_id) ?? 0) + 1)
  }

  const clients = (clientsRes.data ?? [])
    .filter(client => eligibleIds.has(client.id))
    .map(client => {
      const mapping = mappings.get(client.id)
      return {
        client_id: client.id,
        client_name: client.name,
        proposed_username: proposedUsername(client.name),
        username: mapping?.username ?? null,
        provisioned: Boolean(mapping),
        enabled: mapping?.enabled ?? false,
        existing_client_users: profileCounts.get(client.id) ?? 0,
      }
    })

  return jsonResponse({ ok: true, clients })
}

async function handleProvision(body: Record<string, unknown>, admin: AdminClient, adminUserId: string) {
  const clientId = typeof body.client_id === 'string' ? body.client_id.trim() : ''
  const username = normalizeUsername(body.username)

  if (!clientId || !USERNAME_PATTERN.test(username)) {
    return jsonResponse({ ok: false, error: 'Choose a valid client and username.' }, 400)
  }

  const eligibility = await eligibleClient(admin, clientId)
  if (!eligibility.client) return jsonResponse({ ok: false, error: eligibility.error }, 400)

  const { data: collision, error: collisionError } = await admin
    .from('client_portal_access')
    .select('client_id')
    .eq('username', username)
    .maybeSingle()
  if (collisionError) return jsonResponse({ ok: false, error: 'Username availability could not be checked.' }, 503)
  if (collision && collision.client_id !== clientId) {
    return jsonResponse({ ok: false, error: 'That portal username is already assigned.' }, 409)
  }

  const { data: existing, error: existingError } = await admin
    .from('client_portal_access')
    .select('client_id, username, auth_user_id, enabled')
    .eq('client_id', clientId)
    .maybeSingle()
  if (existingError) return jsonResponse({ ok: false, error: 'Existing portal access could not be checked.' }, 503)

  const password = starterPassword(username)
  let authUserId = existing?.auth_user_id as string | undefined

  if (authUserId) {
    const { error: userError } = await admin.auth.admin.updateUserById(authUserId, {
      password,
      user_metadata: { full_name: eligibility.client.name, cg_portal_client_id: clientId },
      ban_duration: 'none',
    })
    if (userError) return jsonResponse({ ok: false, error: 'Existing portal auth account could not be updated.' }, 503)
  } else {
    const email = syntheticEmail(clientId)
    const found = await findAuthUserByEmail(admin, email)
    if (found.error) return jsonResponse({ ok: false, error: 'Existing portal auth account could not be checked.' }, 503)

    if (found.user) {
      authUserId = found.user.id
      const { error: userError } = await admin.auth.admin.updateUserById(authUserId, {
        password,
        user_metadata: { full_name: eligibility.client.name, cg_portal_client_id: clientId },
        ban_duration: 'none',
      })
      if (userError) return jsonResponse({ ok: false, error: 'Existing portal auth account could not be repaired.' }, 503)
    } else {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: eligibility.client.name, cg_portal_client_id: clientId },
      })
      if (createError || !created.user) {
        return jsonResponse({ ok: false, error: 'Portal auth account could not be created.' }, 503)
      }
      authUserId = created.user.id
    }
  }

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({
      id: authUserId,
      full_name: eligibility.client.name,
      email: syntheticEmail(clientId),
      role: 'client',
      client_id: clientId,
      is_active: true,
    }, { onConflict: 'id' })
  if (profileError) return jsonResponse({ ok: false, error: 'Portal profile could not be linked to the client.' }, 503)

  const { error: mapError } = await admin
    .from('client_portal_access')
    .upsert({
      client_id: clientId,
      username,
      auth_user_id: authUserId,
      enabled: true,
      created_by: adminUserId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id' })

  if (mapError) return jsonResponse({ ok: false, error: 'Portal username mapping could not be saved.' }, 503)

  return jsonResponse({
    ok: true,
    client_id: clientId,
    client_name: eligibility.client.name,
    username,
    status: existing ? 'updated' : 'created',
  })
}

async function handleReset(body: Record<string, unknown>, admin: AdminClient) {
  const clientId = typeof body.client_id === 'string' ? body.client_id.trim() : ''
  const { data: access, error } = await admin
    .from('client_portal_access')
    .select('client_id, username, auth_user_id')
    .eq('client_id', clientId)
    .maybeSingle()

  if (error || !access) return jsonResponse({ ok: false, error: 'Portal access is not provisioned for this client.' }, 404)

  const password = starterPassword(access.username)
  const { error: resetError } = await admin.auth.admin.updateUserById(access.auth_user_id, { password, ban_duration: 'none' })
  if (resetError) return jsonResponse({ ok: false, error: 'Portal password could not be reset.' }, 503)

  await admin.from('client_portal_access').update({ enabled: true, updated_at: new Date().toISOString() }).eq('client_id', clientId)
  await admin.from('profiles').update({ is_active: true }).eq('id', access.auth_user_id)

  return jsonResponse({ ok: true, username: access.username })
}

async function handleEnabled(body: Record<string, unknown>, admin: AdminClient, enabled: boolean) {
  const clientId = typeof body.client_id === 'string' ? body.client_id.trim() : ''
  const { data: access, error } = await admin
    .from('client_portal_access')
    .select('auth_user_id')
    .eq('client_id', clientId)
    .maybeSingle()
  if (error || !access) return jsonResponse({ ok: false, error: 'Portal access is not provisioned for this client.' }, 404)

  const { error: authError } = await admin.auth.admin.updateUserById(access.auth_user_id, {
    ban_duration: enabled ? 'none' : '876000h',
  })
  if (authError) return jsonResponse({ ok: false, error: 'Portal auth state could not be updated.' }, 503)

  const [{ error: mapError }, { error: profileError }] = await Promise.all([
    admin.from('client_portal_access').update({ enabled, updated_at: new Date().toISOString() }).eq('client_id', clientId),
    admin.from('profiles').update({ is_active: enabled }).eq('id', access.auth_user_id),
  ])
  if (mapError || profileError) return jsonResponse({ ok: false, error: 'Portal access state could not be saved.' }, 503)

  return jsonResponse({ ok: true, enabled })
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ ok: false, error: 'Portal access service is not configured.' }, 500)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid request.' }, 400)
  }

  const action = typeof body.action === 'string' ? body.action : ''
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  if (action === 'login') {
    return handleLogin(body, admin, supabaseUrl, anonKey)
  }

  const authorization = await requireAdmin(request, admin)
  if (!authorization.ok) return authorization.response

  if (action === 'list') return handleList(admin)
  if (action === 'provision') return handleProvision(body, admin, authorization.userId)
  if (action === 'reset') return handleReset(body, admin)
  if (action === 'disable') return handleEnabled(body, admin, false)
  if (action === 'enable') return handleEnabled(body, admin, true)

  return jsonResponse({ ok: false, error: 'Unsupported action.' }, 400)
})
