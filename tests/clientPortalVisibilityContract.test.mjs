import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const migration = read('../supabase/migrations/20260809130000_client_portal_visibility_contract.sql')
const calendarData = read('../src/lib/clientPortalCalendar.ts')
const companyCalendar = read('../src/lib/companyCalendar.ts')
const companyCalendarPage = read('../src/pages/admin/CompanyCalendarPage.tsx')
const microsoftApply = read('../src/lib/microsoftApply.ts')
const microsoftEnrichment = read('../supabase/migrations/20260725233500_microsoft_calendar_client_enrichment.sql')

const postFunction = migration.slice(
  migration.indexOf('create function public.client_portal_month_ahead_posts_v2'),
  migration.indexOf('-- Migration-first compatibility for a cached/previous frontend'),
)
const eventFunction = migration.slice(
  migration.indexOf('create function public.client_portal_month_ahead_events'),
  migration.indexOf('-- Reconfirm that clients have no direct base-table path'),
)
const visibilityFunction = migration.slice(
  migration.indexOf('create or replace function public.set_company_calendar_event_client_visibility'),
  migration.indexOf('-- A reviewed native -> Outlook supersession'),
)
const supersessionTrigger = migration.slice(
  migration.indexOf('create or replace function public.preserve_calendar_client_visibility_on_supersession'),
  migration.indexOf('-- Replace the old status-based client post projection'),
)
const ownerChangeTrigger = migration.slice(
  migration.indexOf('create or replace function public.prevent_deliverable_client_change_with_history'),
  migration.indexOf('-- A visible event must be re-approved'),
)

let server
let fetchClientMonthAheadWithRpc

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ fetchClientMonthAheadWithRpc } = await server.ssrLoadModule('/src/lib/clientPortalCalendar.ts'))
})

after(async () => { await server?.close() })

function assertEvidenceGate() {
  assert.match(postFunction, /deliverable\.sent_to_client_at is not null[\s\S]*?or deliverable\.client_approved_at is not null[\s\S]*?or deliverable\.posted_at is not null/)
  assert.doesNotMatch(postFunction, /production_status/)
}

function auditStateIsValid(visible, updatedAt, updatedBy) {
  const pairIsComplete = (updatedAt === null && updatedBy === null) || (updatedAt !== null && updatedBy !== null)
  return pairIsComplete && (!visible || (updatedAt !== null && updatedBy !== null))
}

function ownerChangeIsBlocked(oldClientId, newClientId, evidence = {}) {
  return oldClientId !== newClientId && Object.values(evidence).some(value => value !== null)
}

test('draft without evidence is hidden', assertEvidenceGate)
test('meta_draft without evidence is hidden', assertEvidenceGate)
test('approved status without evidence is hidden', assertEvidenceGate)
test('scheduled status without evidence is hidden', assertEvidenceGate)

test('sent evidence is visible as Awaiting approval', () => {
  assertEvidenceGate()
  assert.match(postFunction, /else 'awaiting_approval'/)
})

test('client approval without a schedule date is Approved', () => {
  assert.match(postFunction, /when deliverable\.client_approved_at is not null then 'approved'/)
})

test('client approval with a schedule date is Scheduled', () => {
  assert.match(postFunction, /client_approved_at is not null and deliverable\.scheduled_date is not null then 'scheduled'/)
})

test('posting evidence is Posted and has highest precedence', () => {
  const posted = postFunction.indexOf("when deliverable.posted_at is not null then 'posted'")
  const approved = postFunction.indexOf("when deliverable.client_approved_at is not null")
  assert.ok(posted > -1 && posted < approved)
})

test('archived deliverables stay hidden', () => {
  assert.match(postFunction, /deliverable\.archived_at is null/)
})

test('other-client deliverables stay hidden', () => {
  assert.match(postFunction, /deliverable\.client_id = v_allowed_client_id/)
  assert.match(ownerChangeTrigger, /old\.client_id is distinct from new\.client_id[\s\S]*?raise exception/)
})

test('no status-only path grants deliverable visibility', () => {
  assert.doesNotMatch(postFunction, /production_status/)
})

test('the migration-first legacy post RPC stays safe and vocabulary-compatible', () => {
  assert.match(migration, /from public\.client_portal_month_ahead_posts_v2\(p_client_id, p_month\) post[\s\S]*?where post\.client_safe_status = 'awaiting_approval'/)
  assert.match(migration, /revoke all on function public\.client_portal_month_ahead_posts_v2\(uuid, date\)/)
})

