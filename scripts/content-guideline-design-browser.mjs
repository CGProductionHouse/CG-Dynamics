import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// The actual presentation component, synthetic creative content, loopback only.
// --serve leaves the local visual preview open for review; it is not published.
if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to the approved local Playwright package')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const sample = {
  row_key: 'sample-guide', title: 'November · Stories worth sharing', month: '2026-11-01',
  run_name: 'Internal run name must not appear', filming_date: '2026-11-04', published_at: '2026-10-27T08:00:00Z',
  internal_notes: 'PRIVATE NEVER RENDER', onedrive_footage_url: 'https://private.invalid/raw',
  videos: [
    { position: 1, title: 'The office chair test drive', objective: 'Turn an everyday office moment into a memorable road-safety conversation.',
      hook: 'An office chair. A very serious test drive.', platform: 'Facebook · Instagram', format: 'Short-form video',
      script: 'SCENE 01 — THE TEST DRIVE\nA colleague pushes off in an office chair. It veers gently to one side.\n\nCOLLEAGUE\n“Pulling left.”\n\nDRIVER\n“It’s an office chair.”\n\nSCENE 02 — THE REALISATION\nA pause. They look down at the wheels. Then back at each other.\n\nEND FRAME\nYou notice it here. Notice it on the road, too.',
      shot_breakdown: '01 / Wide office shot.\n02 / Close detail of the chair wheels.\n03 / Hold the reaction, then cut to the end frame.',
      visual_notes: 'Natural light. Understated delivery. Keep the movement controlled.', cta: 'Start a conversation about the small things you notice behind the wheel.' },
    { position: 2, title: 'A small sound. A bigger story.', objective: null, hook: null,
      script: 'SCENE 01\nA quiet workshop. A familiar sound interrupts.\n\nPRESENTER\n“Your car is trying to tell you something.”\n\nSCENE 02\nCut to the team listening, looking and asking the right questions.\n\nEND FRAME\nThe details make the difference.',
      shot_breakdown: null, visual_notes: null, platform: null, format: null, cta: null },
  ],
}
const fixture = {
  name: 'guideline-design-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:guideline-design') return '\0virtual:guideline-design' },
  transform(_code, id) {
    if (id.replaceAll('\\', '/').endsWith('/contexts/AuthContext.tsx')) return 'export function useAuth(){return {profile:{role:"admin",id:"fixture-admin"},signOut:async()=>{}}}'
    if (id.replaceAll('\\', '/').endsWith('/lib/clientLeadsNavigation.ts')) return 'export async function hasClientLeadsDestination(){return false}'
  },
  load(id) {
    if (id !== '\0virtual:guideline-design') return
    return `import React from 'react'; import {createRoot} from 'react-dom/client';
      import {ContentGuidelineDocument} from '/src/components/client/ContentGuidelineDocument.tsx'; import '/src/index.css';
      import ContentGuidelineDocumentEditor from '/src/pages/admin/ContentGuidelineDocumentEditor.tsx';
      import {ClientPortalShell} from '/src/components/client/ClientPortalShell.tsx';
      import {MemoryRouter} from 'react-router-dom';
      window.sampleGuide=${JSON.stringify(sample)};
      const guide=window.sampleGuide;
      const editor=React.createElement(MemoryRouter,null,React.createElement(ContentGuidelineDocumentEditor,{
        guideline:{id:'11111111-1111-4111-8111-111111111111',client_id:'22222222-2222-4222-8222-222222222222',title:guide.title,month:guide.month,status:'draft',client_published_at:null,coverage_start:guide.month,coverage_end:guide.month},
        run:{name:'Fixture shoot',client_name:'Wiseman Group',run_date:guide.filming_date},
        videos:guide.videos.map((video,index)=>({...video,id:'video-'+index,status:'idea',production_status:'not_shot',month:guide.month,updated_at:'2026-10-27T08:00:00Z',notes:'PRIVATE NEVER RENDER',production_note:'PRIVATE NEVER RENDER'})),onChanged:()=>{}}));
      const document=React.createElement(MemoryRouter,{initialEntries:['/client/plan?tab=guidelines&month=2026-11']},
        React.createElement(ClientPortalShell,{client:{id:'22222222-2222-4222-8222-222222222222',name:'Wiseman Group'}},
          React.createElement('p',{className:'mb-4 text-xs text-slate-400'},'DESIGN PREVIEW · SAMPLE CONTENT · NOT PUBLISHED'),
          React.createElement(ContentGuidelineDocument,{guide,client:{name:'Wiseman Group'},clientPath:'/client/plan?tab=guidelines&month=2026-11&guide=sample-guide'})));
      createRoot(window.document.getElementById('root')).render(location.search.includes('editor')?React.createElement('main',{className:'mx-auto max-w-6xl p-3 sm:p-8'},editor):document);`
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith('/__guideline-design')) return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#030706"><div id="root"></div><script type="module" src="/@id/virtual:guideline-design"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-guideline-design-cache'),
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture') },
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom'] },
  server: { host: '127.0.0.1', port: 53994, strictPort: true, hmr: false } })
