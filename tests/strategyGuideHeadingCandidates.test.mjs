import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { readStrategyData, clientFacingStrategyQualityIssues } from '../src/lib/strategyEngine.ts'
import { validateMonthlyStrategyProposal } from '../supabase/functions/_shared/monthlyStrategyProposal.ts'

const packet = JSON.parse(readFileSync(new URL('../docs/ops/client-readiness/2026-11-19-strategy-guide-heading-candidates.json', import.meta.url)))
const visible = data => [...Object.values(data.goldStandard), data.strategyGoingForward, ...data.clientActionsRequired,
  ...Object.values(data.actionPlan).filter(section => section.enabled).flatMap(section => [...section.items, section.notes])].filter(Boolean)

test('eighteen exact-month candidates remain unapplied behind their actual live source gate', () => {
  assert.equal(packet.candidate_rows, 18)
  assert.equal(packet.rows.length, 18)
  assert.equal(new Set(packet.rows.map(row => row.client_id)).size, 6)
  assert.equal(new Set(packet.rows.map(row => `${row.client_id}/${row.strategy_month}`)).size, 18)
  assert.equal(packet.rows.filter(row => row.existing_strategy_id).length, 12)
  assert.equal(packet.rows.filter(row => !row.existing_strategy_id).length, 6)
  assert.equal(packet.runtime_release_required, true)
  assert.equal(packet.canonical_writes, 0)
  assert.equal(packet.source_review_writes, 0)
  assert.equal(packet.approvals, 0)
  assert.equal(packet.publications, 0)
  for (const row of packet.rows) {
    assert.equal(row.canonical_state, 'blocked')
    assert.deepEqual(row.canonical_blockers, ['EXACT_STRATEGY_EVIDENCE_UNAVAILABLE'])
    assert.equal(row.write_status, 'NOT_SAVED_NOT_APPROVED_NOT_PUBLISHED')
    assert.match(row.required_next_step, /re-read canonical exact-month brief/)
    assert.equal(row.guide_id, row.source_ids.client_guide_id)
    assert.match(row.current_brief_fingerprint, /^[a-f0-9]{64}$/)
    if (row.existing_strategy_id) {
      assert.ok(row.expected_version > 0)
      assert.match(row.expected_row_hash, /^[a-f0-9]{32}$/)
    } else {
      assert.equal(row.expected_version, null)
      assert.equal(row.expected_row_hash, null)
    }
  }
})

test('the reviewed candidates meet the actual proposal, positive-copy and package-capacity contracts', () => {
  for (const row of packet.rows) {
    const data = readStrategyData(row.candidate_data)
    const enabled = new Set(Object.entries(data.actionPlan).filter(([, section]) => section.enabled).map(([key]) => key))
    // This is local post-fix validation only. The live gate above is not waived.
    const proposal = { clientId: row.client_id, strategyMonth: row.strategy_month, sourceIds: [row.guide_id],
      goldStandard: data.goldStandard, actionPlan: Object.fromEntries([...enabled].map(key => [key, data.actionPlan[key].items])) }
    assert.deepEqual(validateMonthlyStrategyProposal(JSON.stringify(proposal), {
      clientId: row.client_id, strategyMonth: row.strategy_month, sourceIds: new Set([row.guide_id]),
      enabledFormats: enabled, confirmedCapacity: row.confirmed_scope,
    }).issues, [], row.client_name)
    assert.deepEqual(clientFacingStrategyQualityIssues(data), [], row.client_name)
    assert.match(data.strategyGoingForward, /^1\. [^]+\n\n2\. [^]+\n\n3\. /)
    assert.match(data.goldStandard.nextMonthGamePlan, /^START\n[^]+\n\nBUILD\n[^]+\n\nCLOSE\n/)
    for (const [kind, capacity] of Object.entries(row.confirmed_scope)) {
      const quantity = typeof capacity === 'number' ? capacity : capacity === true ? 1 : 0
      assert.equal(data.actionPlan[kind].enabled, quantity > 0, `${row.client_name}: ${kind}`)
      assert.equal(data.actionPlan[kind].items.length, quantity, `${row.client_name}: ${kind}`)
      assert.ok(data.actionPlan[kind].items.every(item => item.includes('\n\n')))
    }
    for (const text of visible(data)) {
      assert.ok(text.split(/\s+/).length <= 95, row.client_name)
      assert.ok(text.split(/\n\s*\n/).every(part => part.split(/\s+/).length <= 45), row.client_name)
      assert.doesNotMatch(text, /\b(?:not proof|do not infer|unverified|unavailable|unknown|permission-cleared|canonical|RPC|UUID|repository|we cannot|we can.t|rather than|instead of)\b/i)
      assert.doesNotMatch(text, /\b[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\b/i)
    }
    if (row.client_name === 'WiseRide') assert.equal(data.actionPlan.professional_video.enabled, false)
    if (row.client_name === 'WiseRide' && row.strategy_month === '2026-11-01') {
      assert.deepEqual(data.strategyDrivers, [])
      assert.ok(row.private_legacy_context_to_preserve.strategyDrivers.some(text => text.includes(row.client_id)))
    }
    if (row.client_name === 'Supa Quick BFN') {
      assert.equal(data.actionPlan.design_poster.items.length, 3, 'Confirmed package overrides the four historical template rows')
      assert.doesNotMatch(visible(data).join(' '), /Centurion/)
    }
    if (row.client_name === 'Peyper Bonds') assert.doesNotMatch(visible(data).join(' '), /guarantee|guaranteed|interest rate|\d+%|approved loan|legal advice/i)
  }
})

test('all three months carry distinct client-specific goals and concepts', () => {
  for (const clientId of new Set(packet.rows.map(row => row.client_id))) {
    const rows = packet.rows.filter(row => row.client_id === clientId)
    assert.deepEqual(rows.map(row => row.strategy_month), ['2026-11-01', '2026-12-01', '2027-01-01'])
    assert.equal(new Set(rows.map(row => row.candidate_data.goldStandard.objective)).size, 3)
    assert.equal(new Set(rows.map(row => row.candidate_data.goldStandard.coreMessage)).size, 3)
    assert.equal(new Set(rows.map(row => JSON.stringify(row.candidate_data.actionPlan))).size, 3)
    for (const row of rows) for (const other of packet.rows.filter(other => other.client_id !== clientId)) {
      assert.ok(!visible(row.candidate_data).join(' ').includes(other.client_name), `${row.client_name}: ${other.client_name}`)
    }
  }
})

test('the actual reader renders every proposed review with readable spacing and compact actions', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: { port: 0 } },
    esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true }, define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture'),
    } })
  try {
    const { GuidedStrategyView } = await server.ssrLoadModule('/src/components/strategy/GuidedStrategy.tsx')
    for (const row of packet.rows) {
      const html = renderToStaticMarkup(createElement(GuidedStrategyView, { data: readStrategyData(row.candidate_data), hideTopContent: true }))
      assert.match(html, /Action plan/)
      assert.match(html, /whitespace-pre-line/)
      assert.match(html, /line-clamp-2 group-open\/idea:line-clamp-none/)
      assert.doesNotMatch(html, /internal_notes|seed_context|current_brief_fingerprint/)
    }
  } finally { await server.close() }
})
