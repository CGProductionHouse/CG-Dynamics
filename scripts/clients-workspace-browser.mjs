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
  name: 'clients-workspace-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:clients-workspace' || id === 'virtual:clients-data') return `\0${id}` },
  transform(code, id) {
    if (!id.replaceAll('\\', '/').endsWith('/pages/admin/ClientsList.tsx')) return
    return code.replaceAll(/from '\.\.\/\.\.\/(?:lib|components|hooks|contexts)\/[^']+'/g, "from 'virtual:clients-data'")
  },
  load(id) {
    if (id === '\0virtual:clients-data') return `
      import React from 'react';
      export const useAuth = () => ({profile:{id:'admin-1',role:'admin'}});
      export const PremiumCard = ({children}) => React.createElement('div',{className:'rounded-xl border border-white/10 p-3'},children);
      export const ActionButton = ({children,onClick,disabled}) => React.createElement('button',{type:'button',onClick,disabled},children);
      export const Pill = ({children}) => React.createElement('span',null,children);
      export const StatusBadge = ({label}) => React.createElement('span',null,label);
      export const EmptyState = ({title,message}) => React.createElement('p',null,title+' '+message);
      export const useLocalDraft = () => ({getInitialDraft:()=>null,saveDraft:()=>{},clearDraft:()=>{}});
      export const listClients = async () => ({data:[
        {id:'client-1',name:'Exact Client Alpha',active:true,tier:'standard',package_settings:{},created_at:'2026-01-01'},
        {id:'client-2',name:'Exact Client Beta',active:true,tier:'premium',package_settings:{},created_at:'2026-01-02'},
        {id:'client-3',name:'Another Client',active:true,tier:'standard',package_settings:{},created_at:'2026-01-03'},
        {id:'client-4',name:'Archived Client',active:false,tier:'standard',package_settings:{},created_at:'2026-01-04'},
      ],error:null});
      export const createClient = async () => ({error:{message:'Read-only fixture'}});
      export const updateClient = async () => ({error:{message:'Read-only fixture'}});
      export const confirmClientPackage = async () => ({error:{message:'Read-only fixture'}});
      export const archiveClient = async () => ({error:{message:'Read-only fixture'}});
      export const restoreClient = async () => ({error:{message:'Read-only fixture'}});
      export const readPackageSettings = () => null;
      export const readPackageAuthority = () => ({status:'unverified',settings:null});
      export const ClientLogo = ({client}) => React.createElement('span',null,client.name.slice(0,2));
      export const PACKAGE_NUMBER_FIELDS = [];
      export const loadActiveClientPackageEvidenceMatrix = async () => ({data:[],error:null});
      export const PackageEvidenceReviewModal = () => null;
      export const findClientNameConflict = () => false;
      export const clientSaveFailureMessage = () => 'Read-only fixture';
      export const parseBulkClientNames = () => [];
    `
    if (id === '\0virtual:clients-workspace') return `
      import React from 'react'; import { createRoot } from 'react-dom/client'; import { MemoryRouter } from 'react-router-dom';
      import ClientsList from '/src/pages/admin/ClientsList.tsx'; import '/src/index.css';
      createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,null,React.createElement(ClientsList)));
    `
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/__clients-workspace') return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:clients-workspace"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-clients-workspace-cache'), optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom'] }, server: { host: '127.0.0.1', port: 53998, strictPort: true, hmr: false } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('http://127.0.0.1:53998/__clients-workspace')
    await page.getByText('Showing 3 of 4').waitFor()
    assert.ok(await anyVisible(page.getByText('Exact Client Alpha')))
    await page.getByRole('searchbox', { name: 'Search clients' }).fill('beta')
    await page.getByText('Showing 1 of 4').waitFor()
    assert.ok(await anyVisible(page.getByText('Exact Client Beta')))
    assert.equal(await page.getByText('Exact Client Alpha').count(), 0)
    await page.locator('summary:visible').filter({ hasText: 'More actions' }).first().click()
    assert.ok(await anyVisible(page.getByRole('link', { name: 'Setup preview' })))
    assert.ok(await anyVisible(page.getByRole('link', { name: 'Meta / Sync' })))
    await page.screenshot({ path: join(tmpdir(), `cg-clients-workspace-${width}.png`), fullPage: true })
    await page.getByRole('searchbox', { name: 'Search clients' }).fill('no-match')
    assert.ok(await anyVisible(page.getByText('No matching clients')))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px body overflow`)
    assert.deepEqual(errors, [])
    await page.close()
    console.log(`PASS ${width}px: search, exact links, secondary actions, empty state, no overflow`)
  }
} finally { if (browser) await browser.close(); await server.close() }
