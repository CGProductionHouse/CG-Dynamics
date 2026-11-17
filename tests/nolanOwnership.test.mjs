import assert from 'node:assert/strict'
import {before,after,test} from 'node:test'
import {createServer} from 'vite'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
let server, rules, lanes, Component
const directory=new Map([['u1','Canonical owner']])
const base={status:'to_do',assigned_to_user_id:'u1',assignment_review_state:'ok',assigned_to_name:'Stale imported name'}
before(async()=>{server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});rules=await server.ssrLoadModule('/src/lib/nolanOwnership.ts');lanes=await server.ssrLoadModule('/src/lib/nolanSourceLanes.ts');({NolanTaskOwnership:Component}=await server.ssrLoadModule('/src/pages/admin/NolanTaskOwnership.tsx'))})
after(async()=>{await server?.close()})
test('canonical directory name wins, not imported names or helpers',()=>{
 assert.equal(rules.nolanTaskOwnerLabel({...base,helper_names:['Helper']},directory),'Canonical owner')
 assert.equal(lanes.taskInNolanLane(base,'needs','u1',directory),true)
})
test('conflicts and unresolved names cannot appear in personal assigned work',()=>{
 for(const task of [{...base,assignment_review_state:'conflict'},{...base,unresolved_assignee_names:['Unknown']}]){
 assert.equal(lanes.taskInNolanLane(task,'needs','u1',directory),false)
 assert.equal(lanes.taskInNolanLane(task,'ownership',undefined,directory),true)
 }
})
test('missing directory or missing owner profile does not manufacture unassigned work',()=>{
 for(const dir of [null,new Map(),new Map([['other','Other']])]){
 assert.equal(rules.nolanTaskOwnership(base,dir),null)
 assert.equal(lanes.taskInNolanLane(base,'ownership',undefined,dir),false)
 }
})
test('no canonical assignment is reviewable without assigning imported person or helper',()=>{
 const task={...base,assigned_to_user_id:null,helper_names:['Helper']}
 assert.equal(lanes.taskInNolanLane(task,'ownership',undefined,directory),true)
 assert.equal(rules.nolanTaskOwnerLabel(task,directory),'Unassigned')
 assert.equal(lanes.taskInNolanLane({...task,status:'done'},'ownership',undefined,directory),false)
})
test('partial canonical owner resolution is not complete ownership evidence',()=>{
 assert.equal(rules.nolanTaskOwnership({...base,assignee_user_ids:['u1','missing']},directory),null)
})
test('rendered ownership evidence separates helpers/imports and escapes source text',()=>{
 const html=renderToStaticMarkup(React.createElement(Component,{task:{...base,assigned_to_name:'<script>x</script>',helper_names:['Helper']},directory}))
 assert.ok(html.includes('Canonical owner'))
 assert.ok(html.includes('Recorded helpers, not owners'))
 assert.ok(html.includes('Imported assignment text, not ownership proof'))
 assert.ok(!html.includes('<script>'))
})
test('search includes the canonical owner label actually displayed on task rows',async()=>{
 const {readFileSync}=await import('node:fs')
 const page=readFileSync('src/pages/admin/NolanOverview.tsx','utf8')
 assert.ok(page.includes('t.native_id, nolanTaskOwnerLabel(t, snapshot?.staff ?? null)'))
 assert.equal(rules.nolanTaskOwnerLabel(base,directory).toLowerCase().includes('canonical owner'),true)
})
