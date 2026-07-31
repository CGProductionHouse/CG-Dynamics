import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let parseAssistantAction
let resolveRelativeDate
let firstOfNextMonth

// 2026-07-01 is a Wednesday.
const CTX = {
  today: '2026-07-01',
  clients: [
    { id: 'c-dulux', name: 'Dulux' },
    { id: 'c-braize', name: 'Braize' },
    { id: 'c-cape', name: 'Cape Lumber' },
  ],
  staffNames: ['Franco Nel', 'Amonique Fourie', 'Chris'],
  role: 'team',
  currentClientId: null,
  currentClientName: null,
}

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ parseAssistantAction, resolveRelativeDate, firstOfNextMonth } = await server.ssrLoadModule('/src/lib/assistantActions.ts'))
})

after(async () => { await server.close() })

test('relative dates: next Tuesday from Wed 2026-07-01 → 2026-07-07', () => {
  assert.equal(resolveRelativeDate('next tuesday at 10', '2026-07-01'), '2026-07-07')
  assert.equal(resolveRelativeDate('friday', '2026-07-01'), '2026-07-03')
  assert.equal(resolveRelativeDate('vrydag', '2026-07-01'), '2026-07-03')
  assert.equal(resolveRelativeDate('vandag', '2026-07-01'), '2026-07-01')
  assert.equal(firstOfNextMonth('2026-07-01'), '2026-08-01')
})

test('EN: "Add a Dulux meeting next Tuesday at 10" → calendar.create with resolved client + datetime', () => {
  const r = parseAssistantAction('Add a Dulux meeting next Tuesday at 10.', CTX)
  assert.equal(r.type, 'calendar.create')
  assert.equal(r.clientId, 'c-dulux')
  assert.equal(r.fields.date, '2026-07-07')
  assert.equal(r.fields.time, '10:00')
  assert.equal(r.fields.event_type, 'meeting')
})

test('AF: "Voeg n Dulux vergadering by volgende Dinsdag om 10" → calendar.create', () => {
  const r = parseAssistantAction("Voeg 'n Dulux vergadering by volgende Dinsdag om 10", CTX)
  assert.equal(r.type, 'calendar.create')
  assert.equal(r.clientId, 'c-dulux')
  assert.equal(r.fields.date, '2026-07-07')
  assert.equal(r.fields.time, '10:00')
})

test('Mixed: "Skeduleer a Braize meeting friday" → calendar.create', () => {
  const r = parseAssistantAction('Skeduleer a Braize meeting friday', CTX)
  assert.equal(r.type, 'calendar.create')
  assert.equal(r.clientId, 'c-braize')
  assert.equal(r.fields.date, '2026-07-03')
})

test('"Move video five to next month" → video.move to first of next month', () => {
  const r = parseAssistantAction('Move video five to next month.', CTX)
  assert.equal(r.type, 'video.move')
  assert.equal(r.fields.video, 5)
  assert.equal(r.fields.scheduled_date, '2026-08-01')
})

test('"Mark videos one and two as shot" → video.mark_shot [1,2]', () => {
  const r = parseAssistantAction('Mark videos one and two as shot.', CTX)
  assert.equal(r.type, 'video.mark_shot')
  assert.equal(r.fields.videos, '1, 2')
})

test('AF mark shot: "Merk video drie as geskiet"', () => {
  const r = parseAssistantAction('Merk video drie as geskiet', CTX)
  assert.equal(r.type, 'video.mark_shot')
  assert.equal(r.fields.videos, '3')
})

test('"Assign this task to Franco for Friday" → task.assign with due date', () => {
  const r = parseAssistantAction('Assign this task to Franco for Friday.', CTX)
  assert.equal(r.type, 'task.assign')
  assert.equal(r.fields.assignee, 'Franco Nel')
  assert.equal(r.fields.due_date, '2026-07-03')
})

test('assign with NO date leaves due_date null (no due date invented)', () => {
  const r = parseAssistantAction('Assign this task to Amonique', CTX)
  assert.equal(r.type, 'task.assign')
  assert.equal(r.fields.assignee, 'Amonique Fourie')
  assert.equal(r.fields.due_date, null)
})

test('ambiguous / unknown assignee asks instead of guessing', () => {
  const r = parseAssistantAction('Assign this task to Xolani for Friday', CTX)
  assert.ok(r.clarify, 'should ask for clarification')
})

test('schedule move is a PROPOSAL requiring admin approval, never a direct change', () => {
  const r = parseAssistantAction('Move the DP schedule post to next month', CTX)
  assert.equal(r.type, 'schedule.propose')
  assert.equal(r.requiresApproval, true)
  assert.match(r.approvalNote, /pending until an Admin/i)
})

test('"Mark this task as done" → task.update status done', () => {
  const r = parseAssistantAction('Mark this task as done', CTX)
  assert.equal(r.type, 'task.update')
  assert.equal(r.fields.status, 'done')
})

test('AF: "Merk hierdie taak as klaar" → task.update done', () => {
  const r = parseAssistantAction('Merk hierdie taak as klaar', CTX)
  assert.equal(r.type, 'task.update')
  assert.equal(r.fields.status, 'done')
})

test('"This task is blocked" → task.update blocked', () => {
  const r = parseAssistantAction('This task is blocked', CTX)
  assert.equal(r.type, 'task.update')
  assert.equal(r.fields.status, 'blocked')
})

test('plain question / non-action returns null (falls through to chat)', () => {
  assert.equal(parseAssistantAction('What should I focus on today?', CTX), null)
  assert.equal(parseAssistantAction('', CTX), null)
})

test('meeting with no resolvable day asks for the day', () => {
  const r = parseAssistantAction('Add a Dulux meeting at 10', CTX)
  assert.ok(r.clarify)
})
