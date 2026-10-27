import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import ts from 'typescript'
import { cgDayBounds, cgDatePlusDays, CG_TIMEZONE } from '../supabase/functions/cg-dynamics-mcp/cgTime.ts'
import { CALENDAR_MICROSOFT_FIELDS, withSourceLinkage } from '../supabase/functions/cg-dynamics-mcp/microsoftSourceFields.ts'
import { CG_DYNAMICS_MCP_TOOLS } from '../supabase/functions/cg-dynamics-mcp/toolCatalog.ts'
const path='supabase/functions/cg-dynamics-mcp/index.ts'
const source=process.env.CG_MCP_BASELINE==='1'?execFileSync('git',['show',`HEAD:${path}`],{encoding:'utf8'}):readFileSync(path,'utf8')
const a=source.indexOf('const handleListMyCalendar:'),b=source.indexOf('const handleListClientSchedule:',a)
const compiled=ts.transpileModule(source.slice(a,b),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
const handler=new Function('cgDayBounds','cgDatePlusDays','CG_TIMEZONE','CALENDAR_MICROSOFT_FIELDS','withSourceLinkage',`${compiled};return handleListMyCalendar`)(cgDayBounds,cgDatePlusDays,CG_TIMEZONE,CALENDAR_MICROSOFT_FIELDS,withSourceLinkage)
const input={from:'2026-10-01',to:'2026-10-31'}
const row=(id,extra={})=>({id,title:'Synthetic event',start_at:'2026-10-03T08:00:00Z',end_at:'2026-10-03T09:00:00Z',status:'planned',...extra})
async function read(rows,args=input,mode='ok'){
  const calls=[];let first=0,last=999;const filters=[]
  const q={select(){return this},gte(k,v){filters.push(r=>r[k]>=v);return this},lte(k,v){filters.push(r=>r[k]<=v);return this},
    lt(k,v){calls.push(['lt',k,v]);filters.push(r=>Date.parse(r[k])<Date.parse(v));return this},
    or(v){calls.push(['or',v]);const from=v.match(/end_at.gt.([^,]+)/)[1];filters.push(r=>r.end_at?Date.parse(r.end_at)>Date.parse(from):Date.parse(r.start_at)>=Date.parse(from));return this},
    neq(k,v){calls.push(['neq',k,v]);filters.push(r=>r[k]!==v);return this},is(k,v){calls.push(['is',k,v]);filters.push(r=>(r[k]??null)===v);return this},
    order(...v){calls.push(['order',...v]);return this},limit(n){last=n-1;return this},range(a,b){first=a;last=b;calls.push(['range',a,b]);return this},
    then(resolve,reject){if(mode==='throw')return Promise.reject(Error('PRIVATE')).then(resolve,reject);return Promise.resolve({data:Array.isArray(rows)?rows.filter(r=>!r||filters.every(f=>f(r))).slice(first,last+1):rows,error:mode==='error'?{message:'PRIVATE'}:null}).then(resolve,reject)},
  }
  return{result:await handler({supabase:{from(t){calls.push(['from',t]);return q}}},args),calls}
}
test('actual calendar handler reads all 117 events across bounded stable pages',async()=>{
  const rows=Array.from({length:117},(_,i)=>row(`event-${String(i).padStart(3,'0')}`)),all=[];let offset=0
  for(let i=0;i<3;i++){const{result,calls}=await read(rows,{...input,offset});assert.equal(result.error,null);assert.equal(result.pagination.has_more,i<2);assert.equal(result.pagination.total_count,null);all.push(...result.events);offset=result.pagination.next_offset;assert.deepEqual(calls.filter(c=>c[0]==='order'),[['order','start_at',{ascending:true}],['order','id',{ascending:true}]]);assert.ok(calls.some(c=>c[0]==='range'))}
  assert.equal(all.length,117);assert.equal(new Set(all.map(r=>r.id)).size,117)
})
test('Johannesburg overlap includes prior-day spans and local midnight, excludes next month/cancelled/removed/superseded',async()=>{
  const rows=[row('span',{start_at:'2026-09-30T18:00:00Z',end_at:'2026-10-01T01:00:00Z'}),row('local',{start_at:'2026-09-30T22:30:00Z',end_at:'2026-09-30T23:00:00Z'}),row('late',{start_at:'2026-10-31T21:59:59.999Z',end_at:null}),row('nov',{start_at:'2026-10-31T22:00:00Z',end_at:null}),row('cancel',{status:'cancelled'}),row('old',{superseded_by_event_id:'canonical'}),row('removed',{microsoft_source_removed_at:'2026-10-03T10:00:00Z'})]
  const{result}=await read(rows);assert.equal(result.error,null);assert.deepEqual(result.events.map(r=>r.id),['span','local','late']);assert.equal(result.timezone,'Africa/Johannesburg');assert.equal(result.range.to_exclusive,'2026-11-01T00:00:00+02:00')
})
test('missing, failed, rejected and duplicate calendar reads are unknown, not empty successful coverage',async()=>{
  const empty=(await read([])).result;assert.equal(empty.error,null);assert.equal(empty.pagination.has_more,false)
  for(const[rows,mode]of[[null,'ok'],[[],'error'],[[],'throw'],[[row('duplicate'),row('duplicate')],'ok'],[[null],'ok']]){const{result}=await read(rows,input,mode);assert.ok(result.error);assert.equal(result.pagination.has_more,null);assert.deepEqual(result.events,[]);assert.doesNotMatch(JSON.stringify(result),/PRIVATE/)}
})
test('invalid calendar input cannot query; cap truth and schema retain the existing read-only tool',async()=>{
  for(const args of[{...input,offset:-1},{...input,offset:0.5},{...input,offset:'50'},{...input,from:'2026-02-30'},{...input,to:'2026-09-01'}]){const{result,calls}=await read([],args);assert.ok(result.error);assert.deepEqual(calls,[])}
  const tool=CG_DYNAMICS_MCP_TOOLS.find(t=>t.name==='list_my_calendar');assert.equal(tool.inputSchema.properties.offset.maximum,100000);assert.equal(tool.annotations.readOnlyHint,true)
  const rows=Array.from({length:100051},(_,i)=>row(`item-${i}`));const{result}=await read(rows,{...input,offset:100000});assert.equal(result.pagination.has_more,true);assert.equal(result.pagination.next_offset,null);assert.equal(result.pagination.continuation_blocked,'NARROW_DATE_RANGE')
})
