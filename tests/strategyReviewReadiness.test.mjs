import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assessGoldStandardStrategy, clientFacingStrategyQualityIssues, emptyStrategyData, GOLD_STANDARD_FIELDS, strategyRequiredComplete } from '../src/lib/strategyEngine.ts'
import { EMPTY_PACKAGE_SETTINGS } from '../src/lib/packageAuthority.ts'

function completeDraft() {
  const data = emptyStrategyData()
  for (const field of GOLD_STANDARD_FIELDS) data.goldStandard[field.key] = `Show the actual delivery process and ordering questions for ${field.label}.`
  data.clientDirection = ['Explain what a buyer needs to provide when requesting a delivery.']
  data.topContent.whatThisTellsUs = 'The recorded delivery post received enquiries; attribution is not established.'
  data.strategyGoingForward = 'Use a filmed delivery to explain the ordering process and test a clearer enquiry prompt.'
  data.actionPlan.professional_video = { enabled: true, items: ['Film the real ordering-to-delivery sequence.'], notes: '' }
  return data
}
const pkg = { ...EMPTY_PACKAGE_SETTINGS, professional_videos_per_month: 1 }

test('monthly approval checks reject copy already rejected by the client presentation authority', () => {
  const data = completeDraft()
  data.goldStandard.objective = 'Use the verified client evidence to drive the practical direction for this month.'
  assert.ok(assessGoldStandardStrategy(data, pkg, true).some(issue => issue.includes('Internal evidence-template')))
})

test('long generic prose and internal provenance cannot pass by exceeding minimum field length', () => {
  for (const copy of ['Increase engagement by creating engaging content every week.', 'Review docs/internal-plan.md to set the client direction.', 'Canonical client: internal identity is the strategy.']) {
    const data = completeDraft()
    data.goldStandard.coreMessage = copy
    assert.ok(assessGoldStandardStrategy(data, pkg, true).length > 0, copy)
    assert.equal(strategyRequiredComplete(data), false, copy)
  }
})

test('internal caption and contact rules cannot pass as a client strategy', () => {
  for (const copy of [
    'No influencer language, forced humour, slang or hype.',
    'Use natural English or Afrikaans as the brief fits.',
    'Normal public captions should use the current approved regional footer.',
    'Normal public We Ar Fuels captions should use the current approved regional footer.',
    'Captions add to the artwork/video; they do not repeat it.',
  ]) {
    const data = completeDraft()
    data.goldStandard.objective = copy
    assert.ok(clientFacingStrategyQualityIssues(data).length > 0, copy)
    assert.ok(assessGoldStandardStrategy(data, pkg, true).length > 0, copy)
    assert.equal(strategyRequiredComplete(data), false, copy)
  }
})

test('client-facing insight and selected calendar copy receive the same quality gate', () => {
  const fields = [
    data => { data.topContent.whyItWorked = ['Use the verified client evidence to infer performance.'] },
    data => { data.topContent.whatThisTellsUs = 'Source reference: internal working note.' },
    data => { data.topContent.contentType = 'Canonical client: internal type' },
    data => { data.topContent.autoCaption = 'No influencer language in this caption.' },
    data => { data.calendarSelections = [{ eventId: 'event-1', title: 'Review docs/internal-plan.md', date: '2026-10-20', use: true, note: '' }] },
    data => { data.calendarSelections = [{ eventId: 'event-1', title: 'Client meeting', date: '2026-10-20', use: true, note: 'Use the verified client evidence.' }] },
  ]
  for (const change of fields) {
    const data = completeDraft()
    change(data)
    assert.ok(clientFacingStrategyQualityIssues(data).length > 0)
    assert.equal(strategyRequiredComplete(data), false)
  }
  const unused = completeDraft()
  unused.calendarSelections = [{ eventId: 'event-2', title: 'Review docs/internal-plan.md', date: '2026-10-20', use: false, note: '' }]
  assert.deepEqual(clientFacingStrategyQualityIssues(unused), [])
})

test('legacy reporting readiness cannot promote a known bad strategy with populated checkboxes', () => {
  const data = completeDraft()
  data.strategyGoingForward = 'Published-content record: posting a photo is our next-month strategy.'
  assert.equal(strategyRequiredComplete(data), false)
})

test('specific structural checks still pass without asserting human semantic approval', () => {
  const data = completeDraft()
  assert.deepEqual(assessGoldStandardStrategy(data, pkg, true), [])
  assert.equal(strategyRequiredComplete(data), true)
  assert.ok(assessGoldStandardStrategy(data, null, true).length > 0)
  assert.ok(assessGoldStandardStrategy(data, pkg, false).length > 0)
})

test('review checks preserve original staff copy and unknown/zero package values', () => {
  const data = completeDraft()
  data.actionPlan.reels.enabled = true
  const unknown = { ...pkg, reels_per_month: null }
  const before = structuredClone({ data, unknown })
  assert.ok(assessGoldStandardStrategy(data, unknown, true).includes('Reels capacity is unknown; it cannot be approved.'))
  assert.ok(assessGoldStandardStrategy(data, { ...unknown, reels_per_month: 0 }, true).includes('Reels exceeds the confirmed package.'))
  assert.deepEqual({ data, unknown }, before)
})
