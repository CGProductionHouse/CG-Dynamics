import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { readStrategyData, clientFacingStrategyQualityIssues } from '../src/lib/strategyEngine.ts'

// Frozen, independently read-back publication evidence, never an authoring store.
const packet = JSON.parse(readFileSync(new URL('../docs/ops/client-readiness/2026-11-19-client-strategy-editorial-corrections.json', import.meta.url)))
const visibleCopy = data => [
  ...Object.values(data.goldStandard), data.strategyGoingForward,
  ...data.clientActionsRequired,
  ...Object.values(data.actionPlan).filter(section => section.enabled).flatMap(section => [...section.items, section.notes]),
].filter(Boolean)

test('exact handed-off fleet has sixteen corrected published plans and three private holds', () => {
  assert.equal(packet.reviewed_clients.length, 18)
  assert.equal(packet.rows.length, 16)
  assert.equal(new Set(packet.rows.map(row => row.client_id)).size, 15)
  assert.equal(new Set(packet.rows.map(row => `${row.client_id}/${row.strategy_month}`)).size, 16)
  assert.deepEqual(packet.reviewed_clients.filter(row => !row.published).map(row => row.client_name), ['Bat Hill Royale', 'CG Production House', 'Econofoods'])
  for (const row of packet.reviewed_clients.filter(row => !row.published)) {
    assert.equal(row.november_client_rows, 0)
    assert.equal(row.december_client_rows, 0)
  }
  assert.deepEqual(packet.preserved, {
    client_rows: 18, october_published_reports: 17, other_month_strategies: 35,
    immutable_amend_approve_publish_events: 48, package_changes: 0, schedule_changes: 0,
    provider_changes: 0, migrations: 0, vercel_operations: 0,
  })
})

test('every corrected plan is short, spaced and contains a goal, three-stage direction and action plan', () => {
  for (const row of packet.rows) {
    const data = readStrategyData(row.published_strategy_data)
    assert.deepEqual(clientFacingStrategyQualityIssues(data), [], row.client_name)
    assert.equal(Object.keys(data.goldStandard).length, 10)
    assert.ok(Object.values(data.goldStandard).every(value => value.trim()), row.client_name)
    assert.match(data.strategyGoingForward, /^1\. [^\n]+\n[^]+\n\n2\. [^\n]+\n[^]+\n\n3\. /)
    assert.match(data.goldStandard.nextMonthGamePlan, /^START\n[^]+\n\nBUILD\n[^]+\n\nCLOSE\n/)
    for (const value of visibleCopy(data)) {
      assert.ok(value.split(/\s+/).length <= 95, `${row.client_name}: oversized field`)
      for (const paragraph of value.split(/\n\s*\n/)) assert.ok(paragraph.split(/\s+/).length <= 45, `${row.client_name}: wall of text`)
    }
    for (const section of Object.values(data.actionPlan).filter(section => section.enabled)) {
      assert.ok(section.items.every(item => item.includes('\n\n')), `${row.client_name}: title and brief must be separated`)
    }
  }
})

test('client copy has positive direction while production caveats remain private', () => {
  for (const row of packet.rows) {
    const text = visibleCopy(readStrategyData(row.published_strategy_data)).join('\n')
    assert.doesNotMatch(text, /\b(?:not proof|do not infer|unverified|unavailable|unknown|permission-cleared|canonical|source digest|source pack|RPC|UUID|repository|we cannot|we can.t|rather than|instead of)\b/i, row.client_name)
    assert.doesNotMatch(text, /\b[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\b/i)
    assert.equal(row.internal_notes_private, true)
    assert.equal(row.seed_context_preserved, true)
    assert.equal(row.previous_published_snapshot_retained_until_publish, true)
    assert.deepEqual([...row.immutable_revision_events].sort(), ['amended', 'approved', 'published'])
    assert.equal(row.version, row.before_version + 1)
    assert.equal(row.client_role_readback, true)
  }
})

test('published action counts stay within the exact confirmed package, including null and zero', () => {
  const fields = {
    professional_video: 'professional_videos_per_month', photo_content: 'photo_posts_per_month',
    design_poster: 'design_posters_per_month', reels: 'reels_per_month', animated_poster: 'animated_posters_per_month',
  }
  for (const row of packet.rows) {
    for (const [kind, field] of Object.entries(fields)) {
      const section = row.published_strategy_data.actionPlan[kind]
      const capacity = row.confirmed_package[field]
      assert.equal(section.enabled, capacity != null && capacity > 0, `${row.client_name}: ${kind}`)
      assert.equal(section.items.length, capacity ?? 0, `${row.client_name}: ${kind}`)
    }
  }
  const delta = packet.rows.find(row => row.client_name === 'Delta Gas')
  assert.equal(delta.confirmed_package.reels_per_month, null)
  assert.equal(packet.rows.find(row => row.client_name === 'Cape Lumber').confirmed_package.professional_videos_per_month, 0)
})

test('actual client strategy renderer preserves spacing and all new copy without mutating it', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false },
    esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true }, define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture'),
    } })
  try {
    const { GuidedStrategyView } = await server.ssrLoadModule('/src/components/strategy/GuidedStrategy.tsx')
    for (const row of packet.rows) {
      const data = readStrategyData(row.published_strategy_data)
      const before = JSON.stringify(data)
      const html = renderToStaticMarkup(createElement(GuidedStrategyView, { data, hideTopContent: true }))
      assert.match(html, /Monthly strategy/)
      assert.match(html, /Action plan/)
      assert.match(html, /whitespace-pre-line/)
      assert.match(html, /START\n/)
      assert.match(html, /BUILD\n/)
      assert.match(html, /CLOSE\n/)
      assert.doesNotMatch(html, /internal_notes|seed_context|permission-cleared|not proof/)
      assert.equal(JSON.stringify(data), before)
    }
  } finally { await server.close() }
})
