import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { renderMonthBoard } from '../scripts/poster-studio/month-board.mjs'

const plan = JSON.parse(readFileSync(new URL('../docs/ai-workforce/graphic-designer/piek-january-2027/january-strategy.proposal.json', import.meta.url)))

test('month board renders every proposal and production gate', () => {
  const html = renderMonthBoard(plan)
  assert.equal((html.match(/<article class="card/g) ?? []).length, 12)
  for (const brief of plan.briefs) {
    assert.match(html, new RegExp(brief.provisionalId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.match(html, new RegExp(brief.headlineCandidates[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(html, /Planning evidence only/)
  assert.match(html, /blocked/i)
})

test('month board escapes untrusted plan text', () => {
  const unsafe = structuredClone(plan)
  unsafe.briefs[0].headlineCandidates[0] = '<script>alert(1)</script>'
  const html = renderMonthBoard(unsafe)
  assert.doesNotMatch(html, /<script>alert/)
  assert.match(html, /&lt;script&gt;alert/)
})
