import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

// Regression test for issue #386: AbortError from bounded fetch must be
// classified as resumable (MetaSyncDeadlineError) so the worker retries it
// instead of terminalizing the item. The exact production string is
// "AbortError: The signal has been aborted".

let server
let metaFetch, MetaProviderTimeoutError, MetaSyncDeadlineError

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ metaFetch, MetaProviderTimeoutError, MetaSyncDeadlineError } = await server.ssrLoadModule('/supabase/functions/_shared/meta.ts'))
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
