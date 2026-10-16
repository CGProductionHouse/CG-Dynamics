import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
import { businessMonthKey, formatBusinessDate, formatBusinessTime } from '../src/lib/businessTime.ts'

const source = readFileSync(new URL('../src/components/client/ClientMonthAhead.tsx', import.meta.url), 'utf8')
const functions = source.slice(source.indexOf('function formatDay'), source.indexOf('export function ClientMonthAhead'))
const js = ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const { formatDay, formatEventWhen } = new Function('formatBusinessDate', 'formatBusinessTime', `${js};return {formatDay,formatEventWhen}`)(formatBusinessDate, formatBusinessTime)

test('a travelling client sees the Johannesburg event date and time', t => {
  const previous = process.env.TZ
  t.after(() => { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous })
  process.env.TZ = 'America/Los_Angeles'
  assert.match(formatEventWhen({ startAt: '2026-10-31T22:30:00Z', allDay: false }), /1 Nov.*00:30 SAST/)
  assert.match(formatEventWhen({ startAt: '2026-10-31T22:00:00Z', allDay: true }), /1 Nov/)
})

test('the month-ahead read uses the same business month as Plan at the month boundary', () => {
  assert.equal(businessMonthKey('2026-10-31T22:30:00Z'), '2026-11')
  assert.match(source, /const month = businessMonthKey\(\)/)
  assert.match(source, /fetchClientMonthAhead\(clientId, month\)/)
  assert.doesNotMatch(source, /monthKey\(new Date\(\)\)/)
})

test('date-only posting dates stay on the agreed day in every device time zone', t => {
  const previous = process.env.TZ
  t.after(() => { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous })
  for (const zone of ['America/Los_Angeles', 'Pacific/Kiritimati', 'UTC']) {
    process.env.TZ = zone
    assert.match(formatDay('2026-11-01'), /1 Nov/)
  }
})
