import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let m

before(async () => {
  server = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  })
  m = await server.ssrLoadModule('/src/lib/onedriveCanonical.ts')
})

after(async () => {
  await server?.close()
})

test('canonical month abbreviations follow the 3-letter EN convention', () => {
  assert.equal(m.canonicalMonthAbbrev(1), 'JAN')
  assert.equal(m.canonicalMonthAbbrev(9), 'SEP') // not SEPT (observed drift)
  assert.equal(m.canonicalMonthAbbrev(3), 'MAR') // not MRT (observed drift)
  assert.throws(() => m.canonicalMonthAbbrev(0))
  assert.throws(() => m.canonicalMonthAbbrev(13))
})

test('canonical folder name builders', () => {
  assert.equal(m.buildYearFolderName(2026), '2026')
  assert.equal(m.buildMonthFolderName(2026, 9), '2026_09_SEP')
  assert.equal(m.buildMonthFolderName(2025, 8), '2025_08_AUG')
  assert.equal(m.buildVideoFolderName(2025, 8, 'ECONO', 2), '2025_08_ECONO_VIDEO_02')
  assert.equal(m.buildVideoFolderName(2026, 9, 'econo', 12), '2026_09_ECONO_VIDEO_12') // code uppercased
})

test('short code validation', () => {
  assert.equal(m.normalizeShortCode(' econo '), 'ECONO')
  assert.throws(() => m.normalizeShortCode(''))
  assert.throws(() => m.normalizeShortCode('has space'))
})

test('runtime resolution is by durable id, never by name', () => {
  const children = [
    { id: 'A1', name: 'Videos', folder: true },
    { id: 'B2', name: 'videos', folder: true }, // casing drift decoy
  ]
  assert.equal(m.resolveChildByDurableId(children, 'A1').id, 'A1')
  assert.equal(m.resolveChildByDurableId(children, 'ZZ'), null)
  assert.equal(m.resolveChildByDurableId(children, ''), null)
})

test('create-on-request: exists vs create plan (mapping-time only, case-insensitive assist)', () => {
  const children = [{ id: 'M1', name: '2026_09_SEP', folder: true }]
  const existing = m.planCanonicalFolder(children, '2026_09_sep')
  assert.equal(existing.action, 'exists')
  assert.equal(existing.item.id, 'M1')

  const missing = m.planCanonicalFolder(children, '2026_10_OCT')
  assert.equal(missing.action, 'create')
  assert.equal(missing.name, '2026_10_OCT')
})

test('exact-client isolation guard', () => {
  assert.doesNotThrow(() => m.assertSameClient('c1', 'c1'))
  assert.throws(() => m.assertSameClient('c1', 'c2'))
  assert.throws(() => m.assertSameClient('', 'c2'))
})

test('token lifecycle state machine', () => {
  const now = 1_000_000_000_000
  // no refresh token -> needs one-time consent
  assert.equal(
    m.computeTokenState({ hasRefreshToken: false, accessTokenExpiresAt: null, now }),
    'needs_consent',
  )
  // refresh token but no access token -> refresh
  assert.equal(
    m.computeTokenState({ hasRefreshToken: true, accessTokenExpiresAt: null, now }),
    'needs_refresh',
  )
  // access token expiring within skew -> refresh
  assert.equal(
    m.computeTokenState({
      hasRefreshToken: true,
      accessTokenExpiresAt: now + 60_000,
      now,
      skewSeconds: 300,
    }),
    'needs_refresh',
  )
  // healthy access token -> valid
  assert.equal(
    m.computeTokenState({
      hasRefreshToken: true,
      accessTokenExpiresAt: now + 3_600_000,
      now,
      skewSeconds: 300,
    }),
    'valid',
  )
})
