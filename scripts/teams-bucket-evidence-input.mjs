// Offline evidence adapter, not a sync or package authority. Output stays private.
import {readFileSync,writeFileSync,existsSync,realpathSync} from 'node:fs'
import {resolve,relative,isAbsolute,dirname,basename,join} from 'node:path'
import {createHash} from 'node:crypto'

const paths=process.argv.slice(2),[capturePath,baselinePath,fleetPath,authorityPath,out]=paths
const canonical=p=>{const full=existsSync(p)?realpathSync(p):join(realpathSync(dirname(resolve(p))),basename(p));return process.platform==='win32'?full.toLowerCase():full}
if(paths.length!==5||!isAbsolute(out)||existsSync(out)||!relative(canonical(process.cwd()),canonical(out)).startsWith('..')
  ||paths.slice(0,4).some(p=>canonical(p)===canonical(out)))throw Error('New private output outside Git required')
const bytes=paths.slice(0,4).map(p=>readFileSync(p,'utf8'))
const [capture,baseline,fleet,authority]=bytes.map(s=>JSON.parse(s))
const fail=()=>{throw Error('Exact complete identity/collection evidence required; capped collections stay held')}
const hash=s=>createHash('sha256').update(s).digest('hex')
if(capture.contract!=='teams_bucket_evidence_read_v1'||capture.per_collection_limit!==100
  ||!Number.isFinite(Date.parse(capture.observed_at))||fleet.has_more!==false||!Array.isArray(fleet.clients)
  ||!Array.isArray(baseline.clients)||!Array.isArray(authority.monthly)||authority.monthly.length!==2
  ||authority.relationship!=='monthly_cross_check_of_master_not_additional_capacity'
  ||authority.master?.kind!=='owner_confirmed_master'||typeof authority.source_ref!=='string'||!authority.source_ref.trim()
  ||new Set(authority.monthly.map(p=>p.month)).size!==2||authority.monthly.some(p=>!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.month)))fail()
const active=baseline.clients.filter(c=>c.active===true)
const fleetMap=new Map(fleet.clients.map(c=>[c.id,c.name]))
if(fleetMap.size!==fleet.clients.length||fleetMap.size!==active.length
  ||active.some(c=>fleetMap.get(c.id)!==c.name))fail()
const roles=[{role:'master',...authority.master},...authority.monthly.map((p,i)=>({role:i===0?'oct':'nov',...p}))]
if(!Array.isArray(capture.plans)||capture.plans.length!==3||new Set(roles.map(r=>r.plan_id)).size!==3)fail()
const seenPlans=new Set()
const plans=roles.map(binding=>{
  const matches=capture.plans.filter(p=>p.plan_id===binding.plan_id&&p.role===binding.role)
  if(matches.length!==1||seenPlans.has(binding.plan_id))fail()
  seenPlans.add(binding.plan_id)
  const plan=matches[0],buckets=plan.buckets,seenBuckets=new Set(),seenTasks=new Set()
  if(plan.source_name!==binding.source_name||plan.bucket_list_below_limit!==true||!Array.isArray(buckets)||buckets.length>=100)fail()
  const normalized=buckets.map(b=>{
    if(!b.id||seenBuckets.has(b.id)||b.plan_id!==binding.plan_id||typeof b.name!=='string'||!b.name.trim()
      ||!Array.isArray(b.tasks)||b.tasks.length>100||!['below_connector_limit','capped','unavailable'].includes(b.read_state))fail()
    seenBuckets.add(b.id)
    const complete=b.read_state==='below_connector_limit'&&b.tasks.length<100&&!b.error
    if((b.read_state==='capped'&&b.tasks.length!==100)||(b.read_state==='below_connector_limit'&&!complete))fail()
    for(const t of b.tasks){
      if(!t.id||seenTasks.has(t.id)||t.plan_id!==binding.plan_id||t.bucket_id!==b.id||typeof t.title!=='string'
        ||typeof t.etag!=='string'||!t.etag||![0,50,100].includes(t.percent_complete)
        ||['start_date_time','due_date_time'].some(k=>t[k]!==null&&(typeof t[k]!=='string'||!Number.isFinite(Date.parse(t[k])))))fail()
      seenTasks.add(t.id)
    }
    return {...b,read_complete:complete,expected_count:complete?b.tasks.length:null}
  })
  return {plan_id:binding.plan_id,bucket_list_complete:true,expected_bucket_count:buckets.length,buckets:normalized}
})
// A fresh task receipt does NOT refresh a frozen package receipt. The downstream
// comparison remains historical-package-only and can never authorize a write.
const result={...baseline,cutoff:capture.observed_at,master:plans[0],months:plans.slice(1).map((p,i)=>({...p,month:authority.monthly[i].month})),
  package_authority_cutoff:baseline.cutoff,package_readback_required:true,
  evidence_scope:'Independent provider GET receipts, not an atomic source snapshot; frozen package comparisons only.',
  evidence_hashes:{capture:hash(bytes[0]),frozen_package_input:hash(bytes[1]),active_fleet:hash(bytes[2]),owner_authority:hash(bytes[3])},writes:0,apply_ready:false}
delete result.captured_evidence_reads
writeFileSync(out,JSON.stringify(result,null,2))
console.log(JSON.stringify({output:out,active_clients:active.length,plans:plans.map(p=>({plan_id:p.plan_id,buckets:p.buckets.length,tasks:p.buckets.reduce((n,b)=>n+b.tasks.length,0),capped:p.buckets.filter(b=>b.read_state==='capped').length,unavailable:p.buckets.filter(b=>b.read_state==='unavailable').length})),package_readback_required:true,writes:0,apply_ready:false,sha256:hash(JSON.stringify(result))}))
