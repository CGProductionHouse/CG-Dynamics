import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { fetchAllPages } from '../src/lib/paginatedQuery.ts'
import { isOperationallyCompletedStatus } from '../src/lib/taskLifecycle.ts'

const source=readFileSync('src/lib/planner.ts','utf8')
const part=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)))
const code=ts.transpileModule(part('function isMissingRecurrenceColumnError','type PlannerRpcError')+part('export async function listPlannerTasksDueBetween','export interface CalendarTaskRow'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
function load(rows,{nullPage=false,failPage=-1,repeat=false,legacy=false}={}){
  const calls=[];let from=0,to=999,columns
  const supabase={from(table){
    assert.equal(table,'planner_tasks_canonical')
    return {
      select(value){columns=value;return this},is(k,v){calls.push(['is',k,v]);return this},
      gte(k,v){calls.push(['gte',k,v]);return this},lt(k,v){calls.push(['lt',k,v]);return this},
      order(k){calls.push(['order',k]);return this},range(a,b){from=a;to=b;calls.push(['range',a,b]);return this},
      then(resolve,reject){return Promise.resolve(legacy&&columns.includes('recurrence_rule')
        ?{data:null,error:{code:'42703',message:'recurrence_rule missing'}}
        :{data:nullPage?null:rows.slice(repeat?0:from,repeat?1000:to+1),error:from===failPage?{message:'Page unavailable'}:null}).then(resolve,reject)}
    }
  }}
  const exports={}
  new Function('exports','supabase','fetchAllPages','isOperationallyCompletedStatus','PLANNER_TASKS_CANONICAL',code)(exports,supabase,fetchAllPages,isOperationallyCompletedStatus,'planner_tasks_canonical')
  return {read:()=>exports.listPlannerTasksDueBetween('2026-10-01','2026-11-01'),calls}
}
const row=(i,status='to_do')=>({id:`task-${String(i).padStart(4,'0')}`,title:'Synthetic',status,due_date:'2026-10-20',recurrence_rule:null})

test('actual optional Planner calendar layer pages beyond1000 and keeps active scheduling states visible',async()=>{
  const fixture=load([...Array.from({length:1001},(_,i)=>row(i)),row(1002,'approved'),row(1003,'scheduled'),row(1004,'moved_to_tomorrow'),row(1005,'done'),row(1006,'completed'),{...row(1007),recurrence_rule:'FREQ=DAILY'}])
  const result=await fixture.read()
  assert.equal(result.error,null)
  assert.equal(result.data.length,1004)
  for(const id of ['task-1000','task-1002','task-1003','task-1004'])assert.ok(result.data.some(task=>task.id===id))
  assert.ok(fixture.calls.some(c=>c[0]==='range'&&c[1]===1000))
  assert.ok(fixture.calls.some(c=>c[0]==='order'&&c[1]==='id'))
  assert.ok(fixture.calls.some(c=>c[0]==='is'&&c[1]==='microsoft_source_removed_at'))
})

test('calendar task page/null/repetition failures never become empty or partially verified work; legacy fallback stays paged',async()=>{
  const rows=Array.from({length:1001},(_,i)=>row(i))
  for(const options of [{nullPage:true},{failPage:1000},{repeat:true}]){
    const result=await load(rows,options).read()
    assert.ok(result.error)
    assert.equal(result.data,null)
  }
  const legacy=await load(rows,{legacy:true}).read()
  assert.equal(legacy.error,null)
  assert.equal(legacy.data.length,1001)
})
