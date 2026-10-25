import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdtempSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import test from 'node:test'

function run(mutate=()=>{}){
  const dir=mkdtempSync(join(tmpdir(),'cg-resolution-packet-'))
  try{
    const baseline={run:{id:'10000000-0000-4000-8000-000000000001',snapshot_exported_at:'2026-10-19T07:27:07Z',finished_at:'2026-10-19T07:35:09Z',summary:{conflicts:383}},journal_observation:{run_id:'10000000-0000-4000-8000-000000000001',source_exported_at:'2026-10-19T07:27:07Z',conflicts:381,uncoded:381,projection_sha256:'a'.repeat(64)}}
    const audit={writes:0,months:[{month:'2026-10',buckets:[{bucket_id:'exact',plan_id:'oct',client_id:null,client:null,comparison:[{field:'design_posters_per_month',package_state:'known',confirmed_quantity:0,verdict:'source_incomplete'},{field:'photo_posts_per_month',package_state:'flexible',confirmed_quantity:null,verdict:'package_unresolved'}]}]}]}
    mutate(baseline,audit)
    const a=join(dir,'baseline.json'),b=join(dir,'audit.json'),out=join(dir,'packet.json');writeFileSync(a,JSON.stringify(baseline));writeFileSync(b,JSON.stringify(audit))
    const before=[readFileSync(a,'utf8'),readFileSync(b,'utf8')]
    execFileSync(process.execPath,['scripts/teams-resolution-packet.mjs',a,b,out],{stdio:'pipe'})
    const result=JSON.parse(readFileSync(out,'utf8'));assert.deepEqual([readFileSync(a,'utf8'),readFileSync(b,'utf8')],before)
    assert.throws(()=>execFileSync(process.execPath,['scripts/teams-resolution-packet.mjs',a,b,out],{stdio:'pipe'}),/never overwrite/)
    return result
  }finally{if(existsSync(dir))rmSync(dir,{recursive:true,force:true})}
}
test('current383/381 mismatch and exact package holds become a private zero-write inventory, not approvals',()=>{
  const packet=run();assert.equal(packet.summary_journal_difference,2);assert.equal(packet.safe_apply_candidates,0);assert.equal(packet.conflict_rows_embedded,false)
  assert.equal(packet.package_hold_count,2);assert.equal(packet.package_holds[0].confirmed_quantity,0);assert.equal(packet.package_holds[1].confirmed_quantity,null)
  assert.equal(packet.package_holds[1].package_state,'flexible');assert.equal(packet.apply_ready,false);assert.equal(packet.writes,0)
  assert.equal(packet.package_holds[0].client_id,null);assert.match(packet.proof_hashes.baseline_sha256,/^[a-f0-9]{64}$/)
})
test('stale-run observations, duplicate field references, contradictory counts and non-zero-write audits refuse output',()=>{
  for(const mutate of [(b)=>b.journal_observation.run_id='foreign',(b)=>b.run.summary.conflict=0,(_b,a)=>a.writes=1,(_b,a)=>a.months[0].buckets[0].comparison.push({...a.months[0].buckets[0].comparison[0]})])assert.throws(()=>run(mutate))
})
