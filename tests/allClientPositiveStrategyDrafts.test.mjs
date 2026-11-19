import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { clientFacingStrategyQualityIssues, hasStrategyContent, readStrategyData } from '../src/lib/strategyEngine.ts'

// An immutable live-readback receipt, not an authoring store or publish manifest.
const packet = JSON.parse(readFileSync(new URL('../docs/ops/client-readiness/2026-11-19-all-client-positive-strategy-drafts.json', import.meta.url)))
const visibleCopy = data => [
  ...Object.values(data.goldStandard), data.strategyGoingForward, ...data.clientActionsRequired,
  ...Object.values(data.actionPlan).filter(section => section.enabled).flatMap(section => [...section.items, section.notes]),
].filter(Boolean)

test('the full active fleet is accounted for without calling held or unpublished work live', () => {
  assert.equal(packet.active_client_count, 63)
  assert.equal(packet.target_count, 189)
  assert.equal(packet.rows.length, 77)
  assert.equal(new Set(packet.rows.map(row => row.client_id)).size, 31)
  assert.equal(new Set(packet.rows.map(row => `${row.client_id}/${row.strategy_month}`)).size, 77)
  assert.equal(packet.held_clients.length, 32)
  assert.equal(packet.rows.length + packet.protected_published_count + packet.held_target_count, packet.target_count)
  assert.ok(packet.held_clients.every(row => row.months.length === 3 && row.blockers.length && row.gap))
  for (const row of packet.rows) {
    assert.equal(row.workflow_status, 'draft')
    assert.equal(row.published_version, null)
    assert.ok(!packet.held_clients.some(held => held.client_id === row.client_id))
    assert.ok(row.notes_preserved)
    assert.ok(row.seed_history_preserved)
    assert.equal(row.version, row.before_version + row.amendment_versions.length)
    assert.equal(row.version, row.amendment_versions.at(-1))
    assert.match(row.evidence_fingerprint, /^[a-f0-9]{64}$/)
    assert.ok(row.source_ids.length > 0)
  }
  assert.equal(packet.write_summary.new_draft_creations, 1)
  assert.deepEqual(packet.write_summary.immutable_revision_readback, { amended: 78, strategies: 77 })
  assert.equal(packet.write_summary.approved, 0)
  assert.equal(packet.write_summary.published, 0)
  assert.deepEqual(packet.write_summary.drift_issues, [])
})

