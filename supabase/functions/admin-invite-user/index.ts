/* global Deno */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  decideInviteDelivery,
  isAdminRole,
  parseInviteRequest,
  validateClientAccess,
  type AuthUserSummary,
  type PendingInviteSummary,
  type ValidInviteRequest,
} from './invite-policy.ts'

type AdminClient = ReturnType<typeof createClient>

interface InviteRow {
  id: string
  email: string
  role: string
  client_id: string | null
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

function inviteRedirectUrl(): string | null {
  const configured = Deno.env.get('APP_PUBLIC_URL') ?? 'https://cg-dynamics.vercel.app'
  try {
    const url = new URL(configured)
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) return null
    url.pathname = '/signup'
    url.search = '?invited=1'
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

async function requireAdmin(request: Request, admin: AdminClient) {
  const token = bearerToken(request)
  if (!token) return { userId: null, response: jsonResponse({ ok: false, code: 'unauthenticated', error: 'Authentication required.' }, 401) }

  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) {
    return { userId: null, response: jsonResponse({ ok: false, code: 'unauthenticated', error: 'Authentication required.' }, 401) }
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return { userId: null, response: jsonResponse({ ok: false, code: 'authorization_unavailable', error: 'Admin access could not be verified.' }, 503) }
  }
  if (!isAdminRole(profile?.role)) {
    return { userId: null, response: jsonResponse({ ok: false, code: 'forbidden', error: 'Admin access required.' }, 403) }
  }

  return { userId: user.id as string, response: null }
}

async function findAuthUser(admin: AdminClient, email: string): Promise<{ user: AuthUserSummary | null; failed: boolean }> {
  const perPage = 1000
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) return { user: null, failed: true }

    const match = data.users.find(user => user.email?.trim().toLowerCase() === email)
    if (match) {
      return {
        user: {
          confirmed: Boolean(match.email_confirmed_at),
          invited: Boolean(match.invited_at),
        },
        failed: false,
      }
    }
    if (data.users.length < perPage) break
  }
  return { user: null, failed: false }
}

async function findPendingInvite(admin: AdminClient, email: string): Promise<{ invite: InviteRow | null; failed: boolean }> {
  const { data, error } = await admin
    .from('client_invites')
    .select('id, email, role, client_id')
    .eq('status', 'pending')
    .limit(1000)

  const invite = (data as InviteRow[] | null)?.find(row => row.email.trim().toLowerCase() === email) ?? null
  return { invite, failed: Boolean(error) }
}

async function validateClient(admin: AdminClient, request: ValidInviteRequest): Promise<Response | null> {
  if (request.role !== 'client' || !request.clientId) return null
  const { data: client, error } = await admin
    .from('clients')
    .select('id, active')
    .eq('id', request.clientId)
    .maybeSingle()

  if (error) return jsonResponse({ ok: false, code: 'client_check_failed', error: 'The selected client could not be verified.' }, 503)
  const result = validateClientAccess(request, !client ? 'missing' : client.active ? 'active' : 'inactive')
  if (!result.ok) return jsonResponse({ ok: false, code: result.code, error: result.error }, 400)
  return null
}

function logAuthFailure(operation: 'invite' | 'resend', error: { status?: number; code?: string }) {
  console.error('Admin invitation delivery failed.', {
    operation,
    status: error.status ?? null,
    code: error.code ?? 'unknown',
  })
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ ok: false, code: 'method_not_allowed', error: 'Method not allowed.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const redirectTo = inviteRedirectUrl()
  if (!supabaseUrl || !serviceRoleKey || !redirectTo) {
    return jsonResponse({ ok: false, code: 'server_configuration', error: 'Invitation service is not configured.' }, 500)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const authorization = await requireAdmin(request, admin)
  if (authorization.response) return authorization.response
  if (!authorization.userId) {
    return jsonResponse({ ok: false, code: 'unauthenticated', error: 'Authentication required.' }, 401)
  }

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return jsonResponse({ ok: false, code: 'invalid_json', error: 'Invalid invitation request.' }, 400)
  }

  const parsed = parseInviteRequest(rawBody)
  if (!parsed.ok) return jsonResponse({ ok: false, code: parsed.code, error: parsed.error }, 400)
  const clientError = await validateClient(admin, parsed.value)
  if (clientError) return clientError

  const [pendingResult, authResult] = await Promise.all([
    findPendingInvite(admin, parsed.value.email),
    findAuthUser(admin, parsed.value.email),
  ])
  if (pendingResult.failed || authResult.failed) {
    return jsonResponse({ ok: false, code: 'lookup_failed', error: 'Existing invitation status could not be checked.' }, 503)
  }

  const pendingSummary: PendingInviteSummary | null = pendingResult.invite
    ? { id: pendingResult.invite.id, role: pendingResult.invite.role, clientId: pendingResult.invite.client_id }
    : null
  const decision = decideInviteDelivery(parsed.value, pendingSummary, authResult.user)
  if (!decision.ok) return jsonResponse({ ok: false, code: decision.code, error: decision.error }, 409)

  let inviteId = pendingResult.invite?.id ?? null
  if (decision.createInvite) {
    const { data: created, error } = await admin
      .from('client_invites')
      .insert({
        email: parsed.value.email,
        role: parsed.value.role,
        client_id: parsed.value.clientId,
        created_by: authorization.userId,
        status: 'pending',
      })
      .select('id')
      .single()
    if (error || !created) {
      return jsonResponse({ ok: false, code: 'invite_record_failed', error: 'The invitation record could not be created.' }, 409)
    }
    inviteId = created.id as string
  }

  // Supabase recommends sending a new invitation when an invite link expires.
  // Reusing the Auth Admin endpoint preserves the secure `type=invite` flow.
  const delivery = await admin.auth.admin.inviteUserByEmail(parsed.value.email, { redirectTo })

  if (delivery.error) {
    logAuthFailure(decision.delivery === 'send' ? 'invite' : 'resend', delivery.error)
    return jsonResponse({
      ok: false,
      code: decision.delivery === 'send' ? 'invite_delivery_failed' : 'invite_resend_failed',
      error: decision.delivery === 'send'
        ? 'The invitation could not be sent. The pending invite is saved and can be retried.'
        : 'The invitation could not be resent. Please try again after checking Auth email delivery.',
    }, 502)
  }

  const { error: finalizeError } = await admin
    .from('client_invites')
    .update({ status: 'pending', accepted_at: null })
    .eq('id', inviteId)
  if (finalizeError) {
    return jsonResponse({ ok: false, code: 'invite_finalize_failed', error: 'The email was sent, but the pending invite could not be finalized.' }, 500)
  }

  return jsonResponse({
    ok: true,
    inviteId,
    delivery: decision.delivery === 'send' ? 'sent' : 'resent',
  })
})
