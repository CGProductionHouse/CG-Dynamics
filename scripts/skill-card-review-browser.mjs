import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Actual review screens + actual canonical adapters. Synthetic in-memory DB only.
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const fixture = {
  name: 'local-review-revision', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:review-revision') return '\0virtual:review-revision' },
  transform(_, id) {
    const path = id.replaceAll('\\', '/')
    if (path.endsWith('/lib/supabase.ts')) return 'export const supabase=window.__reviewDb'
    if (path.endsWith('/contexts/AuthContext.tsx')) return "export function useAuth(){return {profile:{role:'admin',is_active:true,full_name:'Synthetic Admin'}}}"
  },
  load(id) {
    if (id !== '\0virtual:review-revision') return
    return `import React,{useState}from'react';import{createRoot}from'react-dom/client';import'/src/index.css';
      const hash='a'.repeat(64);const initial={id:'synthetic-card',slug:'synthetic',title:'Exact reviewed creative guidance',category:'Marketing Library',subcategory:null,status:'needs_review',knowledge_layer:'universal_principle',principle:'Use verified proof',summary:'An exact supported creative decision',why_it_matters:null,how_to_apply:'[]',agent_instructions:'[]',safe_claim:'No forecast',prohibited_overclaim:'No guaranteed growth',jurisdiction:null,evidence_label:'proven_principle',confidence_level:'medium',source_reference:'Section 2',reference_state:null,relevant_agents:['creative_director'],resolved_agents:['creative_director'],unrecognised_agents:[],relevant_industries:[],client_specific:false,active_client_id:null,source_id:'synthetic-source',source_name:'Synthetic reviewed source',source_trust_tier:'tier_1_primary',last_reviewed:null,review_expires_at:null,review_count:0,approved_review_count:0,blockers:['No approved review for the current content revision. Reload and review the card.'],ready_to_activate:false,priority_group:2,content_hash:hash,reviewed_content_hash:null};
      window.__card={...initial};window.__reviews=[];window.__calls=[];window.__writes=[];
      window.__reviewDb={rpc:async(name,input)=>{
        if(name==='skill_card_review_queue')return{data:[{...window.__card}],error:null};
        if(name!=='skill_card_record_review')throw new Error('Unexpected RPC '+name);
        window.__calls.push({name,input});if(window.__race){window.__card.content_hash='b'.repeat(64);window.__race=false}
        if(input.p_expected_content_hash!==window.__card.content_hash)return{data:null,error:{message:'Skill Card changed. Reload and review the current content.'}};
        window.__writes.push(input);window.__card={...window.__card,status:'reviewed',last_reviewed:'2026-10-07',reviewed_content_hash:window.__card.content_hash,blockers:[],ready_to_activate:true};
        window.__reviews=[{id:'synthetic-review',skill_card_id:'synthetic-card',reviewed_by:'Synthetic Admin',reviewer_profile_id:'synthetic-admin',review_status:'approved',review_kind:'content_review',reviewed_content_hash:window.__card.content_hash,reviewed_at:'2026-10-07T10:00:00Z',review_notes:input.p_note}];return{data:{...window.__card},error:null};
      },from(table){if(table!=='skill_card_reviews')throw new Error('Unexpected table');const q={select(){return q},eq(){return q},order(){return Promise.resolve({data:window.__reviews,error:null})}};return q}};
      const Modern=(await import('/src/pages/admin/SkillCardReviewPage.tsx')).default;
      const Legacy=(await import('/src/pages/admin/MarketingLibraryReviewSection.tsx')).default;
      function App(){const[card,setCard]=useState({...window.__card});return React.createElement('main',{className:'mx-auto max-w-6xl min-w-0 p-3'},location.search.includes('legacy')?React.createElement(Legacy,{card,source:{source_name:'Synthetic reviewed source',trust_tier:'tier_1_primary'},onChanged:()=>setCard({...window.__card})}):React.createElement(Modern))}
      createRoot(document.getElementById('root')).render(React.createElement(App));`
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith('/__review')) return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:review-revision"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-card-review-cache'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime'] },
  server: { host: '127.0.0.1', port: 53987, strictPort: true, hmr: false } })
let browser
try {
  await server.listen(); browser = await chromium.launch({ headless: true })
  for (const mode of ['modern', 'legacy']) for (const width of [1440, 375, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } }), errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await page.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:53987' ? route.continue() : route.abort())
    const open = async () => {
      await page.goto('http://127.0.0.1:53987/__review?' + mode)
      if (mode === 'modern') await page.getByRole('button', { name: /Exact reviewed creative guidance/ }).last().click()
      await page.locator('textarea').last().fill('Reviewed exact displayed content')
    }
    await open(); await page.evaluate(() => { window.__race = true })
    await page.getByRole('button', { name: 'Approve', exact: true }).click()
    await page.getByText('Skill Card changed. Reload and review the current content.', { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => window.__writes.length), 0)
    assert.equal(await page.locator('textarea').last().inputValue(), 'Reviewed exact displayed content')
    await page.screenshot({ path: join(tmpdir(), `cg-card-review-${mode}-${width}.png`), fullPage: true })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await open(); await page.getByRole('button', { name: 'Approve', exact: true }).click()
    await page.waitForFunction(() => window.__writes.length === 1)
    const writes = await page.evaluate(() => window.__writes)
    assert.equal(writes[0].p_expected_content_hash, 'a'.repeat(64)); assert.equal(writes[0].p_card_id, 'synthetic-card')
    assert.equal(writes[0].p_decision, 'approved'); assert.equal(writes[0].reviewed_by, undefined)
    assert.deepEqual(errors, []); await page.close()
    console.log(`PASS ${mode} ${width}px: exact revision, stale conflict/no write, retained note, human approve/no activate, layout/runtime`)
  }
} finally { await browser?.close(); await server.close() }
