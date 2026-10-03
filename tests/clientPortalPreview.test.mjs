import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'

const clientA = '11111111-1111-4111-8111-111111111111'
const clientB = '22222222-2222-4222-8222-222222222222'
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('preview queries pin publication/client visibility and deny child reads when ownership is unavailable', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true } })
  try {
    const { supabase } = await server.ssrLoadModule('/src/lib/supabase.ts')
    const { listPreviewReports, getPreviewReport, listPreviewApprovals } = await server.ssrLoadModule('/src/lib/clientPortalPreview.ts')
    const calls = []
    let response = { data: null, error: null }
    const original = supabase.from
    supabase.from = table => {
      calls.push(['from', table])
      const chain = { then: resolve => Promise.resolve(response).then(resolve) }
      for (const method of ['select', 'eq', 'is', 'in', 'not', 'order', 'maybeSingle']) chain[method] = (...args) => { calls.push([method, ...args]); return chain }
      return chain
    }
    try {
      response = { data: [
        { id: 'a', client_id: clientA, status: 'published', platform: null },
        { id: 'b', client_id: clientB, status: 'published', platform: null },
        { id: 'draft', client_id: clientA, status: 'draft', platform: null },
      ], error: null }
      assert.deepEqual((await listPreviewReports(clientA)).data.map(row => row.id), ['a'])
      assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['eq', 'client_id', clientA])))
      assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['eq', 'status', 'published'])))
      calls.length = 0
      response = { data: null, error: null }
      assert.equal((await getPreviewReport(clientA, 'foreign-report')).data, null)
      assert.deepEqual(calls.filter(call => call[0] === 'from'), [['from', 'reports']])
      assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['eq', 'client_id', clientA])))
      calls.length = 0
      response = { data: null, error: { message: 'RLS/read unavailable' } }
      assert.equal((await getPreviewReport(clientA, 'report')).error.message, 'Published report unavailable.')
      assert.deepEqual(calls.filter(call => call[0] === 'from'), [['from', 'reports']])
      calls.length = 0
      await listPreviewApprovals(clientA)
      assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['eq', 'client_id', clientA])))
      assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['eq', 'client_approval_required', true])))
      assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['in', 'state', ['client_review', 'approved']])))
      assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['not', 'internal_approved_at', 'is', null])))
      assert.ok(!calls.some(call => ['insert', 'update', 'delete', 'upsert'].includes(call[0])))
    } finally { supabase.from = original }
  } finally { await server.close() }
})

test('server preview scope admits only authenticated manager/admin exact read actions; client override and writes denied', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true } })
  try {
    const { resolveLibraryReadScope } = await server.ssrLoadModule('/supabase/functions/client-onboarding/portal-preview-scope.ts')
    const actions = ['portal_library_load', 'portal_library_month', 'portal_library_access', 'portal_load', 'portal_download']
    for (const action of actions) {
      for (const role of ['admin', 'manager']) assert.deepEqual(resolveLibraryReadScope(`staff_preview_${action}`, { role, client_id: null }, clientA), { action, clientId: clientA })
      for (const role of ['client', 'staff', 'team', '', 'anonymous']) assert.equal(resolveLibraryReadScope(`staff_preview_${action}`, { role, client_id: clientA }, clientB), null)
      assert.equal(resolveLibraryReadScope(`staff_preview_${action}`, { role: 'admin', client_id: null }, 'not-a-uuid'), null)
      assert.deepEqual(resolveLibraryReadScope(action, { role: 'client', client_id: clientA }, undefined), { action, clientId: clientA })
      assert.equal(resolveLibraryReadScope(action, { role: 'client', client_id: clientA }, clientB), null)
    }
    for (const action of ['save', 'upload_init', 'staff_preview_save', 'staff_preview_portal_delete', 'staff_preview_portal_library_connect']) {
      assert.equal(resolveLibraryReadScope(action, { role: 'admin', client_id: null }, clientA), null)
    }
    const edge = read('../supabase/functions/client-onboarding/index.ts')
    const authIndex = edge.indexOf('const authorized = await getAuthorizedUser(service, request)\n  if (!authorized)')
    assert.ok(authIndex >= 0 && authIndex < edge.indexOf('const libraryScope = resolveLibraryReadScope'))
    assert.match(edge, /asset\.client_id !== libraryScope\.clientId/)
    assert.match(edge, /libraryScope\.clientId !== upload\.client_id/)
    assert.match(edge, /\.eq\('client_id', libraryScope\.clientId\)/)
  } finally { await server.close() }
})

