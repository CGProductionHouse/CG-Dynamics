import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

// Regression test for issue #386: AbortError from bounded fetch must be
// classified as resumable (MetaSyncDeadlineError) so the worker retries it
// instead of terminalizing the item. The exact production string is
// "AbortError: The signal has been aborted".

let server
let metaFetch, MetaSyncDeadlineError

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ metaFetch, MetaSyncDeadlineError } = await server.ssrLoadModule('/supabase/functions/_shared/meta.ts'))
})
after(async () => { await server.close() })

test('metaFetch converts AbortError to MetaSyncDeadlineError for retry', async () => {
  // Simulate a fetch that aborts due to timeout (the bounded-fetch timeout path)
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
    assert.ok(e instanceof MetaSyncDeadlineError, `Expected MetaSyncDeadlineError, got ${e?.constructor?.name}: ${e?.message}`)
    assert.match(e.message, /request attempt \d+/)
    // Should have attempted once (no backoff for non-GET or after abort)
    assert.equal(callCount, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('metaFetch converts AbortError on GET to MetaSyncDeadlineError immediately', async () => {
  const originalFetch = globalThis.fetch
  let callCount = 0
  globalThis.fetch = async () => {
    callCount++
    const abortError = new DOMException('The signal has been aborted', 'AbortError')
    throw abortError
  }

  try {
    // GET request - AbortError should be converted immediately, not retried internally
    await metaFetch('https://graph.facebook.com/v25.0/test', { method: 'GET' }, 100)
    assert.fail('Expected metaFetch to throw MetaSyncDeadlineError')
  } catch (e) {
    assert.ok(e instanceof MetaSyncDeadlineError, `Expected MetaSyncDeadlineError, got ${e?.constructor?.name}: ${e?.message}`)
    // Should have attempted once (AbortError converts immediately)
    assert.equal(callCount, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('metaFetch preserves MetaSyncDeadlineError from deadline check', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    await new Promise(r => setTimeout(r, 50))
    return new Response(JSON.stringify({ data: [] }), { status: 200 })
  }

  const control = { deadline: Date.now() - 1000 } // already past deadline

  try {
    await metaFetch('https://graph.facebook.com/v25.0/test', { method: 'GET' }, 1000, control)
    assert.fail('Expected metaFetch to throw MetaSyncDeadlineError')
  } catch (e) {
    assert.ok(e instanceof MetaSyncDeadlineError, `Expected MetaSyncDeadlineError, got ${e?.constructor?.name}: ${e?.message}`)
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