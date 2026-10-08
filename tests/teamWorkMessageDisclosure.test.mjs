import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../src/pages/admin/CommandCentrePage.tsx', import.meta.url), 'utf8')
const morning = source.slice(source.indexOf('function MorningMessageCard('), source.indexOf('function EndOfDayCard('))
const endOfDay = source.slice(source.indexOf('function EndOfDayCard('), source.indexOf('function TaskDetailDrawer('))

test('large Team Work message drafts are deferred and bounded until explicitly previewed', () => {
  for (const card of [morning, endOfDay]) {
    assert.match(card, /useState\(false\)/)
    assert.match(card, /previewOpen \? build/)
    assert.match(card, /previewOpen && \(/)
    assert.match(card, /max-h-80 overflow-auto/)
    assert.match(card, /aria-expanded=\{previewOpen\}/)
  }
})

test('copy actions and truthful unresolved ownership remain available without opening previews', () => {
  assert.match(morning, /ownershipCounts\(ownershipGrouping\)/)
  assert.match(morning, /data-testid="ownership-totals"/)
  assert.match(morning, /onCopy\('morning', message \|\| buildMorningMessage\(ownershipGrouping\)\)/)
  assert.match(endOfDay, /onCopy\('end-of-day', message \|\| buildEndOfDay\(allRelevant, ownershipOf\)\)/)
})
