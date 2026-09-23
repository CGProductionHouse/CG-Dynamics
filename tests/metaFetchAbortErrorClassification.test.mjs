import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

// Regression test for issue #386: AbortError from bounded fetch must be
// classified as resumable (MetaSyncDeadlineError) so the worker retries it
// instead of terminalizing the item. The exact production string is
// "AbortError: The signal has been aborted".

let server
let metaFetch, isTransientMetaRequestAbort, planMetaRequestAbortRetry, MetaProviderTimeoutError, MetaSyncDeadlineError

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ metaFetch, isTransientMetaRequestAbort, planMetaRequestAbortRetry, MetaProviderTimeoutError, MetaSyncDeadlineError } = await server.ssrLoadModule('/supabase/functions/_shared/meta.ts'))
})
after(async () => { await server.close() })

test('metaFetch classifies exact production AbortError as a provider timeout', async () => {
  const originalFetch = globalThis.fetch
  let callCount = 0
  globalThis.fetch = async () => {
    callCount++
    const abortError = new DOMException('The signal has been aborted', 'AbortError')
    throw abortError
  }

  try {
    await metaFetch('https://graph.facebook.com/v25.0/test', 100)
    assert.fail('Expected metaFetch to throw MetaSyncDeadlineError')
  } catch (e) {
    assert.ok(e instanceof MetaProviderTimeoutError, `Expected MetaProviderTimeoutError, got ${e?.constructor?.name}: ${e?.message}`)
    assert.match(e.message, /provider request timed out.*request attempt 1/i)
    assert.equal(callCount, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('plain Error exact production AbortError signature is a provider timeout', async () => {
  const originalFetch = globalThis.fetch
  let callCount = 0
  globalThis.fetch = async () => {
    callCount++
    throw new Error('AbortError: The signal has been aborted')
  }

  try {
    await metaFetch('https://graph.facebook.com/v25.0/test', 100)
    assert.fail('Expected metaFetch to throw MetaProviderTimeoutError')
  } catch (e) {
    assert.ok(e instanceof MetaProviderTimeoutError, `Expected MetaProviderTimeoutError, got ${e?.constructor?.name}: ${e?.message}`)
    assert.match(e.message, /provider request timed out.*request attempt 1/i)
    assert.equal(callCount, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('request-timeout abort equivalents are transient but permanent controls fail closed', () => {
  assert.equal(isTransientMetaRequestAbort(new Error('Meta fetch request timed out')), true)
  assert.equal(isTransientMetaRequestAbort(new Error('Fetch was aborted by the runtime')), true)
  assert.equal(isTransientMetaRequestAbort(new Error('The operation was aborted')), true)
  assert.equal(isTransientMetaRequestAbort({ name: 'AbortError', message: 'cross-realm abort' }), true)
  assert.equal(isTransientMetaRequestAbort({ code: 'UND_ERR_CONNECT_TIMEOUT', message: 'connection stalled' }), true)

  assert.equal(isTransientMetaRequestAbort(new Error('OAuthException: invalid access token')), false)
  assert.equal(isTransientMetaRequestAbort(new Error('Permission denied (HTTP 403)')), false)
  assert.equal(isTransientMetaRequestAbort(new Error('Meta provider configuration is missing')), false)
  assert.equal(isTransientMetaRequestAbort(new Error('Malformed collection data envelope')), false)
  assert.equal(isTransientMetaRequestAbort(new Error('Schema contract rejected the response')), false)
})

test('worker abort disposition requeues once, preserves attempt accounting and exhausts at the existing cap', () => {
  const productionAbort = new Error('AbortError: The signal has been aborted')
  assert.deepEqual(planMetaRequestAbortRetry(productionAbort, 1, 3), {
    status: 'queued',
    error: 'MetaProviderTimeoutError: Meta provider request timed out during worker provider request.',
    refundAttempt: false,
  })
  assert.deepEqual(planMetaRequestAbortRetry(productionAbort, 3, 3), {
    status: 'failed',
    error: 'MetaProviderTimeoutError: Meta provider request timed out during worker provider request. Provider request timeout exhausted 3 bounded attempts.',
    refundAttempt: false,
  })
})

test('permission, auth, configuration and malformed-envelope failures have no automatic abort retry plan', () => {
  for (const message of [
    'OAuthException: invalid access token',
    'Permission denied (HTTP 403)',
    'Meta provider configuration is missing',
    'Malformed collection data envelope',
    'Schema contract rejected the response',
  ]) {
    assert.equal(planMetaRequestAbortRetry(new Error(message), 1, 3), null, message)
  }
})

test('metaFetch classifies TimeoutError as a provider timeout', async () => {
  const originalFetch = globalThis.fetch
  let callCount = 0
  globalThis.fetch = async () => {
    callCount++
    throw new DOMException('The operation timed out', 'TimeoutError')
  }

  try {
    await metaFetch('https://graph.facebook.com/v25.0/test', { method: 'GET' }, 100)
    assert.fail('Expected metaFetch to throw MetaProviderTimeoutError')
  } catch (e) {
    assert.ok(e instanceof MetaProviderTimeoutError, `Expected MetaProviderTimeoutError, got ${e?.constructor?.name}: ${e?.message}`)
    assert.equal(callCount, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('pre-request invocation deadline yields without dispatching a provider request', async () => {
  const originalFetch = globalThis.fetch
  let callCount = 0
  globalThis.fetch = async () => { callCount++; return Response.json({ data: [] }) }

  const control = { deadline: Date.now() - 1000 } // already past deadline

  try {
    await metaFetch('https://graph.facebook.com/v25.0/test', { method: 'GET' }, 1000, control)
    assert.fail('Expected metaFetch to throw MetaSyncDeadlineError')
  } catch (e) {
    assert.ok(e instanceof MetaSyncDeadlineError, `Expected MetaSyncDeadlineError, got ${e?.constructor?.name}: ${e?.message}`)
    assert.equal(callCount, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('metaFetch treats non-AbortError DOMException as regular error', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError')
    throw quotaError
  }

  try {
    await metaFetch('https://graph.facebook.com/v25.0/test', 100)
    assert.fail('Expected metaFetch to throw')
  } catch (e) {
    assert.ok(!(e instanceof MetaSyncDeadlineError), 'QuotaExceededError should not become MetaSyncDeadlineError')
    assert.ok(e instanceof DOMException)
    assert.equal(e.name, 'QuotaExceededError')
  } finally {
    globalThis.fetch = originalFetch
  }
})