test('due_date is never emitted as the client portal schedule date', () => {
  assert.doesNotMatch(postFunction, /deliverable\.due_date/)
  assert.match(postFunction, /else deliverable\.scheduled_date/)
})

test('sent evidence with only an internal due date remains undated and Awaiting approval', () => {
  assert.doesNotMatch(postFunction, /coalesce\(deliverable\.scheduled_date, deliverable\.due_date\)/)
  assert.match(postFunction, /else deliverable\.scheduled_date[\s\S]*?else 'awaiting_approval'/)
})

test('approved evidence with only an internal due date remains undated and Approved', () => {
  assert.doesNotMatch(postFunction, /deliverable\.due_date/)
  assert.match(postFunction, /when deliverable\.client_approved_at is not null then 'approved'/)
})

test('approved evidence with scheduled_date returns the scheduled date and Scheduled status', () => {
  assert.match(postFunction, /else deliverable\.scheduled_date/)
  assert.match(postFunction, /client_approved_at is not null and deliverable\.scheduled_date is not null then 'scheduled'/)
})

test('posted evidence returns the Johannesburg-local posting date and Posted status', () => {
  assert.match(postFunction, /\(deliverable\.posted_at at time zone 'Africa\/Johannesburg'\)::date/)
  assert.match(postFunction, /when deliverable\.posted_at is not null then 'posted'/)
})

test('new events default to client-visible false with no backfill', () => {
  assert.match(migration, /client_visible boolean not null default false/)
  assert.doesNotMatch(migration, /update public\.company_calendar_events[\s\S]{0,120}set client_visible = true[\s\S]{0,120}where/i)
})

test('visible events require both audit fields', () => {
  assert.match(migration, /company_calendar_events_client_visible_requires_audit[\s\S]*?client_visible is false[\s\S]*?client_visibility_updated_at is not null[\s\S]*?client_visibility_updated_by_profile_id is not null/)
  assert.equal(auditStateIsValid(true, null, null), false)
  assert.equal(auditStateIsValid(true, '2026-08-09T12:00:00Z', null), false)
  assert.equal(auditStateIsValid(true, null, 'manager-1'), false)
  assert.equal(auditStateIsValid(true, '2026-08-09T12:00:00Z', 'manager-1'), true)
})

test('explicit false may be unreviewed or retain a complete audit pair', () => {
  assert.equal(auditStateIsValid(false, null, null), true)
  assert.equal(auditStateIsValid(false, '2026-08-09T12:00:00Z', 'manager-1'), true)
})

test('a partial visibility audit pair is invalid even when hidden', () => {
  assert.match(migration, /company_calendar_events_client_visibility_audit_complete[\s\S]*?updated_at is null and client_visibility_updated_by_profile_id is null[\s\S]*?updated_at is not null and client_visibility_updated_by_profile_id is not null/)
  assert.equal(auditStateIsValid(false, '2026-08-09T12:00:00Z', null), false)
  assert.equal(auditStateIsValid(false, null, 'manager-1'), false)
})

