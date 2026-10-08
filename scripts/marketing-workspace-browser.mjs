import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to a local Playwright module')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const fixture = {
  name: 'marketing-workspace-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:marketing-workspace' || id === 'virtual:marketing-data') return `\0${id}` },
  transform(code, id) {
    if (!id.replaceAll('\\', '/').endsWith('/pages/admin/MarketingWorkspacePage.tsx')) return
    return code.replaceAll(/from '\.\.\/\.\.\/(?:lib|components|contexts|types)\/[^']+'/g, "from 'virtual:marketing-data'")
  },
  load(id) {
    if (id === '\0virtual:marketing-data') return `
      import React from 'react';
      export const useAuth = () => ({profile:{role:'admin'}});
      export const isAdminRole = role => role === 'admin';
      export const isManagerRole = role => role === 'admin';
      export const PageContainer = ({children}) => React.createElement('main',null,children);
      export const PageHeader = ({title,description}) => React.createElement('header',null,React.createElement('h1',null,title),React.createElement('p',null,description));
      export const EmptyState = ({title,message}) => React.createElement('p',null,title+' '+message);
      export const LoadingState = ({message}) => React.createElement('p',null,message);
      export const ActionButton = ({children,onClick}) => React.createElement('button',{type:'button',onClick},children);
      export const Pill = ({children}) => React.createElement('span',null,children);
      export const INDUSTRY_LABELS = {general:'General',automotive:'Automotive'};
      export const KNOWLEDGE_LAYER_LABELS = {universal_principle:'Universal principle',industry_specific:'Industry-specific'};
      export const SKILL_STATUS_LABELS = {active:'Active',draft:'Draft'};
      export const SOURCE_TYPE_LABELS = {article:'Article'};
      export const TRUST_TIER_LABELS = {tier_1_primary:'Primary'};
      export const filterSkillCards = (cards,filters) => cards.filter(c =>
        (!filters.query || (c.title+' '+c.summary).toLowerCase().includes(filters.query.toLowerCase())) &&
        (filters.category === 'all' || c.category === filters.category) &&
        (filters.knowledgeLayer === 'all' || c.knowledge_layer === filters.knowledgeLayer) &&
        (filters.industry === 'all' || c.relevant_industries.includes(filters.industry)));
      export const listActiveSharedSkillCards = async () => ({data:[
        {id:'one',title:'Exact offer evidence',summary:'Use the exact client offer.',category:'Marketing Library',status:'active',knowledge_layer:'universal_principle',relevant_industries:['general'],client_specific:false},
        {id:'two',title:'Automotive positioning',summary:'Differentiate the vehicle service.',category:'Strategy Foundations',status:'active',knowledge_layer:'industry_specific',relevant_industries:['automotive'],client_specific:false},
      ],error:null,migrationNeeded:false});
      export const listSkillCards = listActiveSharedSkillCards;
      export const listMarketingLibrarySources = async () => ({data:[],error:null,migrationNeeded:false});
      export const filterMarketingSources = sources => sources;
      export const isUntrustedOrigin = () => false;
      export const skillCardIsStale = () => false;
      export const skillCardMissingSource = () => false;
      export const skillCardNeedsReview = () => false;
      export const sourceNeedsReview = () => false;
      export const sourceUrl = () => null;
      export const REGISTRATION_MANIFEST = [];
      export const classifyRegistrations = () => [];
      export const buildUnifiedPreview = () => [];
      export const listClientGuides = async () => ({data:[],error:null});
      export const downloadClientGuide = async () => null;
      export const copyProjectInstructions = async () => null;
      export const listClientProjectMappings = async () => ({data:[],error:null});
      export const openChatgptProject = () => null;
      export const listAllClientContacts = async () => ({data:[],error:null});
      export const listClients = async () => ({data:[],error:null});
    `
    if (id === '\0virtual:marketing-workspace') return `
      import React from 'react'; import { createRoot } from 'react-dom/client'; import { MemoryRouter } from 'react-router-dom';
      import MarketingWorkspacePage from '/src/pages/admin/MarketingWorkspacePage.tsx'; import '/src/index.css';
      createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,null,React.createElement(MarketingWorkspacePage)));
    `
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/__marketing-workspace') return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:marketing-workspace"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-marketing-workspace-cache'), optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom'] }, server: { host: '127.0.0.1', port: 54000, strictPort: true, hmr: false } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('http://127.0.0.1:54000/__marketing-workspace')
    await page.getByText('Showing 2 of 2 approved shared cards').waitFor()
    assert.ok(await page.getByText('Exact offer evidence').isVisible())
    await page.getByRole('textbox', { name: 'Search knowledge' }).fill('Automotive')
    await page.getByText('Showing 1 of 2 approved shared cards').waitFor()
    assert.equal(await page.getByText('Exact offer evidence').count(), 0)
    await page.getByRole('textbox', { name: 'Search knowledge' }).fill('')
    await page.getByRole('combobox', { name: 'Knowledge category' }).selectOption('Marketing Library')
    await page.getByText('Showing 1 of 2 approved shared cards').waitFor()
    assert.ok(await page.getByText('Exact offer evidence').isVisible())
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px body overflow`)
    if (width === 1440) {
      const positions = await page.locator('input[aria-label="Search knowledge"], select[aria-label^="Knowledge"]').evaluateAll(elements => elements.map(e => Math.round(e.getBoundingClientRect().top)))
      assert.ok(new Set(positions).size <= 2, `desktop filters span ${new Set(positions).size} rows`)
    }
    assert.deepEqual(errors, [])
    await page.screenshot({ path: join(tmpdir(), `cg-marketing-workspace-${width}.png`), fullPage: true })
    await page.close()
    console.log(`PASS ${width}px: compact filters, search/category truth, no overflow or runtime error`)
  }
} finally { if (browser) await browser.close(); await server.close() }
