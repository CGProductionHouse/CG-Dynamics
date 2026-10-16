import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

let server, Dashboard, hooks
const first = { id: 'report-september', platform: null, period_start: '2026-09-01', period_end: '2026-09-30', status: 'published', posts: [] }
const second = { ...first, id: 'report-august', period_start: '2026-08-01', period_end: '2026-08-31' }

before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true },
    esbuild: { jsx: 'automatic' }, define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture'),
    }, plugins: [{
      name: 'report-selection-render-fixture', enforce: 'pre',
      resolveId(id) { if (id.startsWith('virtual:report-selection-')) return `\0${id}` },
      load(id) {
        if (id === '\0virtual:report-selection-hooks') return `let values=[],index=0;export function reset(next){values=next;index=0}
          export function useState(){return[values[index++],()=>{}]}export function useEffect(){}export function useMemo(fn){return fn()}export function useRef(value){return{current:value}}`
        if (id === '\0virtual:report-selection-context') return `export function useClientPortal(){return{client:{id:'fixture-client',name:'Fixture client'}}}`
        if (id === '\0virtual:report-selection-auth') return `export function useAuth(){return{profile:{id:'fixture-profile',client_id:'fixture-client',role:'client'}}}`
        if (id === '\0virtual:report-selection-view') return `import React from'react';export function ClientReportView({report}){return React.createElement('p',{'data-report-id':report.id},report.id)}export function EmptyReportState({title}){return React.createElement('p',null,title)}`
        if (id === '\0virtual:report-selection-empty') return `export function ClientMonthAhead(){return null}export function ClientServiceExpansion(){return null}`
      },
      transform(source, id) {
        if (!id.replaceAll('\\', '/').endsWith('/pages/client/Dashboard.tsx')) return
        return source.replace("from 'react'", "from 'virtual:report-selection-hooks'")
          .replace("from '../../components/client/ClientPortalContext'", "from 'virtual:report-selection-context'")
          .replace("from '../../contexts/AuthContext'", "from 'virtual:report-selection-auth'")
          .replace("from './ClientReportView'", "from 'virtual:report-selection-view'")
          .replace("from '../../components/client/ClientMonthAhead'", "from 'virtual:report-selection-empty'")
          .replace("from '../../components/client/ClientServiceExpansion'", "from 'virtual:report-selection-empty'")
      },
    }] })
  Dashboard = (await server.ssrLoadModule('/src/pages/client/Dashboard.tsx')).default
  hooks = await server.ssrLoadModule('virtual:report-selection-hooks')
})
after(async () => { await server?.close() })

function render({ selected = second.id, loaded = first, pending = false, error = null } = {}) {
  // Real Dashboard render at the state immediately after selection, before its
  // passive effect clears the preceding report and begins the next read.
  hooks.reset([[first, second], selected, loaded, [], null, 'no-activity', null, [], [], false, null, false, false, pending, error])
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Dashboard)))
}

test('new month selection cannot display the previous report before its loading effect runs', () => {
  const html = render()
  assert.doesNotMatch(html, /data-report-id="report-september"/)
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /aria-pressed="true"[^>]*>August 2026/)
})

test('settled matching reports render normally and unavailable reads keep their existing state', () => {
  assert.match(render({ selected: first.id }), /data-report-id="report-september"/)
  assert.match(render({ loaded: null }), /Select a month/)
  assert.doesNotMatch(render({ pending: true }), /data-report-id=/)
  assert.match(render({ error: 'Unavailable' }), /Performance is temporarily unavailable/)
})
