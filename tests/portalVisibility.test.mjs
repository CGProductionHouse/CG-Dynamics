import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { visiblePortalMonths, PORTAL_VISIBILITY_TIMEZONE } from '../supabase/functions/_shared/portal-visibility.ts'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const ef = read('../supabase/functions/client-onboarding/index.ts')
const migration = read('../supabase/migrations/20260919100000_client_portal_remove_photography.sql')
const types = read('../src/features/client-portal-library/types.ts')
const ui = read('../src/features/client-portal-library/ClientPortalLibrary.tsx')

// ── visiblePortalMonths: SAST timezone boundary tests ─────────────────────────

test('timezone is Africa/Johannesburg (CG business timezone)', () => {
  assert.equal(PORTAL_VISIBILITY_TIMEZONE, 'Africa/Johannesburg')
})

test('Sep 30 23:59 SAST -> October visible, November hidden', () => {
  const now = new Date('2026-09-30T21:59:00Z')
  const months = visiblePortalMonths(now)
  assert.equal(months.length, 2)
  assert.deepEqual(months[0], { year: 2026, month: 9 })
  assert.deepEqual(months[1], { year: 2026, month: 10 })
  assert.ok(!months.some(m => m.year === 2026 && m.month === 11), 'November must be hidden on Sep 30')
})

test('Oct 1 00:00 SAST -> November visible', () => {
  const now = new Date('2026-09-30T22:00:00Z')
  const months = visiblePortalMonths(now)
  assert.equal(months.length, 2)
  assert.deepEqual(months[0], { year: 2026, month: 10 })
  assert.deepEqual(months[1], { year: 2026, month: 11 })
})

test('Dec 1 00:00 SAST -> January (next year) visible', () => {
  const now = new Date('2026-11-30T22:00:00Z')
  const months = visiblePortalMonths(now)
  assert.equal(months.length, 2)
  assert.deepEqual(months[0], { year: 2026, month: 12 })
  assert.deepEqual(months[1], { year: 2027, month: 1 })
})

test('Nov 30 23:59 SAST -> December visible, January hidden', () => {
  const now = new Date('2026-11-30T21:59:00Z')
  const months = visiblePortalMonths(now)
  assert.equal(months.length, 2)
  assert.deepEqual(months[0], { year: 2026, month: 11 })
  assert.deepEqual(months[1], { year: 2026, month: 12 })
  assert.ok(!months.some(m => m.year === 2027 && m.month === 1), 'Jan must be hidden on Nov 30')
})

test('always returns exactly 2 months', () => {
  const cases = [
    new Date('2026-01-15T10:00:00Z'),
    new Date('2026-06-30T22:00:00Z'),
    new Date('2026-12-31T21:59:00Z'),
    new Date('2027-02-28T22:00:00Z'),
  ]
  for (const now of cases) {
    const months = visiblePortalMonths(now)
    assert.equal(months.length, 2, `Expected 2 months for ${now.toISOString()}`)
  }
})

test('current month is always first, next month is always second', () => {
  const now = new Date('2026-07-15T10:00:00Z')
  const months = visiblePortalMonths(now)
  assert.equal(months[0].month, 7)
  assert.equal(months[1].month, 8)
  assert.ok(months[0].year <= months[1].year)
})

// ── Photography is rejected everywhere ────────────────────────────────────────

test('PORTAL_CATEGORY_LABELS excludes photography', () => {
  assert.ok(!ef.includes("photography: 'Photography'"), 'EF must not have photography label')
  assert.ok(ef.includes("brand_identity: 'Brand Identity'"))
  assert.ok(ef.includes("graphic_design: 'Graphic Design'"))
  assert.ok(ef.includes("video: 'Video'"))
})

test('DB migration excludes photography from category check', () => {
  assert.ok(!migration.includes("'photography'"), 'no photography in category check')
  assert.ok(migration.includes("'brand_identity', 'graphic_design', 'video'"), 'exactly 3 categories')
})

test('DB migration excludes Photography from folder_name check', () => {
  assert.ok(!migration.includes("'Photography'"), 'no Photography folder_name')
  assert.ok(migration.includes("'Brand Identity'"))
  assert.ok(migration.includes("'Graphic Design'"))
  assert.ok(migration.includes("'Video'"))
})

test('frontend types exclude photography', () => {
  assert.ok(!types.includes("'photography'"), 'types must not list photography')
  assert.ok(types.includes("'brand_identity'"))
  assert.ok(types.includes("'graphic_design'"))
  assert.ok(types.includes("'video'"))
})

test('frontend UI excludes photography', () => {
  assert.ok(!ui.includes("photography: 'Photography'"), 'UI must not have photography label')
})

