// Staff invitation handler (PR 5).
//
// The order below is the whole point of this file: the invitation row is
// persisted BEFORE anything is sent, and its status only advances when there
// is evidence for the next stage. If the process dies between stages the row
// is left in the stage it actually reached ('sending'), never in a stage it
// only intended to reach.

import {
  LIVE_STATUSES,
  decideStaffInvite,
  describeDeliveryFailure,
  emailDomain,
  likelyDomainTypo,
  parseStaffInviteRequest,
  type ExistingState,
  type StaffInviteStatus,
} from './staff-invitation.ts'

// Minimal structural type so this file does not depend on the Supabase SDK types.
interface ProviderError {
  status?: number
  code?: string
  message?: string
}

interface QueryResult<T> {
  data: T | null
  error: { message?: string } | null
}

interface TableQuery {
  select(columns: string): TableQuery & PromiseLike<QueryResult<Record<string, unknown>[]>>
  insert(values: Record<string, unknown>): TableQuery
  update(values: Record<string, unknown>): TableQuery & PromiseLike<QueryResult<unknown>>
  eq(column: string, value: unknown): TableQuery & PromiseLike<QueryResult<Record<string, unknown>[]>>
  in(column: string, values: readonly string[]): TableQuery & PromiseLike<QueryResult<Record<string, unknown>[]>>
  single(): PromiseLike<QueryResult<Record<string, unknown>>>
}

interface Queryable {
  from(table: string): TableQuery
  auth: {
    admin: {
      listUsers(args: { page: number; perPage: number }): Promise<{ data: { users: Array<{ id: string; email?: string | null; last_sign_in_at?: string | null }> }; error: unknown }>
      inviteUserByEmail(email: string, options: { redirectTo: string; data?: Record<string, unknown> }): Promise<{ data: { user: { id: string } | null } | null; error: ProviderError | null }>
    }
  }
}

export interface StaffInviteOutcome {
  status: number
  body: Record<string, unknown>
}

function fail(status: number, code: string, error: string, extra: Record<string, unknown> = {}): StaffInviteOutcome {
  return { status, body: { ok: false, code, error, ...extra } }
}

async function listAllAuthUsers(admin: Queryable): Promise<{ users: Array<{ id: string; email: string; signedIn: boolean }>; failed: boolean }> {
  const collected: Array<{ id: string; email: string; signedIn: boolean }> = []
  const perPage = 1000
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) return { users: collected, failed: true }
    for (const user of data.users) {
      if (user.email) {
        collected.push({ id: user.id, email: user.email.trim().toLowerCase(), signedIn: Boolean(user.last_sign_in_at) })
      }
    }
    if (data.users.length < perPage) break
  }
  return { users: collected, failed: false }
}

