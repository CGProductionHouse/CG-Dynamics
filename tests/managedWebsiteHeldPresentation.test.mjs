import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

let server, View, fleet
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, esbuild: { jsx: 'automatic' }, define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture'),
  } })
  View = (await server.ssrLoadModule('/src/pages/client/ClientReportView.tsx')).ClientReportView
  fleet = await server.ssrLoadModule('/src/lib/cgWebsiteFleet.ts')
})
after(async () => server?.close())
const jfj = 'aece5a86-c962-4234-a1fe-7904c20f03ff'
function render(id, client = { id, name: 'JFJ Electrical' }) {
  const report = { id: 'local-report', client_id: id, status: 'published', period_start: '2026-09-01', period_end: '2026-09-23', posts: [], report_title: 'Local report', summary: null }
  const before = JSON.stringify(report)
  const html = renderToStaticMarkup(createElement(View, { report, client, googleAds: null, googleAdsState: 'unmapped', googleAdsError: null, initialTab: 'web', onTabChange: () => {} }))
  assert.equal(JSON.stringify(report), before)
  return html
}

test('exact known CG maintenance with held reporting never sells the owned website again', () => {
  for (const html of [render(jfj), render(jfj, null)]) {
    assert.match(html, /Website Performance/)
    assert.match(html, /CG-built website is maintained by CG/)
    assert.match(html, /Unavailable|unavailable/)
    assert.match(html, /No figures are inferred or shown as zero/)
    assert.doesNotMatch(html, /Explore adding this service|Discuss my package on WhatsApp|A premium CG-built website|>0<|aece5a86|provider|token/)
  }
  assert.equal(fleet.cgManagedWebsiteForClient(jfj), null, 'maintenance does not authorize a reporting mapping')
})

test('existing four guarded sites and unrelated exact identities retain separate presentation truth', () => {
  for (const id of ['ed7aa1ae-de21-4151-a8f9-54796b234c1f', 'd53d8e62-9e6a-4bb9-be3f-554f40942d45', 'cdb11a82-339e-4b46-9b09-bde1a23efeaf', 'fd16ebae-a50b-4920-afe0-94c2631f8f06']) {
    const html = render(id)
    assert.match(html, new RegExp(fleet.cgManagedWebsiteForClient(id).canonicalHost.replaceAll('.', '\\.')))
    assert.match(html, /no approved website snapshot/)
    assert.doesNotMatch(html, /Explore adding this service|Discuss my package on WhatsApp/)
  }
  for (const id of ['unknown-id', 'JFJ Electrical', '']) {
    const html = render(id)
    assert.match(html, /A premium CG-built website/)
    assert.match(html, /check your existing scope/)
    assert.doesNotMatch(html, /CG-built website is maintained by CG/)
  }
})
