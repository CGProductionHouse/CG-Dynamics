import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
let server, NolanPagedRecords, NolanSourceNote
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  ;({ NolanPagedRecords, NolanSourceNote } = await server.ssrLoadModule('/src/pages/admin/NolanPagedRecords.tsx'))
})
after(async () => { await server?.close() })
const render = rows => renderToStaticMarkup(React.createElement(NolanPagedRecords, {
  rows, empty: React.createElement('p', null, 'No matches; check source errors'),
  renderRow: row => React.createElement('article', { key: row.id }, row.title, React.createElement('details', null,
    React.createElement(NolanSourceNote, { note: row.note }), React.createElement('a', { href: '/admin/work?tab=board&id=' + row.id }, 'Authoritative source'))),
}))
test('actual emitted record component bounds thousands of cards and near-megabyte expanded notes', () => {
  const rows = Array.from({ length: 4375 }, (_, id) => ({ id, title: `Record ${id}`, note: 'x'.repeat(982812) + 'PRIVATE_TAIL_SENTINEL' }))
  const html = render(rows)
  assert.equal((html.match(/<article/g) ?? []).length, 12)
  assert.equal((html.match(/<details/g) ?? []).length, 12)
  assert.match(html, /Showing 1–12 of 4375/)
  assert.match(html, /Page 1 of 365/)
  assert.match(html, /Next records/)
  assert.match(html, /Truncated source excerpt/)
  assert.doesNotMatch(html, /PRIVATE_TAIL_SENTINEL/)
  assert.ok(html.length < 16000, 'Even closed details must not embed full notes')
})
test('filtered snapshot can include a late record; empty remains explicit', () => {
  const html = render([{ id: 4374, title: 'Last matching record', note: 'Literal source note' }])
  assert.match(html, /Last matching record/)
  assert.match(html, /Showing 1–1 of 1/)
  assert.match(html, /Literal source note/)
  assert.match(html, /id=4374/)
  const empty = render([])
  assert.match(empty, /Showing 0–0 of 0/)
  assert.match(empty, /No matches; check source errors/)
})
test('overview pages after whole-snapshot filters, resets on view changes and bounds both note locations', () => {
  const source = readFileSync('src/pages/admin/NolanOverview.tsx', 'utf8')
  assert.match(source, /rows=\{visibleRows\}/)
  assert.match(source, /JSON.stringify\(\[scope, lane, query, statusFilter, generation\]\)/)
  assert.match(source, /const visibleRows = statusFilter === 'All statuses' \? rows : rows.filter/)
  assert.match(source, /nolanNotePreview\(row.detail\).text/)
  assert.match(source, /<NolanSourceNote note=\{row.detail\}/)
  assert.doesNotMatch(source, /visibleRows.map|<p>\{row.detail|row.detail.split/)
  assert.match(source, /Last-known record/)
  assert.match(source, /Open authoritative record \/ workspace/)
})
