import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {transform} from 'esbuild'
const source=readFileSync(new URL('../src/lib/nolanDecisionRequests.ts',import.meta.url),'utf8')
const compiled=await transform(source,{loader:'ts',format:'cjs'})
const m={exports:{}};new Function('module','exports',compiled.code)(m,m.exports)
const {prepareDecisionRequest:prepare,selectPendingDecisions:select,decisionSourceKey:key}=m.exports
const draft={sourceType:'work_task',sourceId:'s1',expectedRevision:'r1',recipientProfileId:'p1',question:' Decide this ',idempotencyKey:'i1'}
const row={...prepare(draft),requestId:'q1',requestedByProfileId:'p2',requestedAt:'2026-11-16T07:00:00Z',state:'pending'}
const revisions=new Map([[key('work_task','s1'),'r1']])
test('producer requires explicit recipient/current revision and strips UI authority claims',()=>{
 assert.deepEqual(prepare({...draft,role:'admin',requestedByProfileId:'spoof',state:'resolved'}),{...draft,question:'Decide this'})
 for(const field of ['sourceId','expectedRevision','recipientProfileId','idempotencyKey','question']) assert.throws(()=>prepare({...draft,[field]:' '}))
 assert.throws(()=>prepare({...draft,sourceType:'notes'}))
 assert.throws(()=>prepare({...draft,question:'x'.repeat(4001)}))
})
test('only current pending requests addressed to viewer appear',()=>{
 assert.deepEqual(select('p1',[row],revisions,true).rows,[row])
 for(const state of ['resolved','withdrawn','superseded']) assert.deepEqual(select('p1',[{...row,state}],revisions,true).rows,[])
 assert.deepEqual(select('other',[row],revisions,true).rows,[])
 assert.deepEqual(select('p1',[row],new Map([[key('work_task','s1'),'r2']]),true).rows,[])
})
test('missing identity, partial source and missing revision fail closed not empty success',()=>{
 for(const args of [[null,[row],revisions,true],['p1',[row],revisions,false],['p1',[row],null,true],['p1',[row],new Map(),true]]) assert.equal(select(...args).state,'unavailable')
 assert.deepEqual(select('p1',[],new Map(),true),{state:'complete',rows:[]})
})
test('identity namespaces and duplicate ambiguity are preserved',()=>{
 assert.notEqual(key('work_task','s1'),key('video','s1'))
 assert.equal(select('p1',[row,row],revisions,true).state,'unavailable')
 assert.equal(select('p1',[{...row,state:'approved'}],revisions,true).state,'unavailable')
 assert.equal(select('p1',[{...row,requestedAt:'not-date'}],revisions,true).state,'unavailable')
 assert.equal(select('p1',[{...row,requestId:''}],revisions,true).state,'unavailable')
})
