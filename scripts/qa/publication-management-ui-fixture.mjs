// Local synthetic acceptance only. Replaces the entire I/O helper before import;
// there are no sessions, provider calls, publication or production writes.
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const reviews = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']
const labels = { queued: 'Queued in Dynamics', submitting: 'Submission started', processing: 'Processing at provider', provider_scheduled: 'Scheduled at provider', posted: 'Verified posted', retry_wait: 'Waiting to retry', blocked: 'Needs review', failed: 'Failed', unknown_outcome: 'Needs reconciliation', cancelled: 'Stopped in Dynamics' }
const io = `export const PUBLICATION_STATE_LABELS=${JSON.stringify(labels)};
const reviews=${JSON.stringify(reviews)};
const rows=Object.fromEntries(reviews.map((id,index)=>[id,['queued','processing','posted','unknown_outcome'].map((state,n)=>({jobId:index+'-'+n,platform:'facebook',accountId:'12345',accountLabel:'Synthetic Client '+(index?'B':'A')+' · Facebook Page',scheduledAt:'2026-11-17T08:00:00Z',state,authorizationState:'recorded',providerMayHaveStarted:n>0,postUrl:state==='posted'?'https://www.facebook.com/12345_789':null,errorCode:null}))]));
export async function getStaffPublicationStatus(reviewId){const mode=window.fixtureMode;const snapshot=structuredClone(rows[reviewId]);if(mode==='slow'&&reviewId===reviews[0])await new Promise(r=>setTimeout(r,1800));if(mode==='unavailable')return null;return{reviewId,clientId:reviewId,items:snapshot,canAuthorize:false}}
export async function withdrawStaffPublication(reviewId,jobId){document.getElementById('fixture-receipt').textContent=JSON.stringify({action:'revoke',reviewId,jobId});if(window.fixtureMode==='uncertain')return null;const row=rows[reviewId].find(r=>r.jobId===jobId);row.authorizationState='revoked';if(!row.providerMayHaveStarted)row.state='cancelled';return{state:row.state,providerMayHaveStarted:row.providerMayHaveStarted}}
`
const server = await createServer({ configFile: false, root: process.cwd(), cacheDir: join(tmpdir(), `cg-publication-management-${process.pid}`),
  optimizeDeps: { include: ['react', 'react-dom/client'] }, server: { host: '127.0.0.1', port: 4180, strictPort: true },
  plugins: [{ name: 'publication-management-synthetic', enforce: 'pre',
    resolveId(id) { if (id === '/__publication-management.js') return id },
    load(id) {
      if (id.replaceAll('\\', '/').endsWith('/src/lib/socialPublishing.ts')) return io
      if (id === '/__publication-management.js') return `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{ContentPublicationPanel}from'/src/components/content/ContentPublicationPanel.tsx';import'/src/index.css';
function Fixture(){const[index,setIndex]=useState(0);const[role,setRole]=useState('manager');const[width,setWidth]=useState('100%');return React.createElement('main',{style:{maxWidth:900,margin:'auto',padding:16,color:'white'}},React.createElement('h1',null,'LOCAL SYNTHETIC · Publishing management'),React.createElement('p',null,'No real API, credential, provider or client data.'),React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:12,margin:'16px 0'}},...['Client A','Client B'].map((s,n)=>React.createElement('button',{key:s,onClick:()=>setIndex(n)},s)),React.createElement('button',{onClick:()=>setRole(role==='manager'?'client':'manager')},'Switch role'),React.createElement('select',{onChange:e=>window.fixtureMode=e.target.value,'aria-label':'Fixture response'},...['normal','slow','unavailable','uncertain'].map(s=>React.createElement('option',{key:s,value:s},s))),React.createElement('select',{onChange:e=>setWidth(e.target.value),'aria-label':'Fixture width'},...['100%','375px','390px','430px'].map(s=>React.createElement('option',{key:s,value:s},s)))),React.createElement('p',null,'Selected: Client '+(index?'B':'A')+' · '+role),React.createElement('div',{id:'fixture-surface',style:{width,maxWidth:'100%',marginTop:16}},role==='manager'?React.createElement(ContentPublicationPanel,{reviewId:${JSON.stringify(reviews)}[index]}):React.createElement('p',null,'Client view: no publishing management')),React.createElement('output',{id:'fixture-receipt',style:{display:'block',overflowWrap:'anywhere',marginTop:16}}))}createRoot(document.getElementById('root')).render(React.createElement(Fixture));`
    },
    configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
      if (req.url?.split('?')[0] !== '/') return next()
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(await vite.transformIndexHtml(req.url, '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>LOCAL FIXTURE · Publication management</title></head><body style="background:#080f17"><div id="root"></div><script type="module" src="/__publication-management.js"></script></body></html>'))
    }) },
  }, react()],
})
await server.listen()
console.log('Synthetic UI fixture: http://127.0.0.1:4180 — backend/provider I/O replaced')
process.on('SIGINT', () => { void server.close().then(() => process.exit()) })
