import assert from 'node:assert/strict'
import {test} from 'node:test'
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {tmpdir} from 'node:os'
import {execFileSync} from 'node:child_process'

function fixture(){
  const bucket=(plan,n)=>({id:`${plan}-bucket`,name:'Exact Studio',plan_id:plan,read_state:n===100?'capped':'below_connector_limit',error:null,
    tasks:Array.from({length:n},(_,i)=>({id:`${plan}-${i}`,title:`DP ${i+1}`,plan_id:plan,bucket_id:`${plan}-bucket`,percent_complete:0,etag:`etag-${i}`,start_date_time:null,due_date_time:null}))})
  return [{contract:'teams_bucket_evidence_read_v1',per_collection_limit:100,observed_at:'2026-10-19T10:00:00Z',plans:[
    {role:'master',plan_id:'master',source_name:'Master',bucket_list_below_limit:true,buckets:[bucket('master',100)]},
    {role:'oct',plan_id:'oct',source_name:'October',bucket_list_below_limit:true,buckets:[bucket('oct',1)]},
    {role:'nov',plan_id:'nov',source_name:'November',bucket_list_below_limit:true,buckets:[bucket('nov',1)]},
  ]},{cutoff:'2026-10-18',clients:[{id:'a',name:'Exact Studio',active:true,package_settings:{design_posters_per_month:0,photo_posts_per_month:null,verification:{field_states:{photo_posts_per_month:'flexible'}}}}],aliases:[],schedule:[]},
  {has_more:false,clients:[{id:'a',name:'Exact Studio'}]},
  {version:1,source_ref:'explicit owner receipt',relationship:'monthly_cross_check_of_master_not_additional_capacity',master:{kind:'owner_confirmed_master',plan_id:'master',source_name:'Master'},monthly:[{plan_id:'oct',source_name:'October',month:'2026-10'},{plan_id:'nov',source_name:'November',month:'2026-11'}]}]
}
function run(inputs,check){const dir=mkdtempSync(join(tmpdir(),'cg-bucket-input-'));try{
  const paths=inputs.map((x,i)=>{const p=join(dir,`${i}.json`);writeFileSync(p,JSON.stringify(x));return p}),out=join(dir,'new.json')
  const execute=()=>execFileSync(process.execPath,['scripts/teams-bucket-evidence-input.mjs',...paths,out],{encoding:'utf8',stdio:'pipe'})
  check(execute,()=>JSON.parse(readFileSync(out,'utf8')),paths)
}finally{rmSync(dir,{recursive:true,force:true})}}

test('fresh exact provider references preserve capped master, null dates and frozen zero/flexible package truth',()=>{
  const input=fixture()
  run(input,(execute,read,paths)=>{const before=paths.map(p=>readFileSync(p,'utf8'));execute();const result=read()
    assert.equal(result.master.buckets[0].read_complete,false)
    assert.equal(result.master.buckets[0].expected_count,null)
    assert.equal(result.months[0].buckets[0].read_complete,true)
    assert.equal(result.months[0].buckets[0].tasks[0].due_date_time,null)
    assert.deepEqual(result.clients[0].package_settings,input[1].clients[0].package_settings)
    assert.equal(result.package_authority_cutoff,'2026-10-18');assert.equal(result.package_readback_required,true)
    assert.equal(result.apply_ready,false);assert.equal(result.writes,0)
    assert.deepEqual(paths.map(p=>readFileSync(p,'utf8')),before)
    const audit=JSON.parse(execFileSync(process.execPath,['scripts/teams-readiness-audit.mjs',join(dirname(paths[0]),'new.json')],{encoding:'utf8',stdio:'pipe'}))
    assert.equal(audit.package_authority_cutoff,'2026-10-18');assert.equal(audit.package_readback_required,true)
    assert.equal(audit.apply_ready,false);assert.match(audit.source_capture_scope,/not an atomic/)
    assert.throws(execute,/New private output/)
  })
})

test('foreign task/bucket identities, duplicate cards, dishonest coverage and active-directory drift refuse output',()=>{
  for(const mutate of [
    x=>x[0].plans[1].buckets[0].tasks[0].plan_id='master',
    x=>x[0].plans[1].buckets[0].tasks[0].bucket_id='foreign',
    x=>x[0].plans[1].buckets[0].tasks.push({...x[0].plans[1].buckets[0].tasks[0]}),
    x=>x[0].plans[0].buckets[0].read_state='below_connector_limit',
    x=>x[2].has_more=true,x=>x[2].clients[0].name='Different Studio',
    x=>x[3].monthly[1].plan_id='oct',x=>x[0].plans[1].buckets[0].tasks[0].etag=null,
  ]){const input=fixture();mutate(input);run(input,execute=>assert.throws(execute,/Exact complete/))}
})
