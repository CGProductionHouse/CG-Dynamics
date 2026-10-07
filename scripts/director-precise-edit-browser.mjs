import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Actual editor and canonical update helper. Synthetic local storage only; all external traffic denied.
if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to approved local Playwright')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const fixture = {
  name: 'director-precise-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:director-precise') return '\0virtual:director-precise' },
  transform(_code, id) {
    const path = id.replaceAll('\\', '/')
    if (path.endsWith('/contexts/AuthContext.tsx')) return 'export function useAuth(){return {profile:{role:"admin",id:"synthetic-staff"}}}'
    if (path.endsWith('/lib/supabase.ts')) return 'export const supabase=window.__directorDb'
    if (path.endsWith('/pages/admin/CanonicalCreativeIntelligence.tsx')) return 'export default function Intelligence(){return null}'
    if (path.endsWith('/lib/planner.ts')) return 'export async function listMonthlyDeliverablesByMonth(){return {data:[],error:null}}'
  },
  load(id) {
    if (id !== '\0virtual:director-precise') return
    return `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';import'/src/index.css';
      const initial={id:'synthetic-video',client_id:'synthetic-client',content_guideline_id:'synthetic-guide',title:'Human chosen video',position:1,month:'2026-10-01',status:'draft',production_status:'planned',hook:'Original human hook',objective:'Explain verified service',script:'Original text-only script',shot_breakdown:'1. Door\\n2. Product',requirements:'15 seconds. Text-only. No spoken dialogue.',platform:'Instagram Reels',format:'text-only',cta:'Original human CTA',notes:'Trusted saved evidence receipt',updated_at:'2026-10-07T09:00:00.123456+00:00'};
      window.__read=()=>JSON.parse(localStorage.getItem('precise-video')||JSON.stringify(initial));window.__writes=[];
      window.__directorDb={auth:{getSession:async()=>({data:{session:{access_token:'synthetic-not-auth'}}})},from(table){
        if(table!=='content_guide_ideas')throw new Error('Unexpected table');const filters={};let patch;
        const query={update(value){patch=value;return query},eq(field,value){filters[field]=value;return query},select(){return query},async single(){
          const saved=window.__read();if(window.__race){saved.cta='Concurrent human CTA';saved.updated_at='2026-10-07T10:00:00Z';localStorage.setItem('precise-video',JSON.stringify(saved));window.__race=false}
          if(saved.id!==filters.id||saved.updated_at!==filters.updated_at)return{data:null,error:{code:'PGRST116'}};
          const updated={...saved,...patch,updated_at:'2026-10-07T09:00:01.123456+00:00'};localStorage.setItem('precise-video',JSON.stringify(updated));window.__writes.push({patch,filters});return{data:updated,error:null};}};return query;}};
      const Editor=(await import('/src/pages/admin/ContentGuidelineDocumentEditor.tsx')).default;
      const guideline={id:'synthetic-guide',client_id:'synthetic-client',title:'Saved 15-second brief',month:'2026-10-01',coverage_start:'2026-10-01',coverage_end:'2026-10-01',status:'draft'};
      function App(){const[saved,setSaved]=useState(window.__read());return React.createElement('main',{className:'mx-auto max-w-5xl min-w-0 p-4'},React.createElement(Editor,{guideline,run:{id:'synthetic-run'},videos:[saved],onChanged:()=>setSaved(window.__read())}))}
      createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(App)));`
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/__precise') return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:director-precise"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-director-precise-cache'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom'] },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture') },
  server: { host: '127.0.0.1', port: 53986, strictPort: true, hmr: false } })
let browser
try {
  await server.listen(); browser = await chromium.launch({ headless: true })
  for (const width of [1440, 375, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } }), errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await page.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.href === 'http://127.0.0.1:1/functions/v1/suggest-content-videos') {
        const body = route.request().postDataJSON()
        assert.equal(body.clientId, 'synthetic-client'); assert.equal(body.guidelineId, 'synthetic-guide')
        assert.deepEqual(body.videoIds, ['synthetic-video']); assert.deepEqual(body.targetFields, ['cta'])
        const saved = await page.evaluate(() => window.__read())
        return route.fulfill({ json: { developments: [{ videoId: saved.id, baseUpdatedAt: saved.updated_at,
          targetFields: ['cta'], cta: 'Ask about the verified service', script: '', shotBreakdown: '', requirements: '', visualNotes: '', notes: null }],
          context: { clientName: 'Synthetic client', developedCount: 1, requestedCount: 1 }, sources: {} } })
      }
      if (url.origin !== 'http://127.0.0.1:53986') { errors.push('Forbidden external request'); return route.abort() }
      return route.continue()
    })
    await page.goto('http://127.0.0.1:53986/__precise')
    const original = await page.evaluate(() => window.__read())
    await page.getByRole('button', { name: 'Propose CTA only', exact: true }).click()
    await page.getByText('Read the draft', { exact: true }).click()
    await page.locator('pre').filter({ hasText: 'Original human CTA' }).waitFor()
    assert.match(await page.locator('body').innerText(), /Proposed replacement · not saved/)
    assert.equal(await page.evaluate(() => window.__writes.length), 0)
    await page.screenshot({ path: join(tmpdir(), `cg-director-precise-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: 'Accept CTA only', exact: true }).click()
    await page.waitForFunction(() => window.__writes.length === 1)
    const stored = await page.evaluate(() => window.__read())
    for (const field of ['hook', 'script', 'shot_breakdown', 'requirements', 'platform', 'format', 'notes']) assert.equal(stored[field], original[field])
    assert.equal(stored.cta, 'Ask about the verified service')
    assert.deepEqual(await page.evaluate(() => window.__writes[0].patch), { cta: 'Ask about the verified service' })
    await page.reload()
    await page.getByRole('textbox', { name: /^Call to action/ }).waitFor()
    assert.equal(await page.getByRole('textbox', { name: /^Call to action/ }).inputValue(), stored.cta)
    await page.getByRole('button', { name: 'Propose CTA only', exact: true }).click()
    await page.getByRole('button', { name: 'Discard draft', exact: true }).click()
    assert.equal(await page.evaluate(() => window.__writes.length), 0, 'discard is read-only')
    await page.getByRole('button', { name: 'Propose CTA only', exact: true }).click()
    await page.evaluate(() => { window.__race = true })
    await page.getByRole('button', { name: 'Accept CTA only', exact: true }).click()
    await page.getByText(/This video changed or is no longer accessible/).waitFor()
    assert.equal(await page.evaluate(() => window.__read().cta), 'Concurrent human CTA')
    assert.equal(await page.evaluate(() => window.__writes.length), 0)
    assert.equal(await page.getByRole('button', { name: 'Discard draft', exact: true }).count(), 1, 'conflicted proposal remains inspectable')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px overflow`)
    assert.deepEqual(errors, []); await page.close()
    console.log(`PASS actual editor ${width}px: diff, CTA-only accept/reload, rejection, atomic concurrent conflict; synthetic local writes only`)
  }
} finally { await browser?.close(); await server.close() }
