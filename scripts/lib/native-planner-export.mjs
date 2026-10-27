// Verify an approved native Planner export against independent exact-ID reads.
// This removes a collection cap, never package, identity, date or apply guards.
export function verifyNativePlannerExport(receipt, binding, anchors) {
  const fail=()=>{throw Error('Native Planner export identity, coverage or source fields differ; keep held')}
  const validDate=v=>v===null||(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v)
  if(binding?.kind!=='owner_confirmed_master'||typeof binding.source_ref!=='string'||!binding.source_ref.trim()
    ||receipt?.contract!=='planner_native_export_v1'||receipt.plan?.['Plan ID']!==binding.plan_id
    ||receipt.plan?.['Plan name']!==binding.source_name||!validDate(receipt.plan?.['Date of export'])||receipt.plan['Date of export']===null
    ||!/^[a-f0-9]{64}$/.test(receipt.file_sha256??'')||receipt.consolidated_task_identity_and_source_fields_match!==true
    ||!Array.isArray(receipt.buckets)||!Array.isArray(receipt.tasks)||receipt.task_count!==receipt.tasks.length
    ||receipt.bucket_count!==receipt.buckets.length||receipt.tasks.length>100000||!Array.isArray(anchors)
    ||anchors.length!==receipt.buckets.length||receipt.writes!==0||receipt.apply_ready!==false)fail()
  const buckets=new Map(),seen=new Set(),anchorMap=new Map(anchors.map(b=>[b.id,b]))
  if(anchorMap.size!==anchors.length)fail()
  for(const b of receipt.buckets){
    const id=b['Bucket ID'],name=b['Bucket Name'],anchor=anchorMap.get(id)
    if(typeof id!=='string'||!id.trim()||buckets.has(id)||typeof name!=='string'||!name.trim()
      ||!anchor||anchor.plan_id!==binding.plan_id||anchor.name!==name||!Array.isArray(anchor.tasks))fail()
    buckets.set(id,{id,name,plan_id:binding.plan_id,read_complete:true,read_state:'native_export_verified',error:null,tasks:[]})
  }
  const progress={'Not started':0,'In progress':50,Completed:100}
  for(const t of receipt.tasks){
    const id=t['Task ID'],bucket=buckets.get(t.Bucket)
    if(typeof id!=='string'||!id.trim()||seen.has(id)||!bucket||typeof t['Task Name']!=='string'||!t['Task Name'].trim()
      ||!Object.hasOwn(progress,t.Status)||!['Start date','Due date','Completed Date'].every(k=>validDate(t[k]))
      ||(t.Notes!==null&&typeof t.Notes!=='string'))fail()
    seen.add(id)
    bucket.tasks.push({id,title:t['Task Name'],description:t.Notes,plan_id:binding.plan_id,bucket_id:bucket.id,
      percent_complete:progress[t.Status],start_date:t['Start date'],due_date:t['Due date'],completed_date:t['Completed Date'],
      source_date_precision:'native_export_date_only',etag:null})
  }
  for(const b of buckets.values()){
    const known=anchorMap.get(b.id),rows=new Map(b.tasks.map(t=>[t.id,t]))
    if(known.read_complete===true&&known.tasks.length!==b.tasks.length)fail()
    const anchorIds=new Set()
    for(const t of known.tasks){const row=rows.get(t.id)
      if(anchorIds.has(t.id)||t.plan_id!==binding.plan_id||t.bucket_id!==b.id||!row
        ||row.title!==t.title||row.percent_complete!==t.percent_complete)fail()
      anchorIds.add(t.id)
    }
    b.expected_count=b.tasks.length
  }
  return {plan_id:binding.plan_id,bucket_list_complete:true,expected_bucket_count:buckets.size,buckets:[...buckets.values()],
    proof:{kind:'native_planner_export',file_sha256:receipt.file_sha256,export_date:receipt.plan['Date of export'],task_count:seen.size,bucket_count:buckets.size,
      rule:'Exact task IDs and bucket IDs; completed history is not current capacity; no ETags or posting/publication inference.',apply_ready:false}}
}

export function nativeBucketMatches(bucket, verified) {
  const expected=verified.buckets.find(b=>b.id===bucket.id)
  if(!expected||expected.plan_id!==bucket.plan_id||expected.name!==bucket.name||!Array.isArray(bucket.tasks)||expected.tasks.length!==bucket.tasks.length)return false
  const rows=new Map(expected.tasks.map(t=>[t.id,t]))
  return new Set(bucket.tasks.map(t=>t.id)).size===bucket.tasks.length&&bucket.tasks.every(t=>{
    const r=rows.get(t.id)
    return r&&['title','description','plan_id','bucket_id','percent_complete','start_date','due_date','completed_date','source_date_precision','etag'].every(k=>t[k]===r[k])
  })
}
