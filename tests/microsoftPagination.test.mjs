import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fetchAllPages } from '../src/lib/paginatedQuery.ts'

test('fetchAllPages returns rows beyond the Supabase 1000-row response limit', async () => {
  const source = Array.from({ length: 2932 }, (_, index) => ({ id: index }))
  const calls = []
  const result = await fetchAllPages(async (from, to) => {
    calls.push([from, to])
    return { data: source.slice(from, to + 1), error: null }
  })

  assert.equal(result.error, null)
  assert.equal(result.data.length, 2932)
  assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]])
})

test('fetchAllPages fails closed without returning a partial data set', async () => {
  const result = await fetchAllPages(async (from, to) => {
    if (from >= 1000) return { data: null, error: { code: 'network', message: 'Page failed.' } }
    return {
      data: Array.from({ length: to - from + 1 }, (_, index) => ({ id: index })),
      error: null,
    }
  })

  assert.deepEqual(result.data, [])
  assert.equal(result.error?.message, 'Page failed.')
})

test('Microsoft target and audit history loaders use paginated reads', () => {
  const source = readFileSync(
    new URL('../src/lib/microsoftImportData.ts', import.meta.url),
    'utf8',
  )
  assert.match(source, /fetchAllPages\(\(from, to\) => supabase[\s\S]*?from\('planner_tasks'\)/)
  assert.match(source, /fetchAllPages\(\(from, to\) => supabase[\s\S]*?from\('monthly_deliverables'\)/)
  assert.match(source, /from\('microsoft_sync_run_items'\)[\s\S]*?\.range\(from, to\)/)
})

test('audit migration permits current reconciliation actions', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/20260725224500_microsoft_sync_audit_actions.sql', import.meta.url),
    'utf8',
  )
  assert.match(sql, /'link_existing'/)
  assert.match(sql, /'package_template_create'/)
  assert.match(sql, /validate constraint microsoft_sync_run_items_action_check/)
})
