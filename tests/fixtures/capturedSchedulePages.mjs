export const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`
export const clients=[{id:id(1),name:'Studio Exact',active:true},{id:id(2),name:'Former Studio',active:false}]
export function pages(count=1051,source='oct'){
  return Array.from({length:Math.max(1,Math.ceil(count/50))},(_,page)=>{
    const offset=page*50,length=Math.min(50,count-offset),next=offset+length,more=next<count
    return {run_id:id(3),job_id:id(4),source_id:source,source_name:'CLIENT SOCIALS - OCTOBER',source_revision:'a'.repeat(32),directory_revision:'b'.repeat(64),captured_at:'2026-10-19T08:00:00Z',source_complete:true,source_record_count:count,coverage:'page_only',records:Array.from({length},(_,n)=>({source_plan_id:source,source_bucket_id:'ob',source_task_id:`t${offset+n}`,client_id:id(1),client_name:'Studio Exact',code:`DP${offset+n+1}`,deliverable_type:'dp',instance_number:offset+n+1,start_date:null,due_date:null,completed_date:null,percent_complete:0,evidence_state:'numbered_source_reference_only'})),pagination:{offset,returned:length,limit:50,has_more:more,next_offset:more?next:null}}
  })
}
