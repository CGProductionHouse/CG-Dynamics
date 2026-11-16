/* eslint-disable react-refresh/only-export-components -- Standalone offline test bundle; no Vite HMR or production imports. */
// Test-only sample data. Never imported by the application build.
import { useSyncExternalStore } from 'react'
export const ADMIN = '00000000-0000-4000-8000-000000000001'
export const REVIEWER = '00000000-0000-4000-8000-000000000002'
export const TASK = '00000000-0000-4000-8000-000000000101'
const client = '00000000-0000-4000-8000-000000000201'
let actor = ADMIN
let mode = 'healthy'
let loseReceipt = false
let revision = 'sample-revision-1'
const listeners = new Set<() => void>()
export function setActor(id: string) { actor=id; listeners.forEach(fn=>fn()) }
export function setMode(value: string) { mode=value }
export function setLostReceipt(value: boolean) { loseReceipt=value }
export function changeRevision() { revision += '-changed' }
export function useAuth() {
 const id=useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn)}},()=>actor,()=>actor)
 return {user:{id},profile:{id,is_active:true,role:id===ADMIN?'admin':'manager'}}
}
const now = '2026-11-16T09:00:00Z'
export const sampleTasks = [
 ['101','Sample storyboard review','in_progress',ADMIN,'Production'],
 ['102','Sample campaign — ownership unresolved','blocked',null,'Once-off'],
 ['103','Sample delivery checklist','done',REVIEWER,'Production'],
 ['104','Sample revision notes','waiting_client',REVIEWER,'Production'],
].map(([n,title,status,owner,bucket])=>({id:`00000000-0000-4000-8000-000000000${n}`,native_id:`00000000-0000-4000-8000-000000000${n}`,data_origin:'planner_tasks',title,status,bucket,client_id:client,client_name:'Sample Studio · fictional',assigned_to_user_id:owner,assigned_to_name:owner===ADMIN?'Sample Administrator':owner?'Sample Reviewer':null,assignment_review_state:'ok',due_date:'2026-11-20',updated_at:now,notes:'SAMPLE ONLY. Review the recorded brief and next handoff. No real client work or delivery is represented.'}))
function read<T>(data: T[]) { if(mode==='unavailable') throw new Error('Simulated source outage — sample preview'); return {data:mode==='empty'?[]:structuredClone(data),error:null,migrationNeeded:false} }
export async function listTasks(){return read(sampleTasks)}
export async function listActiveClients(){return read([{id:client,name:'Sample Studio · fictional',active:true}])}
export const listClients=listActiveClients
export async function listStaffProfiles(){return read([{id:ADMIN,full_name:'Sample Administrator'},{id:REVIEWER,full_name:'Sample Reviewer'}])}
export function taskStatusDisplayLabel(t: {status:string}) {return ({in_progress:'In progress',blocked:'Blocked',done:'Done',waiting_client:'Waiting client'} as Record<string,string>)[t.status]??t.status}
export async function listPipelineVideos(){return read([{id:'00000000-0000-4000-8000-000000000301',title:'Sample launch film',canonical_name:'Sample launch film',client_name:'Sample Studio · fictional',editor_name:'Sample Reviewer',production_status:'in_edit',updated_at:now,production_status_updated_at:now,production_note:'SAMPLE ONLY. Final asset and approval evidence are intentionally missing.',deliverable_id:null,onedrive_footage_url:null,onedrive_internal_review_url:null,onedrive_client_approval_url:null,onedrive_final_url:null}])}
export const PRODUCTION_STATUS_LABELS={planned:'Planned',in_progress:'In progress'}
export async function listMonthlyDeliverablesByMonth(month:string){return read([{id:'00000000-0000-4000-8000-000000000401',title:'Sample monthly reel',client_id:client,code:'R1',month,production_status:'planned',assigned_to_name:'Sample Reviewer',notes:'SAMPLE ONLY. Scheduled does not mean posted.',due_date:month+'-20',scheduled_date:month+'-21',posted_at:null,internal_approved_at:null,sent_to_client_at:null,client_approved_at:null,updated_at:now}])}
export async function loadNolanPackageEvidence(){const result=read([{clientId:client,clientName:'Sample Studio · fictional',confirmed:false,fields:{reels:{proposedValue:2,state:'unverified',evidenceClass:'supporting_context',confidence:'low',note:'Fictional allowance for interaction review only.',sourceReferences:['SAMPLE briefing note — not a real contract']}},conflicts:['Sample brief and sample allowance have not been reconciled.'],unknownFields:['payment_status'],directSources:[],supportingSources:['SAMPLE briefing note']}]);return {...result,checkedAt:new Date().toISOString()}}
// No reporting API is included. Actual website component shows its unmatched state.
export function WebsitePerformancePanel(){return <p>Reporting is outside this offline sample preview.</p>}
export const NOLAN_DECISIONS_ACCEPTED=true // isolated adapter only; production remains false
export function decisionRetryUncertain(previous:boolean,code?:string){return previous||!code||!['P0001','42501','22P02','23514','23503'].includes(code)}
let sequence=500
const requests=[
 {id:'sample-current',taskId:TASK,title:'Sample storyboard review',question:'SAMPLE: Is this brief ready for the next internal review?',recipientId:ADMIN,requestedBy:REVIEWER,createdAt:now,version:1,state:'pending',sourceRevision:revision,currentRevision:revision,recipientActive:true},
 {id:'sample-stale',taskId:TASK,title:'Sample changed source',question:'SAMPLE: This question refers to an older source revision.',recipientId:ADMIN,requestedBy:REVIEWER,createdAt:now,version:1,state:'pending',sourceRevision:'old-sample-revision',currentRevision:revision,recipientActive:true},
]
const keys=new Map<string,string>()
export async function listMyNativeDecisions(){if(mode==='unavailable')throw new Error('Simulated decision reader unavailable');return mode==='empty'?[]:structuredClone(requests.filter(r=>r.state==='pending'&&(r.recipientId===actor||r.requestedBy===actor)).map(r=>({...r,currentRevision:revision})))}
export async function previewDecisionTask(taskId:string){if(taskId!==TASK)throw new Error('Use the sample task UUID shown above.');return {taskId:TASK,title:'Sample storyboard review',revision,recipients:[{id:ADMIN,name:'Sample Administrator'},{id:REVIEWER,name:'Sample Reviewer'}]}}
export async function createNativeDecision(p:{key:string;taskId:string;revision:string;recipientId:string;question:string}){
 if(keys.has(p.key))return keys.get(p.key)!
 if(actor!==ADMIN||p.taskId!==TASK||p.revision!==revision)throw Object.assign(new Error('Sample role or source revision changed; read the source again.'),{code:'P0001'})
 const id=`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`
 requests.push({id,taskId:TASK,title:'Sample storyboard review',question:p.question,recipientId:p.recipientId,requestedBy:actor,createdAt:new Date().toISOString(),version:1,state:'pending',sourceRevision:revision,currentRevision:revision,recipientActive:true});keys.set(p.key,id)
 if(loseReceipt){loseReceipt=false;throw new Error('Simulated lost response after sample creation. Retry this same request.')}
 return id
}
export async function closeNativeDecision(id:string,version:number,action:string,response:string){const r=requests.find(r=>r.id===id);if(!r||r.state!=='pending'||r.version!==version)throw new Error('Sample request changed. Refresh.');if(action==='resolve'&&(r.recipientId!==actor||r.sourceRevision!==revision||!response.trim()))throw new Error('Sample response blocked: actor/source/response check.');if(action==='withdraw'&&r.requestedBy!==actor)throw new Error('Sample requester mismatch');r.state=action==='resolve'?'resolved':'withdrawn';r.version++}

export function cgManagedWebsiteForClient(){return null}
