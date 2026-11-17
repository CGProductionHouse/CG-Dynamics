import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
let server, href, Identity
before(async()=>{
  server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'})
  ;({nolanScheduleRecordHref:href}=await server.ssrLoadModule('/src/lib/nolanRecordLinks.ts'))
  ;({NolanRecordIdentity:Identity}=await server.ssrLoadModule('/src/pages/admin/NolanRecordIdentity.tsx'))
})
after(async()=>{await server?.close()})
test('schedule navigation retains exact record, client and historical month without action-only hiding',()=>{
  const url=new URL(href({id:'fixture-id',client_id:'fixture-client',month:'2025-12-01'}),'https://example.test')
  assert.equal(url.pathname,'/admin/client-schedule')
  assert.equal(url.searchParams.get('id'),'fixture-id')
  assert.equal(url.searchParams.get('client'),'fixture-client')
  assert.equal(url.searchParams.get('month'),'2025-12-01')
  assert.equal(url.searchParams.get('mode'),'all')
})
test('source identities cannot inject or replace query parameters',()=>{
  const url=new URL(href({id:'x&mode=posted-history#fragment',client_id:'a/b?x=y',month:'2026-11-01'}),'https://example.test')
  assert.equal(url.searchParams.get('id'),'x&mode=posted-history#fragment')
  assert.equal(url.searchParams.get('client'),'a/b?x=y')
  assert.equal(url.searchParams.get('mode'),'all')
  assert.equal(url.hash,'')
})
test('record identity is escaped and missing due date is not inferred',()=>{
  const html=renderToStaticMarkup(React.createElement(Identity,{source:'Monthly deliverable',recordId:'<script>fixture</script>',dueDate:null,dateLabel:'Recorded due date'}))
  assert.ok(html.includes('Not recorded'))
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(!html.includes('<script>'))
  assert.ok(html.includes('not delivery or approval verification'))
})
test('destination already supports query context and exact canonical drawer lookup',()=>{
  const source=readFileSync('src/pages/admin/ClientSchedulePage.tsx','utf8')
  for(const key of ['id','client','month','mode']) assert.ok(source.includes(`searchParams.get('${key}')`))
  assert.ok(source.includes('item.id === requestedId'))
})
test('workbook searches exact source identities and canonical video names',()=>{
  const page=readFileSync('src/pages/admin/NolanOverview.tsx','utf8')
  assert.ok(page.includes('t.bucket, t.id, t.native_id'))
  assert.ok(page.includes('v.title, v.canonical_name'))
  assert.ok(page.includes('d.code, d.id'))
  assert.ok(page.includes('href: nolanScheduleRecordHref(d)'))
})

test('Planner task dates disclose existing due/start fallback rather than inventing a due date',()=>{
  const page=readFileSync('src/pages/admin/NolanOverview.tsx','utf8')
  const adapter=readFileSync('src/lib/commandCentre.ts','utf8')
  assert.ok(adapter.includes("due_date: row.due_date ?? row.start_date ?? ''"))
  assert.ok(page.includes("dateLabel: t.data_origin === 'planner_tasks' ? 'Task date (due/start fallback)' : 'Recorded due date'"))
  const html=renderToStaticMarkup(React.createElement(Identity,{source:'Dynamics Planner task',recordId:'fixture',dueDate:'2026-11-16',dateLabel:'Task date (due/start fallback)'}))
  assert.ok(html.includes('Task date (due/start fallback)'))
  assert.ok(!html.includes('Recorded due date'))
})
