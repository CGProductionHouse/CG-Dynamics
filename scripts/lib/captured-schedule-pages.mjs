// Offline verifier for the existing company-admin source-reader projection.
// No network, database, sync, package mutation or import action lives here.
import {createHash} from 'node:crypto'

const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const text=v=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=512
const date=v=>v===null||(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(`${v}T00:00:00Z`))&&new Date(`${v}T00:00:00Z`).toISOString().slice(0,10)===v)
const reject=()=>{throw Error('Captured schedule pages are incomplete, inconsistent or identity-held; no fallback, dates or writes are permitted.')}
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex')

export function verifyCapturedSchedulePages(pages,{run_id,source_id,clients}){
  if(!uuid(run_id)||!text(source_id)||!Array.isArray(clients)||!Array.isArray(pages)||pages.length<1||pages.length>2000)reject()
  const directory=new Map()
  for(const client of clients){if(!client||!uuid(client.id)||!text(client.name)||typeof client.active!=='boolean'||directory.has(client.id))reject();directory.set(client.id,client)}
  const records=[],seen=new Set(),bucketClients=new Map();let pinned=null,offset=0
  const recordKeys=['source_plan_id','source_bucket_id','source_task_id','client_id','client_name','code','deliverable_type','instance_number','start_date','due_date','completed_date','percent_complete','evidence_state']
  for(const [index,page]of pages.entries()){
    if(!page||page.error||page.coverage!=='page_only'||page.run_id!==run_id||page.source_id!==source_id||!uuid(page.job_id)||!text(page.source_name)
      ||page.source_complete!==true||!Number.isInteger(page.source_record_count)||page.source_record_count<0||page.source_record_count>100000
      ||typeof page.source_revision!=='string'||!/^[a-f0-9]{32}$/.test(page.source_revision)
      ||typeof page.directory_revision!=='string'||!/^[a-f0-9]{64}$/.test(page.directory_revision)
      ||typeof page.captured_at!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$/.test(page.captured_at)||!Number.isFinite(Date.parse(page.captured_at))
      ||!Array.isArray(page.records))reject()
    const metadata={run_id,source_id,job_id:page.job_id,source_name:page.source_name,source_revision:page.source_revision,directory_revision:page.directory_revision,captured_at:page.captured_at,source_record_count:page.source_record_count}
    pinned??=metadata
    if(JSON.stringify(pinned)!==JSON.stringify(metadata)||offset>pinned.source_record_count)reject()
    const count=Math.min(50,pinned.source_record_count-offset),next=offset+count,more=next<pinned.source_record_count,p=page.pagination
    if(!p||p.offset!==offset||p.limit!==50||p.returned!==count||page.records.length!==count||p.has_more!==more||p.next_offset!==(more?next:null)
      ||(!more&&index!==pages.length-1)||(more&&index===pages.length-1))reject()
    for(const row of page.records){
      if(!row||row.source_plan_id!==source_id||!text(row.source_bucket_id)||!text(row.source_task_id)||seen.has(row.source_task_id)
        ||!['numbered_source_reference_only','private_review_held','identity_review_held','slot_review_held'].includes(row.evidence_state)
        ||!date(row.start_date)||!date(row.due_date)||!date(row.completed_date)||(row.percent_complete!==null&&![0,50,100].includes(row.percent_complete)))reject()
      const bound=row.client_id!==null||row.client_name!==null,client=directory.get(row.client_id)
      if(bound&&(!uuid(row.client_id)||!client||!client.active||row.client_name!==client.name))reject()
      if(bound){const prior=bucketClients.get(row.source_bucket_id);if(prior&&prior!==row.client_id)reject();bucketClients.set(row.source_bucket_id,row.client_id)}
      if(row.evidence_state==='numbered_source_reference_only'){
        const labels={dp:`DP${row.instance_number}`,photo:`F${row.instance_number}`,video:`Video ${row.instance_number}`,reel:`Reel ${row.instance_number}`}
        if(!bound||!Number.isSafeInteger(row.instance_number)||row.instance_number<1||!Object.hasOwn(labels,row.deliverable_type)||!text(row.code)||row.code!==labels[row.deliverable_type])reject()
      }else{
        if(row.code!==null||row.deliverable_type!==null||row.instance_number!==null)reject()
        if(row.evidence_state==='slot_review_held'){if(!bound)reject()}
        else if(bound||row.start_date!==null||row.due_date!==null||row.completed_date!==null||row.percent_complete!==null)reject()
      }
      seen.add(row.source_task_id);records.push(Object.fromEntries(recordKeys.map(key=>[key,row[key]])))
    }
    offset=next
  }
  if(records.length!==pinned.source_record_count)reject()
  return {...pinned,coverage:'complete_captured_source_only',page_count:pages.length,records,
    receipt_sha256:digest({metadata:pinned,records}),writes:0,
    limitation:'Captured source completeness only; not current package, missing-bucket, posting-date, approval or publication evidence.'}
}
