import assert from 'node:assert/strict'
import {before,after,test} from 'node:test'
import {createServer} from 'vite'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {MemoryRouter} from 'react-router-dom'
let server, MasterScope, age, latest, load, masterPage, notePreview, masterSummary
const id='00000000-0000-4000-8000-000000000001'
const owner='00000000-0000-4000-8000-000000000002'
const task={id:'planner:'+id,native_id:id,data_origin:'planner_tasks',title:'Private existing task',status:'in_progress',planner_status:'approved',assigned_to_user_id:owner,assigned_to_name:'Untrusted imported alias',assignment_review_state:'ok',bucket:'Websites',updated_at:'2020-01-01T00:00:00Z',notes:'Agent: invented agent; device: invented machine; next: ship',client_name:null}
const row={id:'audit-1',entity_type:'planner_task',entity_id:id,action:'comment',actor_user_id:owner,actor_name:'Imported actor text',metadata:null,created_at:'2020-01-01T00:00:00Z'}
before(async()=>{server=await createServer({root:process.cwd(),logLevel:'error',server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});({MasterScope}=await server.ssrLoadModule('/src/pages/admin/NolanMasterScope.tsx'));({nolanEvidenceAge:age,nolanLatestTaskActivity:latest}=await server.ssrLoadModule('/src/lib/nolanTaskEvidence.ts'));({loadNolanTaskActivity:load}=await server.ssrLoadModule('/src/lib/nolanTaskActivity.ts'));({nolanMasterPage:masterPage,nolanNotePreview:notePreview,nolanMasterSummary:masterSummary}=await server.ssrLoadModule('/src/lib/nolanMasterPresentation.ts'))})
after(async()=>{await server?.close()})
const render=props=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(MasterScope,props)))
test('master denies task evidence for absent, team and client roles',()=>{for(const role of ['', 'team','client']){const html=render({role,tasks:[task]});assert.match(html,/Manager access required/);assert.doesNotMatch(html,/Private existing task|invented machine/)}})
test('master uses canonical owner and raw workflow status without inferring agent, device or verified actions',()=>{const html=render({role:'manager',tasks:[task],directory:new Map([[owner,'Canonical Person']]),sourceUnavailable:false,checkedAt:'2026-11-16T00:00:00Z'});assert.match(html,/Canonical owner: Canonical Person/);assert.match(html,/Approved/);assert.match(html,/Execution agent<\/dt><dd>Unknown/);assert.match(html,/Execution device<\/dt><dd>Unknown/);assert.match(html,/Verified next action<\/dt><dd>Unknown/);assert.match(html,/Last verified execution action: Unknown/);assert.match(html,/Recorded source notes — unverified instructions/);assert.match(html,/Historical evidence/);assert.match(html,/board&amp;id=00000000-0000-4000-8000-000000000001/);assert.doesNotMatch(html,/Canonical owner: Untrusted/)})
test('unavailable directory is unknown ownership and retained rows explicitly remain stale',()=>{const html=render({role:'admin',tasks:[task],directory:null,sourceUnavailable:true});assert.match(html,/Owner profile evidence unavailable/);assert.match(html,/retained records are stale/);assert.match(html,/status is last-known/);assert.doesNotMatch(html,/Canonical owner: Unassigned|Task source read completed/)})
test('completed tasks keep done status while old evidence and empty/error states remain distinct',()=>{const completed=render({role:'manager',tasks:[{...task,status:'done',planner_status:'done'}],sourceUnavailable:false});assert.match(completed,/Completed history: 1/);assert.doesNotMatch(completed,/class="card nolan-master-task"/);const empty=render({role:'manager',tasks:[],sourceUnavailable:false});assert.match(empty,/No matching task evidence/);assert.match(empty,/Task source read completed/);const failed=render({role:'manager',tasks:[]});assert.match(failed,/Task source unavailable/)})
test('age never turns a read receipt, missing/future timestamp or recent update into live execution proof',()=>{const now=Date.parse('2026-11-16T00:00:00Z');assert.match(age(null,now),/Unknown age/);assert.match(age('bad',now),/Unknown age/);assert.match(age('2027-01-01',now),/Unknown age/);assert.match(age('2026-11-15',now),/not live execution proof/);assert.match(age('2026-11-01',now),/Historical evidence/)})
test('activity selection fails closed on foreign task/type, absent result or invalid evidence',()=>{assert.equal(latest(id,[]),null);assert.throws(()=>latest(id,null));assert.throws(()=>latest(id,[{...row,entity_id:owner}]),/identity mismatch/);assert.throws(()=>latest(id,[{...row,entity_type:'monthly_deliverable'}]),/identity mismatch/);assert.throws(()=>latest(id,[{...row,created_at:'bad'}]),/invalid timestamp/);assert.equal(latest(id,[row,{...row,id:'audit-2',created_at:'2021-01-01T00:00:00Z'}]).id,'audit-2')})
test('lazy reader denies unauthorized roles before access and binds exact native task identity',async()=>{let calls=0;const reader=async requested=>{calls++;assert.equal(requested,id);return {data:[row],error:null}};for(const role of ['','team','client'])await assert.rejects(load(id,role,reader),/Manager access/);await assert.rejects(load('planner:'+id,'admin',reader),/identity/);assert.equal(calls,0);const result=await load(id,'manager',reader);assert.equal(calls,1);assert.equal(result.taskId,id);assert.equal(result.row.id,'audit-1');assert(Number.isFinite(Date.parse(result.checkedAt)))})
test('reader error and null result never produce a successful empty/latest action claim',async()=>{await assert.rejects(load(id,'admin',async()=>({data:[row],error:{message:'denied'}})),/denied/);await assert.rejects(load(id,'admin',async()=>({data:null,error:null})),/no verifiable result/)})

