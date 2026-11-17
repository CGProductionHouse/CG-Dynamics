import assert from 'node:assert/strict'
import {before,after,test} from 'node:test'
import {readFileSync} from 'node:fs'
import {createServer} from 'vite'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
let server, href, Evidence
const empty={deliverable_id:null,production_status_updated_at:null,onedrive_footage_url:null,onedrive_internal_review_url:null,onedrive_client_approval_url:null,onedrive_final_url:null}
before(async()=>{server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});({nolanHandoffHref:href}=await server.ssrLoadModule('/src/lib/nolanHandoffLinks.ts'));({NolanVideoHandoffEvidence:Evidence}=await server.ssrLoadModule('/src/pages/admin/NolanVideoHandoffEvidence.tsx'))})
after(async()=>{await server?.close()})
const render=fields=>renderToStaticMarkup(React.createElement(Evidence,{video:{...empty,...fields}}))
test('missing handoff evidence is not fabricated from workflow status',()=>{
 const html=render({production_status:'approved'})
 assert.equal((html.match(/Not recorded/g)??[]).length,6)
 assert.ok(html.includes('review link is not approval'))
 assert.ok(html.includes('not proof of the approved final revision'))
})
test('recorded review and final links remain separate and protect opener/referrer',()=>{
 const html=render({onedrive_internal_review_url:'https://example.test/review',onedrive_final_url:'https://example.test/final'})
 assert.ok(html.includes('href="https://example.test/review"'))
 assert.ok(html.includes('href="https://example.test/final"'))
 assert.equal((html.match(/rel="noopener noreferrer"/g)??[]).length,2)
 assert.ok(html.includes('have not been opened or verified'))
})
test('unsafe malformed credential-bearing and relative links are not clickable',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,x','file:///tmp/x','/relative','https://','https://user:secret@example.test/file','https://example.test/a\nb']) assert.equal(href(url),null,url)
 assert.equal(href(' https://example.test/file '),'https://example.test/file')
})
test('invalid link values are reported without rendering their secrets or markup',()=>{
 const html=render({onedrive_final_url:'https://user:secret@example.test/file',onedrive_footage_url:'<script>bad</script>'})
 assert.equal((html.match(/Invalid or unsupported recorded link/g)??[]).length,2)
 assert.ok(!html.includes('secret'))
 assert.ok(!html.includes('<script>'))
 assert.ok(!html.includes('<a '))
})
test('linked deliverable and status timestamp retain exact recorded evidence without inference',()=>{
 const html=render({deliverable_id:'fixture-deliverable',production_status_updated_at:'2026-11-15T10:00:00Z'})
 assert.ok(html.includes('fixture-deliverable'))
 assert.ok(html.includes('2026-11-15T10:00:00Z'))
 assert.equal((html.match(/Not recorded/g)??[]).length,4)
})
test('handoff component only reads existing row data and does not fetch publish or mutate',()=>{
 const page=readFileSync('src/pages/admin/NolanOverview.tsx','utf8')
 const component=readFileSync('src/pages/admin/NolanVideoHandoffEvidence.tsx','utf8')
 assert.ok(page.includes('videoEvidence: v'))
 assert.ok(page.includes('NolanVideoHandoffEvidence video={row.videoEvidence}'))
 assert.doesNotMatch(component,/fetch\(|supabase|\.update\(|\.insert\(|localStorage|iframe/)
})
