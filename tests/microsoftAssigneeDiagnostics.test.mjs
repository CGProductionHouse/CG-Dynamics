import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseMicrosoftSnapshot } from '../src/lib/microsoftSnapshot.ts'

function diagnosticSnapshot(assigneeLookup) {
  return {
    format: 'cg-dynamics-microsoft-snapshot',
    version: 3,
    exportedAt: '2026-07-25T20:00:00Z',
    exportedBy: 'test',
    triggerType: 'admin',
    sources: [{
      sourceType: 'outlook_calendar',
      sourceId: 'calendar-1',
      sourceName: 'Operational Calendar',
      complete: true,
      rangeStart: '2026-07-01T00:00:00+02:00',
      rangeEnd: '2026-08-01T00:00:00+02:00',
      recordCount: 0,
      safeError: null,
    }],
    records: [],
    assigneeMap: {},
    ...(assigneeLookup === undefined ? {} : { assigneeLookup }),
  }
}

test('snapshot preserves safe aggregate assignee lookup diagnostics', () => {
  const lookup = { requested: 2, resolved: 1, unresolved: 1, statusCounts: { 200: 1, 403: 1 } }
  const parsed = parseMicrosoftSnapshot(JSON.stringify(diagnosticSnapshot(lookup)))

  assert.equal(parsed.errors.length, 0)
  assert.deepEqual(parsed.snapshot.assigneeLookup, lookup)
})

test('snapshot rejects inconsistent assignee lookup diagnostics', () => {
  const parsed = parseMicrosoftSnapshot(JSON.stringify(diagnosticSnapshot({
    requested: 2,
    resolved: 1,
    unresolved: 0,
    statusCounts: { 200: 1 },
  })))

  assert.equal(parsed.errors.length, 1)
  assert.match(parsed.errors[0], /resolved plus unresolved must equal requested/i)
})

test('legacy version 3 snapshots remain compatible without diagnostics', () => {
  const parsed = parseMicrosoftSnapshot(JSON.stringify(diagnosticSnapshot(undefined)))

  assert.equal(parsed.errors.length, 0)
  assert.equal(parsed.snapshot.assigneeLookup, null)
})