test('all reviewed drafts have positive readable direction and titled package-valid actions', () => {
  for (const row of packet.rows) {
    const data = readStrategyData(row.draft_strategy_data)
    assert.ok(hasStrategyContent(data), row.client_name)
    assert.deepEqual(clientFacingStrategyQualityIssues(data), [], row.client_name)
    assert.equal(Object.keys(data.goldStandard).length, 10)
    assert.ok(Object.values(data.goldStandard).every(value => value.trim()), row.client_name)
    assert.match(data.strategyGoingForward, /^1\. [^]+\n\n2\. [^]+\n\n3\. /)
    assert.match(data.goldStandard.nextMonthGamePlan, /^START\n[^]+\n\nBUILD\n[^]+\n\nCLOSE\n/)
    for (const value of visibleCopy(data)) {
      assert.ok(value.split(/\s+/).length <= 95, `${row.client_name}: oversized field`)
      for (const paragraph of value.split(/\n\s*\n/)) assert.ok(paragraph.split(/\s+/).length <= 45, `${row.client_name}: wall of text`)
      assert.doesNotMatch(value, /\b(?:not proof|do not infer|unverified|unavailable|unknown|permission-cleared|canonical|source digest|source pack|RPC|UUID|repository|we cannot|we can.t|rather than|instead of)\b/i, row.client_name)
      assert.doesNotMatch(value, /\b[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\b/i)
    }
    for (const [kind, capacity] of Object.entries(row.confirmed_scope)) {
      const section = data.actionPlan[kind]
      const expectedItems = typeof capacity === 'number' ? capacity : capacity === true ? 1 : 0
      assert.equal(section.enabled, expectedItems > 0, `${row.client_name}: ${kind}`)
      assert.equal(section.items.length, expectedItems, `${row.client_name}: ${kind}`)
      assert.ok(section.items.every(item => item.includes('\n\n')), `${row.client_name}: title and brief`)
    }
    assert.equal(data.topContent.whatThisTellsUs, '')
    assert.deepEqual(data.topContent.whyItWorked, [])
    assert.equal(data.topContent.coverImageUrl, '')
  }
  const cape = packet.rows.find(row => row.client_name === 'Cape Lumber')
  assert.equal(cape.confirmed_scope.professional_video, 0)
  assert.equal(packet.rows.find(row => row.client_name === 'HMHI').confirmed_scope.professional_video, null)
  for (const row of packet.rows.filter(row => row.client_name === 'Piek Group')) {
    assert.equal(row.draft_strategy_data.actionPlan.design_poster.items.length, 12)
  }
})

test('paired months have their own goal, message and concept sequence', () => {
  let paired = 0
  for (const clientId of new Set(packet.rows.map(row => row.client_id))) {
    const rows = packet.rows.filter(row => row.client_id === clientId)
    if (rows.length < 2) continue
    paired++
    for (const [i, row] of rows.entries()) {
      for (const other of rows.slice(i + 1)) {
        const a = row.draft_strategy_data, b = other.draft_strategy_data
        assert.notEqual(a.goldStandard.objective, b.goldStandard.objective, row.client_name)
        assert.notEqual(a.goldStandard.coreMessage, b.goldStandard.coreMessage, row.client_name)
        assert.notDeepEqual(a.actionPlan, b.actionPlan, row.client_name)
      }
    }
  }
  assert.equal(paired, 30)
})

test('client prose keeps exact business and branch identities without borrowing another client', () => {
  const clients = new Map([...packet.rows, ...packet.held_clients].map(row => [row.client_id, row.client_name]))
  for (const row of packet.rows) {
    const text = visibleCopy(readStrategyData(row.draft_strategy_data)).join('\n')
    for (const [id, name] of clients) {
      // The agency can naturally be named; another client's business cannot.
      if (id !== row.client_id && name !== 'CG Production House') {
        assert.ok(!text.toLocaleLowerCase().includes(name.toLocaleLowerCase()), `${row.client_name}: foreign client ${name}`)
      }
    }
    if (row.client_name === 'Tobich Optics') {
      assert.match(text, /Otjiwarongo/)
      assert.doesNotMatch(text, /Windhoek|Rundu|cure|diagnos|guaranteed vision/i)
    }
    if (row.client_name === 'Supa Quick Centurion') {
      assert.match(text, /Centurion Lifestyle/)
      assert.doesNotMatch(text, /Bloemfontein|BFN|WiseRide/)
    }
  }
})

test('source, package and published-history protection is supported by live role readback', () => {
  assert.equal(packet.preserved.client_package_rows, 63)
  assert.equal(packet.preserved.protected_published_plans, 16)
  assert.equal(packet.preserved.untouched_existing_strategy_rows, 64)
  assert.equal(packet.preserved.migrations, 0)
  assert.equal(packet.preserved.vercel_operations, 0)
  assert.equal(packet.preserved.runtime_deploys, 0)
  assert.deepEqual(packet.role_acceptance, {
    month_reads: 138, client_contexts: 46, cross_client_denials: 46, private_draft_exposures: 0,
  })
  const neshora = packet.held_clients.find(row => row.client_name === 'Neshora Oxygen')
  assert.equal(neshora.confirmed_scope.professional_video, 1)
  assert.equal(neshora.confirmed_scope.photo_content, 4)
  assert.equal(neshora.confirmed_scope.design_poster, 4)
  const econo = packet.held_clients.find(row => row.client_name === 'Econofoods')
  assert.equal(econo.confirmed_scope.professional_video, 5)
  assert.equal(econo.confirmed_scope.design_poster, null)
  assert.equal(econo.confirmed_scope.photo_content, null)
  assert.match(econo.gap, /five-video-only scope and social-management exclusion/)
})

test('the actual client reader keeps the new copy spaced, compact and free of internal receipts', async () => {
  const server = await createServer({ configFile: false,
    server: { middlewareMode: true, hmr: { port: 0 } },
    esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true }, define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture'),
    } })
  try {
    const { GuidedStrategyView } = await server.ssrLoadModule('/src/components/strategy/GuidedStrategy.tsx')
    for (const row of packet.rows) {
      const data = readStrategyData(row.draft_strategy_data)
      const before = JSON.stringify(data)
      const html = renderToStaticMarkup(createElement(GuidedStrategyView, { data, hideTopContent: true }))
      assert.match(html, /Action plan/)
      assert.match(html, /whitespace-pre-line/)
      assert.match(html, /START\n/)
      assert.match(html, /BUILD\n/)
      assert.match(html, /CLOSE\n/)
      assert.match(html, /line-clamp-2 group-open\/idea:line-clamp-none/)
      assert.doesNotMatch(html, /<details open=""|internal_notes|seed_context|evidence_fingerprint/)
      assert.equal(JSON.stringify(data), before)
    }
  } finally { await server.close() }
})
