import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

import {
  incrementalMonthBounds,
  incrementalMonthEnd,
} from '../supabase/functions/_shared/metaPeriod.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

function withFixedNow(iso, callback) {
  const RealDate = globalThis.Date
  const instant = RealDate.parse(iso)
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length > 0 ? args : [instant]))
    }

    static now() {
      return instant
    }
  }
  try {
    return callback()
  } finally {
    globalThis.Date = RealDate
  }
}

function loadFetchMetaCollection(metaFetch) {
  const worker = read('../supabase/functions/meta-sync-worker/index.ts')
  const start = worker.indexOf('async function fetchMetaCollection')
  const helperStart = worker.indexOf('function safePagingCursor')
  const end = worker.indexOf('/**', start)
  const source = `
    const META_COLLECTION_PAGE_CAP = 25
    const PAGE_FETCH_RESERVE_MS = 8000
    const MIN_PAGE_REQUEST_BUDGET_MS = 4000
    ${worker.slice(helperStart, end)}
  `
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText
  class MetaSyncDeadlineError extends Error {}
  return new Function(
    'metaFetch', 'parseMetaError', 'isMetaRateLimitError', 'MetaSyncDeadlineError',
    `${compiled}\nreturn fetchMetaCollection`,
  )(
    metaFetch,
    async () => 'provider error',
    () => false,
    MetaSyncDeadlineError,
  )
}

test('D01 uses the previous completed Pacific local date across spring DST', () => {
  withFixedNow('2026-03-09T07:30:00Z', () => {
    assert.equal(incrementalMonthEnd(), '2026-03-08')
  })
})

test('D01 uses the previous completed Pacific local date across autumn DST', () => {
  withFixedNow('2026-11-02T07:30:00Z', () => {
    assert.equal(incrementalMonthEnd(), '2026-10-31')
    assert.equal(incrementalMonthBounds('2026-11'), null)
  })
})

test('D03 rejects malformed successful collection envelopes before processing or checkpointing', () => {
  const worker = read('../supabase/functions/meta-sync-worker/index.ts')
  const start = worker.indexOf('async function fetchMetaCollection')
  const end = worker.indexOf('/**', start)
  const fetchCollection = worker.slice(start, end)
  const parsedAt = fetchCollection.indexOf('const page = await res.json()')
  const malformedAt = fetchCollection.indexOf('returned a malformed collection data envelope.')
  const processedAt = fetchCollection.indexOf('await processPage')
  const checkpointedAt = fetchCollection.indexOf('await checkpoint')

  assert.ok(parsedAt >= 0)
  assert.ok(malformedAt > parsedAt)
  assert.ok(processedAt > malformedAt)
  assert.ok(checkpointedAt > malformedAt)
  assert.match(fetchCollection, /complete: false[\s\S]*retryable: false/)
})

test('D03 preserves empty valid collection envelopes as successful pages', () => {
  const worker = read('../supabase/functions/meta-sync-worker/index.ts')
  const start = worker.indexOf('async function fetchMetaCollection')
  const end = worker.indexOf('/**', start)
  const fetchCollection = worker.slice(start, end)

  assert.match(fetchCollection, /Array\.isArray\(page\.data\)/)
  assert.match(fetchCollection, /processPage\(page\.data\)/)
})

test('D03 collection fetch accepts only an array data field without checkpointing malformed pages', async () => {
  for (const malformed of [null, undefined, {}, [], { data: null }, { data: {} }, { data: 'not-an-array' }]) {
    let processed = 0
    let checkpointed = 0
    const fetchMetaCollection = loadFetchMetaCollection(async () => ({ ok: true, json: async () => malformed }))
    const result = await fetchMetaCollection(
      'https://graph.facebook.com/v25.0/page/posts', null, 'Facebook posts fetch', [],
      Date.now() + 60_000,
      async () => { processed++; return 0 },
      async () => { checkpointed++ },
    )
    assert.deepEqual(result, {
      pagesFetched: 1,
      complete: false,
      error: 'Facebook posts fetch returned a malformed collection data envelope.',
      retryable: false,
    })
    assert.equal(processed, 0)
    assert.equal(checkpointed, 0)
  }

  let processed = 0
  let checkpointed = 0
  const fetchMetaCollection = loadFetchMetaCollection(async () => ({ ok: true, json: async () => ({ data: [] }) }))
  const result = await fetchMetaCollection(
    'https://graph.facebook.com/v25.0/page/posts', null, 'Facebook posts fetch', [],
    Date.now() + 60_000,
    async items => { processed++; assert.deepEqual(items, []); return 0 },
    async (_cursor, complete) => { checkpointed++; assert.equal(complete, true) },
  )
  assert.equal(result.complete, true)
  assert.equal(processed, 1)
  assert.equal(checkpointed, 1)
})

test('D03 malformed page two preserves the last valid page checkpoint', async () => {
  const pages = [
    { data: [{ id: 'post-1' }], paging: { next: 'https://graph.facebook.com/v25.0/page/posts?after=cursor-1', cursors: { after: 'cursor-1' } } },
    {},
  ]
  const checkpoints = []
  const fetchMetaCollection = loadFetchMetaCollection(async () => ({ ok: true, json: async () => pages.shift() }))
  const result = await fetchMetaCollection(
    'https://graph.facebook.com/v25.0/page/posts', null, 'Facebook posts fetch', [],
    Date.now() + 60_000,
    async items => items.length,
    async (cursor, complete, postsSynced) => checkpoints.push({ cursor, complete, postsSynced }),
  )

  assert.equal(result.pagesFetched, 2)
  assert.equal(result.complete, false)
  assert.equal(result.retryable, false)
  assert.deepEqual(checkpoints, [{ cursor: 'cursor-1', complete: false, postsSynced: 1 }])
})

test('D03 malformed terminal results flow through the existing fenced failed checkpoint path', () => {
  const worker = read('../supabase/functions/meta-sync-worker/index.ts')
  assert.match(worker, /if \(!fbCollection\.complete\)[\s\S]*if \(fbCollection\.retryable\)[\s\S]*savePlatformState\('facebook', 'failed', null\)/)
  assert.match(worker, /if \(!igCollection\.complete\)[\s\S]*if \(igCollection\.retryable\)[\s\S]*savePlatformState\('instagram', 'failed', null\)/)
  assert.match(worker, /meta_sync_checkpoint_platform_terminal/)
})
