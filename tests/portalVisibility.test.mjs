import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  visiblePortalMonths,
  PORTAL_VISIBILITY_TIMEZONE,
  portalClientSlug,
  portalRootFolderName,
  resolvePortalMapping,
  PORTAL_REQUIRED_CATEGORIES,
} from '../supabase/functions/_shared/portal-visibility.ts'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const ef = read('../supabase/functions/client-onboarding/index.ts')
const migration = read('../supabase/migrations/20260919100000_client_portal_remove_photography.sql')
const types = read('../src/features/client-portal-library/types.ts')
const ui = read('../src/features/client-portal-library/ClientPortalLibrary.tsx')
const portalVis = read('../supabase/functions/_shared/portal-visibility.ts')

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

// ── Canonical portal slug (approved physical naming) ──────────────────────────

test('portalClientSlug: Red Oak -> Red_Oak', () => {
  assert.equal(portalClientSlug('Red Oak'), 'Red_Oak')
})

test('portalClientSlug: AV Event Life -> AV_Event_Life', () => {
  assert.equal(portalClientSlug('AV Event Life'), 'AV_Event_Life')
})

test('portalClientSlug: C&L Innovations -> C_L_Innovations', () => {
  assert.equal(portalClientSlug('C&L Innovations'), 'C_L_Innovations')
})

test('portalClientSlug: RC-Polypipe -> RC_Polypipe', () => {
  assert.equal(portalClientSlug('RC-Polypipe'), 'RC_Polypipe')
})

test('portalClientSlug: Bloem Marble & Granite -> Bloem_Marble_Granite', () => {
  assert.equal(portalClientSlug('Bloem Marble & Granite'), 'Bloem_Marble_Granite')
})

test('portalClientSlug: Dulux Paint & Paper Bloemfontein -> Dulux_Paint_Paper_Bloemfontein', () => {
  assert.equal(portalClientSlug('Dulux Paint & Paper Bloemfontein'), 'Dulux_Paint_Paper_Bloemfontein')
})

test('portalClientSlug: collapses multiple separators into single underscore', () => {
  assert.equal(portalClientSlug('A  B___C...D'), 'A_B_C_D')
})

test('portalClientSlug: trims leading/trailing underscores', () => {
  assert.equal(portalClientSlug('  Hello World  '), 'Hello_World')
})

test('portalClientSlug: preserves alphanumeric case', () => {
  assert.equal(portalClientSlug('MyCompany'), 'MyCompany')
})

test('portalRootFolderName: produces A_ClientPortal_<slug>', () => {
  assert.equal(portalRootFolderName('Red Oak'), 'A_ClientPortal_Red_Oak')
  assert.equal(portalRootFolderName('RC-Polypipe'), 'A_ClientPortal_RC_Polypipe')
})

test('portalClientSlug is exported for testing', () => {
  assert.ok(portalVis.includes('export function portalClientSlug'), 'function is exported')
})

