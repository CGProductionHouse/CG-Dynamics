import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

// Staff invitation lifecycle (PR 5).
//
// Staff invitations were stored in client_invites, a table with two states and
// no record of whether anything was ever sent. A failed send left the row
// 'pending', so "invitation sent" and "no pending invites" could both be shown
// for the same person. These tests pin the parts that make that impossible.

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const stripComments = s => s.replace(/^\s*(--|\/\/).*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

const lifecycleSql = read('../supabase/migrations/20260806090000_staff_invitation_lifecycle.sql')
const acceptanceSql = read('../supabase/migrations/20260806091000_staff_invitation_acceptance.sql')
const integritySql = read('../supabase/migrations/20260806092000_staff_invitation_integrity.sql')
const handlerSrc = read('../supabase/functions/admin-invite-user/staff-handler.ts')
const indexSrc = read('../supabase/functions/admin-invite-user/index.ts')
const panelSrc = read('../src/pages/admin/StaffInvitesPanel.tsx')
const dbSrc = read('../src/lib/db/staffInvitations.ts')
const invitesAdminSrc = read('../src/pages/admin/InvitesAdmin.tsx')

let server, policy
before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  policy = await server.ssrLoadModule('/supabase/functions/admin-invite-user/staff-invitation.ts')
})
after(async () => { await server.close() })

// ── The table and its state machine ─────────────────────────────────────────

test('staff invitations live in their own table, not client_invites', () => {
  assert.match(lifecycleSql, /create table if not exists public\.staff_invitations/)
  assert.match(dbSrc, /from\('staff_invitations'\)/)
  assert.ok(!stripComments(dbSrc).includes('client_invites'),
    'the staff data layer must never read the client invite table')
})

test('every required lifecycle state exists', () => {
  for (const state of ['pending', 'sending', 'sent', 'accepted', 'failed', 'expired', 'cancelled']) {
    assert.ok(lifecycleSql.includes(`'${state}'`), `missing state: ${state}`)
  }
})

test('every required field is stored', () => {
  for (const column of [
    'email', 'email_normalised', 'intended_full_name', 'intended_role', 'status',
    'invited_by', 'created_at', 'updated_at', 'sent_at', 'accepted_at', 'expires_at',
    'cancelled_at', 'auth_user_id', 'redirect_to', 'provider_result', 'failure_code',
    'failure_reason', 'retry_count', 'previous_invitation_id', 'audit',
  ]) {
    assert.match(lifecycleSql, new RegExp(`\\b${column}\\b`), `missing column: ${column}`)
  }
})

test('a row cannot claim it was sent without provider evidence', () => {
  assert.match(lifecycleSql, /staff_invitations_sent_needs_evidence[\s\S]*?sent_at is not null and provider_result is not null/)
})

test('a failed row must carry a plain-language reason', () => {
  assert.match(lifecycleSql, /staff_invitations_failure_needs_reason[\s\S]*?failure_code is not null and failure_reason is not null/)
})

test('an accepted row must name the canonical profile it produced', () => {
  assert.match(lifecycleSql, /staff_invitations_accepted_needs_profile[\s\S]*?accepted_profile_id is not null/)
})

test('only one invitation per person may be in flight', () => {
  assert.match(lifecycleSql, /create unique index[\s\S]*?staff_invitations_one_live_per_email[\s\S]*?where status in \('pending', 'sending', 'sent'\)/)
})

// ── Legacy migration keeps the evidence ─────────────────────────────────────

test('legacy staff rows are migrated, never deleted', () => {
  assert.match(lifecycleSql, /migrated_to_staff_invitation_id/)
  assert.ok(!/delete\s+from\s+public\.client_invites/i.test(lifecycleSql),
    'legacy invite rows must be retained as audit evidence')
  assert.match(lifecycleSql, /legacy_invite_id/)
})

