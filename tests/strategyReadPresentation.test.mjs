import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('actual strategy reader preserves exact content while using accessible progressive disclosure', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true }, define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fixture.supabase.co'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('fixture-anon-key'),
  } })
  try {
    const { GuidedStrategyView } = await server.ssrLoadModule('/src/components/strategy/GuidedStrategy.tsx')
    const { emptyStrategyData, GOLD_STANDARD_FIELDS } = await server.ssrLoadModule('/src/lib/strategyEngine.ts')
    const data = emptyStrategyData()
    data.strategyGoingForward = 'Exact client direction, without rewriting it.'
    data.clientDirection = ['Preserve client request']
    data.strategyDrivers = ['Preserve priority']
    data.clientActionsRequired = ['Confirm the real decision']
    data.calendarSelections = [{ eventId: 'private-event-id', title: 'Exact shoot date', date: '2026-10-12', use: true, note: 'Approved timing' }, { eventId: 'unused', title: 'UNSELECTED DATE', date: null, use: false, note: '' }]
    data.topContent.whatThisTellsUs = 'Actual content observation'
    data.goldStandard = Object.fromEntries(GOLD_STANDARD_FIELDS.map(field => [field.key, `Exact ${field.key} direction`]))
    data.actionPlan.professional_video = { enabled: true, items: ['One professional video with the actual approved scope'], notes: 'Exact production note' }
    data.actionPlan.photo_content = { enabled: true, items: ['Three product photos'], notes: 'Actual photo requirements' }
    data.actionPlan.reels = { enabled: false, items: ['DISABLED PLAN MUST NOT APPEAR'], notes: '' }
    const before = JSON.stringify(data)
    for (const variant of ['report', 'default']) {
      const html = renderToStaticMarkup(createElement(GuidedStrategyView, { data, variant }))
      for (const field of GOLD_STANDARD_FIELDS) assert.ok(html.includes(`Exact ${field.key} direction`))
      for (const value of ['Preserve client request', 'Preserve priority', 'Confirm the real decision', 'Exact shoot date', '2026-10-12', 'Approved timing', 'One professional video with the actual approved scope', 'Three product photos', 'Exact production note', 'Actual photo requirements']) assert.ok(html.includes(value), value)
      assert.match(html, /<details open=""/)
      assert.ok((html.match(/<summary/g) ?? []).length >= 13)
      assert.doesNotMatch(html, /DISABLED PLAN|UNSELECTED DATE|private-event-id|<form|<textarea|bg-report-surface|bg-brand-surface/)
      assert.match(html, /<h3[^>]*>Monthly strategy/)
      assert.match(html, /focus-visible:outline/)
      assert.equal(JSON.stringify(data), before)
      const hidden = renderToStaticMarkup(createElement(GuidedStrategyView, { data, variant, hideTopContent: true }))
      assert.doesNotMatch(hidden, /Actual content observation/)
    }
  } finally { await server.close() }
})

test('presentation work does not weaken publication, exact month or content-quality guards', () => {
  const source = readFileSync(new URL('../src/pages/client/ClientReportView.tsx', import.meta.url), 'utf8')
  assert.match(source, /clientFacingStrategyQualityIssues\(monthlyStrategy.strategyData\)/)
  assert.match(source, /if \(!staffPreview\) return null/)
  assert.match(source, /Draft — not visible to client/)
  assert.match(source, /monthDisplayLabel\(monthlyStrategy.month.slice\(0, 7\)\)/)
  const page = readFileSync(new URL('../src/pages/client/ClientStrategyPage.tsx', import.meta.url), 'utf8')
  assert.match(page, /getClientPublishedMonthlyStrategy\(strategyMonth\)/)
})

test('actual report labels a canonical date-backed October strategy separately from a September report', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true }, define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fixture.supabase.co'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('fixture-anon-key'),
  } })
  try {
    const { ClientReportView } = await server.ssrLoadModule('/src/pages/client/ClientReportView.tsx')
    const { emptyStrategyData } = await server.ssrLoadModule('/src/lib/strategyEngine.ts')
    const strategyData = emptyStrategyData()
    strategyData.strategyGoingForward = 'Show the product in use and answer real customer questions.'
    const report = { id: 'fixture-report', client_id: 'fixture-client', status: 'published', period_start: '2026-09-01', period_end: '2026-09-23', posts: [], report_title: 'Fixture client', summary: null }
    const monthlyStrategy = { month: '2026-10-01', status: 'draft', strategyData }
    const before = JSON.stringify({ report, monthlyStrategy })
    const html = renderToStaticMarkup(createElement(ClientReportView, { report, monthlyStrategy, showAdminDiagnostics: true, googleAds: null, googleAdsState: 'unmapped', googleAdsError: null }))
    assert.match(html, /September 2026/)
    assert.match(html, /October 2026 strategy/)
    assert.doesNotMatch(html, /2026-10-01 strategy/)
    assert.match(html, /Draft — not visible to client/)
    assert.equal(JSON.stringify({ report, monthlyStrategy }), before)
  } finally { await server.close() }
})
