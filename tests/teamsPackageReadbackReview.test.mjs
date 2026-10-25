import assert from 'node:assert/strict'
import {test} from 'node:test'
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {execFileSync} from 'node:child_process'
function fixture(){return[
  {writes:0,apply_ready:false,native_master_export_proof:{kind:'native_planner_export'},months:[{month:'2026-10',slot_review:[],buckets:[{client_id:'a',client:'Exact Studio',bucket_id:'b',plan_id:'oct',comparison:[{field:'design_posters_per_month',package_state:'known',confirmed_quantity:0,verdict:'count_aligned_only'}]}]}]},
  {clients:[{id:'a',name:'Exact Studio',active:true,package_settings:{design_posters_per_month:0,photo_posts_per_month:null,verification:{confirmed_at:'2026-09-23',field_states:{photo_posts_per_month:'flexible'}}}}]},
  {contract:'canonical_package_excerpt_readback_v1',read_only:true,clients:[{client:{id:'a',name:'Exact Studio'},observed_at:'2026-10-19T10:00:00Z',error:null,client_package_coverage:'available',package_evidence:[{authority:'confirmed_client_package',source_id:'a',field:'actionPlan',excerpt:'Confirmed 2026-09-23: 0 design posters.'}]}]},
]}
function run(input,check){const dir=mkdtempSync(join(tmpdir(),'cg-package-review-'));try{
  const paths=input.map((v,i)=>{const p=join(dir,`${i}.json`);writeFileSync(p,JSON.stringify(v));return p}),out=join(dir,'review.json')
  const execute=()=>execFileSync(process.execPath,['scripts/teams-package-readback-review.mjs',...paths,out],{encoding:'utf8',stdio:'pipe'})
  check(execute,()=>JSON.parse(readFileSync(out,'utf8')),paths)
}finally{rmSync(dir,{recursive:true,force:true})}}
test('current numeric-mix corroboration preserves zero/flexible/null and does not approve package or schedule writes',()=>{
  const input=fixture()
  run(input,(execute,read,paths)=>{const before=paths.map(p=>readFileSync(p,'utf8'));execute();const result=read()
    assert.equal(result.clients[0].package_readback,'numeric_mix_and_confirmation_timestamp_match')
    assert.equal(result.clients[0].full_structured_package_readback_required,true)
    assert.equal(result.comparisons[0].confirmed_quantity,0);assert.equal(result.apply_ready,false);assert.equal(result.writes,0)
    assert.deepEqual(paths.map(p=>readFileSync(p,'utf8')),before);assert.throws(execute,/New private output/)
  })
})
test('missing or changed package evidence stays held, never becomes zero scope',()=>{
  for(const mutate of [x=>x[2].clients[0].package_evidence=[],x=>x[2].clients[0].package_evidence[0].excerpt='Confirmed 2026-09-23: 4 design posters.']){
    const input=fixture();mutate(input);run(input,(execute,read)=>{execute();assert.equal(read().clients[0].package_readback,'held_missing_or_changed_package_receipt');assert.equal(read().apply_ready,false)})
  }
})
test('foreign/duplicate client receipts and missing full source proof refuse the review',()=>{
  for(const mutate of [x=>x[2].clients[0].package_evidence[0].source_id='foreign',x=>x[2].clients[0].client.name='Wrong branch',x=>x[2].clients.push(x[2].clients[0]),x=>x[0].native_master_export_proof=null]){
    const input=fixture();mutate(input);run(input,execute=>assert.throws(execute))
  }
})
