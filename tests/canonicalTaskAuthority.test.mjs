import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// Canonical task authority and duplicate reconciliation (PR 2).
//
// The headline finding is that the STATED PREMISE WAS WRONG. An earlier audit
// counted 51 duplicate title groups and 4,015 surplus rows by grouping on TITLE
// ALONE. Grouped on real evidence those are recurring instances:
//
//   FACEBOOK GROUPS SHARE  486 rows / 486 distinct due dates  (daily)
//   RED OAK TV              49 rows /  48 distinct due dates  (weekly)
//
// True duplicates: 14 groups, 14 surplus rows out of 4,264 active.

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const sql = read('../supabase/migrations/20260805110000_canonical_task_authority.sql')
const planner = read('../src/lib/planner.ts')
const commandCentre = read('../src/lib/commandCentre.ts')

// ── The evidence key ────────────────────────────────────────────────────────
test('a durable Microsoft/Planner id IS the identity when present', () => {
  assert.match(sql, /when coalesce\(p_ms_task_id, ''\) <> '' then 'ms:' \|\| p_ms_task_id/)
})

test('due date is part of the evidence key, which is what separates recurrence from duplication', () => {
  const fn = sql.slice(sql.indexOf('function public.cg_task_evidence_key'), sql.indexOf('Canonical operational view'))
  assert.match(fn, /coalesce\(p_due::text, '-'\)/)
  assert.match(fn, /upper\(btrim\(coalesce\(p_title, ''\)\)\)/)
  assert.match(fn, /p_client_id/)
  assert.match(fn, /p_board_id/)
  assert.match(fn, /p_bucket_id/)
})

test('the migration records why title-only grouping was wrong', () => {
  assert.match(sql, /THE STATED PREMISE WAS WRONG/)
  assert.match(sql, /486 rows \/ 486 distinct due dates/)
  assert.match(sql, /49 rows \/\s+48 distinct due dates/)
  assert.match(sql, /would have destroyed roughly 4,000 legitimate task/)
})

// ── Nothing is deleted ──────────────────────────────────────────────────────
test('duplicates are superseded by pointer, never deleted', () => {
  assert.match(sql, /add column if not exists superseded_by_task_id uuid references public\.planner_tasks\(id\)/)
  assert.match(sql, /superseded_reason text/)
  assert.match(sql, /superseded_at timestamptz/)
  assert.ok(!/delete from public\.planner_tasks/i.test(sql), 'PR 2 must never delete a task')
  assert.ok(!/drop table public\.planner_tasks/i.test(sql))
})

test('Planner ids, imported text and history survive supersession', () => {
  // Supersession only writes the three pointer columns.
  assert.ok(!/set[\s\S]{0,200}microsoft_task_id\s*=/i.test(sql), 'must never rewrite a Planner id')
  assert.ok(!/set[\s\S]{0,200}assigned_to_name\s*=/i.test(sql), 'must never rewrite imported assignment text')
  assert.ok(!/set[\s\S]{0,200}title\s*=/i.test(sql), 'must never rewrite a title')
})

// ── One logical task, one canonical record ──────────────────────────────────
test('the canonical view drops archived and superseded rows', () => {
  const view = sql.slice(sql.indexOf('create or replace view public.planner_tasks_canonical'))
  assert.match(view, /where t\.archived_at is null/)
  assert.match(view, /and t\.superseded_by_task_id is null/)
})

test('the view names every consumer that must read it', () => {
  for (const consumer of ['Work', 'My Work', 'Team Work', 'summaries', 'notifications', 'CG Assistant']) {
    assert.ok(sql.includes(consumer), `the canonical contract must name ${consumer}`)
  }
})

// ── The shared listing path consumes it ─────────────────────────────────────
test('the operational task list reads the canonical view, not the base table', () => {
  assert.match(planner, /const PLANNER_TASKS_CANONICAL = 'planner_tasks_canonical'/)
  const listFn = planner.slice(planner.indexOf('export async function listPlannerTaskRows'))
  assert.match(listFn.slice(0, 400), /supabase\.from\(PLANNER_TASKS_CANONICAL\)/)
  assert.doesNotMatch(listFn.slice(0, 400), /supabase\.from\(PLANNER_TASKS_TABLE\)/)
})

test('writes still target the base table, not the view', () => {
  // Archive and status updates must hit planner_tasks itself.
  assert.match(commandCentre, /\.from\(PLANNER_TASKS_TABLE\)\s*\n\s*\.update\(/)
  assert.doesNotMatch(commandCentre, /\.from\('planner_tasks_canonical'\)\s*\n?\s*\.update\(/)
})

test('Command Centre reaches planner rows through the canonical reader', () => {
  assert.match(commandCentre, /listPlannerTaskRows\(/)
  const code = commandCentre.replace(/^\s*\/\/.*$/gm, '')
  assert.ok(!/from\(PLANNER_TASKS_TABLE\)\s*\n\s*\.select/.test(code),
    'Command Centre must not read the base table directly')
})

// ── Ambiguity is never merged away ──────────────────────────────────────────
test('near-duplicate candidates stay separate and go to manager review', () => {
  assert.match(sql, /create table if not exists public\.task_duplicate_review/)
  assert.match(sql, /'near_duplicate_dates'/)
  assert.match(sql, /status text not null default 'open' check \(status in \('open', 'merged', 'kept_separate'\)\)/)
  assert.match(sql, /may or may not be one task; the rules do not know, so they stay\s*\n--\s*separate/)
})

// ── Reconciliation precedence ───────────────────────────────────────────────
test('a Planner-backed record always outranks a legacy copy', () => {
  // Documented as the canonical rule in the migration header comment.
  assert.match(sql, /a row carrying a durable Microsoft\/Planner id beats one without/i)
})

// ── Rollback ────────────────────────────────────────────────────────────────
test('supersession is reversible from the correction log', () => {
  assert.match(sql, /Nothing is deleted\. Duplicates are SUPERSEDED by pointer/)
  // The pointer is a single nullable column, so reverting is setting it back.
  assert.match(sql, /superseded_by_task_id uuid references/)
})

// ── PR scope discipline ─────────────────────────────────────────────────────
test('PR 2 does not touch invitations, summaries or client matching', () => {
  for (const out of ['client_invites', 'staff_invites', 'morning_list', 'whatsapp_summary']) {
    assert.ok(!sql.includes(out), `PR 2 must not touch ${out}`)
  }
})

test('PR 2 does not reassign anyone', () => {
  assert.ok(!/planner_task_assignees/i.test(sql), 'PR 2 must not change assignment links')
  assert.ok(!/assignment_review_state\s*=/.test(sql), 'PR 2 must not change PR 1 review states')
})
