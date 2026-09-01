import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let parseAssistantAction
let resolveRelativeDate
let firstOfNextMonth
let businessDateKey

// 2026-07-01 is a Wednesday.
const CTX = {
  today: '2026-07-01',
  clients: [
    { id: 'c-dulux', name: 'Dulux' },
    { id: 'c-braize', name: 'Braize' },
    { id: 'c-cape', name: 'Cape Lumber' },
    { id: 'c-red-oak', name: 'Red Oak' },
    { id: 'c-mimosa', name: 'Mimosa Mall' },
    { id: 'c-germoparts', name: 'Germoparts' },
  ],
  staffNames: ['Franco Nel', 'Amonique Fourie', 'Chris'],
  role: 'team',
  currentClientId: null,
  currentClientName: null,
  currentTaskId: 'task-1',
  currentTaskName: 'Prepare Dulux artwork',
}

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ parseAssistantAction, resolveRelativeDate, firstOfNextMonth } = await server.ssrLoadModule('/src/lib/assistantActions.ts'))
  ;({ businessDateKey } = await server.ssrLoadModule('/src/lib/businessTime.ts'))
})

after(async () => { await server.close() })

test('relative dates: next Tuesday from Wed 2026-07-01 → 2026-07-07', () => {
  assert.equal(resolveRelativeDate('next tuesday at 10', '2026-07-01'), '2026-07-07')
  assert.equal(resolveRelativeDate('friday', '2026-07-01'), '2026-07-03')
  assert.equal(resolveRelativeDate('vrydag', '2026-07-01'), '2026-07-03')
  assert.equal(resolveRelativeDate('vandag', '2026-07-01'), '2026-07-01')
  assert.equal(firstOfNextMonth('2026-07-01'), '2026-08-01')
})

test('businessDateKey uses Africa/Johannesburg, not UTC — timezone edge cases', () => {
  // 2026-08-26 23:30 SAST → UTC 21:30 on same calendar day
  assert.equal(businessDateKey(new Date('2026-08-26T21:30:00Z')), '2026-08-26')
  // 2026-08-27 00:30 SAST → UTC 22:30 on previous calendar day
  assert.equal(businessDateKey(new Date('2026-08-26T22:30:00Z')), '2026-08-27')
})

