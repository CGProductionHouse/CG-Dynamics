import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { createClient } from '@supabase/supabase-js'

const source = readFileSync('src/lib/companyCalendar.ts', 'utf8')
const section = source.slice(source.indexOf('export async function updateCompanyEvent('), source.indexOf('export async function deleteCompanyEvent('))
const code = ts.transpileModule(section.replace('export ', ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const time = '2026-10-20T11:00:00Z'
function actual({ currentTime = time, error = null } = {}) {
  const calls = []
  const client = createClient('http://127.0.0.1:1', 'local-fixture-public-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (url, options) => {
      calls.push({ url: new URL(url), options, body: JSON.parse(options.body) })
      if (error) return new Response(JSON.stringify(error), { status: error.code === '42P01' ? 404 : 500, headers: { 'Content-Type': 'application/json' } })
      const expected = new URL(url).searchParams.get('updated_at')
      if (expected && expected !== `eq.${currentTime}`) return new Response(JSON.stringify({ code: 'PGRST116', message: '0 rows' }), { status: 406, headers: { 'Content-Type': 'application/json' } })
      return new Response(JSON.stringify({ id: 'synthetic-event', notes: 'Updated', updated_at: '2026-10-20T12:00:00Z' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    } },
  })
  const update = new Function('supabase', 'TABLE', 'handleError', 'isCompanyCalendarTableMissingError', `${code};return updateCompanyEvent`)(client, 'company_calendar_events', e => e, e => e?.code === '42P01')
  return { update, calls }
}

test('actual update helper + real SDK submit exact row/revision filters and only edited fields', async () => {
  const fixture = actual()
  const result = await fixture.update('synthetic-event', { notes: 'Updated' }, time)
  assert.equal(result.error, null)
  assert.equal(result.data.id, 'synthetic-event')
  assert.equal(fixture.calls.length, 1)
  assert.equal(fixture.calls[0].options.method, 'PATCH')
  assert.equal(fixture.calls[0].url.searchParams.get('id'), 'eq.synthetic-event')
  assert.equal(fixture.calls[0].url.searchParams.get('updated_at'), `eq.${time}`)
  assert.deepEqual(fixture.calls[0].body, { notes: 'Updated' })
})

test('newer row is not overwritten; stale receipt is a reload error, not saved success', async () => {
  const fixture = actual({ currentTime: '2026-10-20T11:01:00Z' })
  const result = await fixture.update('synthetic-event', { notes: 'Updated' }, time)
  assert.equal(result.data, null)
  assert.match(result.error.message, /Reload before saving/)
  assert.equal(fixture.calls.length, 1)
})

test('cancellation uses the real SDK revision-fenced PATCH, never DELETE or a full event replacement', async () => {
  const exactRevision = '2026-10-25T11:30:00.123456Z'
  const current = actual({ currentTime: exactRevision })
  const result = await current.update('synthetic-event', { status: 'cancelled' }, exactRevision)
  assert.equal(result.error, null)
  assert.equal(current.calls.length, 1)
  assert.equal(current.calls[0].options.method, 'PATCH')
  assert.equal(current.calls[0].url.searchParams.get('id'), 'eq.synthetic-event')
  assert.equal(current.calls[0].url.searchParams.get('updated_at'), `eq.${exactRevision}`)
  assert.deepEqual(current.calls[0].body, { status: 'cancelled' })
})

test('invalid revision makes no request; table/query failures stay failures; legacy callers retain signature', async () => {
  const invalid = actual()
  assert.ok((await invalid.update('synthetic-event', { notes: 'Updated' }, 'invalid')).error)
  assert.equal(invalid.calls.length, 0)
  for (const error of [{ code: '42P01', message: 'missing' }, { code: '42501', message: 'denied' }]) {
    const result = await actual({ error }).update('synthetic-event', { notes: 'Updated' }, time)
    assert.equal(result.data, null)
    assert.ok(result.tableMissing || result.error)
  }
  const legacy = actual()
  assert.equal((await legacy.update('synthetic-event', { notes: 'Updated' })).error, null)
  assert.equal(legacy.calls[0].url.searchParams.has('updated_at'), false)
})