export async function handleStaffInvite(
  admin: Queryable,
  body: unknown,
  invitedBy: string,
  redirectTo: string,
): Promise<StaffInviteOutcome> {
  const parsed = parseStaffInviteRequest(body)
  if (!parsed.ok) return fail(400, parsed.code, parsed.error)
  const { email, role, fullName } = parsed.value

  // ── Pre-flight checks. Nothing is written until these pass. ──────────────
  const authList = await listAllAuthUsers(admin)
  if (authList.failed) {
    return fail(503, 'lookup_failed', 'Existing accounts could not be checked, so no invitation was created.')
  }
  const authUser = authList.users.find(user => user.email === email) ?? null

  // Domains this workspace has actually delivered to. Derived from real users,
  // so it needs no configuration and no hardcoded company domain.
  const knownDomains = [...new Set(authList.users.map(user => emailDomain(user.email)))]
  const typoOf = likelyDomainTypo(email, knownDomains)
  const confirmedTypo = (body as Record<string, unknown> | null)?.acknowledgeDomain === emailDomain(email)
  if (typoOf && !confirmedTypo) {
    return fail(409, 'suspected_domain_typo',
      `Did you mean @${typoOf}? No invitation was created. Confirm the address if it is correct.`,
      { suggestedDomain: typoOf, enteredDomain: emailDomain(email) })
  }

  const { data: profileRows, error: profileError } = await admin
    .from('profiles').select('id, role, is_active, client_id').eq('id', authUser?.id ?? '00000000-0000-0000-0000-000000000000')
  if (profileError) {
    return fail(503, 'lookup_failed', 'Existing profiles could not be checked, so no invitation was created.')
  }
  const profileRow = (profileRows as Array<{ role: string; is_active: boolean; client_id: string | null }> | null)?.[0] ?? null

  const { data: liveRows, error: liveError } = await admin
    .from('staff_invitations').select('id, status, intended_role')
    .eq('email_normalised', email).in('status', LIVE_STATUSES)
  if (liveError) {
    return fail(503, 'lookup_failed', 'Existing invitations could not be checked, so no invitation was created.')
  }
  const liveRow = (liveRows as Array<{ id: string; status: StaffInviteStatus; intended_role: string }> | null)?.[0] ?? null

  const state: ExistingState = {
    authUserExists: Boolean(authUser),
    activeProfile: profileRow
      ? { role: profileRow.role, isActive: profileRow.is_active, isClientAccount: profileRow.client_id !== null }
      : null,
    // Supabase writes a default 'client' profile as soon as an Auth user is
    // invited, so a profile row is not evidence of a real account.
    accountInUse: Boolean(authUser?.signedIn),
    liveInvitation: liveRow ? { id: liveRow.id, status: liveRow.status, role: liveRow.intended_role as never } : null,
    duplicateIdentityForms: [],
  }

  const decision = decideStaffInvite(parsed.value, state)
  if (!decision.ok) return fail(409, decision.code, decision.error)

  // ── 1. Persist the invitation FIRST, as 'pending'. ───────────────────────
  const { data: created, error: insertError } = await admin
    .from('staff_invitations')
    .insert({
      email, intended_role: role, intended_full_name: fullName,
      status: 'pending', invited_by: invitedBy, redirect_to: redirectTo,
      audit: { created_via: 'admin-invite-user' },
    })
    .select('id').single()

  if (insertError || !created) {
    return fail(409, 'invite_record_failed',
      'The invitation could not be saved, so nothing was sent. Please try again.')
  }
  const invitationId = created.id as string

  // ── 2. Mark it 'sending' so a crash mid-flight is visible as exactly that. ─
  await admin.from('staff_invitations').update({ status: 'sending' }).eq('id', invitationId)

  // ── 3. Actually send. ────────────────────────────────────────────────────
  let delivery: { data: { user: { id: string } | null } | null; error: ProviderError | null }
  try {
    delivery = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: fullName ? { full_name: fullName } : undefined,
    })
  } catch (thrown) {
    delivery = { data: null, error: { message: thrown instanceof Error ? thrown.message : 'Unknown error' } }
  }

  // ── 4. Record what actually happened. ────────────────────────────────────
  if (delivery.error) {
    const { failureCode, failureReason } = describeDeliveryFailure(delivery.error)
    await admin.from('staff_invitations').update({
      status: 'failed',
      failure_code: failureCode,
      failure_reason: failureReason,
      // Store the provider's own words as evidence, never shown to the invitee.
      provider_result: { error: { status: delivery.error.status ?? null, code: delivery.error.code ?? null, message: delivery.error.message ?? null } },
    }).eq('id', invitationId)

    return fail(502, failureCode, failureReason, { invitationId, status: 'failed' })
  }

  const authUserId = delivery.data?.user?.id ?? null
  const { error: finalizeError } = await admin.from('staff_invitations').update({
    status: 'sent',
    sent_at: new Date().toISOString(),
    auth_user_id: authUserId,
    provider_result: { delivered: true, auth_user_id: authUserId },
  }).eq('id', invitationId)

  if (finalizeError) {
    // The email really did go out; say so, and say the record is behind.
    return fail(500, 'invite_finalize_failed',
      'The invitation email was sent but the record could not be updated. Refresh before sending another.',
      { invitationId })
  }

  return { status: 200, body: { ok: true, invitationId, status: 'sent', authUserId } }
}

export async function handleStaffResend(
  admin: Queryable,
  invitationId: string,
  invitedBy: string,
  redirectTo: string,
): Promise<StaffInviteOutcome> {
  const { data: rows, error } = await admin
    .from('staff_invitations')
    .select('id, email, intended_role, intended_full_name, status, retry_count')
    .eq('id', invitationId)
  if (error) return fail(503, 'lookup_failed', 'The invitation could not be read.')
  const invite = (rows as Array<Record<string, unknown>> | null)?.[0]
  if (!invite) return fail(404, 'not_found', 'That invitation does not exist.')
  if (invite.status === 'accepted') {
    return fail(409, 'already_accepted', 'That invitation has already been accepted.')
  }
  if (invite.status === 'cancelled') {
    return fail(409, 'cancelled', 'That invitation was cancelled. Create a new one instead.')
  }

  await admin.from('staff_invitations').update({
    status: 'sending',
    retry_count: ((invite.retry_count as number | null) ?? 0) + 1,
    failure_code: null,
    failure_reason: null,
  }).eq('id', invitationId)

  let delivery: { data: { user: { id: string } | null } | null; error: ProviderError | null }
  try {
    delivery = await admin.auth.admin.inviteUserByEmail(invite.email as string, { redirectTo })
  } catch (thrown) {
    delivery = { data: null, error: { message: thrown instanceof Error ? thrown.message : 'Unknown error' } }
  }

  if (delivery.error) {
    const { failureCode, failureReason } = describeDeliveryFailure(delivery.error)
    await admin.from('staff_invitations').update({
      status: 'failed', failure_code: failureCode, failure_reason: failureReason,
      provider_result: { error: { status: delivery.error.status ?? null, code: delivery.error.code ?? null, message: delivery.error.message ?? null } },
    }).eq('id', invitationId)
    return fail(502, failureCode, failureReason, { invitationId, status: 'failed' })
  }

  const authUserId = delivery.data?.user?.id ?? null
  await admin.from('staff_invitations').update({
    status: 'sent', sent_at: new Date().toISOString(), auth_user_id: authUserId,
    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    provider_result: { delivered: true, auth_user_id: authUserId, resent_by: invitedBy },
  }).eq('id', invitationId)

  return { status: 200, body: { ok: true, invitationId, status: 'sent', authUserId } }
}