// ── Brand Identity is flat/non-monthly ────────────────────────────────────────

test('brand_identity is flat: month-visibility skips it', () => {
  assert.match(ef, /category\.category !== 'brand_identity'.*isVisible/s, 'month-visibility must skip brand_identity')
})

test('brand_identity flat flag used for query filtering', () => {
  assert.match(ef, /const flat = categoryName === 'brand_identity'/, 'flat flag set for brand_identity')
  assert.match(ef, /assetsQuery = flat[\s\S]*?assetsQuery\.is\('library_year', null\)\.is\('library_month', null\)/, 'flat queries null year+month')
})

// ── Graphic Design + Video are monthly ────────────────────────────────────────

test('non-flat categories require year+month validation', () => {
  assert.match(ef, /!flat && \(!Number\.isInteger\(year\)/, 'non-flat validates year+month')
})

test('month-visibility gate applies to non-flat categories', () => {
  assert.match(ef, /if \(!flat\) \{[\s\S]*?visiblePortalMonths/, 'visibility gate only for non-flat')
})

// ── staff_resolve_portal_root: structure and safety ───────────────────────────

test('staff_resolve_portal_root requires admin role', () => {
  assert.match(ef, /action === 'staff_resolve_portal_root'[\s\S]*?Admin access required/, 'admin-only action')
})

test('resolves exact A_ClientPortal_<ClientSlug> only', () => {
  assert.match(ef, /expectedRootName = `A_ClientPortal_\$\{slug\}`/, 'exact portal root naming')
  assert.match(ef, /children\.find\(c => c\.isFolder && c\.name === expectedRootName\)/, 'exact name match only')
})

test('maps exactly 3 categories: Brand Identity, Graphic Design, Video', () => {
  assert.match(ef, /brand_identity.*Brand Identity/, 'brand_identity mapped')
  assert.match(ef, /graphic_design.*Graphic Design/, 'graphic_design mapped')
  assert.match(ef, /video.*Video(?!,)/, 'video mapped')
  const catBlock = ef.slice(ef.indexOf("action === 'staff_resolve_portal_root'"))
  const catCount = (catBlock.match(/expectedName:/g) || []).length
  assert.equal(catCount, 3, 'exactly 3 categories in resolution block')
})

test('cannot map Photography, Videos, Photos or sibling folders', () => {
  const resolveBlock = ef.slice(ef.indexOf("action === 'staff_resolve_portal_root'"))
  assert.ok(!resolveBlock.includes("'Photography'"), 'no Photography mapping')
  assert.ok(!resolveBlock.includes("'Videos'"), 'no Videos mapping')
  assert.ok(!resolveBlock.includes("'Photos'"), 'no Photos mapping')
  assert.ok(!resolveBlock.includes("'videos'"), 'no lowercase videos mapping')
})

test('fails closed on missing portal root', () => {
  assert.match(ef, /Portal folder not found.*404/, 'returns 404 when portal root missing')
})

test('fails closed on missing category folder', () => {
  assert.match(ef, /found: false/, 'reports found: false for missing categories')
})

test('fails closed on library upsert error', () => {
  assert.match(ef, /Could not save portal mapping.*503/, '503 on library upsert failure')
})

test('fails closed on category upsert error', () => {
  assert.match(ef, /Could not save category mapping.*503/, '503 on category upsert failure')
})

test('repeated resolve/upsert is idempotent (uses upsert with onConflict)', () => {
  assert.match(ef, /client_portal_libraries[\s\S]*?onConflict: 'client_id'/, 'library upsert on client_id')
  assert.match(ef, /client_portal_library_categories[\s\S]*?onConflict: 'library_id,category'/, 'category upsert on library_id+category')
})

test('upserts verified_at timestamp for trust establishment', () => {
  const resolveBlock = ef.slice(ef.indexOf("action === 'staff_resolve_portal_root'"))
  assert.ok(resolveBlock.includes('last_verified_at'), 'sets last_verified_at on upsert')
})

test('drive_id comes from resolveClientsFolder (durable Graph ID)', () => {
  assert.match(ef, /resolveClientsFolder\(\)/, 'resolves drive from Graph')
  assert.match(ef, /clientsFolder\.driveId/, 'uses durable drive ID')
})

test('uses listChildren for portal root discovery (not path-based)', () => {
  assert.match(ef, /listChildren\(clientsFolder\.driveId, clientsFolder\.itemId\)/, 'lists children of Clients root')
  assert.match(ef, /listChildren\(clientsFolder\.driveId, portalRoot\.id\)/, 'lists children of portal root')
})
