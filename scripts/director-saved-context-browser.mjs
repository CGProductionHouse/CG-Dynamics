import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Actual staff editor, saved synthetic row. No login/provider/DB/write invocation.
if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to approved local Playwright')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const fixture = {
  name: 'director-saved-readonly-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:director-saved') return '\0virtual:director-saved' },
  transform(_code, id) {
    const path = id.replaceAll('\\', '/')
    if (path.endsWith('/contexts/AuthContext.tsx')) return 'export function useAuth(){return {profile:{role:"admin",id:"synthetic-staff"}}}'
    if (path.endsWith('/lib/supabase.ts')) return 'export const supabase={auth:{getSession:async()=>({data:{session:{access_token:"synthetic-fixture-not-a-real-credential"}}})}}'
    if (path.endsWith('/pages/admin/CanonicalCreativeIntelligence.tsx')) return 'export default function Intelligence(){return null}'
    if (path.endsWith('/lib/planner.ts')) return 'export async function listMonthlyDeliverablesByMonth(){return {data:[],error:null}}'
  },
  load(id) {
    if (id !== '\0virtual:director-saved') return
    return `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';
      import Editor from'/src/pages/admin/ContentGuidelineDocumentEditor.tsx';import'/src/index.css';
      const guideline={id:'synthetic-guideline-a',client_id:'synthetic-client-a',title:'Synthetic saved guideline',month:'2026-10-01',coverage_start:'2026-10-01',coverage_end:'2026-10-01',status:'draft',publish_to_client:false};
      const run={id:'synthetic-run',client_id:'synthetic-client-a',name:'Synthetic run'};
      const saved={id:'synthetic-video',guideline_id:guideline.id,title:'Human selected name',position:0,script:'Human script unchanged',objective:'Explain the real service',hook:'Human opening',month:'2026-10-01',deliverable_id:null,shot_breakdown:null,requirements:null,visual_notes:null,status:'draft',notes:'Angle: Human chosen angle\\nConfirm with client: Confirm service details\\nCG guidance: Reviewed proof guidance [card synthetic-card]\\nSource: Section 3 [source synthetic-source]\\nEvidence: source_backed; confidence: medium\\nDo not claim: No guaranteed results\\nCard observed revision: 2026-10-07T08:00:00Z\\n<script>window.injected=true</script> '+ 'https://untrusted.example/'.repeat(20)};
      saved.production_status='planned';
      function App(){const [other,setOther]=useState(false);window.depart=()=>setOther(true);return React.createElement('main',{className:'mx-auto max-w-5xl min-w-0 p-4'},React.createElement(Editor,{key:${process.env.CG_REPRO_UNKEYED === '1' ? 'undefined' : "other?'b':'a'"},guideline:other?{...guideline,id:'synthetic-guideline-b',client_id:'synthetic-client-b',title:'Other client'}:guideline,run,videos:other?[]:[JSON.parse(JSON.stringify(saved))],onChanged:()=>{throw new Error('Read-only fixture forbids writes')}}))}
      createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(App)));`
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/__director') return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:director-saved"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-director-browser-cache'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom'] },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture') },
  server: { host: '127.0.0.1', port: 53987, strictPort: true, hmr: false } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 375, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.href === 'http://127.0.0.1:1/functions/v1/suggest-content-videos') {
        const payload = route.request().postDataJSON()
        assert.equal(payload.clientId, 'synthetic-client-a')
        assert.equal(payload.guidelineId, 'synthetic-guideline-a')
        return route.fulfill({ json: { ideas: [{ title: 'Old client proposed idea', objective: 'Old-client objective', hook: 'Old hook', angle: 'Old angle', targetMonth: '2026-10', deliverableId: null, evidence: [] }], context: { clientName: 'Synthetic client A', coverageMonths: ['2026-10'], totalDeliverableSlots: 0 }, sources: { liveExternalResearch: [] } } })
      }
      if (new URL(route.request().url()).origin !== 'http://127.0.0.1:53987') { errors.push('Forbidden external request'); return route.abort() }
      return route.continue()
    })
    await page.goto('http://127.0.0.1:53987/__director')
    try { await page.getByText('Saved creative context', { exact: true }).click() }
    catch (error) { console.error(JSON.stringify({ errors, body: await page.locator('body').innerText() })); throw error }
    await page.getByText('Human chosen angle', { exact: false }).waitFor()
    assert.match(await page.locator('details').filter({ hasText: 'Saved creative context' }).innerText(), /synthetic-card|synthetic-source|No guaranteed results|not a new recommendation/)
    assert.equal(await page.getByPlaceholder('Enter the complete spoken and on-screen script...').inputValue(), 'Human script unchanged')
    assert.equal(await page.evaluate(() => window.injected), undefined)
    assert.equal(await page.locator('details').filter({ hasText: 'Saved creative context' }).locator('a').count(), 0)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px body overflow`)
    await page.screenshot({ path: join(tmpdir(), `cg-director-saved-${width}.png`), fullPage: true })
    await page.locator('details').filter({ hasText: 'Saved creative context' }).screenshot({ path: join(tmpdir(), `cg-director-context-${width}.png`) })
    await page.reload()
    await page.getByText('Saved creative context', { exact: true }).click()
    await page.getByText('Human chosen angle', { exact: false }).waitFor()
    await page.getByRole('button', { name: 'Plan video ideas', exact: true }).click()
    await page.getByText('Old client proposed idea', { exact: false }).waitFor()
    await page.evaluate(() => window.depart())
    await page.waitForFunction(() => document.querySelector('[aria-label="Content Guideline title"]')?.value === 'Other client')
    assert.equal(await page.getByText('Saved creative context', { exact: true }).count(), 0)
    assert.doesNotMatch(await page.locator('body').innerText(), /synthetic-card|Human chosen angle|Old client proposed idea|Old-client objective/)
    assert.deepEqual(errors, [])
    await page.close()
    console.log(`PASS saved-context actual editor ${width}px, reload, scope departure, escaped notes, no writes`)
  }
} finally { await browser?.close(); await server.close() }
