import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Real System Health component, deterministic read-only data. No app session or
// production query; all Supabase reads are intercepted by the local fixture.
if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to the approved local Playwright module')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const mocks = [
  '../../components/ui/Buttons', '../../components/ui/States',
  '../../lib/supabase', './LaunchReadinessPanel',
]
const plugin = {
  name:'system-health-workspace-fixture', enforce:'pre',
  resolveId(id) { if (id === 'virtual:health-workspace' || id === 'virtual:health-data') return `\0${id}` },
  transform(code,id) {
    if (!id.replaceAll('\\','/').endsWith('/pages/admin/ImportHealthPage.tsx')) return
    for (const path of mocks) code = code.replaceAll(`'${path}'`, "'virtual:health-data'")
    return code
  },
  load(id) {
    if (id === '\0virtual:health-data') return `
      import React from 'react';
      export const ActionButton = ({children,variant,size,loading,...props}) => React.createElement('button',props,children);
      export const EmptyState = ({title,message}) => React.createElement('p',null,title,' ',message);
      export const LaunchReadinessPanel = () => React.createElement('div',null,'Launch action queue');
      export default LaunchReadinessPanel;
      const rows = {
        planner_tasks:[{bucket_id:'bucket-a',original_bucket_name:'Daily',client_id:null},{bucket_id:'bucket-a',original_bucket_name:'Daily',client_id:'client-1'}],
        planner_buckets:[{id:'bucket-a',board_id:'board-client',name:'Exact Client',bucket_type:null},{id:'bucket-b',board_id:'board-client',name:'Unmatched Bucket',bucket_type:null}],
        planner_boards:[{id:'board-client',name:'Client schedule',slug:'client-schedule',board_type:'client_schedule'}],
        clients:[{id:'client-1',name:'Exact Client'}],
        monthly_deliverables:[{client_id:'client-1',package_id:'package-1',template_id:'template-1',month:'2026-10',due_date:null,scheduled_date:null,production_status:'scheduled'}],
      };
      export const supabase = {from(table) {return {select(columns,options) {
        const result = {data:rows[table] ?? [],count:(rows[table] ?? []).length,error:null};
        const query = {eq(){return query},order(){return query},is(){return query},then(resolve){return Promise.resolve(result).then(resolve)}};
        return options?.head ? Promise.resolve(result) : query;
      }}}};
    `
    if (id === '\0virtual:health-workspace') return `
      import React from 'react'; import {createRoot} from 'react-dom/client';
      import {MemoryRouter} from 'react-router-dom';
      import ImportHealthPage from '/src/pages/admin/ImportHealthPage.tsx'; import '/src/index.css';
      createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,null,React.createElement(ImportHealthPage)));
    `
  },
  configureServer(server) {
    server.middlewares.use((req,res,next) => {
      if (req.url !== '/__system-health-workspace') return next()
      res.setHeader('Content-Type','text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@id/virtual:health-workspace"></script></body></html>')
    })
  },
}
const server = await createServer({configFile:false,plugins:[plugin,react()],cacheDir:join(tmpdir(),'cg-system-health-workspace-cache'),optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react/jsx-dev-runtime','react-router-dom']},server:{host:'127.0.0.1',port:53997,strictPort:true,hmr:false}})
let browser
try {
  await server.listen()
  browser = await chromium.launch({headless:true})
  for (const width of [1440,375]) {
    const page = await browser.newPage({viewport:{width,height:850}})
    const errors = []
    page.on('pageerror',error => errors.push(error.message))
    await page.goto('http://127.0.0.1:53997/__system-health-workspace')
    await page.getByText('Needs attention',{exact:true}).waitFor()
    assert.equal(await page.getByText('Missing date',{exact:true}).isVisible(),true,'actionable missing-date fact stays visible')
    const totals = page.locator('details').filter({has:page.getByText('Imported data totals and source')})
    assert.equal(await totals.getAttribute('open'),null,'source totals start collapsed')
    await totals.locator('summary').click()
    assert.equal(await page.getByText('Planner tasks',{exact:true}).isVisible(),true,'full totals remain available')
    const breakdown = page.locator('details').filter({has:page.getByText('Explore imported-data breakdowns')})
    assert.match(await breakdown.locator('summary').innerText(),/1 unmatched client schedule buckets/,'unmatched work remains signalled')
    await breakdown.locator('summary').click()
    assert.equal(await page.getByText('Unmatched Bucket').isVisible(),true,'exact unmatched bucket remains inspectable')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),`${width}px body overflow`)
    assert.deepEqual(errors,[])
    await page.close()
    console.log(`PASS ${width}px: action first, exact source/breakdown disclosure, no overflow/errors/writes`)
  }
} finally {if(browser) await browser.close(); await server.close()}