let browser
const serve = process.argv.includes('--serve')
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 375, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 1050 }, permissions: ['clipboard-read', 'clipboard-write'], reducedMotion: 'reduce' })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => { errors.push(error.message); console.error('FIXTURE RUNTIME', error.message) })
    await page.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.origin === 'http://127.0.0.1:1') {
        assert.equal(route.request().method(), 'GET', 'Editor preview never writes or generates')
        return route.fulfill({ json: [] })
      }
      assert.equal(url.origin, 'http://127.0.0.1:53994', 'No external requests'); return route.continue()
    })
    await page.goto('http://127.0.0.1:53994/__guideline-design')
    await page.getByRole('heading', { name: 'Video 01 - The office chair test drive' }).waitFor()
    await page.getByAltText('Wiseman Group logo').first().evaluate(img => img.decode())
    assert.equal(await page.getByText(sample.videos[0].script, { exact: true }).textContent(), sample.videos[0].script, 'Complete script preserved byte for byte')
    assert.equal(await page.getByText('Complete script', { exact: true }).count(), 2)
    assert.doesNotMatch(await page.locator('body').innerText(), /PRIVATE NEVER RENDER|private.invalid|Internal run name/)
    await page.getByRole('button', { name: 'Copy guideline link' }).click()
    const copied = new URL(await page.evaluate(() => navigator.clipboard.readText()))
    assert.equal(copied.pathname, '/client/plan')
    assert.equal(copied.searchParams.get('guide'), 'sample-guide')
    assert.equal(copied.searchParams.has('client'), false, 'No client identity override in shared link')
    assert.equal(copied.searchParams.has('token'), false, 'Not an anonymous bearer link')
    await page.getByRole('link', { name: '02 A small sound. A bigger story.' }).click()
    const target = await page.getByRole('heading', { name: 'Video 02 - A small sound. A bigger story.' }).boundingBox()
    assert.ok(target && target.y >= 0 && target.y < 500, 'Lineup link reaches the correct video')
    await page.getByRole('link', { name: '01 The office chair test drive' }).click()
    await page.getByText('Filming & visual direction', { exact: true }).click()
    assert.ok(await page.getByText(sample.videos[0].shot_breakdown, { exact: true }).isVisible())
    await page.getByText('Filming & visual direction', { exact: true }).click()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px overflow`)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: join(tmpdir(), `cg-guideline-portal-${width}.png`), fullPage: true })
    await page.screenshot({ path: join(tmpdir(), `cg-guideline-portal-fold-${width}.png`) })
    await page.goto('http://127.0.0.1:53994/__guideline-design?editor')
    await page.getByRole('textbox', { name: 'Complete script', exact: true }).first().fill('Unsaved staff wording — keep this draft.')
    await page.getByRole('button', { name: 'View client layout', exact: true }).click()
    await page.getByText('Saved content only · Draft — not shared with the client', { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Copy guideline link' }).count(), 0, 'Unpublished draft cannot be shared')
    assert.doesNotMatch(await page.locator('body').innerText(), /PRIVATE NEVER RENDER/)
    assert.ok(await page.getByText(sample.videos[0].script, { exact: true }).isVisible())
    await page.getByRole('button', { name: 'Back to editing', exact: true }).click()
    assert.equal(await page.getByRole('textbox', { name: 'Content Guideline title', exact: true }).inputValue(), sample.title)
    assert.equal(await page.getByRole('textbox', { name: 'Complete script', exact: true }).first().inputValue(), 'Unsaved staff wording — keep this draft.', 'Preview preserves unsaved staff edits')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px editor overflow`)
    await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('Fixture clipboard denied') } } }) })
    await page.goto('http://127.0.0.1:53994/__guideline-design')
    await page.getByRole('button', { name: 'Copy guideline link' }).click()
    assert.equal(new URL(await page.getByRole('textbox', { name: 'Client guideline link' }).inputValue()).pathname, '/client/plan', 'Copy failure exposes the client link, never an admin URL')
    assert.deepEqual(errors, [])
    await context.close()
    console.log(`PASS ${width}px: actual branded document, scripts, safe link, video jump, direction and no overflow`)
  }
} finally { if (browser) await browser.close(); if (!serve) await server.close() }
if (serve) console.log('LOCAL VISUAL PREVIEW http://127.0.0.1:53994/__guideline-design')
