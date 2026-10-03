import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { emptyStrategyData, generateActionPlan, generateStrategyGoingForward } from '../src/lib/strategyEngine.ts'

const packageSettings = {
  professional_videos_per_month: 1, reels_per_month: null, photo_posts_per_month: 4,
  design_posters_per_month: 0, animated_posters_per_month: null,
  campaign_management_included: null, monthly_campaign_budget: null,
}
const context = data => ({ clientName: 'We Ar Fuels', data, packageSettings, selectedCalendar: [{ eventId: 'date-a', title: 'A proposed date', date: '2026-10-10', use: true, note: '' }] })

test('guardrails, quantity and a calendar selection never manufacture a strategy or results claim', () => {
  const data = emptyStrategyData()
  data.strategyDrivers = ['No influencer language, forced humour, slang or hype.', 'Use the approved regional footer.']
  data.clientDirection = ['Use natural English or Afrikaans.']
  data.topContent.whyItWorked = ['Authentic']
  const before = JSON.stringify(data)
  assert.equal(generateStrategyGoingForward(context(data)), '')
  const plan = generateActionPlan(context(data))
  assert.equal(plan.professional_video.enabled, true)
  assert.deepEqual(plan.professional_video.items, [])
  assert.deepEqual(plan.photo_content.items, [])
  for (const key of ['reels', 'design_poster', 'animated_poster', 'campaign_recommendation']) assert.equal(plan[key].enabled, false)
  assert.equal(JSON.stringify(data), before)
})

test('written brief is assembled verbatim without claiming measured causation or inventing tactics', () => {
  const data = emptyStrategyData()
  data.goldStandard.objective = 'Help farm customers prepare the information needed for a fuel-delivery discussion.'
  data.goldStandard.coreMessage = 'Start with the job and location; the team confirms service availability for that request.'
  data.goldStandard.testAndChange = 'Test a customer planning-question video; review actual enquiry quality, not assumed sales.'
  assert.equal(generateStrategyGoingForward(context(data)), [data.goldStandard.objective, data.goldStandard.coreMessage, data.goldStandard.testAndChange].join('\n\n'))
  data.goldStandard.objective = 'Canonical client: We Ar Fuels'
  assert.equal(generateStrategyGoingForward(context(data)), '')
})

test('staff direction and format-specific concepts survive assembly and unknown scope stays disabled', () => {
  const data = emptyStrategyData()
  data.strategyGoingForward = 'Staff-authored exact direction — preserve this unchanged.'
  data.actionPlan.professional_video = { enabled: true, items: ['Team answers a fuel-delivery planning question beside actual equipment.'], notes: 'Confirm the exact service example before filming.' }
  data.actionPlan.reels = { enabled: true, items: ['Staff proposal awaiting scope confirmation.'], notes: 'Keep this proposal, do not silently discard it.' }
  const before = JSON.stringify(data)
  assert.equal(generateStrategyGoingForward(context(data)), data.strategyGoingForward)
  const plan = generateActionPlan(context(data))
  assert.deepEqual(plan.professional_video, data.actionPlan.professional_video)
  assert.equal(plan.reels.enabled, false)
  assert.deepEqual(plan.reels.items, data.actionPlan.reels.items)
  assert.equal(plan.reels.notes, data.actionPlan.reels.notes)
  plan.professional_video.items.push('Separate copy')
  assert.equal(JSON.stringify(data), before)
})

test('canonical seed retains evidence without promoting source notes or package receipts into strategy fields', () => {
  const source = readFileSync(new URL('../src/lib/monthlyStrategy.ts', import.meta.url), 'utf8')
  assert.match(source, /intelligence_evidence: baseline\.evidence/)
  assert.match(source, /marketing_library_cards:/)
  assert.match(source, /package_verification_confirmed_at:/)
  assert.doesNotMatch(source, /strategyData\.(clientDirection|strategyDrivers) = baseline\./)
  assert.doesNotMatch(source, /strategyData\.goldStandard\.(objective|formatsAndRationale|testAndChange|nextMonthGamePlan) =/)
})
