import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { NOLAN_DECISIONS_ACCEPTED, decisionRetryUncertain, previewDecisionTask, listMyNativeDecisions, createNativeDecision, closeNativeDecision, type DecisionTaskPreview, type NativeDecisionRow } from '../../lib/nolanDecisionApi'

/** Account isolation is enforced by the parent's scope key as well as server auth. */
export function NolanNeedsYou({ viewerId, role }: { viewerId: string; role: string }) {
 if (!NOLAN_DECISIONS_ACCEPTED) return <div className="coverage" role="status">Needs You is not activated. The explicit decision-request workflow is awaiting database/role acceptance. Assigned to you remains a separate view; no personal decisions are inferred.</div>
 return <DecisionWorkspace viewerId={viewerId} role={role} />
}
function DecisionWorkspace({viewerId,role}:{viewerId:string;role:string}) {
 const [rows,setRows]=useState<NativeDecisionRow[]|null>(null)
 const [error,setError]=useState('')
 const [generation,setGeneration]=useState(0)
 const [busy,setBusy]=useState(false)
 const [taskId,setTaskId]=useState('')
 const [preview,setPreview]=useState<DecisionTaskPreview|null>(null)
 const [recipient,setRecipient]=useState('')
 const [question,setQuestion]=useState('')
 const [response,setResponse]=useState<Record<string,string>>({})
 const [receipt,setReceipt]=useState('')
 const key=useRef<string|null>(null)
 const uncertain=useRef(false)
 const mounted=useRef(true)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{
  let cancelled=false;setRows(null);setError('')
  listMyNativeDecisions().then(data=>{if(!cancelled)setRows(data)}).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:(e as {message?:string})?.message??String(e))})
  return()=>{cancelled=true}
 },[generation,viewerId])
 const run=async(action:()=>Promise<void>)=>{
  if(busy)return;setBusy(true);setError('')
  try{await action()}catch(e){if(mounted.current)setError(e instanceof Error?e.message:String(e))}
  finally{if(mounted.current)setBusy(false)}
 }
 const clearDraft=()=>{setPreview(null);setRecipient('');key.current=null;setReceipt('')}
 const prepare=()=>run(async()=>{
  const result=await previewDecisionTask(taskId)
  if(!mounted.current)return
  setPreview(result);setRecipient('');key.current=null;setReceipt('')
 })
 const submit=()=>run(async()=>{
  if(!preview || !recipient || !question.trim())return
  // Same key survives uncertain errors. Editing draft deliberately starts a new request.
  key.current??=crypto.randomUUID()
  let id:string
  try { id=await createNativeDecision({taskId:preview.taskId,revision:preview.revision,recipientId:recipient,question,key:key.current}) }
  catch(error) {
   // SQL rejection rolls back; only these known errors allow a corrected draft.
   // Network/timeouts or an absent receipt keep the retry key and frozen draft.
   const code=(error as {code?:string})?.code
   uncertain.current=decisionRetryUncertain(uncertain.current,code)
   if(!uncertain.current) key.current=null
   throw error
  }
  if(!mounted.current)return
  uncertain.current=false;setReceipt('Request recorded: '+id);setPreview(null);setQuestion('');setRecipient('');key.current=null;setGeneration(n=>n+1)
 })
 const close=(r:NativeDecisionRow,action:'resolve'|'withdraw')=>run(async()=>{
  await closeNativeDecision(r.id,r.version,action,response[r.id]??'')
  if(mounted.current){setReceipt(action==='resolve'?'Response recorded; no task change applied.':'Request withdrawn.');setGeneration(n=>n+1)}
 })
 const incoming=rows?.filter(r=>r.recipientId===viewerId)??[]
 const outgoing=rows?.filter(r=>r.requestedBy===viewerId && r.recipientId!==viewerId)??[]
 return <section aria-label="Explicit decision requests">
  <p>Explicit questions on native work tasks only. A response records your answer, not approval to publish, spend or change a project. Source changes require a new request.</p>
  <button disabled={busy} onClick={()=>setGeneration(n=>n+1)}>Refresh requests</button>
  {error&&<p role="alert">{error} No complete current queue is claimed.</p>}
  {receipt&&<p role="status">{receipt}</p>}
  {!rows&&!error&&<p>Reading your decision requests…</p>}
  {rows&&incoming.length===0&&<p>No pending questions addressed to this account in the complete returned native-task scope.</p>}
  {[...incoming,...outgoing].map(r=><article className="card" key={r.id}>
   <h3>{r.title}</h3><p>{r.recipientId===viewerId?'Needs your response':'Requested by you'}</p><p>{r.question}</p>
   <p>Requested {r.createdAt} · request {r.id}</p>
   <p>Native task ID: {r.taskId}</p><Link to="/admin/work?tab=daily-tasks">Open native task workspace</Link>
   {(r.sourceRevision!==r.currentRevision||!r.recipientActive)&&<p role="status">Source changed or recipient unavailable. Do not act on this request; withdraw and review a new request.</p>}
   {r.recipientId===viewerId&&r.sourceRevision===r.currentRevision&&r.recipientActive&&<>
    <label>Response<textarea maxLength={4000} disabled={busy} value={response[r.id]??''} onChange={e=>setResponse(v=>({...v,[r.id]:e.target.value}))}/></label>
    <button disabled={busy||!(response[r.id]??'').trim()} onClick={()=>close(r,'resolve')}>Record response only</button>
   </>}
   {r.requestedBy===viewerId&&<button disabled={busy} onClick={()=>close(r,'withdraw')}>Withdraw request</button>}
  </article>)}
  {role==='admin'&&<fieldset disabled={busy}><legend>Ask for an explicit decision</legend>
   <label>Native Dynamics task UUID<input disabled={!!key.current} value={taskId} onChange={e=>{setTaskId(e.target.value);clearDraft()}}/></label>
   <button onClick={prepare} disabled={!taskId.trim()||!!key.current}>Read source and eligible recipients</button>
   {preview&&<>{key.current&&<p>Creation receipt pending. Retry the same request without editing; do not start a duplicate.</p>}<p>Source: {preview.title} · revision {preview.revision}</p>
    <label>Named recipient<select disabled={!!key.current} value={recipient} onChange={e=>{setRecipient(e.target.value);key.current=null}}><option value="">Choose a recipient explicitly</option>{preview.recipients.map(p=><option key={p.id} value={p.id}>{p.name??'Profile'} · {p.id}</option>)}</select></label>
    <label>Question<textarea disabled={!!key.current} maxLength={4000} value={question} onChange={e=>{setQuestion(e.target.value);key.current=null}}/></label>
    <button disabled={!recipient||!question.trim()} onClick={submit}>Send internal decision request</button>
   </>}
  </fieldset>}
 </section>
}
