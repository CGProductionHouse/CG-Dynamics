import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { execFileSync } from 'node:child_process'

test('actual client approval rendering separates pending decisions from approved history', async () => {
  const plugins = process.env.CG_REPRODUCE_APPROVAL_BASELINE === '1' ? [{ name: 'accepted-main-reproduction', enforce: 'pre', transform(_code, id) {
    const path = id.replaceAll('\\', '/')
    const file = ['/src/pages/admin/ContentReviewsPage.tsx', '/src/components/content/ContentReviewCard.tsx'].find(file => path.endsWith(file))
    if (file) return execFileSync('git', ['show', `ef6e9563ccb5c1045beb84d6df2fed66a4230b6d:${file.slice(1)}`], { encoding: 'utf8' }).replace('function ClientApprovalsView(', 'export function ClientApprovalsView(')
  } }] : []
  const server = await createServer({ configFile: false, plugins, server: { middlewareMode: true, hmr: false }, esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true } })
  try {
    const { ClientApprovalsView } = await server.ssrLoadModule('/src/pages/admin/ContentReviewsPage.tsx')
    const { ContentReviewCard } = await server.ssrLoadModule('/src/components/content/ContentReviewCard.tsx')
    const row = { id: 'fixture', title: 'Reviewed delivery video', asset_path: 'fixture/test.mp4', media_type: 'video/mp4', caption: 'Exact delivery process.', channels: ['facebook'], scheduled_at: '2026-10-12T10:00:00Z', state: 'approved' }
    const render = reviews => renderToStaticMarkup(createElement(MemoryRouter, {}, createElement(ClientApprovalsView, { reviews, loading: false, error: null, readOnly: true, onChanged() { throw new Error('No decision allowed') } })))
    const approved = render([row])
    assert.match(approved, /Nothing waiting/)
    assert.doesNotMatch(approved, /1 item waiting|Publish manually|connected channel|Ready to schedule/)
    assert.match(approved, /Your approval is recorded/)
    assert.match(approved, /Approved content/)
    const mixed = render([row, { ...row, id: 'pending', state: 'client_review' }])
    assert.match(mixed, /1 item waiting/)
    assert.doesNotMatch(mixed, /2 items waiting/)
    assert.doesNotMatch(mixed, /<button[^>]*>Approve|<button[^>]*>Request changes/)
    assert.match(render([]), /Nothing waiting/)
    assert.match(render([]), /You’re up to date/)
    const unavailable = renderToStaticMarkup(createElement(MemoryRouter, {}, createElement(ClientApprovalsView, { reviews:[row], loading:false, error:'PRIVATE', onChanged() {} })))
    assert.match(unavailable, /Approvals could not be loaded/)
    assert.doesNotMatch(unavailable, /Nothing waiting|PRIVATE|Reviewed delivery video/)
    const staff = renderToStaticMarkup(createElement(ContentReviewCard, { review:row, staffView:true, canDecide:false, onChanged() {} }))
    assert.match(staff, /Publish manually through the connected channel/)
  } finally { await server.close() }
})
