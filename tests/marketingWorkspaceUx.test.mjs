import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync(new URL('../src/pages/admin/MarketingWorkspacePage.tsx', import.meta.url), 'utf8')

test('Marketing search and filters remain accessible without full-width desktop select stacking', () => {
  assert.doesNotMatch(page, /const INPUT_CLS = 'w-full /)
  for (const name of ['Search knowledge', 'Knowledge category', 'Knowledge layer', 'Knowledge industry', 'Search sources', 'Source type', 'Source trust tier']) {
    assert.match(page, new RegExp(`aria-label="${name}"`))
  }
  assert.match(page, /Showing \{filtered\.length\} of \{cards\.length\}/)
  assert.match(page, /Showing \{filtered\.length\} of \{sources\.length\}/)
  assert.match(page, /filterSkillCards\(cards, filters, today\(\)\)/)
  assert.match(page, /filterMarketingSources\(sources, filters\)/)
})
