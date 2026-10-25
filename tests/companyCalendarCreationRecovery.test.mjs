import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { createClient } from '@supabase/supabase-js'
import { pathToFileURL } from 'node:url'
import { businessDateKey, formatBusinessTime } from '../src/lib/businessTime.ts'

const source = readFileSync('src/lib/companyCalendar.ts', 'utf8')
const section = source.slice(source.indexOf('export async function createCompanyEvent('), source.indexOf('export async function updateCompanyEvent('))
const code = ts.transpileModule(section.replace('export ', ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const requestId = '10000000-0000-4000-8000-000000000123'
function fixture() {
  const calls = []
  const client = createClient('http://127.0.0.1:1', 'local-public-fixture', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (url, options) => {
      const body = JSON.parse(options.body)
      calls.push({ url: new URL(url), method: options.method, body })
      return new Response(JSON.stringify({ id: body.id ?? requestId, ...body }), { status: 201, headers: { 'Content-Type': 'application/json' } })
    } },
  })
  return { calls, create: new Function('supabase', 'TABLE', 'handleError', 'isCompanyCalendarTableMissingError', `${code};return createCompanyEvent`)(client, 'company_calendar_events', e => e, () => false) }
}

const payload = { title: 'Synthetic local meeting', event_type: 'meeting', start_at: '2026-10-25T12:00:00Z', client_id: null }
test('actual creation helper + real SDK bind caller attempt to existing canonical event primary key', async () => {
  const f = fixture(); await f.create({ ...payload, id: 'foreign', client_visible: true, microsoft_event_id: 'foreign-source' }, requestId)
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].method, 'POST')
  assert.equal(f.calls[0].body.id, requestId)
  assert.equal(f.calls[0].body.client_id, null)
  assert.equal(f.calls[0].url.pathname, '/rest/v1/company_calendar_events')
  assert.equal(Object.hasOwn(f.calls[0].body, 'client_visible'), false)
  assert.equal(Object.hasOwn(f.calls[0].body, 'microsoft_event_id'), false)
})

test('invalid explicit attempt identity makes no request; historical callers retain server-generated identity', async () => {
  const f = fixture()
  for (const id of ['', 'invalid', null]) assert.ok((await f.create(payload, id)).error)
  assert.equal(f.calls.length, 0)
  await f.create(payload)
  assert.equal(f.calls.length, 1)
  assert.equal(Object.hasOwn(f.calls[0].body, 'id'), false)
})

test('existing actual calendar table primary key rejects replay without replacing staff content', { skip: !process.env.CG_LOCAL_PGLITE_MODULE }, async () => {
  const { PGlite } = await import(pathToFileURL(process.env.CG_LOCAL_PGLITE_MODULE).href)
  const db = await PGlite.create()
  try {
    const baseline = readFileSync('supabase/phase-10a-company-calendar-events.sql', 'utf8')
    const start = baseline.indexOf('create table public.company_calendar_events (')
    assert.ok(start >= 0)
    await db.exec('create table public.clients(id uuid primary key)')
    await db.exec(baseline.slice(start, baseline.indexOf('\n);', start) + 4))
    await db.query("insert into company_calendar_events(id,title,start_at,notes) values($1,'Synthetic',now(),'Later staff edit')", [requestId])
    await assert.rejects(db.query("insert into company_calendar_events(id,title,start_at,notes) values($1,'Retry',now(),'Old draft')", [requestId]), error => error.code === '23505')
    assert.deepEqual((await db.query('select title,notes from company_calendar_events')).rows, [{ title: 'Synthetic', notes: 'Later staff edit' }])
  } finally { await db.close() }
})

