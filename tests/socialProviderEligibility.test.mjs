import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { classifySocialProviderEligibility } from '../src/lib/socialProviderEligibility.ts'

const fields = [
  'professional_videos_per_month', 'reels_per_month', 'photo_posts_per_month',
  'design_posters_per_month', 'animated_posters_per_month', 'campaign_management_included',
  'monthly_campaign_budget', 'shoot_days_per_month', 'website_updates_per_month',
  'other_agreed_deliverables', 'package_notes', 'package_exclusions',
]

function confirmed(overrides = {}) {
  const settings = Object.fromEntries(fields.map(field => [field, null]))
  Object.assign(settings, overrides)
  const fieldStates = Object.fromEntries(fields.map(field => {
    const value = settings[field]
    return [field, value === null || value === '' ? 'unknown' : typeof value === 'number' && value === 0 ? 'explicit_zero' : 'known']
  }))
  return {
    ...settings,
    verification: {
      status: 'confirmed', version: 2, confirmed_at: '2026-09-23T14:00:00.000Z',
      confirmed_by_profile_id: 'admin-id', evidence_note: 'Exact package evidence reviewed.',
      inference_note: '', source_references: ['issue:#504'], field_states: fieldStates,
    },
  }
}

describe('confirmed package social-provider eligibility', () => {
  test('positive recurring social content is eligible while blank scope is held', () => {
    assert.equal(classifySocialProviderEligibility(confirmed({ design_posters_per_month: 4 })).state, 'eligible')
    assert.equal(classifySocialProviderEligibility(confirmed()).state, 'unresolved')
    assert.equal(classifySocialProviderEligibility(null).state, 'unresolved')
  })

  test('explicit social-management evidence is eligible without invented quantities', () => {
    assert.equal(classifySocialProviderEligibility(confirmed({ other_agreed_deliverables: 'Social media management and caption generation included.' })).state, 'eligible')
  })

  test('explicit non-social scope wins over positive production quantities', () => {
    assert.equal(classifySocialProviderEligibility(confirmed({
      professional_videos_per_month: 5,
      package_exclusions: 'CG does not manage social media; videos are supplied only.',
    })).state, 'excluded')
  })

  test('social removals and website-only service are excluded without deactivating the client', () => {
    for (const text of [
      'No recurring social-media management package.',
      'No recurring social-media package.',
      'No ongoing social-media package.',
      'Website service only; monthly website-update quantity is not specified.',
    ]) {
      assert.equal(classifySocialProviderEligibility(confirmed({ package_exclusions: text })).state, 'excluded')
    }
  })

  test('explicit zero is preserved but does not invent an exclusion decision', () => {
    assert.equal(classifySocialProviderEligibility(confirmed({ reels_per_month: 0 })).state, 'unresolved')
  })
})
