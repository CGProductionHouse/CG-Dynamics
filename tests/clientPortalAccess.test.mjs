import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const MIGRATION = read('../supabase/migrations/20260918101500_client_portal_access.sql')
const EDGE = read('../supabase/functions/client-portal-access/index.ts')
const AUTH = read('../src/contexts/AuthContext.tsx')
const LOGIN = read('../src/pages/Login.tsx')
const ADMIN = read('../src/pages/admin/ClientAccessAdmin.tsx')
const USERS_HUB = read('../src/pages/admin/UsersHub.tsx')
const API = read('../src/lib/clientPortalAccess.ts')

test('portal mapping stores username and auth identity but never plaintext password', () => {
  assert.match(MIGRATION, /create table if not exists public\.client_portal_access/)
  assert.match(MIGRATION, /client_id uuid not null unique references public\.clients/)
  assert.match(MIGRATION, /username text not null unique/)
  assert.match(MIGRATION, /auth_user_id uuid not null unique references auth\.users/)
  assert.match(MIGRATION, /enable row level security/)
  assert.match(MIGRATION, /revoke all on table public\.client_portal_access from anon/)
  assert.match(MIGRATION, /revoke all on table public\.client_portal_access from authenticated/)
  assert.doesNotMatch(MIGRATION, /password\s+text/i)
})

test('username login resolves exact mapped auth user and refuses inactive or disabled clients', () => {
  assert.match(EDGE, /from\('client_portal_access'\)/)
  assert.match(EDGE, /eq\('username', username\)/)
  assert.match(EDGE, /!access\?\.enabled/)
  assert.match(EDGE, /from\('clients'\)/)
  assert.match(EDGE, /!client\?\.active/)
  assert.match(EDGE, /getUserById\(access\.auth_user_id\)/)
  assert.match(EDGE, /signInWithPassword\(\{ email, password \}\)/)
  assert.match(EDGE, /signIn\.user\?\.id !== access\.auth_user_id/)
  assert.match(EDGE, /Invalid username or password\./)
})

test('provisioning uses Auth Admin and links the created profile to one exact client', () => {
  assert.match(EDGE, /auth\.admin\.createUser/)
  assert.match(EDGE, /email_confirm: true/)
  assert.match(EDGE, /role: 'client'/)
  assert.match(EDGE, /client_id: clientId/)
  assert.match(EDGE, /from\('client_portal_access'\)\s*\.upsert/)
  assert.match(EDGE, /That portal username is already assigned\./)
  assert.match(EDGE, /client_packages/)
  assert.match(EDGE, /ACTIVE_PACKAGE_STATUSES/)
  assert.doesNotMatch(EDGE, /insert\s+into\s+auth\.users/i)
})

test('phase-one starter credential is generated only in the server access service', () => {
  assert.match(EDGE, /username.*_cg\$/s)
  assert.doesNotMatch(MIGRATION, /starter_password|password_hash|plaintext_password/i)
  assert.doesNotMatch(API, /_cg\$/)
  assert.doesNotMatch(ADMIN, /_cg\$/)
})

test('existing staff email login remains while username login uses the server resolver', () => {
  assert.match(AUTH, /value\.includes\('@'\)/)
  assert.match(AUTH, /signInWithPassword\(\{ email: value, password \}\)/)
  assert.match(AUTH, /signInWithPortalUsername\(value, password\)/)
  assert.match(AUTH, /supabase\.auth\.setSession/)
  assert.match(LOGIN, /Username or email/)
  assert.match(LOGIN, /autoComplete="username"/)
  assert.match(LOGIN, /Company username or email/)
})

test('client access management stays inside the admin Users workspace', () => {
  assert.match(USERS_HUB, /ClientAccessAdmin/)
  assert.match(USERS_HUB, /'client-access'/)
  assert.match(USERS_HUB, /Client Access/)
  assert.match(ADMIN, /provisionClientPortalAccess/)
  assert.match(ADMIN, /resetClientPortalAccess/)
  assert.match(ADMIN, /setClientPortalAccessEnabled/)
  assert.match(ADMIN, /Copy login details/)
})

test('admin access API never persists generated credentials client-side', () => {
  assert.match(API, /supabase\.functions\.invoke<AccessResponse>\('client-portal-access'/)
  assert.match(ADMIN, /ClientPortalCredentials/)
  assert.doesNotMatch(API, /localStorage|sessionStorage/)
  assert.doesNotMatch(ADMIN, /localStorage|sessionStorage/)
})
