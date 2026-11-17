import { supabase } from './supabase'
/** Deliberately off until disposable PostgreSQL/RLS and same-origin acceptance. */
export const NOLAN_DECISIONS_ACCEPTED = false
export type DecisionTaskPreview = { taskId: string; title: string; revision: string; recipients: { id: string; name: string | null }[] }
export type NativeDecisionRow = { id: string; taskId: string; title: string; question: string; recipientId: string; requestedBy: string; createdAt: string; version: number; state: 'pending'; sourceRevision: string; currentRevision: string; recipientActive: boolean }
export async function previewDecisionTask(taskId: string): Promise<DecisionTaskPreview> {
 const {data,error}=await supabase.rpc('preview_nolan_decision_task',{p_task_id:taskId})
 if(error) throw error
 return validateDecisionPreview(data,taskId)
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
 return validateDecisionCreationReceipt(data)
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

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function validateDecisionPreview(data:unknown,requestedTaskId:string):DecisionTaskPreview {
 const p=data as DecisionTaskPreview
 if(!p || typeof p.taskId!=='string' || !uuid.test(p.taskId) || p.taskId.toLowerCase()!==requestedTaskId.toLowerCase()
  || typeof p.title!=='string' || !p.title.trim() || typeof p.revision!=='string' || !/^[0-9a-f]{32}$/.test(p.revision)
  || !Array.isArray(p.recipients)) throw new Error('Decision preview unavailable')
 const seen=new Set<string>()
 for(const recipient of p.recipients) {
  if(!recipient || typeof recipient.id!=='string' || !uuid.test(recipient.id) || seen.has(recipient.id.toLowerCase())
    || (recipient.name!==null && typeof recipient.name!=='string')) throw new Error('Invalid recipient evidence')
  seen.add(recipient.id.toLowerCase())
 }
 return p
}
/** Later rejection cannot disprove an earlier uncertain successful commit. */
export function decisionRetryUncertain(wasUncertain:boolean,code:string|undefined):boolean {
 return wasUncertain || !code || !['P0001','42501','22P02','23514','23503'].includes(code)
}

export function validateDecisionCreationReceipt(data:unknown):string {
 if(typeof data!=='string' || !uuid.test(data)) throw new Error('Decision creation receipt unavailable; do not create a new retry key')
 return data
}
