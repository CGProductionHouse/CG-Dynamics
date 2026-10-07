import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Approved local Playwright required')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const fixture = {
  name: 'integrations-unavailable-readonly', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:integrations-unavailable') return '\0virtual:integrations-unavailable' },
  transform(_code, id) {
    const path = id.replaceAll('\\', '/')
    if (path.endsWith('/contexts/AuthContext.tsx')) return "export function useAuth(){return{profile:{id:'fixture-admin',role:'admin'}}}"
    const preamble = "const scenario=new URLSearchParams(location.search).get('case');const bad=['error','rejected','malformed'].includes(scenario);"
    if (path.endsWith('/lib/supabase.ts')) return preamble + `
      window.fixtureWrites=0;const forbidden=()=>{window.fixtureWrites++;throw new Error('No mutation permitted')};
      const query={select(){return this},eq(){return this},then(resolve,reject){
        const result=scenario==='rejected'?Promise.reject(new Error('Synthetic read rejection')):Promise.resolve(
          scenario==='connected'||bad?{data:null,error:{message:'Synthetic read unavailable'}}:
          {data:scenario==='inventory'?[{id:'asset-fixture',client_id:'client-fixture',facebook_page_id:'page-fixture',instagram_account_id:null}]:[],error:null});
        return result.then(resolve,reject);
      }};
      const safeQuery=new Proxy(query,{get(target,name){return name in target?target[name]:forbidden}});
      export const supabase={from:()=>safeQuery,functions:{invoke:async name=>{
        if(name!=='meta-connection-status')return forbidden();
        if(scenario==='rejected')throw new Error('Synthetic read rejection');
        if(scenario==='error')return{data:null,error:{message:'Synthetic unavailable'}};
        return{data:{ok:true,connected:scenario==='malformed'?'yes':scenario!=='disconnected',assetHealth:null},error:null};
      }}};`
    if (path.endsWith('/lib/googleAds.ts')) return preamble + "export async function getGoogleAdsWorkspace(){if(bad)throw new Error('Synthetic unavailable');return{accounts:scenario==='disconnected'?[]:[{}],accountLinks:scenario==='connected'||scenario==='inventory'?[{active:true,clientId:'client-fixture'}]:[],campaignLinks:[]}}"
    if (path.endsWith('/lib/microsoftImportData.ts')) return preamble + "export async function getMicrosoftConnectionStatus(){if(scenario==='rejected')throw new Error('Synthetic read rejection');return bad?{data:null,error:'Synthetic unavailable'}:{data:{connected:scenario!=='disconnected',sources:scenario==='connected'||scenario==='inventory'?[{}]:[],freshness:null},error:null}}"
    if (path.endsWith('/lib/tiktok.ts')) return preamble + "export async function getTiktokConnectionQueue(){if(bad)throw new Error('Synthetic unavailable');const n=scenario==='connected'||scenario==='inventory'?1:0;return{ok:true,summary:{activeClients:n,eligible:n,excluded:0,unresolved:0,connected:n,reconnectRequired:0,notConnected:0}}}"
  },
  load(id) {
    if (id === '\0virtual:integrations-unavailable') return "import React from'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';import Page from'/src/pages/admin/IntegrationsPage.tsx';import'/src/index.css';createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(Page)));"
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith('/__integrations-unavailable?')) return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@id/virtual:integrations-unavailable"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-integrations-unavailable-cache'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom'] },
  server: { host: '127.0.0.1', port: 53993, strictPort: true, hmr: false } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  for (const width of [375, 390, 430, 1440]) {
    for (const scenario of ['error', 'rejected', 'malformed', 'disconnected', 'connected', 'inventory', 'zero']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/*', route => {
        const request = route.request()
        if (new URL(request.url()).origin !== 'http://127.0.0.1:53993' || request.method() !== 'GET') { errors.push('Non-local/read request'); return route.abort() }
        return route.continue()
      })
      await page.goto(`http://127.0.0.1:53993/__integrations-unavailable?case=${scenario}`)
      await page.getByRole('heading', { name: 'Integrations', exact: true }).waitFor()
      await page.getByText('Checking...', { exact: true }).first().waitFor({ state: 'hidden' })
      const text = await page.locator('body').innerText()
      if (['error', 'rejected', 'malformed'].includes(scenario)) {
        assert.equal(await page.getByText('Unavailable', { exact: true }).count(), 4)
        assert.doesNotMatch(text, /Not connected|0 Planner|Set up Meta|Set up Google Ads/)
      } else if (scenario === 'disconnected') {
        assert.equal(await page.getByText('Not connected', { exact: true }).count(), 4)
      } else {
        assert.ok(await page.getByText('Connected', { exact: true }).count() >= 3)
        assert.doesNotMatch(text, /PASS/)
        if (scenario === 'connected') assert.match(text, /linked-client inventory is unavailable/)
        if (scenario === 'inventory') assert.match(text, /1 clients · 1 assets · 1 mapped platforms/)
        if (scenario === 'zero') assert.match(text, /0 Planner and Outlook sources/)
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      assert.equal(await page.evaluate(() => window.fixtureWrites), 0)
      assert.deepEqual(errors, [])
      if (scenario === 'error') await page.screenshot({ path: join(tmpdir(), `cg-integrations-unavailable-${width}.png`), fullPage: true })
      await page.close()
      console.log(`PASS actual Integrations ${width}px ${scenario}; unavailable/disconnected/count/freshness truth, no errors/overflow/writes`)
    }
  }
} finally { await browser?.close(); await server.close() }