test('portalRootFolderName is exported for testing', () => {
  assert.ok(portalVis.includes('export function portalRootFolderName'), 'function is exported')
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

// ── staff_resolve_portal_root: structural checks ──────────────────────────────

test('staff_resolve_portal_root requires admin role', () => {
  assert.match(ef, /action === 'staff_resolve_portal_root'[\s\S]*?Admin access required/, 'admin-only action')
})

test('EF uses resolvePortalMapping from shared module', () => {
  assert.ok(ef.includes('resolvePortalMapping(client.name, rootChildren, categoryChildren)'), 'EF calls pure resolver')
})

test('EF uses portalRootFolderName from shared module', () => {
  assert.ok(ef.includes('portalRootFolderName(client.name)'), 'EF uses portalRootFolderName')
})

test('EF imports portalRootFolderName', () => {
  assert.ok(ef.includes('portalRootFolderName') && ef.includes("from '../_shared/portal-visibility.ts'"), 'imports portalRootFolderName')
})

test('library created with enabled: false until explicit activation', () => {
  const resolveBlock = ef.slice(ef.indexOf("action === 'staff_resolve_portal_root'"))
  assert.ok(resolveBlock.includes('enabled: false'), 'library created disabled')
  assert.ok(!resolveBlock.includes('enabled: true'), 'library never enabled during resolve')
})

test('library persist happens AFTER category validation (not before)', () => {
  const resolveBlock = ef.slice(ef.indexOf("action === 'staff_resolve_portal_root'"))
  const validatePos = resolveBlock.indexOf('resolvePortalMapping')
  const persistPos = resolveBlock.indexOf('client_portal_libraries')
  assert.ok(validatePos < persistPos, 'category validation must precede library persist')
})

test('category bulk upsert uses single .upsert call (atomic)', () => {
  const resolveBlock = ef.slice(ef.indexOf("action === 'staff_resolve_portal_root'"))
  const persistSection = resolveBlock.slice(resolveBlock.indexOf('client_portal_library_categories'))
  const upsertCount = (persistSection.match(/\.upsert\(/g) || []).length
  assert.equal(upsertCount, 1, 'exactly one upsert call for categories (atomic bulk)')
})

test('category bulk upsert uses onConflict library_id,category', () => {
  const resolveBlock = ef.slice(ef.indexOf("action === 'staff_resolve_portal_root'"))
  const persistSection = resolveBlock.slice(resolveBlock.indexOf('client_portal_library_categories'))
  assert.ok(persistSection.includes("onConflict: 'library_id,category'"), 'category upsert on library_id+category')
})

test('library upsert uses onConflict client_id', () => {
  const resolveBlock = ef.slice(ef.indexOf("action === 'staff_resolve_portal_root'"))
  assert.ok(resolveBlock.includes("onConflict: 'client_id'"), 'library upsert on client_id')
})

test('library upsert error returns 503', () => {
  assert.match(ef, /Could not save portal mapping.*503/, '503 on library upsert failure')
})

test('category bulk upsert error returns 503', () => {
  assert.match(ef, /Could not save category mappings.*503/, '503 on category bulk upsert failure')
})

test('last_verified_at set on category rows', () => {
  const resolveBlock = ef.slice(ef.indexOf("action === 'staff_resolve_portal_root'"))
  assert.ok(resolveBlock.includes('last_verified_at: now'), 'sets last_verified_at on category rows')
})

test('response includes enabled: false and created flag', () => {
  const resolveBlock = ef.slice(ef.indexOf("action === 'staff_resolve_portal_root'"))
  assert.ok(resolveBlock.includes('enabled: false'), 'response includes enabled: false')
  assert.ok(resolveBlock.includes('created,'), 'response includes created flag')
})

test('EF does not use old slug pattern (strips all non-alphanumeric)', () => {
  const resolveBlock = ef.slice(ef.indexOf("action === 'staff_resolve_portal_root'"))
  assert.ok(!resolveBlock.includes("replace(/[^A-Za-z0-9]/g, '')"), 'no old slug pattern')
})

// ── Pure resolver: mocked behavior tests ──────────────────────────────────────

function makeFolder(id, name) {
  return { id, name, isFolder: true }
}

function makeFile(id, name) {
  return { id, name, isFolder: false }
}

const VALID_ROOT_CHILDREN = [
  makeFolder('root-id-red-oak', 'A_ClientPortal_Red_Oak'),
  makeFolder('root-id-other', 'A_ClientPortal_Other_Client'),
  makeFile('file-1', 'readme.txt'),
]

const VALID_CATEGORY_CHILDREN = [
  makeFolder('cat-brand', 'Brand Identity'),
  makeFolder('cat-graphic', 'Graphic Design'),
  makeFolder('cat-video', 'Video'),
  makeFile('file-2', 'notes.txt'),
]

test('resolver: exact approved root selected', () => {
  const result = resolvePortalMapping('Red Oak', VALID_ROOT_CHILDREN, VALID_CATEGORY_CHILDREN)
  assert.ok(!('error' in result), 'should not error')
  assert.equal(result.rootItemId, 'root-id-red-oak')
  assert.equal(result.rootFolderName, 'A_ClientPortal_Red_Oak')
})

test('resolver: valid 3-child portal produces one deterministic mapping plan', () => {
  const result = resolvePortalMapping('Red Oak', VALID_ROOT_CHILDREN, VALID_CATEGORY_CHILDREN)
  assert.ok(!('error' in result), 'should not error')
  assert.equal(result.categories.length, 3)
  assert.deepEqual(result.categories.map(c => c.key), ['brand_identity', 'graphic_design', 'video'])
  assert.deepEqual(result.categories.map(c => c.folderId), ['cat-brand', 'cat-graphic', 'cat-video'])
  assert.deepEqual(result.categories.map(c => c.folderName), ['Brand Identity', 'Graphic Design', 'Video'])
})

test('resolver: repeat input returns same root/category IDs (idempotent)', () => {
  const result1 = resolvePortalMapping('Red Oak', VALID_ROOT_CHILDREN, VALID_CATEGORY_CHILDREN)
  const result2 = resolvePortalMapping('Red Oak', VALID_ROOT_CHILDREN, VALID_CATEGORY_CHILDREN)
  assert.ok(!('error' in result1))
  assert.ok(!('error' in result2))
  assert.deepEqual(result1, result2, 'identical inputs produce identical results')
})

test('resolver: sibling/internal Graphic Design workspace excluded', () => {
  const rootChildren = [
    makeFolder('root-1', 'A_ClientPortal_Test'),
    makeFolder('gd-workspace', 'Graphic Design'),
  ]
  const categoryChildren = [
    makeFolder('cat-brand', 'Brand Identity'),
    makeFolder('cat-graphic', 'Graphic Design'),
    makeFolder('cat-video', 'Video'),
  ]
  const result = resolvePortalMapping('Test', rootChildren, categoryChildren)
  assert.ok(!('error' in result))
  assert.equal(result.rootItemId, 'root-1', 'selects portal root, not Graphic Design workspace')
})

test('resolver: Videos folder excluded from categories', () => {
  const categoryChildren = [
    makeFolder('cat-brand', 'Brand Identity'),
    makeFolder('cat-graphic', 'Graphic Design'),
    makeFolder('cat-video', 'Video'),
    makeFolder('videos-sibling', 'Videos'),
  ]
  const result = resolvePortalMapping('Red Oak', VALID_ROOT_CHILDREN, categoryChildren)
  assert.ok(!('error' in result))
  assert.ok(!result.categories.some(c => c.folderName === 'Videos'), 'Videos not in categories')
})

test('resolver: VIDEOS folder excluded from categories', () => {
  const categoryChildren = [
    makeFolder('cat-brand', 'Brand Identity'),
    makeFolder('cat-graphic', 'Graphic Design'),
    makeFolder('cat-video', 'Video'),
    makeFolder('videos-upper', 'VIDEOS'),
  ]
  const result = resolvePortalMapping('Red Oak', VALID_ROOT_CHILDREN, categoryChildren)
  assert.ok(!('error' in result))
  assert.ok(!result.categories.some(c => c.folderName === 'VIDEOS'), 'VIDEOS not in categories')
})

test('resolver: Photos folder excluded from categories', () => {
  const categoryChildren = [
    makeFolder('cat-brand', 'Brand Identity'),
    makeFolder('cat-graphic', 'Graphic Design'),
    makeFolder('cat-video', 'Video'),
    makeFolder('photos-sibling', 'Photos'),
  ]
  const result = resolvePortalMapping('Red Oak', VALID_ROOT_CHILDREN, categoryChildren)
  assert.ok(!('error' in result))
  assert.ok(!result.categories.some(c => c.folderName === 'Photos'), 'Photos not in categories')
})

test('resolver: Photography folder excluded from categories', () => {
  const categoryChildren = [
    makeFolder('cat-brand', 'Brand Identity'),
    makeFolder('cat-graphic', 'Graphic Design'),
    makeFolder('cat-video', 'Video'),
    makeFolder('photo-sibling', 'Photography'),
  ]
  const result = resolvePortalMapping('Red Oak', VALID_ROOT_CHILDREN, categoryChildren)
  assert.ok(!('error' in result))
  assert.ok(!result.categories.some(c => c.folderName === 'Photography'), 'Photography not in categories')
})

test('resolver: missing required category (Brand Identity) -> hard failure', () => {
  const categoryChildren = [
    makeFolder('cat-graphic', 'Graphic Design'),
    makeFolder('cat-video', 'Video'),
  ]
  const result = resolvePortalMapping('Red Oak', VALID_ROOT_CHILDREN, categoryChildren)
  assert.ok('error' in result, 'should error')
  assert.equal(result.httpStatus, 404)
  assert.ok(result.error.includes('Brand Identity'), 'error mentions missing category')
})

test('resolver: missing required category (Graphic Design) -> hard failure', () => {
  const categoryChildren = [
    makeFolder('cat-brand', 'Brand Identity'),
    makeFolder('cat-video', 'Video'),
  ]
  const result = resolvePortalMapping('Red Oak', VALID_ROOT_CHILDREN, categoryChildren)
  assert.ok('error' in result, 'should error')
  assert.equal(result.httpStatus, 404)
  assert.ok(result.error.includes('Graphic Design'), 'error mentions missing category')
})

test('resolver: missing required category (Video) -> hard failure', () => {
  const categoryChildren = [
    makeFolder('cat-brand', 'Brand Identity'),
    makeFolder('cat-graphic', 'Graphic Design'),
  ]
  const result = resolvePortalMapping('Red Oak', VALID_ROOT_CHILDREN, categoryChildren)
  assert.ok('error' in result, 'should error')
  assert.equal(result.httpStatus, 404)
  assert.ok(result.error.includes('Video'), 'error mentions missing category')
})

test('resolver: missing portal root -> hard failure', () => {
  const result = resolvePortalMapping('Nonexistent Client', VALID_ROOT_CHILDREN, VALID_CATEGORY_CHILDREN)
  assert.ok('error' in result, 'should error')
  assert.equal(result.httpStatus, 404)
  assert.ok(result.error.includes('Portal folder not found'), 'error mentions missing root')
})

test('resolver: duplicate exact category names fail closed (409 conflict)', () => {
  const categoryChildren = [
    makeFolder('cat-brand-1', 'Brand Identity'),
    makeFolder('cat-brand-2', 'Brand Identity'),
    makeFolder('cat-graphic', 'Graphic Design'),
    makeFolder('cat-video', 'Video'),
  ]
  const result = resolvePortalMapping('Red Oak', VALID_ROOT_CHILDREN, categoryChildren)
  assert.ok('error' in result, 'should error on duplicate category')
  assert.equal(result.httpStatus, 409)
  assert.ok(result.error.includes('Brand Identity'), 'error mentions duplicate category')
})

test('resolver: duplicate Graphic Design -> hard failure (409)', () => {
  const categoryChildren = [
    makeFolder('cat-brand', 'Brand Identity'),
    makeFolder('cat-gd-1', 'Graphic Design'),
    makeFolder('cat-gd-2', 'Graphic Design'),
    makeFolder('cat-video', 'Video'),
  ]
  const result = resolvePortalMapping('Red Oak', VALID_ROOT_CHILDREN, categoryChildren)
  assert.ok('error' in result, 'should error on duplicate Graphic Design')
  assert.equal(result.httpStatus, 409)
  assert.ok(result.error.includes('Graphic Design'), 'error mentions duplicate Graphic Design')
})

test('resolver: duplicate Video -> hard failure (409)', () => {
  const categoryChildren = [
    makeFolder('cat-brand', 'Brand Identity'),
    makeFolder('cat-graphic', 'Graphic Design'),
    makeFolder('cat-video-1', 'Video'),
    makeFolder('cat-video-2', 'Video'),
  ]
  const result = resolvePortalMapping('Red Oak', VALID_ROOT_CHILDREN, categoryChildren)
  assert.ok('error' in result, 'should error on duplicate Video')
  assert.equal(result.httpStatus, 409)
  assert.ok(result.error.includes('Video'), 'error mentions duplicate Video')
})

test('resolver: duplicate portal root -> hard failure (409)', () => {
  const rootChildren = [
    makeFolder('root-1', 'A_ClientPortal_Red_Oak'),
    makeFolder('root-2', 'A_ClientPortal_Red_Oak'),
  ]
  const result = resolvePortalMapping('Red Oak', rootChildren, VALID_CATEGORY_CHILDREN)
  assert.ok('error' in result, 'should error on duplicate portal root')
  assert.equal(result.httpStatus, 409)
  assert.ok(result.error.includes('Duplicate portal root'), 'error mentions duplicate root')
})

test('resolver: case-sensitive exact match (no case folding)', () => {
  const categoryChildren = [
    makeFolder('cat-brand', 'brand identity'),
    makeFolder('cat-graphic', 'Graphic Design'),
    makeFolder('cat-video', 'Video'),
  ]
  const result = resolvePortalMapping('Red Oak', VALID_ROOT_CHILDREN, categoryChildren)
  assert.ok('error' in result, 'lowercase "brand identity" should not match')
  assert.equal(result.httpStatus, 404)
})

test('resolver: empty root children -> portal not found', () => {
  const result = resolvePortalMapping('Red Oak', [], VALID_CATEGORY_CHILDREN)
  assert.ok('error' in result)
  assert.equal(result.httpStatus, 404)
})

test('resolver: empty category children -> missing category', () => {
  const result = resolvePortalMapping('Red Oak', VALID_ROOT_CHILDREN, [])
  assert.ok('error' in result)
  assert.equal(result.httpStatus, 404)
})

test('resolver: files in root children are ignored (isFolder check)', () => {
  const rootChildren = [
    makeFile('file-1', 'A_ClientPortal_Red_Oak'),
    makeFolder('root-id', 'A_ClientPortal_Red_Oak'),
  ]
  const result = resolvePortalMapping('Red Oak', rootChildren, VALID_CATEGORY_CHILDREN)
  assert.ok(!('error' in result))
  assert.equal(result.rootItemId, 'root-id')
})

test('resolver: files in category children are ignored (isFolder check)', () => {
  const categoryChildren = [
    makeFile('file-1', 'Brand Identity'),
    makeFolder('cat-brand', 'Brand Identity'),
    makeFolder('cat-graphic', 'Graphic Design'),
    makeFolder('cat-video', 'Video'),
  ]
  const result = resolvePortalMapping('Red Oak', VALID_ROOT_CHILDREN, categoryChildren)
  assert.ok(!('error' in result))
  assert.equal(result.categories[0].folderId, 'cat-brand')
})

test('resolver: PORTAL_REQUIRED_CATEGORIES has exactly 3 entries', () => {
  assert.equal(PORTAL_REQUIRED_CATEGORIES.length, 3)
  assert.deepEqual([...PORTAL_REQUIRED_CATEGORIES].map(c => c.key), ['brand_identity', 'graphic_design', 'video'])
})

// ── Shared module is pure ─────────────────────────────────────────────────────

test('portal-visibility shared module is pure (no network, no Deno, no React)', () => {
  assert.ok(!portalVis.includes('fetch('), 'no network calls')
  assert.ok(!portalVis.includes('Deno.'), 'no Deno API')
  assert.ok(!portalVis.includes('import React'), 'no React')
  assert.ok(!portalVis.includes('createElement'), 'no JSX')
})

test('visiblePortalMonths is exported for testing', () => {
  assert.ok(portalVis.includes('export function visiblePortalMonths'), 'function is exported')
})

test('PORTAL_VISIBILITY_TIMEZONE is exported for testing', () => {
  assert.ok(portalVis.includes('export const PORTAL_VISIBILITY_TIMEZONE'), 'constant is exported')
})

test('resolvePortalMapping is exported for testing', () => {
  assert.ok(portalVis.includes('export function resolvePortalMapping'), 'function is exported')
})

test('PORTAL_REQUIRED_CATEGORIES is exported for testing', () => {
  assert.ok(portalVis.includes('export const PORTAL_REQUIRED_CATEGORIES'), 'constant is exported')
})
