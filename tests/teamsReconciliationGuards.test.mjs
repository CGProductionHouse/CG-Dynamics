import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import test from 'node:test'
import {pages} from './fixtures/capturedSchedulePages.mjs'

const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`
function fixture(){
  const bucket=(plan,bid)=>({id:bid,plan_id:plan,name:'Studio Exact',read_complete:true,expected_count:1,tasks:[{id:`${plan}-task`,plan_id:plan,bucket_id:bid,title:'DP1',percent_complete:0}]})
  return {cutoff:'synthetic',clients:[{id:id(1),name:'Studio Exact',active:true,package_settings:{design_posters_per_month:1,verification:{status:'confirmed',field_states:{design_posters_per_month:'known'}}}},{id:id(2),name:'Foreign Exact',active:true}],aliases:[],schedule:[],master:{plan_id:'master',authority:{kind:'owner_confirmed_master',source_ref:'owner'},bucket_list_complete:true,expected_bucket_count:1,buckets:[bucket('master','mb')]},months:[{month:'2026-10',period_authority:{kind:'owner_confirmed',plan_id:'oct',month:'2026-10',source_ref:'owner'},bucket_list_complete:true,expected_bucket_count:1,buckets:[bucket('oct','ob')]}]}
}
function audit(input){const dir=mkdtempSync(join(tmpdir(),'cg-teams-guards-'));try{const path=join(dir,'input.json');writeFileSync(path,JSON.stringify(input));return JSON.parse(execFileSync(process.execPath,['scripts/teams-readiness-audit.mjs',path],{encoding:'utf8',stdio:'pipe'}))}finally{rmSync(dir,{recursive:true,force:true})}}

test('duplicate canonical slots cannot be accepted as aligned package capacity or ready review',()=>{
  const input=fixture(),b=input.months[0].buckets[0]
  b.tasks.push({...b.tasks[0],id:'another',title:'DP 1'});b.expected_count=2
  input.clients[0].package_settings.design_posters_per_month=2
  const m=audit(input).months[0]
  assert.equal(m.buckets[0].comparison[0].verdict,'allocation_review_held')
  assert.equal(m.slot_review[0].state,'held')
})
test('same source task repeated across buckets cannot become two deliverables',()=>{
  const input=fixture(),month=input.months[0],b=structuredClone(month.buckets[0]);b.id='ob2';b.tasks[0].bucket_id=b.id;month.buckets.push(b);month.expected_bucket_count=2
  const result=audit(input).months[0]
  assert.equal(result.source_complete,false)
  assert.ok(result.buckets.every(b=>b.comparison.every(c=>c.verdict==='source_incomplete')))
})
test('a phrase, shortened suggestion or foreign-client title does not establish exact bucket evidence',()=>{
  for(const mutate of [i=>i.months[0].buckets[0].name='Studio Exact other work',i=>i.months[0].buckets[0].tasks[0].title='DP1 - Foreign Exact']){
    const input=fixture();mutate(input);const month=audit(input).months[0]
    assert.equal(month.slot_review[0].state,'held')
    assert.ok(month.buckets[0].comparison.every(c=>!['count_aligned_only','discuss_difference'].includes(c.verdict)))
  }
})
test('multiple exact client buckets require allocation review, not per-bucket package differences',()=>{
  const input=fixture(),month=input.months[0],b=structuredClone(month.buckets[0]);b.id='ob2';b.tasks[0]={...b.tasks[0],id:'different',bucket_id:b.id};month.buckets.push(b);month.expected_bucket_count=2
  const result=audit(input).months[0]
  assert.ok(result.buckets.every(b=>b.comparison.every(c=>c.verdict==='allocation_review_held')))
})
test('a unique exact pair never invents schedule dates or publication from completed progress',()=>{
  const input=fixture();input.months[0].buckets[0].tasks[0].percent_complete=100
  const result=audit(input),row=result.months[0]
  assert.equal(row.buckets[0].comparison[0].verdict,'count_aligned_only')
  assert.equal(row.slot_review[0].slots[0].verdict,'same_slot_cross_check_only')
  assert.equal(result.writes,0)
  assert.ok(!JSON.stringify(result).includes('scheduled_date'))
})

test('a real complete1051-card page receipt removes only the bucket cap, not package or period guards',()=>{
  const input=fixture(),b=input.months[0].buckets[0],p=pages()
  b.tasks=p.flatMap(page=>page.records.map(row=>({id:row.source_task_id,plan_id:'oct',bucket_id:'ob',title:row.code,percent_complete:0})))
  b.expected_count=b.tasks.length
  input.clients[0].package_settings.design_posters_per_month=1051
  assert.equal(audit(input).months[0].buckets[0].comparison[0].verdict,'source_incomplete')
  input.captured_evidence_reads=[{run_id:id(3),source_id:'oct',pages:p}]
  input.cutoff=p[0].captured_at
  let result=audit(input)
  assert.equal(result.months[0].buckets[0].comparison[0].verdict,'count_aligned_only')
  assert.equal(result.captured_source_receipts[0].page_count,22)
  assert.equal(result.captured_source_receipts[0].held_records,0)
  assert.equal(result.writes,0)
  delete input.months[0].period_authority
  assert.equal(audit(input).months[0].buckets[0].comparison[0].verdict,'period_unverified')
  input.months[0].period_authority={kind:'owner_confirmed',plan_id:'oct',month:'2026-10',source_ref:'owner'}
  input.clients[0].package_settings.verification.field_states.design_posters_per_month='flexible'
  assert.equal(audit(input).months[0].buckets[0].comparison[0].verdict,'package_unresolved')
})
test('captured source cannot silently fall back when its page, slot, client, progress or date differs',()=>{
  for(const change of [i=>i.captured_evidence_reads[0].pages.pop(),i=>i.months[0].buckets[0].tasks[0].id='unknown',i=>i.months[0].buckets[0].tasks[0].title='F1',i=>i.months[0].buckets[0].tasks[0].percent_complete=100,i=>i.months[0].buckets[0].tasks[0].due_date='2026-10-22']){
    const input=fixture(),p=pages(1),b=input.months[0].buckets[0];b.tasks[0].id='t0';input.cutoff=p[0].captured_at;input.captured_evidence_reads=[{run_id:id(3),source_id:'oct',pages:p}];change(input)
    if(!input.captured_evidence_reads[0].pages.length)assert.throws(()=>audit(input),/Captured schedule pages/)
    else assert.equal(audit(input).months[0].buckets[0].comparison[0].verdict,'source_incomplete')
  }
})
test('mixed captured source cutoffs, directories or runs cannot create a misleading comparison',()=>{
  for(const field of ['run_id','job_id','directory_revision','captured_at']){
    const input=fixture(),p=pages(1),master=pages(1,'master')
    const value=field==='directory_revision'?'c'.repeat(64):field==='captured_at'?'2026-10-18T08:00:00Z':id(9)
    master[0][field]=value;input.cutoff=p[0].captured_at
    input.captured_evidence_reads=[{run_id:id(3),source_id:'oct',pages:p},{run_id:master[0].run_id,source_id:'master',pages:master}]
    assert.throws(()=>audit(input),/exact audit cutoff/)
  }
})
test('private source copy remains held without echoing it into the reconciliation report',()=>{
  const input=fixture();input.months[0].buckets[0].tasks[0].title='Private payroll sentinel'
  const result=audit(input),bucket=result.months[0].buckets[0]
  assert.equal(bucket.comparison[0].verdict,'allocation_review_held')
  assert.ok(!JSON.stringify(result).includes('Private payroll sentinel'))
  assert.equal(bucket.unrecognised[0].reason,'private_review_held')
})
test('an empty failed bucket or a capped sibling cannot certify full-plan review',()=>{
  for(const mutate of [b=>{b.error='read failed';b.tasks=[];b.expected_count=0},b=>{b.read_complete=false;b.tasks=[];b.expected_count=0}]){
    const input=fixture(),b={...structuredClone(input.months[0].buckets[0]),id:'failed',name:'Foreign Exact'}
    mutate(b);input.months[0].buckets.push(b);input.months[0].expected_bucket_count=2
    const result=audit(input).months[0]
    assert.equal(result.buckets[0].comparison[0].verdict,'source_incomplete')
    assert.equal(result.slot_review[0].state,'held')
  }
})
