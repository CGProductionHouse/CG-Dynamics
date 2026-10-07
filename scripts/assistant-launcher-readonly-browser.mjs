import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Real composer/CSS, synthetic empty reads. No authenticated session or provider.
if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Approved local Playwright module required')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const fixture = {
  name: 'assistant-launcher-readonly', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:assistant-launcher') return '\0virtual:assistant-launcher' },
  transform(_code, id) {
    const path = id.replaceAll('\\', '/')
    if (path.endsWith('/contexts/AuthContext.tsx')) return 'export function useAuth(){return {profile:null}}'
    if (path.endsWith('/lib/supabase.ts')) return `
      window.fixtureWrites=0;
      const forbidden=()=>{window.fixtureWrites++;throw new Error('Fixture forbids writes/functions')};
      const reads=new Set(['select','eq','neq','not','in','or','order','limit','range','gte','lte','gt','lt','is','maybeSingle','single']);
      const query=new Proxy({}, {get(_target,name){
        if(name==='then')return Promise.resolve({data:[],error:null}).then.bind(Promise.resolve({data:[],error:null}));
        if(reads.has(name))return ()=>query;
        return forbidden;
      }});
      export const supabase={from:()=>query,rpc:name=>name==='list_planner_board_assignments'?query:forbidden(),
        auth:{getSession:async()=>({data:{session:null}})},functions:{invoke:forbidden}};`
  },
  load(id) {
    if (id !== '\0virtual:assistant-launcher') return
    return `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';
      import{GlobalAssistantComposer}from'/src/components/assistant/GlobalAssistantComposer.tsx';import'/src/index.css';
      function App(){const [full,setFull]=useState(false);return React.createElement(React.Fragment,null,
        React.createElement('main',{inert:full||undefined,'aria-hidden':full||undefined},React.createElement('h1',null,'Synthetic work page')),
        !full&&React.createElement('nav',{'aria-label':'Primary mobile navigation',className:'fixed bottom-0 inset-x-0 h-14'},'Synthetic navigation'),
        React.createElement(GlobalAssistantComposer,{onMobileFullscreenChange:setFull}));}
      createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(App)));`
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/__assistant-launcher') return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@id/virtual:assistant-launcher"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-assistant-launcher-cache'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom'] },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture') },
  server: { host: '127.0.0.1', port: 53991, strictPort: true, hmr: false } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  for (const [width, height] of [[375, 812], [390, 844], [430, 932], [844, 390], [1440, 1000]]) {
    const page = await browser.newPage({ viewport: { width, height } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => {
      const request = route.request()
      if (new URL(request.url()).origin !== 'http://127.0.0.1:53991' || request.method() !== 'GET') {
        errors.push('Forbidden non-local/read request'); return route.abort()
      }
      return route.continue()
    })
    await page.goto('http://127.0.0.1:53991/__assistant-launcher')
    const mobile = width < 768 || height <= 500
    if (mobile) {
      const launcher = page.getByRole('button', { name: 'Open CG Assistant', exact: true })
      await launcher.waitFor()
      assert.equal(await launcher.evaluate(el => getComputedStyle(el).pointerEvents), 'auto', 'Launcher must accept real pointer input')
      const size = await launcher.boundingBox()
      assert.ok(size.width >= 44 && size.height >= 44, 'Minimum touch target')
      await launcher.click()
      await page.getByRole('dialog', { name: 'CG Assistant', exact: true }).waitFor()
      assert.equal(await page.getByRole('navigation', { name: 'Primary mobile navigation' }).count(), 0)
      assert.equal(await page.locator('main').getAttribute('inert'), '')
      const input = page.getByRole('textbox', { name: 'Ask CG Assistant', exact: true })
      await input.fill('Unsent synthetic draft')
      await page.keyboard.press('Escape')
      await launcher.waitFor()
      assert.equal(await page.getByRole('navigation', { name: 'Primary mobile navigation' }).count(), 1)
      assert.equal(await page.locator('main').getAttribute('inert'), null)
      await launcher.click()
      await page.getByRole('dialog', { name: 'CG Assistant', exact: true }).waitFor()
      assert.equal(await input.inputValue(), 'Unsent synthetic draft')
      await page.getByRole('button', { name: 'Close assistant', exact: true }).click()
      await launcher.waitFor()
    } else {
      await page.getByRole('textbox', { name: 'Ask CG Assistant', exact: true }).click()
      await page.getByRole('button', { name: 'Minimise assistant', exact: true }).waitFor()
      assert.equal(await page.getByRole('dialog', { name: 'CG Assistant', exact: true }).count(), 0)
      await page.getByRole('button', { name: 'Minimise assistant', exact: true }).click()
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    assert.equal(await page.evaluate(() => window.fixtureWrites), 0)
    assert.deepEqual(errors, [])
    await page.screenshot({ path: join(tmpdir(), `cg-assistant-launcher-${width}.png`), fullPage: true })
    await page.close()
    console.log(`PASS actual Assistant launcher ${width}x${height}; open/close, draft, navigation, no writes/errors/overflow`)
  }
} finally { await browser?.close(); await server.close() }
