import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const edge = read('../supabase/functions/cg-assistant-chat/index.ts')
const composer = read('../src/components/assistant/GlobalAssistantComposer.tsx')
const actions = read('../src/lib/assistantActions.ts')

// ── Calendar query pattern matching ────────────────────────────────────────
function matchesCalendarQuery(message) {
  return CALENDAR_QUERY_PATTERNS.some(p => p.test(message))
}
function matchesScheduleOverdueQuery(message) {
  return SCHEDULE_OVERDUE_PATTERNS.some(p => p.test(message))
}

const CALENDAR_QUERY_PATTERNS = [
  /\bwhat(?:'s| is) (?:on |happening )?today\b/i,
  /\btoday(?:'s)? (?:events?|meetings?|schedule|calendar)\b/i,
  /\b(what|which) .+ (?:today|tonight)\b/i,
  /\bshow me .+ today\b/i,
  /\bcalendar (?:for )?today\b/i,
  /\bvandag(?: se)? (?:vergaderings?|kalender)\b/i,
]

const SCHEDULE_OVERDUE_PATTERNS = [
  /\boverdue\b/i,
  /\bmissing (?:posts?|content|deliverables?)\b/i,
  /\blate (?:posts?|content|deliverables?)\b/i,
  /\bwhat(?:'s| is) (?:overdue|late|missing)\b/i,
  /\bbehind (?:schedule|on posts?)\b/i,
  /\bany (?:missing|late|overdue)\b/i,
]

// ── Calendar query: today ──────────────────────────────────────────────────
test('calendar query: "What\'s on today?" matches', () => {
  assert.ok(matchesCalendarQuery("What's on today?"))
})
test('calendar query: "What is happening today?" matches', () => {
  assert.ok(matchesCalendarQuery("What is happening today?"))
})
test('calendar query: "Today\'s meetings" matches', () => {
  assert.ok(matchesCalendarQuery("Today's meetings"))
})
test('calendar query: "Today\'s schedule" matches', () => {
  assert.ok(matchesCalendarQuery("Today's schedule"))
})
test('calendar query: "Show me today\'s events" matches', () => {
  assert.ok(matchesCalendarQuery("Show me today's events"))
})
test('calendar query: "Calendar for today" matches', () => {
  assert.ok(matchesCalendarQuery("Calendar for today"))
})
test('calendar query: "Vandag se vergaderings" matches (Afrikaans)', () => {
  assert.ok(matchesCalendarQuery("Vandag se vergaderings"))
})
test('calendar query: "Which meetings today?" matches', () => {
  assert.ok(matchesCalendarQuery("Which meetings today?"))
})

// ── Calendar query non-matches ─────────────────────────────────────────────
test('calendar query: "What\'s on tomorrow?" does not match', () => {
  assert.ok(!matchesCalendarQuery("What's on tomorrow?"))
})
test('calendar query: "Show me next week\'s meetings" does not match', () => {
  assert.ok(!matchesCalendarQuery("Show me next week's meetings"))
})
test('calendar query: "Create a meeting" does not match', () => {
  assert.ok(!matchesCalendarQuery("Create a meeting"))
})

// ── Schedule overdue patterns ──────────────────────────────────────────────
test('schedule overdue: "What\'s overdue?" matches', () => {
  assert.ok(matchesScheduleOverdueQuery("What's overdue?"))
})
test('schedule overdue: "Any missing posts?" matches', () => {
  assert.ok(matchesScheduleOverdueQuery("Any missing posts?"))
})
test('schedule overdue: "Any late content?" matches', () => {
  assert.ok(matchesScheduleOverdueQuery("Any late content?"))
})
test('schedule overdue: "What is overdue?" matches', () => {
  assert.ok(matchesScheduleOverdueQuery("What is overdue?"))
})
test('schedule overdue: "Behind schedule" matches', () => {
  assert.ok(matchesScheduleOverdueQuery("Behind schedule"))
})
test('schedule overdue: "Any overdue deliverables?" matches', () => {
  assert.ok(matchesScheduleOverdueQuery("Any overdue deliverables?"))
})
test('schedule overdue: "Missing deliverables" matches', () => {
  assert.ok(matchesScheduleOverdueQuery("Missing deliverables"))
})
test('schedule overdue: "Late posts" matches', () => {
  assert.ok(matchesScheduleOverdueQuery("Late posts"))
})

// ── Schedule overdue non-matches ───────────────────────────────────────────
test('schedule overdue: "What\'s coming up?" does not match', () => {
  assert.ok(!matchesScheduleOverdueQuery("What's coming up?"))
})
test('schedule overdue: "Show me upcoming posts" does not match', () => {
  assert.ok(!matchesScheduleOverdueQuery("Show me upcoming posts"))
})
test('schedule overdue: "Create a deliverable" does not match', () => {
  assert.ok(!matchesScheduleOverdueQuery("Create a deliverable"))
})

// ── Edge function structure ────────────────────────────────────────────────
test('edge function has handleCalendarQuery handler', () => {
  assert.ok(edge.includes('async function handleCalendarQuery'))
})
test('edge function has handleScheduleOverdueQuery handler', () => {
  assert.ok(edge.includes('async function handleScheduleOverdueQuery'))
})
test('edge function checks isCalendarQuery before AI chat', () => {
  assert.ok(edge.includes('if (isCalendarQuery(message))'))
  assert.ok(edge.includes('const calendarResult = await handleCalendarQuery'))
})
test('edge function checks isScheduleOverdueQuery before AI chat', () => {
  assert.ok(edge.includes('if (isScheduleOverdueQuery(message))'))
  assert.ok(edge.includes('const overdueResult = await handleScheduleOverdueQuery'))
})
test('calendar query uses localWorkContext when available', () => {
  assert.ok(edge.includes('localWorkContext.todayCalendarEventSummaries.length > 0'))
})
test('calendar query falls back to database query', () => {
  assert.ok(edge.includes(".from('company_events')"))
})
test('schedule overdue query falls back to database query', () => {
  assert.ok(edge.includes(".from('monthly_deliverables')"))
  assert.ok(edge.includes(".is('archived_at', null)"))
})
test('calendar query resolves client names', () => {
  assert.ok(edge.includes("from('clients')"))
})
test('calendar query limits results to 5 in display', () => {
  assert.ok(edge.includes('events.slice(0, 5).map'))
})
test('schedule overdue query limits results to 5 in display', () => {
  assert.ok(edge.includes('overdue.slice(0, 5).map'))
})
test('calendar query handles empty state', () => {
  assert.ok(edge.includes('You have no calendar events scheduled for today.'))
})
test('schedule overdue query handles empty state (no deliverables)', () => {
  assert.ok(edge.includes('No deliverables found'))
  assert.ok(edge.includes('this month.'))
})
test('schedule overdue query handles empty state (nothing overdue)', () => {
  assert.ok(edge.includes('Nothing overdue'))
  assert.ok(edge.includes('All deliverables are on track or already posted.'))
})
test('calendar query preserves read-only boundary (no insert/update/delete)', () => {
  const calendarSection = edge.slice(edge.indexOf('async function handleCalendarQuery'), edge.indexOf('async function handleScheduleOverdueQuery'))
  assert.doesNotMatch(calendarSection, /\.insert/)
  assert.doesNotMatch(calendarSection, /\.update/)
  assert.doesNotMatch(calendarSection, /\.delete/)
})
test('schedule overdue query preserves read-only boundary (no insert/update/delete)', () => {
  const overdueSection = edge.slice(edge.indexOf('async function handleScheduleOverdueQuery'), edge.indexOf('function buildRestrictedResponse'))
  assert.doesNotMatch(overdueSection, /\.insert/)
  assert.doesNotMatch(overdueSection, /\.update/)
  assert.doesNotMatch(overdueSection, /\.delete/)
})

// ── Client-side parser does not intercept server-grounded queries ───────────
test('client-side parser does not intercept calendar queries', () => {
  assert.doesNotMatch(actions, /calendar\.query/)
  assert.doesNotMatch(actions, /schedule\.query_overdue/)
})
test('client-side composer does not handle calendar.query or schedule.query_overdue proposals', () => {
  assert.doesNotMatch(composer, /p\.type === 'calendar\.query'/)
  assert.doesNotMatch(composer, /p\.type === 'schedule\.query_overdue'/)
})

// ── Grounded queries fall through client-side parser (return null) ──────────
// The client-side parseAssistantAction must return null for these messages
// so the server-side handlers can answer directly from real data.
test('client parser: "What\'s on today?" returns null (falls through to server)', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("What's on today?", {
    today: '2026-09-01', clients: [], staffNames: [], role: 'admin',
  })
  assert.equal(r, null)
})
test('client parser: "Any missing posts?" returns null (falls through to server)', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("Any missing posts?", {
    today: '2026-09-01', clients: [], staffNames: [], role: 'admin',
  })
  assert.equal(r, null)
})
test('client parser: "What\'s overdue?" returns null (falls through to server)', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("What's overdue?", {
    today: '2026-09-01', clients: [], staffNames: [], role: 'admin',
  })
  assert.equal(r, null)
})
test('client parser: "Show me today\'s meetings" returns null (falls through to server)', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("Show me today's meetings", {
    today: '2026-09-01', clients: [], staffNames: [], role: 'admin',
  })
  assert.equal(r, null)
})

// ── Audit trail ────────────────────────────────────────────────────────────
test('calendar query result is audited with calendar_query status', () => {
  assert.ok(edge.includes("responseStatus: 'calendar_query'"))
  assert.ok(edge.includes("promptCategory: 'calendar'"))
  assert.ok(edge.includes("model: 'local:calendar_query'"))
})
test('schedule overdue query result is audited with schedule_overdue_query status', () => {
  assert.ok(edge.includes("responseStatus: 'schedule_overdue_query'"))
  assert.ok(edge.includes("promptCategory: 'schedule_overdue'"))
  assert.ok(edge.includes("model: 'local:schedule_overdue'"))
})
