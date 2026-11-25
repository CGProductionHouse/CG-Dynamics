import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

const source=readFileSync('src/lib/contentWorkflow.ts','utf8')
const start=source.indexOf('export async function createRunWithCalendarEvent(')
const end=source.indexOf('// Update a run and keep',start)
const js=ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
const input={name:'Real requested shoot',client_id:'client',run_date:'2026-12-08'}

function fixture({trigger=true,readFailure=false,foreign=false,lostInsert=false,changedRevision=false}={}){
  let mirrored=null,inserts=0,events=0,updates=0,cancels=0
  const supabase={from(table){assert.equal(table,'content_runs');let patch=null;const filters=[]
    return {select(){return this},eq(key,value){filters.push([key,value]);return this},is(key,value){filters.push([key,value]);return this},update(value){patch=value;return this},async maybeSingle(){
      if(readFailure)return {data:null,error:{message:'Unavailable read'}}
      if(patch){updates++;if(changedRevision||!filters.every(([k,v])=>mirrored?.[k]===v))return {data:null,error:null};Object.assign(mirrored,patch)}
      return {data:mirrored,error:null}
    }}
  }}
  const dependencies={supabase,
    runStartIso:()=> '2026-12-08T07:00:00Z',mapRunStatusToCalendar:()=> 'planned',
    createCompanyEvent:async()=>{events++;if(trigger)mirrored={id:'canonical-run',client_id:foreign?'foreign':'client',calendar_event_id:'event',updated_at:'original'};return {data:{id:'event'},error:null}},
    createRun:async row=>{inserts++;mirrored={...row,id:'canonical-run',updated_at:'original'};return {data:lostInsert?null:mirrored,error:lostInsert?'Lost accepted response':null}},
    updateCompanyEvent:async()=>{cancels++},wrap:(data,error)=>({data,error,migrationNeeded:false}),
  }
  const fn=new Function(...Object.keys(dependencies),`var exports={};${js};return createRunWithCalendarEvent`)(...Object.values(dependencies))
  return {call:args=>fn(args),state:()=>({mirrored,inserts,events,updates,cancels})}
}

test('actual create path reuses the trigger-created run instead of inserting/cancelling the booking',async()=>{
  const f=fixture(),saved=await f.call(input)
  assert.equal(saved.data.id,'canonical-run');assert.equal(f.state().events,1);assert.equal(f.state().inserts,0);assert.equal(f.state().cancels,0)
})
test('new operational metadata updates only the exact mirrored revision',async()=>{
  const f=fixture(),saved=await f.call({...input,helper_names:['Actual helper'],internal_notes:'Keep real source notes'})
  assert.deepEqual(saved.data.helper_names,['Actual helper']);assert.equal(f.state().updates,1);assert.equal(f.state().inserts,0)
})
test('a concurrent operational edit stays preserved and the real booking is never cancelled',async()=>{
  const f=fixture({changedRevision:true}),saved=await f.call({...input,internal_notes:'Requested note'})
  assert.ok(saved.error);assert.equal(f.state().mirrored.internal_notes,undefined);assert.equal(f.state().cancels,0)
})
test('a failed mirror read or foreign client cannot cause a second insert or destructive compensation',async()=>{
  for(const options of [{readFailure:true},{foreign:true}]){const f=fixture(options),saved=await f.call(input);assert.ok(saved.error);assert.equal(f.state().inserts,0);assert.equal(f.state().cancels,0)}
})
test('legacy trigger absence and a lost accepted insert recover the same exact run',async()=>{
  const f=fixture({trigger:false,lostInsert:true}),saved=await f.call(input)
  assert.equal(saved.data.id,'canonical-run');assert.equal(f.state().events,1);assert.equal(f.state().inserts,1);assert.equal(f.state().cancels,0)
})
test('undated preparation never invents a calendar event or shoot time',async()=>{
  const f=fixture(),saved=await f.call({...input,run_date:null})
  assert.equal(saved.data.run_date,null);assert.equal(f.state().events,0);assert.equal(f.state().inserts,1)
})
