import assert from 'node:assert/strict'
import test from 'node:test'
import {verifyCapturedSchedulePages} from '../scripts/lib/captured-schedule-pages.mjs'

import {id,clients,pages} from './fixtures/capturedSchedulePages.mjs'
const verify=p=>verifyCapturedSchedulePages(p,{run_id:id(3),source_id:'oct',clients})
test('complete1051-card capture is22 contiguous pinned pages, not a new current-work authority',()=>{
  const packet=verify(pages())
  assert.equal(packet.records.length,1051);assert.equal(packet.page_count,22);assert.equal(packet.coverage,'complete_captured_source_only');assert.equal(packet.writes,0)
  assert.match(packet.receipt_sha256,/^[a-f0-9]{64}$/)
  assert.ok(packet.records.every(r=>r.due_date===null))
  assert.match(packet.limitation,/not current package/)
})
test('missing, reordered, repeated or over-reported pages cannot prove complete source coverage',()=>{
  for(const mutate of [p=>p.pop(),p=>p.shift(),p=>p.reverse(),p=>p.push(p.at(-1)),p=>p[1].records[0].source_task_id=p[0].records[0].source_task_id,p=>p[1].pagination.offset=51,p=>p[0].pagination.next_offset=100,p=>p.at(-1).pagination.has_more=true,p=>p[1].records.pop(),p=>p[1].source_record_count=1050]){
    const p=pages();mutate(p);assert.throws(()=>verify(p),/Captured schedule pages/)
  }
})
test('exact run, job, source, cutoff and both revisions are pinned without metadata substitutions',()=>{
  for(const field of ['run_id','job_id','source_id','source_name','captured_at','source_revision','directory_revision']){const p=pages();p[1][field]=field.endsWith('_id')?id(8):'changed';assert.throws(()=>verify(p),/Captured schedule pages/)}
  for(const mutate of [p=>p[0].source_complete=false,p=>p[0].error='unavailable',p=>p[0].coverage='unknown',p=>p[0].records[0].source_plan_id='foreign']){const p=pages();mutate(p);assert.throws(()=>verify(p),/Captured schedule pages/)}
})
test('cross-client, inactive, invalid format/date and contradictory bucket identity refuse the whole receipt',()=>{
  for(const mutate of [r=>r.client_id=id(2),r=>r.client_name='Different client',r=>r.client_id=id(9),r=>r.code='DP999',r=>{r.deliverable_type='unsupported';delete r.code},r=>r.due_date='2026-02-30',r=>r.evidence_state='approved',r=>r.instance_number=0]){const p=pages();mutate(p[0].records[0]);assert.throws(()=>verify(p),/Captured schedule pages/)}
  assert.throws(()=>verifyCapturedSchedulePages(pages(),{run_id:id(3),source_id:'oct',clients:[...clients,clients[0]]}),/Captured schedule pages/)
})
test('held references are counted but cannot leak copy, identities or become numbered capacity',()=>{
  const p=pages(1),r=p[0].records[0]
  Object.assign(r,{client_id:null,client_name:null,code:null,deliverable_type:null,instance_number:null,percent_complete:null,evidence_state:'private_review_held',description:'private text',provider_token:'never copy'})
  const receipt=verify(p)
  assert.equal(receipt.records[0].evidence_state,'private_review_held')
  assert.ok(!JSON.stringify(receipt).includes('private text'));assert.ok(!JSON.stringify(receipt).includes('never copy'))
  r.due_date='2026-10-21';assert.throws(()=>verify(p),/Captured schedule pages/)
})
test('explicit complete zero is valid; unavailable or missing pages are not zero',()=>{
  assert.equal(verify(pages(0)).records.length,0)
  for(const p of [[],null,[{error:'read failed'}]])assert.throws(()=>verify(p),/Captured schedule pages/)
})
