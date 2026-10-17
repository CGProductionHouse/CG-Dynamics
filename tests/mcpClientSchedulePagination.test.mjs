import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
import { CLIENT_SCHEDULE_SELECT, flattenDeliverableClient } from '../supabase/functions/cg-dynamics-mcp/clientScheduleRows.ts'
import { CG_DYNAMICS_MCP_TOOLS } from '../supabase/functions/cg-dynamics-mcp/toolCatalog.ts'

const source=readFileSync(new URL('../supabase/functions/cg-dynamics-mcp/index.ts',import.meta.url),'utf8')
const start=source.indexOf('const handleListClientSchedule:')
const end=source.indexOf('const handleFindContentRuns:',start)
assert.ok(start>=0&&end>start)
const compiled=ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
const handler=new Function('CLIENT_SCHEDULE_SELECT','flattenDeliverableClient',`${compiled};return handleListClientSchedule`)(CLIENT_SCHEDULE_SELECT,flattenDeliverableClient)
const base={from:'2026-10-01',to:'2026-11-30'}

async function read(rows,input=base,mode='ok'){
  const calls=[];let first=0,last=999,client=null
  const query={
    select(value){calls.push(['select',value]);return this},
    gte(...args){calls.push(['gte',...args]);return this},lte(...args){calls.push(['lte',...args]);return this},
    order(...args){calls.push(['order',...args]);return this},
    eq(key,value){calls.push(['eq',key,value]);client=value;return this},
    limit(count){last=count-1;calls.push(['limit',count]);return this},
    range(from,to){first=from;last=to;calls.push(['range',from,to]);return this},
    then(resolve,reject){
      if(mode==='reject')return Promise.reject(Error('PRIVATE transport')).then(resolve,reject)
      const data=rows===null?null:rows.filter(row=>!client||row.client_id===client).slice(first,last+1)
      return Promise.resolve({data,error:mode==='failure'?{message:'PRIVATE backend'}:null}).then(resolve,reject)
    },
  }
  const result=await handler({supabase:{from(table){calls.push(['from',table]);return query}}},input)
  return{result,calls}
}

test('actual schedule tool exposes every page past fifty without claiming the first page is complete',async()=>{
  const rows=Array.from({length:117},(_,i)=>({id:`item-${String(i).padStart(3,'0')}`,client_id:'exact-client',scheduled_date:'2026-10-20',client:{name:'Exact client'}}))
  const all=[];let offset=0
  for(let page=0;page<3;page++){
    const {result,calls}=await read(rows,{...base,client_id:'exact-client',offset})
    assert.equal(result.error,null)
    assert.equal(result.pagination.has_more,page<2)
    assert.equal(result.pagination.next_offset,page<2?offset+50:null)
    assert.equal(result.pagination.page_size,50)
    assert.equal(result.pagination.total_count,null,'A page is not an exact total')
    assert.deepEqual(calls.filter(([method])=>method==='order'),[['order','scheduled_date',{ascending:true}],['order','id',{ascending:true}]])
    assert.ok(calls.some(call=>JSON.stringify(call)===JSON.stringify(['range',offset,offset+50])),'One sentinel row, bounded read')
    assert.ok(calls.some(call=>JSON.stringify(call)===JSON.stringify(['eq','client_id','exact-client'])))
    assert.ok(!calls.some(([method])=>['insert','update','upsert','delete'].includes(method)))
    all.push(...result.deliverables);offset=result.pagination.next_offset
  }
  assert.equal(all.length,117)
  assert.equal(new Set(all.map(row=>row.id)).size,117)
  assert.ok(all.every(row=>row.client_name==='Exact client'&&!('client'in row)))
})

test('empty, missing and failed schedule pages stay distinct; invalid paging never issues a query',async()=>{
  const empty=(await read([])).result
  assert.equal(empty.error,null);assert.equal(empty.pagination.has_more,false);assert.deepEqual(empty.deliverables,[])
  for(const [rows,mode]of[[null,'ok'],[[],'failure'],[[],'reject']]){
    const result=(await read(rows,base,mode)).result
    assert.ok(result.error);assert.deepEqual(result.deliverables,[])
    assert.equal(result.pagination.has_more,null,'Unknown coverage is not complete')
    assert.doesNotMatch(JSON.stringify(result),/PRIVATE/)
  }
  for(const offset of[-1,0.5,'50',Number.MAX_SAFE_INTEGER,100001]){
    const{result,calls}=await read([],{...base,offset})
    assert.ok(result.error);assert.deepEqual(calls,[])
  }
})

test('schedule paging remains read-only and the safety cap cannot masquerade as complete',async()=>{
  const tool=CG_DYNAMICS_MCP_TOOLS.find(tool=>tool.name==='list_client_schedule')
  assert.equal(tool.annotations.readOnlyHint,true)
  assert.equal(tool.annotations.destructiveHint,false)
  assert.deepEqual(tool.inputSchema.properties.offset.type,'integer')
  assert.match(tool.description,/undated|Undated/)
  const rows=Array.from({length:100051},(_,i)=>({id:`item-${i}`,scheduled_date:'2026-10-20'}))
  const result=(await read(rows,{...base,offset:100000})).result
  assert.equal(result.pagination.has_more,true)
  assert.equal(result.pagination.next_offset,null)
  assert.equal(result.pagination.continuation_blocked,'NARROW_DATE_RANGE')
  assert.equal(result.deliverables.length,50)
})