const page = readFileSync('src/pages/admin/CompanyCalendarPage.tsx', 'utf8')
test('actual drawer never resubmits a creation attempt after ambiguous or foreign responses, even before state rerender', async () => {
  const helpers = page.slice(page.indexOf('function isoToLocalDateTimeInput('), page.indexOf('function shiftMonth('))
  const start = page.indexOf('  async function handleSave(')
  const body = page.slice(start, page.indexOf('  async function retryCreationReadback(', start))
  const compiled = ts.transpileModule(helpers + body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  for (const mode of ['null', 'error', 'throw', 'foreign', 'client', 'success']) {
    const calls = [], states = [], saved = [], errors = []
    let ids = 0
    const values = {
      mutationPending: { current: false }, creationReadbackPending: false, creationAttempt: { current: null },
      saving: false, cancelling: false, visibilitySaving: false, canManage: true, isNew: true,
      title: 'Synthetic', eventType: 'meeting', clientId: '', clientName: '', startAt: '2026-10-25T14:00', endAt: '', allDay: false,
      location: '', notes: 'Unsent staff draft', assignedName: '', status: 'planned',
      event: { id: '', start_at: '2026-10-25T12:00:00Z', end_at: null, all_day: false },
      crypto: { randomUUID: () => { ids += 1; return requestId } }, businessDateKey, formatBusinessTime,
      setSaving: () => {}, setSaveError: e => errors.push(e), setCreationReadbackPending: v => states.push(v),
      onSaved: () => saved.push(true),
      createCompanyEvent: async (...args) => {
        calls.push(args)
        if (mode === 'throw') throw Error('Synthetic lost response')
        if (mode === 'error') return { data: null, error: { message: 'Synthetic uncertain response' } }
        return { data: mode === 'null' ? null : { id: mode === 'foreign' ? 'foreign-row' : requestId, client_id: mode === 'client' ? 'foreign-client' : null }, error: null }
      },
    }
    const save = new Function(...Object.keys(values), `${compiled};return handleSave`)(...Object.values(values))
    await save(); await save()
    assert.equal(calls.length, 1, mode)
    assert.equal(ids, 1)
    assert.equal(calls[0][1], requestId)
    assert.deepEqual(states, [true])
    assert.equal(saved.length, mode === 'success' ? 1 : 0)
    if (mode !== 'success') assert.ok(errors.at(-1))
  }
})

function readbackFixture(result, throws = false) {
  const start = page.indexOf('  async function retryCreationReadback(')
  assert.ok(start >= 0)
  const compiled = ts.transpileModule(page.slice(start, page.indexOf('  async function handleCancelEvent(', start)), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const reads = [], writes = [], errors = [], saved = [], pending = []
  const values = {
    creationAttempt: { current: { id: requestId, clientId: null } }, mutationPending: { current: false }, creationReadbackPending: true,
    setSaving: v => pending.push(v), setSaveError: v => errors.push(v), onSaved: () => saved.push(true),
    getCompanyEvent: async id => { reads.push(id); if (throws) throw Error('Synthetic read failure'); return result },
    createCompanyEvent: async () => { writes.push(true); throw Error('Readback must not write') },
  }
  return { run: new Function(...Object.keys(values), `${compiled};return retryCreationReadback`)(...Object.values(values)), reads, writes, errors, saved, pending }
}

test('actual recovery reads only exact attempt identity; failures and foreign client/row never pass', async () => {
  for (const result of [
    { data: null, error: null }, { data: null, error: { message: 'denied' } }, { data: null, tableMissing: true },
    { data: { id: 'foreign', client_id: null } }, { data: { id: requestId, client_id: 'foreign-client' } },
  ]) {
    const f = readbackFixture(result); await f.run(); await f.run()
    assert.deepEqual(f.reads, [requestId, requestId])
    assert.equal(f.writes.length, 0)
    assert.equal(f.saved.length, 0)
    assert.match(f.errors.at(-1), /unverified/)
  }
})

test('actual recovery accepts exact current row without overwriting newer staff edits; transport failure stays held', async () => {
  const row = { id: requestId, client_id: null, notes: 'Newer staff wording' }
  const f = readbackFixture({ data: row, error: null }); await f.run()
  assert.deepEqual(f.reads, [requestId]); assert.equal(f.saved.length, 1); assert.equal(f.writes.length, 0)
  assert.equal(row.notes, 'Newer staff wording')
  const failed = readbackFixture(null, true); await failed.run()
  assert.equal(failed.saved.length, 0); assert.equal(failed.writes.length, 0)
  assert.match(failed.errors.at(-1), /Readback is unavailable/)
  assert.deepEqual(failed.pending, [true, false])
})
