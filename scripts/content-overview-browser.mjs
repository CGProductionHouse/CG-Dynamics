import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Render the real staff overview with synthetic exact-client records only.
if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to a local Playwright module')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const fixture = {
  name: 'content-overview-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:content-overview' || id === 'virtual:content-data') return `\0${id}` },
  transform(code, id) {
    if (!id.replaceAll('\\', '/').endsWith('/pages/admin/ContentOverview.tsx')) return
    for (const path of ['../../lib/businessTime', '../../lib/contentWorkflowRules', '../../lib/videoPipelineRules', '../../components/ui/States', './contentGuidelineHelpers']) code = code.replaceAll(`'${path}'`, "'virtual:content-data'")
    return code
  },
  load(id) {
    if (id === '\0virtual:content-data') return `
      export const businessDateKey = () => '2026-10-08';
      export const CONTENT_RUN_STATUSES = ['planning','ready','completed'];
      export const VIDEO_PRODUCTION_STATUSES = ['not_shot'];
      export const VIDEO_STATUS_LABELS = {not_shot:'Not shot'};
      export const humanizeStatus = value => value;
      import React from 'react';
      export const EmptyState = ({title,message}) => React.createElement('p',null,title+' '+message);
    `
    if (id === '\0virtual:content-overview') return `
      import React from 'react'; import { createRoot } from 'react-dom/client';
      import { MemoryRouter } from 'react-router-dom';
      import ContentOverview from '/src/pages/admin/ContentOverview.tsx'; import '/src/index.css';
      const runs = Array.from({length:7}, (_,index) => ({id:'run-'+index,name:'Exact Client run '+(index+1),client_id:'client-1',client_name:'Exact Client',run_date:'2026-10-'+String(8+index).padStart(2,'0'),status:'planning',lead_name:null,lead_user_id:null,helper_names:[],updated_at:'2026-10-08'}));
      createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,null,React.createElement(ContentOverview,{clients:[{id:'client-1',name:'Exact Client'}],staff:[],runs,documents:[],onOpenRun:()=>{},onOpenGuideline:()=>{},onOpenPipeline:()=>{},onOpenRuns:()=>{document.body.dataset.openRuns='yes'},onOpenGuidelines:()=>{}})));
    `
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/__content-overview') return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:content-overview"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-content-overview-cache'), optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom'] }, server: { host: '127.0.0.1', port: 53995, strictPort: true, hmr: false } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('http://127.0.0.1:53995/__content-overview')
    await page.getByRole('heading', { name: 'Needs attention' }).waitFor()
    assert.equal(await page.getByRole('heading', { name: 'Draft guidelines' }).count(), 0, 'empty draft panel hidden')
    assert.equal(await page.getByRole('heading', { name: 'Published guidelines' }).count(), 0, 'empty published panel hidden')
    assert.equal(await page.getByText('Exact Client run 1', { exact: true }).count(), 1, 'action item is not repeated in upcoming runs')
    await page.screenshot({ path: join(tmpdir(), `cg-content-overview-${width}.png`), fullPage: true })
    if (width === 375) {
      assert.equal(await page.getByRole('button', { name: 'Filters' }).getAttribute('aria-expanded'), 'false')
      await page.getByRole('button', { name: 'Filters' }).click()
      assert.ok(await page.getByRole('combobox', { name: 'Client' }).isVisible())
    }
    assert.ok(await page.getByRole('button', { name: 'View all 7 →' }).isVisible())
    await page.getByRole('button', { name: 'View all 7 →' }).click()
    assert.equal(await page.evaluate(() => document.body.dataset.openRuns), 'yes')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px body overflow`)
    assert.deepEqual(errors, [])
    await page.close()
    console.log(`PASS ${width}px: action-first Content overview, all-runs path, no overflow or runtime error`)
  }
} finally { if (browser) await browser.close(); await server.close() }
