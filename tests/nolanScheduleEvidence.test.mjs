import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
let server, Evidence
const empty = { scheduled_date: null, posted_at: null, internal_approved_at: null, sent_to_client_at: null, client_approved_at: null }
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  ;({ NolanScheduleEvidence: Evidence } = await server.ssrLoadModule('/src/pages/admin/NolanScheduleEvidence.tsx'))
})
after(async () => { await server?.close() })
const render = fields => renderToStaticMarkup(React.createElement(Evidence, { deliverable: { ...empty, ...fields } }))
test('missing fields remain missing, never inferred from status', () => {
  const html = render({ production_status: 'posted' })
  assert.equal((html.match(/Not recorded/g) ?? []).length, 5)
  assert.ok(html.includes('not verified live posts or approval provenance'))
  assert.ok(html.includes('does not establish publication'))
})
test('scheduled date does not fill posting or approval evidence', () => {
  const html = render({ scheduled_date: '2026-11-16' })
  assert.ok(html.includes('2026-11-16'))
  assert.equal((html.match(/Not recorded/g) ?? []).length, 4)
})
test('recorded timestamps are separately labelled and shown in SAST', () => {
  const html = render({ posted_at:'2026-11-15T11:41:00Z', internal_approved_at:'2026-11-14T08:00:00Z' })
  assert.ok(html.includes('Posted timestamp recorded'))
  assert.ok(html.includes('13:41'))
  assert.ok(html.includes('10:00'))
  assert.equal((html.match(/ SAST/g) ?? []).length, 2)
  assert.equal((html.match(/Not recorded/g) ?? []).length, 3)
})
test('invalid timestamp is a source gap, not a render error or success', () => {
  const html = render({ posted_at:'unknown', client_approved_at:'<script>alert(1)</script>' })
  assert.equal((html.match(/Invalid source timestamp/g) ?? []).length, 2)
  assert.ok(!html.includes('<script>'))
})
test('evidence view is read-only and only attached to canonical package rows', () => {
  const page = readFileSync('src/pages/admin/NolanOverview.tsx', 'utf8')
  const component = readFileSync('src/pages/admin/NolanScheduleEvidence.tsx', 'utf8')
  assert.ok(page.includes('scheduleEvidence: d'))
  assert.ok(page.includes('row.scheduleEvidence && <NolanScheduleEvidence deliverable={row.scheduleEvidence} />'))
  assert.doesNotMatch(component, /supabase|fetch\(|\.update\(|\.insert\(|localStorage/)
})
