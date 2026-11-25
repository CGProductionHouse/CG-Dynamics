// Local-only UI acceptance. All provider/backend functions are replaced before
// module loading. No real session, credential, OAuth grant or network API call.
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const clients = [
  { clientId: '11111111-1111-4111-8111-111111111111', clientName: 'Synthetic Client A', state: 'connected', account: { displayName: 'Synthetic Account A', avatarUrl: null, lastConnectedAt: null }, diagnostic: 'Synthetic fixture' },
  { clientId: '22222222-2222-4222-8222-222222222222', clientName: 'Synthetic Client B', state: 'connected', account: { displayName: 'Synthetic Account B', avatarUrl: null, lastConnectedAt: null }, diagnostic: 'Synthetic fixture' },
]
const analytics = `export const TIKTOK_METRICS=[];
export async function getTiktokConnectionQueue(){return ${JSON.stringify({ ok: true, items: clients, summary: { activeClients: 2, eligible: 2, excluded: 0, unresolved: 0, connected: 2, reconnectRequired: 0, notConnected: 0 } })}}
export async function getTiktokConnectionStatus(clientId){return {ok:true,connected:true,status:'connected',missingScopes:[],connection:{id:clientId,clientId}}}
export async function startTiktokOAuth(){return {ok:false,error:'Fixture blocks analytics OAuth'}}
export async function syncTiktokAnalytics(){return {ok:false,errors:['Fixture blocks sync']}}`
const business = `export async function getTiktokBusinessStatus(){return {available:true,connected:false,accountHandle:null,expiresAt:null,message:'Synthetic local fixture: no real publishing account.'}}
export async function startTiktokBusinessOAuth(input){document.getElementById('fixture-receipt').textContent=JSON.stringify(input);return {ok:false,error:'Fixture captured exact-account request; no consent opened.'}}`
const server = await createServer({
  configFile: false, root: process.cwd(), cacheDir: join(tmpdir(), `cg-social-ui-${process.pid}`),
  optimizeDeps: { include: ['react', 'react-dom/client', 'react-router-dom'] },
  server: { host: '127.0.0.1', port: 4179, strictPort: true },
  plugins: [{ name: 'social-publishing-fixture', enforce: 'pre',
    resolveId(id) { if (id === '/__social-fixture.js') return id },
    load(id) {
      const file = id.replaceAll('\\', '/')
      if (file.endsWith('/src/lib/tiktok.ts')) return analytics
      if (file.endsWith('/src/lib/tiktokBusiness.ts')) return business
      if (id === '/__social-fixture.js') return `import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';import Page from '/src/pages/admin/TikTokIntegrationPage.tsx';import '/src/index.css';createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(Page)));`
    },
    configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
      if (req.url?.split('?')[0] !== '/') return next()
      res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(await vite.transformIndexHtml(req.url, '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>LOCAL FIXTURE · TikTok connection</title></head><body style="background:#080f17"><div style="padding:12px;color:white">LOCAL SYNTHETIC FIXTURE — all OAuth, sync and provider calls blocked</div><div id="root"></div><output id="fixture-receipt" style="display:block;overflow-wrap:anywhere;color:white"></output><script type="module" src="/__social-fixture.js"></script></body></html>'))
    }) },
  }, react()],
})
await server.listen()
console.log('Synthetic UI fixture: http://127.0.0.1:4179 — no provider calls')
process.on('SIGINT', () => { void server.close().then(() => process.exit()) })
