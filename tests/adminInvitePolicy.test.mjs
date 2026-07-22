import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

let server
let decideInviteDelivery
let isAdminRole
let parseInviteRequest
let validateClientAccess

const clientId = '11111111-1111-4111-8111-111111111111'

function request(overrides = {}) {
  return {
    email: 'person@example.com',
    inviteType: 'client',
    role: 'client',
    clientId,
    ...overrides,
  }
}

before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  ;({ decideInviteDelivery, isAdminRole, parseInviteRequest, validateClientAccess } = await server.ssrLoadModule('/supabase/functions/admin-invite-user/invite-policy.ts'))
})

after(async () => { await server?.close() })

test('only admin passes the server authorization decision', () => {
  assert.equal(isAdminRole('admin'), true)
  for (const role of ['manager', 'staff', 'team', 'client', null]) assert.equal(isAdminRole(role), false)
})

test('the actual invite model allows client, staff and manager but not admin or legacy team', () => {
  assert.equal(parseInviteRequest(request()).ok, true)
  assert.equal(parseInviteRequest(request({ inviteType: 'workforce', role: 'staff', clientId: null })).ok, true)
  assert.equal(parseInviteRequest(request({ inviteType: 'workforce', role: 'manager', clientId: null })).ok, true)
  assert.equal(parseInviteRequest(request({ inviteType: 'workforce', role: 'admin', clientId: null })).code, 'invalid_role')
  assert.equal(parseInviteRequest(request({ inviteType: 'workforce', role: 'team', clientId: null })).code, 'invalid_role')
})

test('workforce and client invitation inputs cannot be mixed', () => {
  assert.equal(parseInviteRequest(request({ inviteType: 'workforce' })).code, 'role_type_mismatch')
  assert.equal(parseInviteRequest(request({ inviteType: 'client', role: 'staff', clientId })).code, 'role_type_mismatch')
  assert.equal(parseInviteRequest(request({ clientId: null })).code, 'client_required')
  assert.equal(parseInviteRequest(request({ inviteType: 'workforce', role: 'staff' })).code, 'client_not_allowed')
})

test('missing and inactive clients are rejected', () => {
  const parsed = parseInviteRequest(request())
  assert.equal(parsed.ok, true)
  assert.equal(validateClientAccess(parsed.value, 'missing').code, 'client_not_found')
  assert.equal(validateClientAccess(parsed.value, 'inactive').code, 'client_inactive')
  assert.equal(validateClientAccess(parsed.value, 'active').ok, true)
})

test('a duplicate matching pending invite resends without creating another row', () => {
  const parsed = parseInviteRequest(request())
  const decision = decideInviteDelivery(
    parsed.value,
    { id: 'invite-1', role: 'client', clientId },
    { confirmed: false, invited: true },
  )
  assert.deepEqual(decision, { ok: true, delivery: 'resend', createInvite: false })
})

test('a new email sends once and a saved retry reuses the pending row', () => {
  const parsed = parseInviteRequest(request({ inviteType: 'workforce', role: 'staff', clientId: null }))
  assert.deepEqual(decideInviteDelivery(parsed.value, null, null), { ok: true, delivery: 'send', createInvite: true })
  assert.deepEqual(
    decideInviteDelivery(parsed.value, { id: 'invite-1', role: 'staff', clientId: null }, null),
    { ok: true, delivery: 'send', createInvite: false },
  )
})

test('a pending invite with different access is a deliberate conflict', () => {
  const parsed = parseInviteRequest(request())
  const decision = decideInviteDelivery(
    parsed.value,
    { id: 'invite-1', role: 'staff', clientId: null },
    null,
  )
  assert.equal(decision.code, 'pending_invite_conflict')
})

test('confirmed users and unfinished public signups are not invited over', () => {
  const parsed = parseInviteRequest(request())
  assert.equal(decideInviteDelivery(parsed.value, null, { confirmed: true, invited: true }).code, 'already_registered')
  assert.equal(
    decideInviteDelivery(parsed.value, { id: 'invite-1', role: 'client', clientId }, { confirmed: true, invited: true }).code,
    'confirmed_pending_setup',
  )
  assert.equal(decideInviteDelivery(parsed.value, null, { confirmed: false, invited: false }).code, 'unconfirmed_signup')
})

test('invite acceptance is email-bound and transitions the authoritative row atomically', async () => {
  const migration = await readFile('supabase/phase-19a-secure-admin-invites.sql', 'utf8')
  assert.match(migration, /new\.invited_at is not null then 'client'/)
  assert.match(migration, /new\.invited_at is not null then null/)
  assert.match(migration, /function public\.validate_pending_invite\(\)/)
  assert.match(migration, /coalesce\(encrypted_password, ''\) <> ''/)
  assert.match(migration, /revoke execute on function public\.claim_invite\(\) from authenticated/)
  assert.match(migration, /lower\(email\) = lower\(user_email\)[\s\S]*status = 'pending'/)
  assert.match(migration, /insert into public\.profiles[\s\S]*on conflict \(id\) do update[\s\S]*role = invite\.role[\s\S]*client_id = resolved_client_id/)
  assert.match(migration, /update public\.client_invites[\s\S]*status = 'accepted', accepted_at = now\(\)/)
  assert.match(migration, /return jsonb_build_object\([\s\S]*'role', invite\.role/)
})

test('invite acceptance has no public signUp fallback', async () => {
  const [authContext, signup] = await Promise.all([
    readFile('src/contexts/AuthContext.tsx', 'utf8'),
    readFile('src/pages/Signup.tsx', 'utf8'),
  ])
  assert.doesNotMatch(authContext, /auth\.signUp\s*\(/)
  assert.doesNotMatch(signup, /\bsignUp\s*\(/)
  assert.match(authContext, /validatePendingInvite\(\)[\s\S]*auth\.updateUser/)
  assert.match(signup, /completeInvite\(password, fullName\)/)
})
