import assert from 'node:assert/strict'
import { readFileSync, mkdirSync } from 'node:fs'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Actual review/card/panel/confirmation/library/CSS; synthetic IO only.
// Never connects to a signed-in browser, real provider or Supabase instance.
if (!process.env.CG_PLAYWRIGHT_MODULE) throw Error('Approved local Playwright module required')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const origin = 'http://127.0.0.1:54010'
const reviewId = '11111111-1111-4111-8111-111111111111', clientId = '22222222-2222-4222-8222-222222222222'
const jobId = '33333333-3333-4333-8333-333333333333', authorizationId = '44444444-4444-4444-8444-444444444444'
const fixture = {
  name: 'publication-review-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:publication-app') return '\0virtual:publication-app' },
  load(id) {
    if (id.replaceAll('\\', '/').endsWith('/src/lib/supabase.ts')) return `
      window.publicationCalls=[];
      const preview={ok:true,preview:{target:{reviewVersionId:'${reviewId}',clientId:'${clientId}',accountId:'12345',route:'facebook_page'},platform:'facebook',mediaType:'image/png',caption:'Exact synthetic approved caption',assetSha256:'a'.repeat(64),fingerprint:'b'.repeat(64),scheduledAt:'2026-11-17T08:00:00Z'}};
      export const supabase={
        storage:{from(){return{async createSignedUrl(){return{data:{signedUrl:'/tests/fixtures/publication-baseline-320.jpg'},error:null}}}}},
        from(){const q={select(){return q},eq(){return q},order(){return Promise.resolve({data:[],error:null})}};return q},
        functions:{async invoke(name,{body}){
          window.publicationCalls.push({name,body});
          if(body.action==='inspect')return{data:{ok:true,inspection:{contract:'facebook_publication_readiness_v1',reviewId:'${reviewId}',clientId:'${clientId}',accountId:'12345',accountName:'Synthetic verified Page',scheduledAt:'2026-11-17T08:00:00Z',checkedAt:new Date().toISOString(),assetSha256:'a'.repeat(64),canConfirm:false,canPublish:false,checks:[
            {key:'account',status:'pass',code:null},{key:'image',status:'pass',code:null},
            {key:'teams',status:window.inspectionAllPass?'pass':'unavailable',code:window.inspectionAllPass?null:'FRESH_TEAMS_EVIDENCE_REQUIRED'},
            {key:'time',status:'pass',code:null},{key:'release',status:window.inspectionAllPass?'pass':'blocked',code:window.inspectionAllPass?null:'PUBLISHING_DISABLED'}]}},error:null};
          if(body.action==='preview'){
            if(window.deferPreview)return await new Promise(resolve=>{window.resolvePreview=()=>resolve({data:preview,error:null})});
            return{data:preview,error:null};
          }
          if(body.action==='confirm')return{data:{ok:true,publication:{jobId:'${jobId}',authorizationId:'${authorizationId}',fingerprint:'b'.repeat(64),status:'queued',state:'queued'}},error:null};
          if(body.action==='revoke')return{data:{ok:true,publication:{jobId:'${jobId}',state:'cancelled',authorizationRevoked:true,providerMayHaveStarted:false}},error:null};
          if(body.action!=='status')throw Error('Unexpected synthetic action');
          return{data:{ok:true,status:{reviewId:'${reviewId}',clientId:'${clientId}',canAuthorize:false,items:[{jobId:'${jobId}',platform:'facebook',accountId:'12345',accountLabel:'Synthetic exact Page',scheduledAt:'2026-11-17T08:00:00Z',state:window.publicationState??'queued',authorizationState:'recorded',providerMayHaveStarted:window.providerStarted??false,postUrl:null,errorCode:window.publicationError??null}]}},error:null};
        }},
      };`
    if (id !== '\0virtual:publication-app') return
    return `import React,{useState}from'react';import{createRoot}from'react-dom/client';
      import{ContentReviewCard}from'/src/components/content/ContentReviewCard.tsx';import'/src/index.css';
      const query=new URLSearchParams(location.search),role=query.get('role')||'manager';
      function App(){const[review,setReview]=useState({id:'${reviewId}',client_id:'${clientId}',deliverable_id:'${jobId}',title:'Synthetic review',asset_path:'fixture/approved.png',media_type:query.get('media')||'image/png',caption:'Synthetic approved caption',channels:[query.get('channel')||'facebook'],state:query.get('state')||'approved',scheduled_at:'2026-11-17T08:00:00Z'});
        window.changeReview=change=>setReview(current=>({...current,...change}));
        return React.createElement('main',{className:'mx-auto max-w-3xl p-4'},React.createElement(ContentReviewCard,{review,canDecide:false,onChanged(){},staffView:role!=='client',canManagePublishing:role==='manager'}))}
      createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(App)));`
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!/^\/review([/?]|$)/.test(req.url ?? '')) return next()
      res.setHeader('Content-Type', 'text/html')
      res.end(readFileSync('index.html', 'utf8').replace('/src/main.tsx', '/@id/virtual:publication-app'))
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()],
  cacheDir: join(tmpdir(), 'cg-publication-review-vite'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime'] },
  define: { 'import.meta.env.VITE_SOCIAL_PUBLISHING_PREVIEW': JSON.stringify('true') },
  server: { host: '127.0.0.1', port: 54010, strictPort: true, hmr: false },
})
const output = join(tmpdir(), 'cg-publication-review-browser')
mkdirSync(output, { recursive: true })
let browser
let cases = 0
try {
  // Installed Chrome in a NEW temporary automation profile; no userDataDir,
  // remote-debugging port, persistent profile or existing-session attachment.
  await server.listen(); browser = await chromium.launch({ headless: true, channel: 'chrome' })
  for (const width of [375, 390, 430, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } }), errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
    for (const role of ['client', 'staff']) {
      await page.goto(`${origin}/review?role=${role}`)
      await page.getByRole('heading', { name: 'Synthetic review' }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Publishing status', exact: true }).count(), 0)
      assert.equal(await page.evaluate(() => window.publicationCalls.length), 0)
      cases++
    }
    for (const query of ['state=superseded', 'channel=instagram', 'channel=tiktok', 'channel=linkedin', 'channel=manual', 'media=image/jpeg']) {
      await page.goto(`${origin}/review?${query}`)
      await page.getByRole('button', { name: 'Publishing status', exact: true }).click()
      await page.getByText('Synthetic exact Page', { exact: true }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Prepare Facebook schedule', exact: true }).count(), 0)
      assert.equal(await page.getByRole('button', { name: 'Check Facebook readiness', exact: true }).count(), 0)
      await page.getByRole('button', { name: 'Stop queued publishing', exact: true }).click()
      assert.equal(await page.evaluate(() => window.publicationCalls.filter(c => c.body.action === 'revoke').length), 0)
      await page.getByRole('button', { name: 'Keep current authority', exact: true }).click()
      cases++
    }
    await page.goto(`${origin}/review`)
    await page.getByRole('button', { name: 'Publishing status', exact: true }).click()
    await page.getByRole('button', { name: 'Prepare Facebook schedule', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm this Facebook schedule', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    assert.equal(await page.evaluate(() => window.publicationCalls.filter(c => c.body.action === 'confirm').length), 0)
    await page.getByRole('button', { name: 'Prepare Facebook schedule', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm this Facebook schedule', exact: true }).click()
    await page.getByText(/Confirmation recorded/).waitFor()
    assert.equal(await page.evaluate(() => window.publicationCalls.filter(c => c.body.action === 'confirm').length), 1)
    await page.evaluate(() => { window.deferPreview = true })
    await page.getByRole('button', { name: 'Prepare Facebook schedule', exact: true }).click()
    await page.waitForFunction(() => typeof window.resolvePreview === 'function')
    await page.evaluate(() => window.changeReview({ state: 'superseded' }))
    await page.getByRole('button', { name: 'Publishing status', exact: true }).click()
    await page.evaluate(() => window.resolvePreview())
    await page.getByText('Synthetic exact Page', { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Confirm this Facebook schedule', exact: true }).count(), 0)
    assert.equal(await page.getByRole('button', { name: 'Prepare Facebook schedule', exact: true }).count(), 0)
    assert.equal(await page.evaluate(() => window.publicationCalls.filter(c => c.body.action === 'confirm').length), 1)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    assert.deepEqual(errors, [])
    await page.screenshot({ path: join(output, `superseded-${width}.png`), fullPage: true })
    await page.evaluate(() => { window.publicationState = 'blocked'; window.publicationError = 'FRESH_TEAMS_EVIDENCE_REQUIRED' })
    await page.getByRole('button', { name: 'Refresh status', exact: true }).click()
    await page.getByText('Publishing manager action needed', { exact: true }).waitFor()
    await page.getByText(/Ask the scheduling owner to review the sync hold/).waitFor()
    assert.equal(await page.getByRole('button', { name: /retry/i }).count(), 0)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    await page.screenshot({ path: join(output, `blocked-${width}.png`), fullPage: true })
    await page.evaluate(() => { window.publicationState = 'unknown_outcome'; window.providerStarted = true })
    await page.getByRole('button', { name: 'Refresh status', exact: true }).click()
    await page.getByText(/A post may already exist/).waitFor()
    assert.equal(await page.getByText(/refresh the approved capture/).count(), 0)
    cases += 2
    await page.goto(`${origin}/review`)
    await page.getByRole('button', { name: 'Publishing status', exact: true }).click()
    await page.getByRole('button', { name: 'Check Facebook readiness', exact: true }).click()
    const readiness = page.locator('[aria-label="Facebook readiness results"]')
    await readiness.getByText('Synthetic verified Page · 12345', { exact: true }).waitFor()
    assert.equal(await readiness.getByText('Verified', { exact: true }).count(), 3)
    assert.equal(await page.getByRole('button', { name: 'Prepare Facebook schedule', exact: true }).isDisabled(), true)
    assert.equal(await page.evaluate(() => window.publicationCalls.filter(c => ['confirm', 'revoke', 'preview'].includes(c.body.action)).length), 0)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    await page.screenshot({ path: join(output, `readiness-${width}.png`), fullPage: true })
    await page.evaluate(() => { window.inspectionAllPass = true })
    await page.getByRole('button', { name: 'Check Facebook readiness', exact: true }).click()
    assert.equal(await page.getByRole('button', { name: 'Prepare Facebook schedule', exact: true }).isDisabled(), false)
    assert.equal(await page.getByRole('button', { name: 'Confirm this Facebook schedule', exact: true }).count(), 0)
    assert.equal(await page.evaluate(() => window.publicationCalls.filter(c => ['confirm', 'revoke', 'preview'].includes(c.body.action)).length), 0)
    cases += 2
    await page.close(); cases++
  }
  console.log(JSON.stringify({ passed: true, engine: 'isolated Chromium', widths: [375, 390, 430, 1440], cases, externalNetwork: 'blocked', liveWrites: 0, output }))
} finally { await browser?.close(); await server.close() }
