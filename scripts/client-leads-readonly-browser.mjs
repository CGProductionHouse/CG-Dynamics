import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Approved existing local Playwright module required')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const clientId = '11111111-1111-4111-8111-111111111111'
const fixture = { name: 'lead-read-truth', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:lead-read-truth') return '\0virtual:lead-read-truth' },
  load(id) {
    if (id !== '\0virtual:lead-read-truth') return
    return `import React from 'react';import{createRoot}from'react-dom/client';
      import{LeadInbox}from'/src/pages/client/ClientLeadsPage.tsx';import'/src/index.css';
      const preview=new URLSearchParams(location.search).get('scope')==='preview';
      createRoot(document.getElementById('root')).render(React.createElement('main',{className:'mx-auto max-w-6xl p-4 sm:p-8'},
        React.createElement(LeadInbox,preview?{clientId:'${clientId}',preview:{clientName:'Synthetic A'}}:{})));`
  },
  configureServer(server) { server.middlewares.use((req, res, next) => {
    if (req.url?.split('?')[0] !== '/__lead-read-truth') return next()
    res.setHeader('Content-Type', 'text/html')
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:lead-read-truth"></script></body></html>')
  }) },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-lead-read-truth-cache'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime'] },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture') },
  server: { host: '127.0.0.1', port: 53993, strictPort: true, hmr: false } })
let browser
try {
  await server.listen(); browser = await chromium.launch({ headless: true })
  for (const scope of ['client', 'preview']) for (const width of [1440, 375, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    let mode = 'missing', inboxReads=0
    await page.route('**/*', route => {
      const request = route.request(), url = new URL(request.url()), rpc = url.pathname.split('/').at(-1)
      if (url.origin === 'http://127.0.0.1:53993') return route.continue()
      assert.equal(url.origin, 'http://127.0.0.1:1', 'No external connection')
      assert.ok(['website_lead_inbox', 'website_lead_metrics', 'website_lead_breakdown'].includes(rpc), 'Only existing read RPCs')
      const args = request.postDataJSON()
      assert.equal(args.p_client_id, scope === 'preview' ? clientId : null, 'Exact preview or server-pinned client')
      if (rpc === 'website_lead_inbox') {
        inboxReads++
        if (mode === 'transport') return route.abort('connectionfailed')
        if (mode === 'missing') return route.fulfill({ json: null })
        if (mode === 'bad-date') return route.fulfill({ json: [{ enquiry_id: 'a', receipt_id: 'r', accepted_at: 'invalid',
          website_editor_website_id: 'site', form_schema_key: 'contact', form_schema_version: 1,
          status: 'new', quality: null, poor_reason: null, poor_note: null, fields: [], attribution: {} }] })
        return route.fulfill({ json: [] })
      }
      if (rpc === 'website_lead_metrics') {
        const metrics = { clientId, state: 'available', period: { from: args.p_from, to: args.p_to, timezone: 'Africa/Johannesburg' },
          total: 0, new: 0, contacted: 0, qualified: 0, won: 0, closedLost: 0, lost: 0, good: 0, poor: 0, unreviewed: 0, qualificationRate: null }
        return route.fulfill({ json: mode === 'bad-metrics' ? { ...metrics, total: 'unknown', qualified: 99 } : metrics })
      }
      return route.fulfill({ json: { clientId, state: 'available', dimension: args.p_dimension, minSample: 5, rows: [], otherRows: 0 } })
    })
    for (const nextMode of ['missing', 'bad-date', 'transport', 'zero', 'bad-metrics']) {
      mode = nextMode
      await page.goto(`http://127.0.0.1:53993/__lead-read-truth?scope=${scope}`)
      if (['missing', 'bad-date', 'transport'].includes(mode)) {
        await page.getByRole('heading', { name: 'Your leads could not be loaded', exact: true }).waitFor()
        assert.equal(await page.getByText('No website enquiries yet.', { exact: false }).count(), 0, 'Failure is never an empty inbox')
        const beforeRetry=inboxReads, retryUrl=page.url()
        await page.evaluate(()=>{window.fixtureRetryMarker='kept'})
        mode='zero'
        await page.getByRole('button',{name:'Try again',exact:true}).click()
        await page.getByRole('heading',{name:'Leads',exact:true}).waitFor()
        await page.getByText('No website enquiries were received in this period.',{exact:true}).first().waitFor()
        assert.equal(inboxReads,beforeRetry+1,'One explicit inbox retry; no automatic polling')
        assert.equal(await page.evaluate(()=>window.fixtureRetryMarker),'kept','Read retry does not reload the app')
        assert.equal(page.url(),retryUrl)
      } else {
        await page.getByRole('heading', { name: 'Leads', exact: true }).waitFor()
        if (mode === 'bad-metrics') {
          await page.getByText('Lead metrics could not be loaded.', { exact: true }).waitFor()
          assert.equal(await page.getByText('NaN', { exact: true }).count(), 0)
          assert.equal(await page.getByText('99', { exact: true }).count(), 0)
        } else await page.getByText('No website enquiries were received in this period.', { exact: true }).first().waitFor()
      }
      assert.equal(await page.getByRole('button', { name: 'Save progress', exact: true }).count(), 0)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px overflow`)
      assert.deepEqual(errors, [])
    }
    console.log(`PASS ${scope} ${width}px: missing/malformed/rejected reads are errors, verified zero stays zero, exact read-only RPC scope, no crash/overflow`)
    await page.close()
  }
} finally { if (browser) await browser.close(); await server.close() }
