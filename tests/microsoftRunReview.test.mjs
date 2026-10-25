import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import ts from 'typescript'
import {microsoftConflictCount,microsoftRunOutcome,buildMicrosoftRunReview} from '../src/lib/microsoftRunReview.ts'

const source=readFileSync('src/pages/admin/MicrosoftImportPage.tsx','utf8')
test('actual history component reports the automatic383-conflict contract rather than fake zero',()=>{
  const fragment=source.slice(source.indexOf('function RunHistory('),source.indexOf('// Which preview job'))
  const js=ts.transpileModule(fragment,{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText
  const RunHistory=new Function('React','microsoftConflictCount',`${js};return RunHistory`)(React,microsoftConflictCount)
  const html=renderToStaticMarkup(React.createElement(RunHistory,{runs:[{id:'exact',createdAt:'2026-10-19T07:27:09Z',triggerType:'agent',snapshotExportedAt:'2026-10-19T07:27:07Z',sourceCompleteness:[],status:'partial',safeError:null,summary:{conflicts:383,applied:18,failed:0}}],onSelect(){}}))
  assert.match(html,/383 conflicts/)
  assert.doesNotMatch(html,/>0 conflicts/)
})
test('count aliases preserve real zero and reject unknown, invalid and contradictory counts',()=>{
  for(const summary of [{conflicts:0},{conflict:0},{conflictsUntouched:0}])assert.equal(microsoftConflictCount(summary),0)
  for(const summary of [{},{conflicts:null},{conflicts:-1},{conflicts:'383'},{conflicts:383,conflict:0}])assert.equal(microsoftConflictCount(summary),null)
  assert.equal(microsoftRunOutcome({status:'partial',summary:{conflicts:383,applied:18}}),'partial · 18 applied · 383 conflicts held for review')
  assert.match(microsoftRunOutcome({status:'partial',summary:{}}),/Unknown applied · Unknown conflicts/)
})
test('381 uncoded journal rows never become a383-item apply packet or expose private copy',()=>{
  const run={id:'run',snapshotExportedAt:'2026-10-19T07:27:07Z',finishedAt:'2026-10-19T07:35:09Z',status:'partial',summary:{conflicts:383}}
  const items=Array.from({length:381},(_,n)=>({id:'id'+n,itemKey:'key'+n,sourceType:'planner_task',sourceContainerId:'plan',sourceItemId:'task'+n,sourceName:'To Do',destination:'planner',destinationId:null,action:'conflict',resultStatus:'skipped',sourceComplete:true,details:{title:'private payroll sentinel',conflict_reason:'private bank sentinel'}}))
  const review=buildMicrosoftRunReview(run,items)
  assert.equal(review.coverage,'count_mismatch');assert.equal(review.count_gap,2);assert.equal(review.uncoded,381)
  assert.equal(review.apply_ready,false);assert.equal(review.writes,0)
  assert.ok(!JSON.stringify(review).includes('sentinel'))
  assert.ok(review.rows.every(row=>row.resolution==='fresh_canonical_preview_required'))
})
test('actual run selector refuses late responses from the previously selected run',async()=>{
  const fragment=source.slice(source.indexOf('async function selectRun('),source.indexOf('async function prepareRunRecovery('))
  const js=ts.transpileModule(fragment,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const state={selected:null,rows:[],read:null,error:null},pending={},request={current:0}
  const select=new Function('runItemsRequest','setSelectedRunId','setRunItems','setRunItemsState','loadMicrosoftSyncRunItems','setError',`${js};return selectRun`)(request,v=>state.selected=v,v=>state.rows=v,v=>state.read=v,id=>new Promise(resolve=>pending[id]=resolve),v=>state.error=v)
  const a=select('old'),b=select('new');pending.new({data:[{id:'new-only'}],error:null});await b
  pending.old({data:[],error:'old private error'});await a
  assert.equal(state.selected,'new');assert.deepEqual(state.rows,[{id:'new-only'}]);assert.equal(state.read,'ready');assert.equal(state.error,null)
  const c=select('failed');pending.failed({data:[],error:'Unavailable'});await c
  assert.deepEqual(state.rows,[]);assert.equal(state.read,'error')
})