test('conflicting assignment is not promoted to a person or execution agent',()=>{const html=render({role:'manager',tasks:[{...task,assignment_review_state:'conflict'}],directory:new Map([[owner,'Canonical Person']]),sourceUnavailable:false});assert.match(html,/Canonical owner: Assignment conflict/);assert.doesNotMatch(html,/Canonical owner: Canonical Person/);assert.match(html,/Execution agent<\/dt><dd>Unknown/)})


test('near-megabyte notes render only a literal bounded excerpt and retain the authoritative source link',()=>{
 const notes='Historical note. '.repeat(62000)+'SECRET_TAIL_NOT_IN_DOM'
 const input={...task,notes}
 const html=render({role:'manager',tasks:[input],sourceUnavailable:false})
 assert(notes.length>982812)
 assert.equal(notePreview(notes).text.length,600)
 assert.equal(notePreview(notes).truncated,true)
 assert(html.length<18000, 'Closed details must not contain the full note log')
 assert.doesNotMatch(html,/SECRET_TAIL_NOT_IN_DOM/)
 assert.match(html,/Truncated source excerpt/)
 assert.match(html,/Full notes remain in the authoritative task workspace/)
 assert.match(html,/Read full notes at source/)
 assert.match(html,/Verified next action<\/dt><dd>Unknown/)
 assert.equal(input.notes,notes,'Presentation must never truncate the canonical source')
 assert.doesNotMatch(render({role:'client',tasks:[input]}),/Historical note|SECRET_TAIL|Read full notes/)
 assert.deepEqual(notePreview(null),{text:'',truncated:false})
 assert.deepEqual(notePreview('literal <script>not an instruction</script>'),{text:'literal <script>not an instruction</script>',truncated:false})
 assert.equal(notePreview('a'.repeat(599)+'😀tail').text,'a'.repeat(599))
})

test('long task lists render twelve cards while paging/search/status/owner filters retain all authorized records',()=>{
 const tasks=Array.from({length:1001},(_,i)=>({...task,id:'task-'+i,native_id:'native-'+i,title:'Record '+i,notes:'do not infer next action '+i,status:i===1000?'done':'in_progress',planner_status:i===1000?'done':'approved'}))
 const filters={query:'',status:'',ownership:'',lifecycle:'all'}
 const html=render({role:'manager',tasks,sourceUnavailable:false})
 assert.equal((html.match(/class="card nolan-master-task"/g)||[]).length,12)
 assert.match(html,/Showing 1–12 of 1000/)
 assert.doesNotMatch(html,/>Record 1000</)
 const seen=[]
 for(let page=0;page<84;page++)seen.push(...masterPage(tasks,null,filters,page).rows.map(row=>row.id))
 assert.deepEqual(seen,tasks.map(row=>row.id))
 const found=masterPage(tasks,new Map([[owner,'Canonical Person']]),{query:'native-1000',status:'Done',ownership:'verified',lifecycle:'all'},50)
 assert.equal(found.page,0);assert.equal(found.total,1);assert.equal(found.rows[0].id,'task-1000')
 assert.equal(masterPage(tasks,null,{...filters,query:'do not infer next action'},0).total,0,'Notes are not promoted into task identity or plans')
 assert.equal(masterPage(tasks,null,filters,999).rows.length,5)
 assert.equal(masterPage(tasks.slice(0,1),null,filters,83).page,0,'Shrinking refreshed data clamps the current page')
 assert.deepEqual(masterPage([],null,filters,3),{rows:[],total:0,page:0,pages:1,from:0,to:0})
 assert.equal(masterPage(tasks,null,filters,-1).page,0)
 assert.equal(masterPage(tasks,null,filters,NaN).page,0)
})


