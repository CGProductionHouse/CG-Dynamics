import assert from 'node:assert/strict'
import {before, after, test} from 'node:test'
import {readFileSync} from 'node:fs'
import {createServer} from 'vite'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
let server, reviewed
before(async()=>{server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});({reviewedNolanWebsites:reviewed}=await server.ssrLoadModule('/src/lib/nolanWebsiteConnections.ts'))})
after(async()=>{await server?.close()})
test('only exact reviewed active IDs qualify; name matches and maintenance-only do not',()=>{
 const exact={id:'ed7aa1ae-de21-4151-a8f9-54796b234c1f',name:'Actual client',active:true}
 const result=reviewed([exact,{id:'other',name:'Piek',active:true},{...exact,active:false},{id:'aece5a86-c962-4234-a1fe-7904c20f03ff',name:'JFJ',active:true}])
 assert.equal(result.length,1);assert.equal(result[0].client,exact);assert.equal(result[0].website.canonicalHost,'www.piekgroup.co.za')
 assert.deepEqual(reviewed([]),[])
})
test('existing read-only reporting is reused, source timestamps separated and full fleet not claimed',()=>{
 const page=readFileSync('src/pages/admin/NolanWebsiteConnections.tsx','utf8')
 const parent=readFileSync('src/pages/admin/NolanOverview.tsx','utf8')
 const panel=readFileSync('src/components/admin/WebsitePerformancePanel.tsx','utf8')
 for(const text of ['4 reviewed reporting mappings, not the full website fleet','canSave={false} showFreshness','Directory read time is not','Retry connections','if (cancelled) return','listClients(\'active\')']) assert.ok(page.includes(text))
 assert.ok(parent.includes('<NolanWebsiteConnections key={generation} />'))
 assert.ok(parent.includes("lane !== 'master' && lane !== 'systems'"))
 assert.ok(panel.includes("report?.generatedAt ?? 'Not available'"))
 assert.doesNotMatch(page,/access_token|Authorization|service_role|fetch\(|as Client|saveWebsitePerformanceDraft/)
})

test('initial rendered website lane is explicit and lazy, not a fake fleet count', async()=>{
 const {NolanWebsiteConnections}=await server.ssrLoadModule('/src/pages/admin/NolanWebsiteConnections.tsx')
 const html=renderToStaticMarkup(React.createElement(NolanWebsiteConnections))
 assert.ok(html.includes('4 reviewed reporting mappings, not the full website fleet'))
 assert.ok(html.includes('Load reviewed connections'))
 assert.ok(!html.includes('Select a client'))
 const css=readFileSync('src/pages/admin/nolanOverview.css','utf8')
 assert.doesNotMatch(css,/\.nolan-board \.grid\s*\{/)
})
