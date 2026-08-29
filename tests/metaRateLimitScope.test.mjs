import assert from 'node:assert/strict'
import { test } from 'node:test'
import { metaRateLimitScope } from '../supabase/functions/_shared/metaRateLimit.ts'

test('Meta application and token limit codes pause the batch', () => {
  for (const code of [4, 17, 341, 613]) {
    assert.equal(metaRateLimitScope(`Meta failed, code: ${code}`), 'batch')
  }
  assert.equal(metaRateLimitScope('HTTP 429'), 'batch')
})

test('Meta Page request limit code pauses only the affected item', () => {
  assert.equal(metaRateLimitScope('Meta failed, code: 32'), 'item')
  assert.equal(metaRateLimitScope('Facebook posts fetch page 1 failed (HTTP 429)'), 'batch')
})

test('ordinary failures do not trigger cooldown', () => {
  assert.equal(metaRateLimitScope('permission denied code: 10'), null)
  assert.equal(metaRateLimitScope('network reset'), null)
})