test('a legacy row marked accepted with no account becomes failed, not accepted', () => {
  assert.match(lifecycleSql, /legacy_accepted_without_account/)
  assert.match(lifecycleSql, /when l\.legacy_status = 'accepted' and l\.profile_id is null then 'failed'/)
})

test('an undeliverable legacy address is recorded as failed so it can never send', () => {
  assert.match(lifecycleSql, /undeliverable_domain/)
  assert.match(lifecycleSql, /domain_ever_delivered/)
  // The rule is derived from real delivered domains, so it names no company.
  assert.ok(!stripComments(lifecycleSql).includes('cgproductionhouse'),
    'the migration must not hardcode a company domain')
})

test('the client acceptance path ignores migrated staff rows', () => {
  assert.match(lifecycleSql, /accept_invite[\s\S]*?migrated_to_staff_invitation_id is null/)
  assert.match(indexSrc, /is\('migrated_to_staff_invitation_id', null\)/)
})

// ── Send ordering: persist first, claim later ───────────────────────────────

test('the invitation row is persisted before anything is sent', () => {
  // Scope to the handler body — the type declaration at the top of the file
  // also mentions inviteUserByEmail.
  const body = handlerSrc.slice(handlerSrc.indexOf('export async function handleStaffInvite'))
  const insertAt = body.search(/\.from\('staff_invitations'\)\s*\n?\s*\.insert\(/)
  const sendAt = body.indexOf('admin.auth.admin.inviteUserByEmail')
  assert.ok(insertAt > 0, 'the handler must insert the invitation row')
  assert.ok(sendAt > 0, 'the handler must call the Auth invite endpoint')
  assert.ok(insertAt < sendAt, 'the row must be written before the email is attempted')
})

test('the row passes through sending, so a crash is visible as sending', () => {
  assert.match(handlerSrc, /update\(\{ status: 'sending' \}\)/)
})

test('a delivery failure writes failed with a reason and keeps the row', () => {
  assert.match(handlerSrc, /if \(delivery\.error\)[\s\S]*?status: 'failed'[\s\S]*?failure_code[\s\S]*?failure_reason/)
  assert.ok(!/delete\(\)/.test(handlerSrc), 'a failed invitation must be retained for retry')
})

test('a delivery failure never returns ok', () => {
  // The only ok:true responses are the two that follow a successful send.
  const okReturns = handlerSrc.match(/ok: true/g) ?? []
  assert.equal(okReturns.length, 2)
  for (const match of handlerSrc.matchAll(/return \{ status: 200, body: \{ ok: true[\s\S]{0,80}/g)) {
    assert.match(match[0], /status: 'sent'/)
  }
})

test('a thrown provider error is caught and recorded, not swallowed', () => {
  assert.match(handlerSrc, /catch \(thrown\)[\s\S]*?delivery = \{ data: null, error:/)
})

// ── Validation and duplicate protection ─────────────────────────────────────

test('the email is normalised and validated', () => {
  assert.equal(policy.normaliseEmail('  Name@Example.COM '), 'name@example.com')
  assert.equal(policy.normaliseEmail('not-an-email'), null)
  assert.equal(policy.normaliseEmail('missing@domain'), null)
  assert.equal(policy.normaliseEmail(''), null)
  assert.equal(policy.normaliseEmail(null), null)
})

test('a mistyped domain is detected against domains that really deliver', () => {
  const known = ['cgproductionhouse.com']
  // The real production typo.
  assert.equal(policy.likelyDomainTypo('amonique@cgoroductionhouse.com', known), 'cgproductionhouse.com')
  // A correct address is not flagged.
  assert.equal(policy.likelyDomainTypo('amonique@cgproductionhouse.com', known), null)
  // A genuinely different domain is not "corrected" into the known one.
  assert.equal(policy.likelyDomainTypo('someone@gmail.com', known), null)
})

test('the typo check names no company - it is given the known domains', () => {
  const src = read('../supabase/functions/admin-invite-user/staff-invitation.ts')
  assert.ok(!stripComments(src).includes('cgproductionhouse'))
  assert.match(handlerSrc, /knownDomains = \[\.\.\.new Set\(authList\.users\.map/)
})

test('the older staff role spelling maps to the one canonical value', () => {
  assert.equal(policy.parseStaffInviteRequest({ email: 'a@b.com', role: 'staff' }).value.role, 'team')
  assert.equal(policy.parseStaffInviteRequest({ email: 'a@b.com', role: 'team' }).value.role, 'team')
  assert.equal(policy.parseStaffInviteRequest({ email: 'a@b.com', role: 'manager' }).value.role, 'manager')
})

test('a role that is not a staff role is refused', () => {
  for (const role of ['client', 'owner', 'superuser', '', null]) {
    const parsed = policy.parseStaffInviteRequest({ email: 'a@b.com', role })
    assert.equal(parsed.ok, false, `role ${role} must be refused`)
    assert.equal(parsed.code, 'invalid_role')
  }
})

test('somebody who already has an active account is not invited again', () => {
  const decision = policy.decideStaffInvite(
    { email: 'a@b.com', role: 'team', fullName: null },
    { authUserExists: true, activeProfile: { role: 'team', isActive: true, isClientAccount: false },
      liveInvitation: null, duplicateIdentityForms: [] },
  )
  assert.equal(decision.ok, false)
  assert.equal(decision.code, 'already_active')
})

test('a client login cannot be reused as a staff identity', () => {
  const decision = policy.decideStaffInvite(
    { email: 'a@b.com', role: 'team', fullName: null },
    { authUserExists: true, activeProfile: { role: 'client', isActive: true, isClientAccount: true },
      liveInvitation: null, duplicateIdentityForms: [] },
  )
  assert.equal(decision.ok, false)
  assert.equal(decision.code, 'client_account_conflict')
})

test('a second live invitation for the same address is refused', () => {
  for (const status of ['pending', 'sending', 'sent']) {
    const decision = policy.decideStaffInvite(
      { email: 'a@b.com', role: 'team', fullName: null },
      { authUserExists: false, activeProfile: null,
        liveInvitation: { id: 'x', status, role: 'team' }, duplicateIdentityForms: [] },
    )
    assert.equal(decision.ok, false, status)
    assert.equal(decision.code, 'invitation_already_live')
  }
})

test('a failed invitation does not block a fresh one', () => {
  const decision = policy.decideStaffInvite(
    { email: 'a@b.com', role: 'team', fullName: null },
    { authUserExists: false, activeProfile: null,
      liveInvitation: { id: 'x', status: 'failed', role: 'team' }, duplicateIdentityForms: [] },
  )
  assert.equal(decision.ok, true)
})

test('provider failures become plain language without losing the code', () => {
  assert.equal(policy.describeDeliveryFailure({ status: 429 }).failureCode, 'rate_limited')
  assert.equal(policy.describeDeliveryFailure({ status: 422 }).failureCode, 'already_registered')
  assert.equal(policy.describeDeliveryFailure({ status: 500 }).failureCode, 'smtp_unavailable')
  for (const status of [429, 422, 500, 400, 0]) {
    const described = policy.describeDeliveryFailure({ status })
    assert.ok(described.failureReason.length > 20, 'the reason must be usable by an operator')
    assert.ok(!/\bundefined\b|\[object/.test(described.failureReason))
  }
})

// ── Acceptance and activation ───────────────────────────────────────────────

test('acceptance is idempotent - a second open returns the same result', () => {
  assert.match(acceptanceSql, /status = 'accepted'[\s\S]*?already_accepted', true/)
})

test('acceptance produces exactly one profile keyed by the auth user', () => {
  assert.match(acceptanceSql, /insert into public\.profiles \(id, full_name, email, role, client_id, is_active\)[\s\S]*?on conflict \(id\) do update/)
})

test('the role comes from the invitation, never from the invitee', () => {
  assert.match(acceptanceSql, /role = v_invite\.intended_role/)
  assert.ok(!/role = requested/.test(acceptanceSql))
})

test('an expired invitation cannot be accepted', () => {
  assert.match(acceptanceSql, /if v_invite\.expires_at <= now\(\) then[\s\S]*?status = 'expired'[\s\S]*?raise exception/)
})

test('a cancelled invitation is not selectable for acceptance', () => {
  assert.match(acceptanceSql, /status in \('pending', 'sending', 'sent'\)\s*\n\s*order by created_at desc limit 1 for update/)
})

test('older live invitations are superseded on acceptance', () => {
  assert.match(acceptanceSql, /status = 'cancelled'[\s\S]*?superseded by acceptance/)
})

test('an accepted invitation cannot be cancelled', () => {
  assert.match(acceptanceSql, /if v_invite\.status = 'accepted' then[\s\S]*?cannot be cancelled/)
})

// ── Reconciliation is generic ───────────────────────────────────────────────

test('reconciliation offers a dry run before it writes', () => {
  assert.match(acceptanceSql, /p_apply boolean default false/)
  assert.match(acceptanceSql, /if not p_apply then[\s\S]*?'dry_run', true/)
})

test('reconciliation names nobody', () => {
  const code = stripComments(acceptanceSql)
  for (const name of ['Amonique', 'Fourie', 'Franco', 'Sydney', 'Christie', 'Ger-Marie', 'KG', 'Alana']) {
    assert.ok(!code.includes(name), `reconciliation must not mention ${name}`)
  }
})

test('reconciliation reuses the PR 1 resolver rather than a second implementation', () => {
  assert.match(acceptanceSql, /public\.cg_resolve_identity_segment/)
  assert.match(acceptanceSql, /public\.cg_staff_identity_candidates/)
})

test('a task naming anyone else is left alone', () => {
  assert.match(acceptanceSql, /and not exists \([\s\S]*?r2\.profile_id is distinct from p_profile_id\)/)
})

test('imported text is preserved when a task is reconciled', () => {
  const update = acceptanceSql.slice(acceptanceSql.indexOf('update public.planner_tasks'))
  assert.ok(!/assigned_to_name\s*=/.test(update.slice(0, 400)),
    'the imported assignee text must never be rewritten')
})

test('a derived alias is skipped when it already belongs to someone else', () => {
  assert.match(acceptanceSql, /where c\.form = f and c\.profile_id <> p_profile_id/)
})

test('a client account cannot be reconciled as a staff identity', () => {
  assert.match(acceptanceSql, /if v_profile\.client_id is not null then[\s\S]*?client account cannot be used/)
})

// ── Permissions ─────────────────────────────────────────────────────────────

test('only managers and admins may read or change staff invitations', () => {
  assert.match(lifecycleSql, /create policy staff_invitations_manager_read[\s\S]*?using \(public\.is_manager\(\)\)/)
  assert.match(lifecycleSql, /create policy staff_invitations_manager_write[\s\S]*?with check \(public\.is_manager\(\)\)/)
  assert.match(lifecycleSql, /force row level security/)
})

test('the invite function refuses anyone below manager', () => {
  assert.match(indexSrc, /if \(role !== 'admin' && role !== 'manager'\)/)
})

test('client invitations stay admin-only', () => {
  assert.match(indexSrc, /if \(authorization\.role !== 'admin'\)[\s\S]*?Admin access required to invite a client/)
})

test('cancel requires manager rights', () => {
  assert.match(acceptanceSql, /cancel_staff_invitation[\s\S]*?if not public\.is_manager\(\) then/)
})

test('the acceptance and reconciliation RPCs are not granted to anon', () => {
  for (const fn of ['accept_staff_invitation', 'reconcile_staff_identity', 'cancel_staff_invitation']) {
    assert.match(acceptanceSql, new RegExp(`revoke all on function public\\.${fn}[\\s\\S]*?from public, anon`))
  }
})

// ── The UI cannot disagree with the database ────────────────────────────────

test('the panel reads the same table the invitation is written to', () => {
  assert.match(panelSrc, /listStaffInvitations/)
  assert.ok(!stripComments(panelSrc).includes('client_invites'))
})

test('the panel re-reads persisted state after every action', () => {
  for (const handler of ['handleSend', 'handleResend', 'handleCancel']) {
    const body = panelSrc.slice(panelSrc.indexOf(`async function ${handler}`))
    assert.match(body.slice(0, 1800), /await load\(\{ silent: true \}\)/, `${handler} must refresh from the database`)
  }
})

test('a failed send still refreshes the list rather than reporting nothing', () => {
  const body = panelSrc.slice(panelSrc.indexOf('async function handleSend'))
  const failureBranch = body.slice(body.indexOf('if (result.error)'), body.indexOf('setDomainWarning(null)'))
  assert.match(failureBranch, /await load\(\{ silent: true \}\)/)
})

test('every truthful state is rendered', () => {
  for (const state of ['pending', 'sending', 'sent', 'accepted', 'failed', 'expired', 'cancelled']) {
    assert.match(panelSrc, new RegExp(`${state}:`), `status ${state} must have a label and style`)
  }
})

test('the empty message only speaks about open invitations', () => {
  assert.match(panelSrc, /No open staff invitations\./)
  assert.ok(!panelSrc.includes('No pending invites.'),
    'the old message could appear while a persisted failed invitation existed')
})

test('failure reasons are shown to the operator', () => {
  assert.match(panelSrc, /data-testid="staff-invitation-failure"/)
  assert.match(panelSrc, /invitation\.failure_reason/)
})

test('recipient, role, inviter times, retries and actions are all shown', () => {
  for (const field of ['invitation.email', 'intended_role', 'created_at', 'sent_at', 'expires_at', 'retry_count']) {
    assert.ok(panelSrc.includes(field), `missing field in the row: ${field}`)
  }
  assert.match(panelSrc, /Resend/)
  assert.match(panelSrc, /Cancel/)
})

test('expired invitations are swept before the list is read', () => {
  const body = panelSrc.slice(panelSrc.indexOf('async function load'))
  assert.ok(body.indexOf('expireStaffInvitations') < body.indexOf('listStaffInvitations'))
})

test('the client invite form no longer offers staff roles', () => {
  assert.ok(!invitesAdminSrc.includes('<option value="staff">'))
  assert.ok(!invitesAdminSrc.includes('<option value="manager">'))
  assert.match(invitesAdminSrc, /<StaffInvitesPanel \/>/)
})

test('a staff invitation is accepted by the staff RPC, not the client one', () => {
  const auth = read('../src/contexts/AuthContext.tsx')
  assert.match(auth, /kind === 'staff'/)
  assert.match(auth, /\? await acceptStaffInvitation\(fullName\)\s*\n\s*: await acceptInvite\(fullName\)/)
})

// ── Integrity diagnostics ───────────────────────────────────────────────────

test('every required integrity check exists', () => {
  for (const check of [
    'sent_without_provider_result', 'accepted_without_profile', 'duplicate_live_invitations',
    'staff_invite_in_client_invites', 'duplicate_active_staff_identity', 'profile_without_auth_user',
    'invalid_role_grant', 'client_account_as_staff', 'terminal_invitation_accepted',
    'duplicate_identity_alias', 'activated_identity_left_unresolved',
  ]) {
    assert.ok(integritySql.includes(`'${check}'`), `missing integrity check: ${check}`)
  }
})

test('the integrity function is not readable by anonymous callers', () => {
  assert.match(integritySql, /revoke all on function public\.staff_invitation_integrity\(\) from public, anon/)
})