test('strategy preview mirrors the frozen client publication, never the current editable amendment', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true } })
  try {
    const { supabase } = await server.ssrLoadModule('/src/lib/supabase.ts')
    const { getPreviewStrategy } = await server.ssrLoadModule('/src/lib/clientPortalPreview.ts')
    const calls = []
    let row = { client_id: clientA, strategy_month: '2026-10-01', workflow_status: 'draft', strategy_data: { direction: 'UNPUBLISHED' }, published_strategy_data: { direction: 'Published decision' }, published_at: '2026-10-01T12:00:00Z' }
    const original = supabase.from
    supabase.from = table => {
      calls.push(['from', table])
      const chain = { then: resolve => Promise.resolve({ data: row, error: null }).then(resolve) }
      for (const method of ['select', 'eq', 'not', 'maybeSingle']) chain[method] = (...args) => { calls.push([method, ...args]); return chain }
      return chain
    }
    try {
      const result = await getPreviewStrategy(clientA, '2026-10')
      assert.deepEqual(result.data.strategy_data, { direction: 'Published decision' })
      assert.doesNotMatch(JSON.stringify(result), /UNPUBLISHED/)
      assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['not', 'published_strategy_data', 'is', null])))
      assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['eq', 'client_id', clientA])))
      assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['eq', 'strategy_month', '2026-10-01'])))
      row = { ...row, published_strategy_data: null }
      assert.equal((await getPreviewStrategy(clientA, '2026-10')).data, null)
      row = { ...row, client_id: clientB, published_strategy_data: {} }
      assert.equal((await getPreviewStrategy(clientA, '2026-10')).data, null)
      row = { ...row, client_id: clientA, strategy_month: '2026-09-01' }
      assert.equal((await getPreviewStrategy(clientA, '2026-10')).data, null)
    } finally { supabase.from = original }
  } finally { await server.close() }
})

test('exact published report allowlist quarantines drafts/cross-client rows and strips staff evidence', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true } })
  try {
    const { previewClientId, projectPreviewReport, portalPreviewPath } = await server.ssrLoadModule('/src/lib/clientPortalPreview.ts')
    const row = { id: 'report-a', client_id: clientA, status: 'published', platform: null, period_start: '2026-09-01', period_end: '2026-10-01', published_at: '2026-10-02T12:00:00Z', report_title: 'Client A September', strategy_data: { private: 'PRIVATE' }, general_notes: 'PRIVATE', performance_comments: 'PRIVATE', created_by: 'PRIVATE', website_report_snapshot_id: 'PRIVATE' }
    const before = JSON.stringify(row)
    assert.equal(projectPreviewReport(row, clientB), null)
    assert.equal(projectPreviewReport({ ...row, status: 'draft' }, clientA), null)
    assert.equal(projectPreviewReport({ ...row, platform: 'facebook' }, clientA), null)
    const result = projectPreviewReport(row, clientA)
    assert.equal(result.id, 'report-a')
    assert.equal(result.strategy_data, null)
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE|client_id|general_notes|created_by|snapshot_id/)
    assert.equal(JSON.stringify(row), before)
    for (const role of ['client', 'staff', 'team', undefined]) assert.equal(previewClientId(role, clientA), null)
    assert.equal(previewClientId('manager', clientA), clientA)
    const target = new URL(portalPreviewPath(clientA, '/client/plan?tab=guidelines&month=2026-10&guide=exact-guide'), 'https://preview.invalid')
    assert.equal(target.pathname, '/admin/client-portal-preview')
    assert.equal(target.searchParams.get('client'), clientA)
    assert.equal(target.searchParams.get('area'), 'plan')
    assert.equal(target.searchParams.get('guide'), 'exact-guide')
    assert.equal(target.searchParams.get('month'), '2026-10')
  } finally { await server.close() }
})

test('shared client links stay in selected-client preview without replacing authentication or exposing a write control', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true } })
  try {
    const { ClientPortalContext } = await server.ssrLoadModule('/src/components/client/ClientPortalContext.ts')
    const { ClientPortalLink } = await server.ssrLoadModule('/src/components/client/ClientPortalLink.tsx')
    const render = value => renderToStaticMarkup(createElement(MemoryRouter, {}, createElement(ClientPortalContext.Provider, { value }, createElement(ClientPortalLink, { to: '/client/plan?month=2026-10' }, 'Plan'))))
    assert.match(render({ client: null }), /href="\/client\/plan\?month=2026-10"/)
    const html = render({ client: null, previewClientId: clientA })
    assert.match(html, /href="\/admin\/client-portal-preview/)
    assert.match(html, /area=plan/)
    assert.match(html, new RegExp(clientA))
    const preview = read('../src/pages/admin/ClientPortalPreview.tsx')
    assert.match(preview, /key=\{`\$\{client\.id\}:\$\{area\}`\}/)
    assert.doesNotMatch(preview, /AuthProvider|signIn|setSession|access_token|functions\.invoke|\.rpc\(/)
    const reviews = read('../src/pages/admin/ContentReviewsPage.tsx')
    assert.match(reviews, /canDecide=\{!readOnly && review\.state === 'client_review'\}/)
    assert.match(read('../src/components/content/ContentReviewCard.tsx'), /if \(!canDecide \|\| busy\) return/)
  } finally { await server.close() }
})
