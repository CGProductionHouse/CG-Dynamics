import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import {
  FB_ACCOUNT_METRICS,
  MetaFactRetryableError,
  MetaSyncDeadlineError,
  syncAccountFacts,
} from '../supabase/functions/_shared/meta.ts'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

class FactCheckpointStore {
  completed = new Set()
  metricResults = {}
  finalized = null
  persistCalls = []

  async rpc(name, args) {
    if (name === 'meta_sync_begin_account_fact_run') {
      return {
        data: [{
          sync_run_id: '00000000-0000-0000-0000-000000000001',
          completed_metric_keys: [...this.completed],
          summary: { metric_results: this.metricResults },
        }],
        error: null,
      }
    }
    if (name === 'meta_sync_persist_account_metric') {
      this.persistCalls.push(args)
      this.metricResults[args.p_metric_key] = args.p_fact
      if (args.p_terminal) this.completed.add(args.p_metric_key)
      return { data: [{ completed_metric_keys: [...this.completed] }], error: null }
    }
    if (name === 'meta_sync_finalize_account_fact_run') {
      this.finalized = args
      return { data: null, error: null }
    }
    throw new Error(`Unexpected RPC ${name}`)
  }
}

function healthyMetaFetch(log) {
  return async input => {
    const url = new URL(String(input))
    log.push(url.searchParams.get('metric') ?? url.searchParams.get('fields') ?? '')
    if (url.pathname.endsWith('/insights')) {
      const metric = url.searchParams.get('metric') ?? 'metric'
      return new Response(JSON.stringify({
        data: [{ name: metric, total_value: { value: 1 }, values: [{ value: 1 }] }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    const field = (url.searchParams.get('fields') ?? 'followers_count').split(',')[0]
    return new Response(JSON.stringify({ [field]: 1, fan_count: 1 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

function args(overrides = {}) {
  return {
    clientId: '00000000-0000-0000-0000-000000000010',
    assetId: '00000000-0000-0000-0000-000000000011',
    connectionId: '00000000-0000-0000-0000-000000000012',
    platform: 'facebook',
    objectId: 'page-id',
    token: 'token-for-test-only',
    baseUrl: 'https://graph.facebook.com/v25.0',
    apiVersion: 'v25.0',
    periodMonth: '2026-07',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    tokens: ['token-for-test-only'],
    tokenClass: 'page',
    runType: 'scheduled',
    checkpoint: { itemId: '00000000-0000-0000-0000-000000000020', leaseGeneration: 2 },
    ...overrides,
  }
}

test('deadline after metric N resumes at N+1 without repeating completed probes', async () => {
  const store = new FactCheckpointStore()
  const firstFetches = []
  globalThis.fetch = healthyMetaFetch(firstFetches)
  await assert.rejects(
    syncAccountFacts(store, args({ shouldCancel: () => store.completed.size >= 2 })),
    MetaSyncDeadlineError,
  )
  assert.deepEqual([...store.completed], FB_ACCOUNT_METRICS.slice(0, 2).map(spec => spec.metricKey))
  assert.equal(firstFetches.length, 2)

  const resumedFetches = []
  globalThis.fetch = healthyMetaFetch(resumedFetches)
  const result = await syncAccountFacts(store, args())
  assert.equal(resumedFetches.length, FB_ACCOUNT_METRICS.length - 2)
  assert.equal(store.completed.size, FB_ACCOUNT_METRICS.length)
  assert.equal(result.probes.length, FB_ACCOUNT_METRICS.length)
  assert.equal(store.finalized.p_status, 'success')
})

test('rate-limited metric is checkpointed as nonterminal and retried', async () => {
  const store = new FactCheckpointStore()
  let rateLimited = true
  globalThis.fetch = async input => {
    const metric = new URL(String(input)).searchParams.get('metric')
    if (rateLimited && metric === FB_ACCOUNT_METRICS[0].sourceMetric) {
      return new Response(JSON.stringify({ error: { code: 4, message: 'Application request limit reached' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return healthyMetaFetch([])(input)
  }
  await assert.rejects(
    syncAccountFacts(store, args()),
    error => error instanceof MetaFactRetryableError && error.rateLimited,
  )
  assert.equal(store.completed.size, 0)
  assert.equal(store.persistCalls[0].p_terminal, false)

  rateLimited = false
  globalThis.fetch = healthyMetaFetch([])
  await syncAccountFacts(store, args())
  assert.equal(store.completed.size, FB_ACCOUNT_METRICS.length)
})

test('permission-blocked metric is terminal and is not repeated on resume', async () => {
  const store = new FactCheckpointStore()
  let calls = 0
  globalThis.fetch = async input => {
    calls++
    const metric = new URL(String(input)).searchParams.get('metric')
    if (metric === FB_ACCOUNT_METRICS[0].sourceMetric) {
      return new Response(JSON.stringify({ error: { code: 10, message: 'Permission denied' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return healthyMetaFetch([])(input)
  }
  const first = await syncAccountFacts(store, args())
  assert.equal(first.probes[0].availability, 'permission_blocked')
  assert.equal(store.completed.has(FB_ACCOUNT_METRICS[0].metricKey), true)

  const beforeResume = calls
  globalThis.fetch = healthyMetaFetch([])
  await syncAccountFacts(store, args())
  assert.equal(calls, beforeResume)
})