test('"tomorrow" resolves from business date, not live date — fixture context is 2026-07-01', () => {
  // The 2026-07-02 due_date in the production-prompt test comes from the
  // fixture today='2026-07-01', NOT from the current live date.
  assert.equal(businessDateKey(new Date('2026-07-01T22:00:00Z')), '2026-07-02')
  assert.equal(resolveRelativeDate('tomorrow', '2026-07-01'), '2026-07-02')
  assert.equal(resolveRelativeDate('tomorrow', '2026-08-26'), '2026-08-27')
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

test('existing-task assignment without an open Planner task asks for a canonical match, not Planner navigation', () => {
  const r = parseAssistantAction('Assign this task to Amonique', { ...CTX, currentTaskId: null, currentTaskName: null })
  assert.match(r.clarify, /matching active task/i)
  assert.doesNotMatch(r.clarify, /open.*planner/i)
})

test('production prompt: create and assign new Red Oak work without an open Planner task', () => {
  const r = parseAssistantAction('Assign Franco to do a rugby table league poster design for Red Oak.', {
    ...CTX, currentTaskId: null, currentTaskName: null,
  })
  assert.equal(r.type, 'task.create', JSON.stringify(r))
  assert.equal(r.clientId, 'c-red-oak')
  assert.equal(r.fields.assignee, 'Franco Nel')
  assert.match(r.fields.task, /rugby table league poster design/i)
})

test('P0 mobile prompt: add-to-Planner wording reaches the canonical task proposal', () => {
  const r = parseAssistantAction('Add to planner that Franco should send managing requests to all Germoparts Google Business Profiles.', {
    ...CTX, currentTaskId: null, currentTaskName: null,
  })
  assert.equal(r.type, 'task.create', JSON.stringify(r))
  assert.equal(r.clientId, 'c-germoparts')
  assert.equal(r.fields.assignee, 'Franco Nel')
  assert.equal(r.fields.task, 'send managing requests to all Germoparts Google Business Profiles')
})

test('natural task creation variants route semantically without an exact phrase whitelist', () => {
  const make = parseAssistantAction('Make Franco a task to finish the Germoparts poster by Thursday.', {
    ...CTX, currentTaskId: null, currentTaskName: null,
  })
  assert.equal(make.type, 'task.create', JSON.stringify(make))
  assert.equal(make.fields.assignee, 'Franco Nel')
  assert.equal(make.fields.due_date, '2026-07-02')
  assert.match(make.fields.task, /finish the Germoparts poster/i)

  const remind = parseAssistantAction('Remind me to phone Red Oak tomorrow.', {
    ...CTX, currentTaskId: null, currentTaskName: null,
  })
  assert.equal(remind.type, 'task.create', JSON.stringify(remind))
  assert.equal(remind.clientId, 'c-red-oak')
  assert.equal(remind.fields.due_date, '2026-07-02')
  assert.equal(remind.fields.task, 'phone Red Oak')
})

test('production prompt: create + client + assignee + relative due date', () => {
  const r = parseAssistantAction('Mimosa Mall 5km logo design should be done tomorrow by Franco.', {
    ...CTX, currentTaskId: null, currentTaskName: null,
  })
  assert.equal(r.type, 'task.create', JSON.stringify(r))
  assert.equal(r.clientId, 'c-mimosa')
  assert.equal(r.fields.assignee, 'Franco Nel')
  assert.equal(r.fields.due_date, '2026-07-02')
  assert.equal(r.fields.task, 'Mimosa Mall 5km logo design')
})

test('unique visible task is reassigned without creating a duplicate', () => {
  const r = parseAssistantAction('Reassign the rugby table league poster design for Red Oak to Franco', {
    ...CTX,
    currentTaskId: null,
    currentTaskName: null,
    tasks: [{ id: 'task-rugby', title: 'Rugby table league poster design', clientId: 'c-red-oak', clientName: 'Red Oak', dueDate: '2026-07-04' }],
  })
  assert.equal(r.type, 'task.assign')
  assert.equal(r.target.id, 'task-rugby')
})

test('unknown client creation command gives the supported next action without Planner internals', () => {
  const r = parseAssistantAction('Add Newco as a client and assign Franco', {
    ...CTX, currentTaskId: null, currentTaskName: null,
  })
  assert.match(r.clarify, /active client directory/i)
  assert.match(r.clarify, /Clients first/i)
  assert.doesNotMatch(r.clarify, /Planner/i)
})

test('ambiguous / unknown assignee asks instead of guessing', () => {
  const r = parseAssistantAction('Assign this task to Xolani for Friday', CTX)
  assert.ok(r.clarify, 'should ask for clarification')
})

test('schedule move is a PROPOSAL requiring manager/admin approval, never a direct change', () => {
  const r = parseAssistantAction('Move the DP schedule post to next month', CTX)
  assert.equal(r.type, 'schedule.propose')
  assert.equal(r.requiresApproval, true)
  assert.match(r.approvalNote, /pending until a manager or admin/i)
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

test('"Run Meta sync and also sync the previous month" uses plain preview fields', () => {
  const r = parseAssistantAction('Run Meta sync and also sync the previous month', CTX)
  assert.equal(r.type, 'job.enqueue')
  assert.equal(r.fields.job, 'meta_sync')
  assert.equal(r.fields.sync_previous_month, 'yes')
  assert.equal('baseline' in r.fields, false)
})

test('"sync all connected meta clients" → job.enqueue meta_sync (was falling through to chat)', () => {
  const r = parseAssistantAction('sync all connected meta clients', CTX)
  assert.equal(r.type, 'job.enqueue')
  assert.equal(r.fields.job, 'meta_sync')
})

test('Meta sync natural variations → job.enqueue meta_sync', () => {
  for (const phrase of [
    'sync all Meta clients',
    'run the Meta sync',
    'refresh Meta data',
    'update all client Meta reports',
    'sync connected clients',
    'sinkroniseer al die Meta kliënte',
    'verfris Meta data',
    'update die Meta verslae',
  ]) {
    const r = parseAssistantAction(phrase, CTX)
    assert.equal(r.type, 'job.enqueue', `expected job.enqueue for: ${phrase}`)
    assert.equal(r.fields.job, 'meta_sync', `expected meta_sync for: ${phrase}`)
  }
})

test('Meta-related phrases WITHOUT sync intent stay null (fall through to chat)', () => {
  assert.equal(parseAssistantAction('Where can I find the Meta reports?', CTX), null)
  assert.equal(parseAssistantAction('When is the next client sync call?', CTX), null)
})

test('"Prepare the reports" → job.enqueue report_prep', () => {
  const r = parseAssistantAction('Prepare the reports', CTX)
  assert.equal(r.type, 'job.enqueue')
  assert.equal(r.fields.job, 'report_prep')
})

test('"Remember: Dulux prefers Friday posts" → memory.add with note', () => {
  const r = parseAssistantAction('Remember: Dulux prefers Friday posts', CTX)
  assert.equal(r.type, 'memory.add')
  assert.equal(r.fields.note, 'Dulux prefers Friday posts')
})

test('AF: "Onthou dat Braize nie Maandae wil plaas nie" → memory.add', () => {
  const r = parseAssistantAction('Onthou dat Braize nie Maandae wil plaas nie', CTX)
  assert.equal(r.type, 'memory.add')
  assert.match(r.fields.note, /Braize nie Maandae/)
})

test('plain question / non-action returns null (falls through to chat)', () => {
  assert.equal(parseAssistantAction('What should I focus on today?', CTX), null)
  assert.equal(parseAssistantAction('', CTX), null)
})

test('meeting with no resolvable day asks for the day', () => {
  const r = parseAssistantAction('Add a Dulux meeting at 10', CTX)
  assert.ok(r.clarify)
})

test('"Move the due date to Friday" → task.due_date with resolved date', () => {
  const r = parseAssistantAction('Move the due date to Friday', CTX)
  assert.equal(r.type, 'task.due_date')
  assert.equal(r.fields.due_date, '2026-07-03')
  assert.equal(r.target.id, 'task-1')
})

test('"Change deadline to next Tuesday" → task.due_date', () => {
  const r = parseAssistantAction('Change deadline to next Tuesday', CTX)
  assert.equal(r.type, 'task.due_date')
  assert.equal(r.fields.due_date, '2026-07-07')
})

test('"What\'s on today?" → calendar.query today', () => {
  const r = parseAssistantAction("What's on today?", CTX)
  assert.equal(r.type, 'calendar.query')
  assert.equal(r.fields.scope, 'today')
})

test('"Show me this week\'s meetings" → calendar.query week', () => {
  const r = parseAssistantAction("Show me this week's meetings", CTX)
  assert.equal(r.type, 'calendar.query')
  assert.equal(r.fields.scope, 'week')
})

test('"What schedule items are overdue?" → schedule.query_overdue', () => {
  const r = parseAssistantAction('What schedule items are overdue?', CTX)
  assert.equal(r.type, 'schedule.query_overdue')
})

test('"Any missing posts?" → schedule.query_overdue', () => {
  const r = parseAssistantAction('Any missing posts?', CTX)
  assert.equal(r.type, 'schedule.query_overdue')
})
