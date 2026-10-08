import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to a local Playwright module')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const anyVisible = async locator => (await Promise.all((await locator.all()).map(element => element.isVisible()))).some(Boolean)
const fixture = {
  name: 'users-workspace-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:users-workspace' || id === 'virtual:users-data') return `\0${id}` },
  transform(code, id) {
    if (!id.replaceAll('\\', '/').endsWith('/pages/admin/UsersAdmin.tsx')) return
    return code.replaceAll(/from '\.\.\/\.\.\/lib\/(?:db\/profiles|db\/clients|roles)'/g, "from 'virtual:users-data'")
  },
  load(id) {
    if (id === '\0virtual:users-data') return `
      export const listProfiles = async () => ({data:[
        {id:'admin-1',full_name:'CG Admin',email:'admin@example.test',role:'admin',client_id:null,is_active:true,created_at:'2026-10-01'},
        {id:'staff-1',full_name:'Team Member',email:'team@example.test',role:'staff',client_id:null,is_active:false,created_at:'2026-10-02'},
        {id:'client-1',full_name:'Exact Client',email:'client-test@portal.cgdynamics.co.za',role:'client',client_id:'exact-client',is_active:true,created_at:'2026-10-03'},
        {id:'client-2',full_name:'Unlinked Client',email:'unlinked@example.test',role:'client',client_id:null,created_at:'2026-10-04'},
        {id:'client-3',full_name:'Unknown Status Client',email:'unknown@example.test',role:'client',client_id:'exact-client',created_at:'2026-10-05'},
      ],error:null});
      export const listClients = async () => ({data:[{id:'exact-client',name:'Exact Client'}],error:null});
      export const updateProfile = async () => ({data:null,error:{message:'Fixture is read only'}});
      export const roleLabel = role => role[0].toUpperCase()+role.slice(1);
    `
    if (id === '\0virtual:users-workspace') return `
      import React from 'react'; import { createRoot } from 'react-dom/client';
      import UsersAdmin from '/src/pages/admin/UsersAdmin.tsx'; import '/src/index.css';
      createRoot(document.getElementById('root')).render(React.createElement(UsersAdmin,{embedded:true}));
    `
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/__users-workspace') return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:users-workspace"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-users-workspace-cache'), optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime'] }, server: { host: '127.0.0.1', port: 53997, strictPort: true, hmr: false } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('http://127.0.0.1:53997/__users-workspace')
    await page.getByText('Showing 2 of 5').waitFor()
    assert.ok(await anyVisible(page.getByText('CG Admin')))
    assert.equal(await page.getByText('Exact Client').count(), 0, 'client login not mixed into default team view')
    assert.ok(await anyVisible(page.getByText('Inactive')), 'inactive team member not labelled active')
    await page.getByRole('button', { name: 'Client logins 3' }).click()
    assert.ok(await anyVisible(page.getByText('Exact Client')))
    assert.ok(await anyVisible(page.getByText('Generated portal login')))
    assert.ok(await anyVisible(page.getByText('Status unverified')), 'unknown status not called active')
    await page.getByRole('button', { name: 'Unlinked 1' }).click()
    assert.ok(await anyVisible(page.getByText('Unlinked Client')))
    assert.equal(await page.getByText('Exact Client').count(), 0)
    await page.getByRole('button', { name: 'All 5' }).click()
    await page.getByRole('searchbox', { name: 'Search accounts' }).fill('admin@example.test')
    await page.getByText('Showing 1 of 5').waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px body overflow`)
    assert.deepEqual(errors, [])
    await page.screenshot({ path: join(tmpdir(), `cg-users-workspace-${width}.png`), fullPage: true })
    await page.close()
    console.log(`PASS ${width}px: team default, client/pending views, search, truthful status, no overflow`)
  }
} finally { if (browser) await browser.close(); await server.close() }
