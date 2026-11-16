import { supabase } from './supabase'
/** Deliberately off until disposable PostgreSQL/RLS and same-origin acceptance. */
export const NOLAN_DECISIONS_ACCEPTED = false
export type DecisionTaskPreview = { taskId: string; title: string; revision: string; recipients: { id: string; name: string | null }[] }
export type NativeDecisionRow = { id: string; taskId: string; title: string; question: string; recipientId: string; requestedBy: string; createdAt: string; version: number; state: 'pending'; sourceRevision: string; currentRevision: string; recipientActive: boolean }
export async function previewDecisionTask(taskId: string): Promise<DecisionTaskPreview> {
 const {data,error}=await supabase.rpc('preview_nolan_decision_task',{p_task_id:taskId})
 if(error) throw error
 if(!data || typeof data.taskId!=='string' || typeof data.revision!=='string' || !Array.isArray(data.recipients)) throw new Error('Decision preview unavailable')
 return data
}
export async function listMyNativeDecisions(): Promise<NativeDecisionRow[]> {
 const {data,error}=await supabase.rpc('list_my_nolan_decision_requests')
 if(error) throw error
 if(!data || data.complete!==true || !Array.isArray(data.rows)) throw new Error('Decision source incomplete')
 return validateNativeDecisionRows(data.rows)
}
export async function createNativeDecision(input:{taskId:string;revision:string;recipientId:string;question:string;key:string}):Promise<string> {
 const {data,error}=await supabase.rpc('create_nolan_decision_request',{p_task_id:input.taskId,p_expected_revision:input.revision,p_recipient_id:input.recipientId,p_question:input.question,p_idempotency_key:input.key})
 if(error) throw error
 if(typeof data!=='string') throw new Error('Decision creation receipt unavailable; do not create a new retry key')
 return data
}
export async function closeNativeDecision(id:string,version:number,action:'resolve'|'withdraw',response:string) {
 const {error}=await supabase.rpc('close_nolan_decision_request',{p_request_id:id,p_expected_version:version,p_action:action,p_response:response})
 if(error) throw error
}

export function validateNativeDecisionRows(value: unknown): NativeDecisionRow[] {
 if(!Array.isArray(value) || value.length>500) throw new Error('Decision source incomplete')
 const seen=new Set<string>()
 for(const row of value) {
  if(!row || ['id','taskId','title','question','recipientId','requestedBy','createdAt','sourceRevision','currentRevision'].some(k=>typeof row[k]!=='string'||!row[k].trim())
    || row.state!=='pending' || !Number.isInteger(row.version) || row.version<1
    || typeof row.recipientActive!=='boolean' || !Number.isFinite(Date.parse(row.createdAt))
    || seen.has(row.id)) throw new Error('Invalid or duplicate decision receipt')
  seen.add(row.id)
 }
 return value
}