test('operational summary keeps approved/scheduled/reopened/deferred tasks active and completed history explicit',()=>{
 const tasks=[
  {...task,id:'approved'}, {...task,id:'scheduled',planner_status:'scheduled'},
  {...task,id:'blocked',status:'blocked',planner_status:'blocked'},
  {...task,id:'waiting',status:'waiting_client',planner_status:'waiting_client'},
  {...task,id:'deferred',status:'moved_to_tomorrow',planner_status:'moved_to_tomorrow'},
  {...task,id:'reopened',status:'to_do',planner_status:'to_do',completed_at:'2026-01-01'},
  {...task,id:'unassigned',assigned_to_user_id:null,assigned_to_name:null},
  {...task,id:'done',status:'done',planner_status:'done'},
  {...task,id:'legacy',status:'completed',planner_status:'completed'},
 ]
 const directory=new Map([[owner,'Canonical Person']])
 assert.deepEqual(masterSummary(tasks,directory),{active:7,completed:2,blocked:1,waiting:1,unassigned:1,ownershipUnknown:0})
 const filters={query:'',status:'',ownership:''}
 assert.deepEqual(masterPage(tasks,directory,filters,0).rows.map(t=>t.id),tasks.slice(0,7).map(t=>t.id))
 assert.deepEqual(masterPage(tasks,directory,{...filters,lifecycle:'history'},0).rows.map(t=>t.id),['done','legacy'])
 assert.equal(masterPage(tasks,directory,{...filters,lifecycle:'all'},0).total,9)
 assert.equal(masterPage(tasks,directory,{...filters,status:'Approved'},0).total,2)
 assert.equal(masterPage(tasks,directory,{...filters,status:'Scheduled'},0).rows[0].id,'scheduled')
 assert.equal(masterPage(tasks,directory,{...filters,status:'Blocked'},0).rows[0].id,'blocked')
 assert.equal(masterPage(tasks,directory,{...filters,status:'Waiting client'},0).rows[0].id,'waiting')
 assert.equal(masterPage(tasks,directory,{...filters,ownership:'unassigned'},0).rows[0].id,'unassigned')
 assert.equal(masterPage(tasks,directory,{...filters,lifecycle:'history',query:'legacy'},8).rows[0].id,'legacy')
 const html=render({role:'manager',tasks,directory,sourceUnavailable:false})
 assert.match(html,/Active work: 7/);assert.match(html,/Blocked: 1/);assert.match(html,/Waiting client: 1/);assert.match(html,/Completed history: 2/)
 assert.match(html,/not company or fleet totals/);assert.doesNotMatch(html,/overdue|deadline/i)
})

test('summary distinguishes unavailable/refreshing zero from a successful empty visible snapshot and unknown owners',()=>{
 const unavailable=render({role:'manager',tasks:[],sourceUnavailable:true})
 assert.match(unavailable,/Active work: Unknown/);assert.match(unavailable,/Counts unavailable/);assert.doesNotMatch(unavailable,/Active work: 0/)
 const refreshing=render({role:'manager',tasks:[],sourceUnavailable:false,loading:true})
 assert.match(refreshing,/Active work: Unknown/)
 const empty=render({role:'manager',tasks:[],directory:new Map(),sourceUnavailable:false})
 assert.match(empty,/Active work: 0/);assert.match(empty,/Task source read completed/)
 const stale=render({role:'manager',tasks:[task],sourceUnavailable:true})
 assert.match(stale,/Active work: 1 last-known/);assert.match(stale,/not current verification/)
 assert.match(stale,/Unassigned active: Unknown/);assert.match(stale,/not counted as unassigned/)
 const unavailableOwner=masterSummary([task],new Map())
 assert.equal(unavailableOwner.unassigned,0);assert.equal(unavailableOwner.ownershipUnknown,1)
 assert.equal(masterSummary([task],null).unassigned,null)
})