test('an evidence-free client reassignment is permitted', () => {
  assert.equal(ownerChangeIsBlocked('client-1', 'client-2', {
    sent_to_client_at: null,
    client_approved_at: null,
    posted_at: null,
  }), false)
  assert.match(ownerChangeTrigger, /old\.client_id is distinct from new\.client_id[\s\S]*?and \(/)
})

test('sent history blocks client reassignment', () => {
  assert.equal(ownerChangeIsBlocked('client-1', 'client-2', { sent_to_client_at: '2026-08-09T12:00:00Z' }), true)
  assert.match(ownerChangeTrigger, /old\.sent_to_client_at is not null/)
})

test('approved history blocks client reassignment', () => {
  assert.equal(ownerChangeIsBlocked('client-1', 'client-2', { client_approved_at: '2026-08-09T12:00:00Z' }), true)
  assert.match(ownerChangeTrigger, /old\.client_approved_at is not null/)
})

test('posted history blocks client reassignment', () => {
  assert.equal(ownerChangeIsBlocked('client-1', 'client-2', { posted_at: '2026-08-09T12:00:00Z' }), true)
  assert.match(ownerChangeTrigger, /old\.posted_at is not null/)
})

test('same-client updates remain allowed', () => {
  assert.equal(ownerChangeIsBlocked('client-1', 'client-1', { posted_at: '2026-08-09T12:00:00Z' }), false)
})

test('client reassignment never clears or transfers historical evidence', () => {
  assert.match(ownerChangeTrigger, /cannot be reassigned without explicit reconciliation/)
  assert.match(ownerChangeTrigger, /new\.sent_to_client_at is not null[\s\S]*?new\.client_approved_at is not null[\s\S]*?new\.posted_at is not null/)
  assert.doesNotMatch(ownerChangeTrigger, /new\.(sent_to_client_at|client_approved_at|posted_at)\s*:=/)
})

test('a linked client alone does not expose an event', () => {
  assert.match(eventFunction, /event\.client_id = v_allowed_client_id/)
  assert.match(eventFunction, /event\.client_visible is true/)
})

test('planned or confirmed status alone does not expose an event', () => {
  assert.match(eventFunction, /event\.client_visible is true/)
  assert.doesNotMatch(eventFunction, /status in \('planned', 'confirmed'/)
})

test('an explicit manager publication writes visibility audit state', () => {
  assert.match(visibilityFunction, /set client_visible = p_visible/)
  assert.match(visibilityFunction, /client_visibility_updated_at = now\(\)/)
  assert.match(visibilityFunction, /client_visibility_updated_by_profile_id = auth\.uid\(\)/)
})

test('the same manager RPC can hide an event', () => {
  assert.match(visibilityFunction, /set client_visible = p_visible/)
  assert.doesNotMatch(visibilityFunction, /if not p_visible[\s\S]*?raise exception/)
})

test('a clientless event cannot be published', () => {
  assert.match(visibilityFunction, /if v_event\.client_id is null[\s\S]*?raise exception 'A linked client is required'/)
})

test('meeting, internal and deadline events cannot be published', () => {
  assert.match(visibilityFunction, /event_type not in \('shoot', 'content_run', 'client_event'\)/)
})

test('cancelled events cannot be published', () => {
  assert.match(visibilityFunction, /if v_event\.status = 'cancelled'/)
})

test('superseded events cannot change publication state', () => {
  assert.match(visibilityFunction, /if v_event\.superseded_by_event_id is not null/)
})

test('Outlook-created events remain hidden by the database default', () => {
  assert.doesNotMatch(microsoftApply, /client_visible/)
  assert.doesNotMatch(microsoftEnrichment, /client_visible/)
})

test('Outlook re-sync does not own or overwrite client visibility', () => {
  assert.doesNotMatch(microsoftApply, /client_visible/)
  assert.match(migration, /clear_calendar_client_visibility_on_scope_change[\s\S]*?old\.client_id is distinct from new\.client_id[\s\S]*?old\.event_type is distinct from new\.event_type[\s\S]*?new\.status = 'cancelled'/)
})

test('reviewed supersession preserves explicit native visibility', () => {
  assert.match(supersessionTrigger, /old\.client_visible is true/)
  assert.match(supersessionTrigger, /target\.id = new\.superseded_by_event_id/)
  assert.match(supersessionTrigger, /client_visibility_updated_at = old\.client_visibility_updated_at/)
})

test('reviewed supersession never creates visibility when neither row was visible', () => {
  assert.match(supersessionTrigger, /and old\.client_visible is true/)
  assert.match(supersessionTrigger, /and target\.client_visible is false/)
})

test('an active client receives only its own visible records', () => {
  for (const definition of [postFunction, eventFunction]) {
    assert.match(definition, /profile\.id = auth\.uid\(\)[\s\S]*?profile\.is_active/)
    assert.match(definition, /v_profile\.role = 'client'/)
    assert.match(definition, /v_allowed_client_id := v_profile\.client_id/)
  }
})

test('a client cannot force another p_client_id', () => {
  for (const definition of [postFunction, eventFunction]) {
    assert.match(definition, /p_client_id is distinct from v_profile\.client_id[\s\S]*?raise exception 'Client access denied'/)
  }
})

test('inactive client profiles are denied', () => {
  for (const definition of [postFunction, eventFunction]) {
    assert.match(definition, /where profile\.id = auth\.uid\(\)[\s\S]*?and profile\.is_active/)
  }
})

test('unsupported profile roles cannot use the portal projection', () => {
  for (const definition of [postFunction, eventFunction]) {
    assert.match(definition, /v_profile\.role not in \('admin', 'manager', 'staff', 'team', 'client'\)/)
  }
})

test('active staff preview uses the same narrow projection for an explicit client', () => {
  for (const definition of [postFunction, eventFunction]) {
    assert.match(definition, /if p_client_id is null[\s\S]*?v_allowed_client_id := p_client_id/)
  }
})

test('direct client base-table policies remain absent', () => {
  assert.match(migration, /drop policy if exists "monthly_deliverables: client reads own"/)
  assert.match(migration, /drop policy if exists "company_calendar_events: client reads own"/)
})

test('missing visibility capability returns zero items and does not call unsafe projections', async () => {
  const calls = []
  const result = await fetchClientMonthAheadWithRpc(async name => {
    calls.push(name)
    return { data: null, error: { message: 'function missing' } }
  }, 'client-1', '2026-08')

  assert.deepEqual(calls, ['client_portal_visibility_contract_version'])
  assert.deepEqual(result, { month: '2026-08', posts: [], events: [], loadFailed: true })
})

test('supported visibility capability loads only allowlisted safe rows', async () => {
  const result = await fetchClientMonthAheadWithRpc(async name => {
    if (name === 'client_portal_visibility_contract_version') return { data: 1, error: null }
    if (name === 'client_portal_month_ahead_posts_v2') return {
      data: [
        { row_key: 'post-safe', schedule_date: '2026-08-12', title: 'Poster', post_type: 'dp', client_safe_status: 'scheduled' },
        { row_key: 'post-unsafe', schedule_date: null, title: 'Internal', post_type: 'admin', client_safe_status: 'planned' },
      ],
      error: null,
    }
    return {
      data: [
        { row_key: 'event-safe', title: 'Shoot', event_type: 'shoot', start_time: '2026-08-12T08:00:00Z', end_time: null, all_day: false, location: null, guideline_row_key: null },
        { row_key: 'event-unsafe', title: 'Meeting', event_type: 'meeting', start_time: '2026-08-13T08:00:00Z', end_time: null, all_day: false, location: null, guideline_row_key: null },
      ],
      error: null,
    }
  }, 'client-1', '2026-08')

  assert.equal(result.loadFailed, false)
  assert.deepEqual(result.posts.map(post => post.id), ['post-safe'])
  assert.deepEqual(result.events.map(event => event.id), ['event-safe'])
})

test('the frontend checks capability before either projection with no legacy fallback', () => {
  const capability = calendarData.indexOf("rpc('client_portal_visibility_contract_version')")
  const posts = calendarData.indexOf("rpc('client_portal_month_ahead_posts_v2'")
  const events = calendarData.indexOf("rpc('client_portal_month_ahead_events'")
  assert.ok(capability > -1 && capability < posts && posts < events)
  assert.doesNotMatch(calendarData, /phase-11a|legacy.*client_portal_month_ahead/i)
})

test('event visibility is excluded from general browser update patches', () => {
  const patch = companyCalendar.slice(
    companyCalendar.indexOf('export interface CompanyEventPatch'),
    companyCalendar.indexOf('export interface CompanyEventResult'),
  )
  assert.doesNotMatch(patch, /client_visible/)
  assert.match(companyCalendar, /setCompanyEventClientVisibility/)
  assert.match(migration, /revoke update \([\s\S]*?client_visible[\s\S]*?\) on public\.company_calendar_events from authenticated/)
})

test('only managers receive the Calendar publication action', () => {
  assert.match(companyCalendarPage, /!isNew && canManage/)
  assert.match(companyCalendarPage, /setCompanyEventClientVisibility/)
  assert.match(companyCalendarPage, /Visible to client/)
})

test('event projection remains narrow and omits internal fields', () => {
  const signature = eventFunction.slice(0, eventFunction.indexOf('language plpgsql'))
  for (const field of ['notes', 'assigned_to_name', 'microsoft_event_id', 'linked_task_id', 'client_visibility_updated_by_profile_id']) {
    assert.doesNotMatch(signature, new RegExp(`\\b${field}\\b`))
  }
})

test('all public RPCs are authenticated-only with fixed search paths', () => {
  for (const name of [
    'client_portal_visibility_contract_version',
    'set_company_calendar_event_client_visibility',
    'client_portal_month_ahead_posts',
    'client_portal_month_ahead_posts_v2',
    'client_portal_month_ahead_events',
  ]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${name}`))
    assert.match(migration, new RegExp(`grant execute on function public\\.${name}`))
  }
  assert.ok((migration.match(/security definer/g) ?? []).length >= 5)
  assert.ok((migration.match(/set search_path = ''/g) ?? []).length >= 5)
})
