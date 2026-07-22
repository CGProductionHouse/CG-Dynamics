import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// Pure Content Workflow rules are loaded through a Vite SSR server (the module
// has no Supabase import, so nothing hits the network). The migration contract
// is validated by parsing the SQL file. No database is touched.

let server
let rules

before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  rules = await server.ssrLoadModule('/src/lib/contentWorkflowRules.ts')
})
after(async () => { await server?.close() })

// ── Guide status transitions ──────────────────────────────────────────────────

test('guide actions target the correct status', () => {
  assert.equal(rules.guideActionTarget('submit_review'), 'needs_review')
  assert.equal(rules.guideActionTarget('approve'), 'approved')
  assert.equal(rules.guideActionTarget('return_to_review'), 'needs_review')
  assert.equal(rules.guideActionTarget('archive'), 'archived')
})

test('guide actions are only available from sensible states', () => {
  assert.equal(rules.canRunGuideAction('idea', 'approve'), true)
  assert.equal(rules.canRunGuideAction('needs_review', 'approve'), true)
  assert.equal(rules.canRunGuideAction('approved', 'approve'), false)
  assert.equal(rules.canRunGuideAction('approved', 'return_to_review'), true)
  assert.equal(rules.canRunGuideAction('idea', 'return_to_review'), false)
  assert.equal(rules.canRunGuideAction('archived', 'approve'), false)
  assert.equal(rules.canRunGuideAction('archived', 'archive'), false)
  assert.equal(rules.canRunGuideAction('completed', 'archive'), true)
})

// ── Approved-only add-to-run rule ─────────────────────────────────────────────

test('only an approved idea can be added to a run', () => {
  assert.equal(rules.canAddGuideToRun('approved'), true)
  for (const status of ['idea', 'needs_review', 'added_to_run', 'in_production', 'completed', 'archived']) {
    assert.equal(rules.canAddGuideToRun(status), false, `${status} must not be addable`)
  }
})

// ── Run assignment visibility ─────────────────────────────────────────────────

test('a run is visible to its lead (by id or name) and helpers', () => {
  const run = { lead_user_id: 'user-1', lead_name: 'Amonique', helper_names: ['Thabo', 'Lerato'] }
  assert.equal(rules.runInvolvesUser(run, { id: 'user-1' }), true)
  assert.equal(rules.runInvolvesUser(run, { id: 'other', full_name: 'amonique' }), true)
  assert.equal(rules.runInvolvesUser(run, { full_name: 'THABO' }), true)
  assert.equal(rules.runInvolvesUser(run, { full_name: 'Someone Else' }), false)
  assert.equal(rules.runInvolvesUser({ lead_user_id: null, lead_name: null, helper_names: [] }, { full_name: '' }), false)
})

// ── Seven-day upcoming filtering ──────────────────────────────────────────────

test('isRunUpcoming includes runs within the window and excludes others', () => {
  const today = '2026-07-22'
  assert.equal(rules.isRunUpcoming({ run_date: '2026-07-22', status: 'planning' }, today), true)
  assert.equal(rules.isRunUpcoming({ run_date: '2026-07-29', status: 'ready' }, today), true)
  assert.equal(rules.isRunUpcoming({ run_date: '2026-07-30', status: 'planning' }, today), false)
  assert.equal(rules.isRunUpcoming({ run_date: '2026-07-21', status: 'planning' }, today), false)
  assert.equal(rules.isRunUpcoming({ run_date: null, status: 'planning' }, today), false)
  assert.equal(rules.isRunUpcoming({ run_date: '2026-07-23', status: 'cancelled' }, today), false)
})

// ── Migration RLS + linking contract ──────────────────────────────────────────

const SQL = readFileSync(new URL('../supabase/phase-19d-content-workflow-mvp.sql', import.meta.url), 'utf8')
const TABLES = ['content_guide_ideas', 'content_runs', 'content_run_items']

test('all three tables enable RLS with staff read/write and no client policy', () => {
  for (const table of TABLES) {
    assert.match(SQL, new RegExp(`alter table public\\.${table} enable row level security`), `${table} RLS`)
    assert.match(SQL, new RegExp(`"${table}: staff select"[\\s\\S]*?using \\(public\\.is_staff\\(\\)\\)`), `${table} staff select`)
    assert.match(SQL, new RegExp(`"${table}: staff insert"[\\s\\S]*?with check \\(public\\.is_staff\\(\\)\\)`), `${table} staff insert`)
    assert.match(SQL, new RegExp(`"${table}: staff update"`), `${table} staff update`)
  }
  // No client-role access anywhere in the migration.
  assert.doesNotMatch(SQL, /role\s*=\s*'client'/)
  assert.doesNotMatch(SQL, /is_client\(\)/)
})

test('a guide idea can link to an existing monthly deliverable', () => {
  assert.match(SQL, /deliverable_id\s+uuid\s+references public\.monthly_deliverables\(id\) on delete set null/)
})

test('the three canonical tables exist and reference existing master data', () => {
  assert.match(SQL, /create table if not exists public\.content_guide_ideas/)
  assert.match(SQL, /create table if not exists public\.content_runs/)
  assert.match(SQL, /create table if not exists public\.content_run_items/)
  assert.match(SQL, /references public\.clients\(id\)/)
  assert.match(SQL, /references public\.profiles\(id\)/)
})
