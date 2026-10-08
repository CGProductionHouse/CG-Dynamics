import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const users = readFileSync(new URL('../src/pages/admin/UsersAdmin.tsx', import.meta.url), 'utf8')
const hub = readFileSync(new URL('../src/pages/admin/UsersHub.tsx', import.meta.url), 'utf8')

test('admin Users workspace separates workforce and client logins without changing role authority', () => {
  assert.match(users, /useState<UserView>\('team'\)/)
  for (const view of ['team', 'clients', 'pending', 'all']) assert.match(users, new RegExp(`'${view}'`))
  assert.match(users, /profile\.role === 'client'/)
  assert.match(users, /profile\.client_id/)
  assert.match(users, /Search name, email or client/)
  assert.match(users, /aria-pressed=\{view === option\}/)
  assert.match(hub, /aria-pressed=\{tab === item\.key\}/)
  assert.doesNotMatch(users, /from\(['"]profiles['"]\)/)
})

test('status and generated login labels do not imply false active or public email identity', () => {
  assert.match(users, /profile\.is_active === false/)
  assert.match(users, /profile\.is_active !== true/)
  assert.match(users, /Status unverified/)
  assert.match(users, /Generated portal login/)
  assert.match(users, /<details/)
  assert.match(users, /<LoginIdentity profile=\{p\}/)
  assert.match(users, /<StatusBadge profile=\{p\}/)
})
