import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

test('zero-write comparison keeps eligibility, package unknowns, source coverage and bucket allocation explicit',()=>{
  const directory=mkdtempSync(join(tmpdir(),'cg-teams-audit-test-'))
  try {
    const input={cutoff:'synthetic',clients:[{id:'a',name:'Synthetic Active',active:true,package_settings:{verification:{status:'confirmed',field_states:{design_posters_per_month:'known',photo_posts_per_month:'unknown'}},design_posters_per_month:0,photo_posts_per_month:null}},{id:'b',name:'Synthetic Inactive',active:false}],aliases:[{client_id:'a',alias:'Exact Alias'}],schedule:[],months:[{month:'2026-10',buckets:[{id:'one',name:'Exact Alias',error:false,tasks:[{id:'t1',title:'DP1'},{id:'t2',title:'DP1'},{id:'t3',title:'F1'}]},{id:'two',name:'Synthetic Active',error:false,tasks:[]},{id:'old',name:'Synthetic Inactive',error:false,tasks:[]},{id:'failed',name:'No Match',error:true}]}]}
    const path=join(directory,'input.json');writeFileSync(path,JSON.stringify(input))
    const monthInput=input.months[0]
    monthInput.period_authority={kind:'owner_confirmed',month:'2026-10',plan_id:'monthly-oct',source_ref:'synthetic owner decision'}
    monthInput.bucket_list_complete=true;monthInput.expected_bucket_count=monthInput.buckets.length
    for(const b of monthInput.buckets){b.plan_id='monthly-oct';b.read_complete=!b.error;b.expected_count=b.tasks?.length??null;for(const t of b.tasks??[]){t.plan_id=b.plan_id;t.bucket_id=b.id}}
    writeFileSync(path,JSON.stringify(input))
    const result=JSON.parse(execFileSync(process.execPath,['scripts/teams-readiness-audit.mjs',path],{encoding:'utf8'}))
    assert.equal(result.active_clients,1)
    const month=result.months[0],bucket=month.buckets[0]
    assert.equal(bucket.client_id,'a')
    assert.equal(month.buckets[2].client_id,null)
    assert.equal(bucket.comparison[0].confirmed_quantity,0)
    assert.equal(bucket.comparison[0].verdict,'source_incomplete','another failed source bucket cannot certify full plan coverage')
    assert.equal(bucket.comparison[1].confirmed_quantity,null)
    assert.equal(bucket.comparison[1].verdict,'source_incomplete')
    assert.deepEqual(bucket.duplicate_slots,[['t1','t2']])
    assert.equal(month.multiple_buckets_for_one_client.length,1)
    assert.equal(month.source_complete,false)
    assert.equal(month.buckets[3].comparison[0].teams_cards,null)
    input.clients[0].active=undefined;writeFileSync(path,JSON.stringify(input))
    assert.throws(()=>execFileSync(process.execPath,['scripts/teams-readiness-audit.mjs',path],{stdio:'pipe'}),/Explicit Dynamics active flags/)
  } finally {rmSync(directory,{recursive:true,force:true})}
})

function audit(input,authority) {
  const dir=mkdtempSync(join(tmpdir(),'cg-teams-pair-test-'))
  try {const path=join(dir,'input.json');writeFileSync(path,JSON.stringify(input));const args=['scripts/teams-readiness-audit.mjs',path];if(authority){const receipt=join(dir,'authority.json');writeFileSync(receipt,JSON.stringify(authority));args.push('--authority',receipt)}return JSON.parse(execFileSync(process.execPath,args,{encoding:'utf8'}))}
  finally {rmSync(dir,{recursive:true,force:true})}
}
function pair() {
  const bucket=(plan,id,tasks)=>({id,name:'Studio Exact',plan_id:plan,read_complete:true,expected_count:tasks.length,tasks:tasks.map(t=>({...t,plan_id:plan,bucket_id:id}))})
  return {cutoff:'synthetic',clients:[{id:'exact',name:'Studio Exact',active:true,package_settings:{verification:{status:'confirmed',field_states:{design_posters_per_month:'known',photo_posts_per_month:'flexible'}},design_posters_per_month:0,photo_posts_per_month:null}}],aliases:[],schedule:[],
    master:{plan_id:'master',authority:{kind:'owner_confirmed_master',source_ref:'synthetic owner master decision'},bucket_list_complete:true,expected_bucket_count:1,buckets:[bucket('master','m',[{id:'m1',title:'DP1',percent_complete:0},{id:'old',title:'DP9',percent_complete:100}])]},
    months:[{month:'2026-10',period_authority:{kind:'owner_confirmed',month:'2026-10',plan_id:'oct',source_ref:'synthetic owner 2026 confirmation'},bucket_list_complete:true,expected_bucket_count:1,buckets:[bucket('oct','o',[{id:'o1',title:'DP 1',percent_complete:100}])]}]}
}

