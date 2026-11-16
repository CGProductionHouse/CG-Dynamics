import assert from 'node:assert/strict'
import {before, after, test} from 'node:test'
import {readFileSync} from 'node:fs'
import {createServer} from 'vite'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
let server, reviewed, coverage
before(async()=>{server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});({reviewedNolanWebsites:reviewed,nolanWebsiteMappingCoverage:coverage}=await server.ssrLoadModule('/src/lib/nolanWebsiteConnections.ts'))})
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
 assert.ok(parent.includes('<NolanWebsiteConnections key={`${scope}:${generation}`} />'))
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

test('coverage counts unique active client identities, not inferred websites',()=>{
 const mapped={id:'ed7aa1ae-de21-4151-a8f9-54796b234c1f',active:true}
 assert.deepEqual(coverage([mapped,mapped,{id:'unknown',active:true},{id:'inactive',active:false}]),{activeClientIdentitiesRead:2,reviewedMappingsMatched:1,clientIdentitiesWithoutReviewedMapping:1})
 assert.deepEqual(coverage([]),{activeClientIdentitiesRead:0,reviewedMappingsMatched:0,clientIdentitiesWithoutReviewedMapping:0})
})
test('new operations names and URLs never establish a reporting-client join',()=>{
 const entries=['Get Together','Imbewu','CG ARCC','JFJ','Raadzaal','Wiseman'].map((name,i)=>({id:'unbound-'+i,name,active:true,website:'https://example.test'}))
 assert.equal(reviewed(entries).length,0)
 assert.equal(coverage(entries).clientIdentitiesWithoutReviewedMapping,6)
})
test('coverage disclosure keeps unknown client joins distinct from site health',()=>{
 const page=readFileSync('src/pages/admin/NolanWebsiteConnections.tsx','utf8')
 for(const text of ['not a website denominator','not evidence of a missing or down website','Dynamics client ID:','do not establish the Dynamics reporting-client binding','no name or host guessing']) assert.ok(page.includes(text))
})
