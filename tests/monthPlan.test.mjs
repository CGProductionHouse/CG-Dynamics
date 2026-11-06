import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateMonthPlan } from '../scripts/poster-studio/month-plan.mjs'

const root = resolve(import.meta.dirname, '..', 'docs', 'ai-workforce', 'graphic-designer', 'piek-january-2027')

test('execution windows reject impossible dates, missing coverage and accidental scheduling', () => {
  const plan = JSON.parse(readFileSync(resolve(root, 'january-strategy.proposal.json'), 'utf8'))
  const brandPack = JSON.parse(readFileSync(resolve(root, 'brand-pack-index.json'), 'utf8'))
  plan.creativeWindows[0].end = '2027-01-32'
  plan.creativeWindows[1].scheduled_date = '2027-01-03'
  plan.creativeWindows.pop()
  const report = validateMonthPlan(plan, brandPack)
  assert.equal(report.valid, false)
  assert.ok(report.errors.some((error) => error.includes('one proposed creative window')))
  assert.ok(report.errors.some((error) => error.includes('real date')))
  assert.ok(report.errors.some((error) => error.includes('cannot create a schedule assignment')))
})

test('Piek January proposal has 12 complete, scope-balanced and mechanism-distinct briefs', () => {
  const plan = JSON.parse(readFileSync(resolve(root, 'january-strategy.proposal.json'), 'utf8'))
  const brandPack = JSON.parse(readFileSync(resolve(root, 'brand-pack-index.json'), 'utf8'))
  const report = validateMonthPlan(plan, brandPack)
  assert.equal(report.valid, true, report.errors.join('\n'))
  assert.equal(report.briefCount, 12)
  assert.equal(report.uniqueMechanismCount, 12)
  assert.deepEqual(report.countsByScope, { PIEK_GROUP: 3, ENGEN: 3, SASOL: 3, GET_TOGETHER: 3 })
  assert.deepEqual(report.errors, [])
})

test('proposal validator refuses fabricated schedule IDs', () => {
  const plan = JSON.parse(readFileSync(resolve(root, 'january-strategy.proposal.json'), 'utf8'))
  const brandPack = JSON.parse(readFileSync(resolve(root, 'brand-pack-index.json'), 'utf8'))
  plan.briefs[0].monthlyDeliverableId = 'invented-id'
  const report = validateMonthPlan(plan, brandPack)
  assert.equal(report.valid, false)
  assert.ok(report.errors.some((error) => error.includes('must not invent monthlyDeliverableId')))
})

test('proposal validator refuses an incomplete or falsely cleared Brand Pack', () => {
  const plan = JSON.parse(readFileSync(resolve(root, 'january-strategy.proposal.json'), 'utf8'))
  const brandPack = JSON.parse(readFileSync(resolve(root, 'brand-pack-index.json'), 'utf8'))
  const incomplete = structuredClone(brandPack)
  incomplete.scopes[0].colours = []
  incomplete.scopes[0].productionBlocked = false
  const result = validateMonthPlan(plan, incomplete)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.includes('exact Brand Kit colours')))
  assert.ok(result.errors.some((error) => error.includes('local font rendering')))
  assert.ok(result.errors.some((error) => error.includes('exact verified logo')))
})