test('owner-confirmed master/month pair is one slot cross-check, never extra capacity or publication proof',()=>{
  const result=audit(pair()),month=result.months[0],review=month.slot_review[0]
  assert.equal(month.period_verified,true);assert.equal(result.master_authority_verified,true)
  assert.equal(review.slots.length,1);assert.equal(review.slots[0].verdict,'same_slot_cross_check_only')
  assert.deepEqual(review.slots[0].master_task_ids,['m1']);assert.deepEqual(review.slots[0].monthly_task_ids,['o1'])
  assert.equal(review.slots[0].proposed_schedule_writes,0);assert.equal(result.writes,0)
  assert.match(review.scope,/never additive capacity, posting dates or publication proof/)
  assert.equal(month.buckets[0].comparison[0].confirmed_quantity,0)
  assert.equal(month.buckets[0].comparison[1].confirmed_quantity,null)
  assert.equal(month.buckets[0].dynamics_rows,0)
  assert.match(result.input_sha256,/^[a-f0-9]{64}$/)
})

test('month labels or creation-year context alone do not establish an exact owner-confirmed period',()=>{
  for(const mutation of [i=>delete i.months[0].period_authority,i=>i.months[0].period_authority.month='2025-10',i=>i.months[0].period_authority.plan_id='wrong-plan',i=>i.months.push(structuredClone(i.months[0]))]){
    const input=pair();mutation(input);const result=audit(input)
    for(const month of result.months){assert.equal(month.period_verified,false);assert.equal(month.slot_review[0].slots[0].verdict,'coverage_or_identity_or_period_held')}
  }
})

test('truncated/missing/duplicate/failed source evidence remains held, never a missing-slot instruction',()=>{
  for(const mutation of [i=>i.master.bucket_list_complete=false,i=>i.master.buckets[0].tasks=Array.from({length:100},(_,n)=>({id:'t'+n,title:'DP1',percent_complete:0})),i=>i.master.buckets[0].error='provider read failed',i=>delete i.months[0].buckets[0].read_complete,i=>i.months[0].buckets[0].expected_count=2,i=>i.master.buckets[0].tasks.push({...i.master.buckets[0].tasks[0]})]){
    const input=pair();mutation(input);const review=audit(input).months[0].slot_review[0]
    assert.equal(review.state,'held');assert.ok(review.slots.every(s=>s.verdict==='coverage_or_identity_or_period_held'))
  }
})

test('duplicate numbered slots, unknown master progress and unnumbered video stay explicit review holds',()=>{
  const input=pair();const b=input.months[0].buckets[0]
  b.tasks.push({id:'o2',title:'DP1',plan_id:'oct',bucket_id:'o'},{id:'v',title:'VIDEO',plan_id:'oct',bucket_id:'o'});b.expected_count=3
  input.master.buckets[0].tasks.push({id:'mystery',title:'F1',percent_complete:null,plan_id:'master',bucket_id:'m'});input.master.buckets[0].expected_count=3
  const review=audit(input).months[0].slot_review[0]
  assert.equal(review.state,'held');assert.equal(review.slots[0].verdict,'duplicate_slot_review')
  assert.deepEqual(review.unallocated.map(r=>r.reason).sort(),['no_exact_numbered_slot','unknown_master_progress'])
})

test('provider bucket or plan mismatch cannot establish an exact-client slot comparison',()=>{
  for(const field of ['plan_id','bucket_id']){const input=pair();input.master.buckets[0].tasks[0][field]='foreign';const review=audit(input).months[0].slot_review[0];assert.equal(review.state,'held');assert.ok(review.slots.every(s=>s.verdict==='coverage_or_identity_or_period_held'))}
})

test('inactive or foreign client buckets are not cross-linked; master role requires explicit authority',()=>{
  const input=pair();input.master.buckets[0].name='Foreign Studio';input.clients.push({id:'inactive',name:'Foreign Studio',active:false})
  let result=audit(input);assert.equal(result.active_clients,1);assert.equal(result.months[0].slot_review[0].state,'held')
  input.master.buckets[0].name='Studio Exact';delete input.master.authority
  result=audit(input);assert.equal(result.master_authority_verified,false);assert.equal(result.months[0].slot_review[0].state,'held')
})

test('explicit authority file binds only the exact plan and month and never upgrades missing read coverage',()=>{
  const authority={version:1,source_ref:'synthetic owner receipt',relationship:'monthly_cross_check_of_master_not_additional_capacity',master:{kind:'owner_confirmed_master',plan_id:'master'},monthly:[{plan_id:'oct',month:'2026-10'}]}
  const input=pair();delete input.master.authority;delete input.months[0].period_authority
  let result=audit(input,authority);assert.equal(result.master_authority_verified,true);assert.equal(result.months[0].period_verified,true)
  delete input.months[0].buckets[0].read_complete
  result=audit(input,authority);assert.equal(result.months[0].period_verified,true);assert.equal(result.months[0].source_complete,false);assert.equal(result.months[0].slot_review[0].state,'held')
  authority.monthly[0].plan_id='other-exact-plan'
  assert.equal(audit(input,authority).months[0].period_verified,false)
  assert.equal(audit(pair(),authority).months[0].period_verified,false,'selected receipt must replace an older embedded confirmation')
})

test('private report output cannot overwrite its approved input snapshot',()=>{
  const dir=mkdtempSync(join(tmpdir(),'cg-teams-input-preserve-'))
  try {const path=join(dir,'approved-input.json'),bytes=JSON.stringify(pair());writeFileSync(path,bytes)
    assert.throws(()=>execFileSync(process.execPath,['scripts/teams-readiness-audit.mjs',path,'--output',path],{stdio:'pipe'}),/never overwrite/)
    assert.equal(readFileSync(path,'utf8'),bytes)
  }finally{rmSync(dir,{recursive:true,force:true})}
})
