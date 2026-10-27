// Compile the actual dispatcher/creator/receipt functions. Identity lookup is injected,
// but context parsing, canonical key derivation and receipt/SQL paths are real.
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import * as context from '../../supabase/functions/cg-dynamics-mcp/projectContext.ts'
import { commitOperationalWrite, parseIdempotencyRead, ownsOperationalReceipt } from '../../supabase/functions/cg-dynamics-mcp/operationalReceipts.ts'

const source=readFileSync('supabase/functions/cg-dynamics-mcp/index.ts','utf8')
function compile(start,end,names,deps={}){
  const a=source.indexOf(start),b=source.indexOf(end,a)
  if(a<0||b<=a)throw Error('Actual MCP function boundary missing')
  const js=ts.transpileModule(source.slice(a,b),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  return new Function(...Object.keys(deps),`${js};return {${names.join(',')}}`)(...Object.values(deps))
}
const hashes=compile('async function computeInputHash','// ── Table existence check',['computeInputHash','checkIdempotency','recordIdempotency'],{parseIdempotencyRead,strategyMcpInputHash:async()=>{throw Error('Unicode hash is covered by its own suite')}})
const {handleCreateTask}=compile('const handleCreateTask:','const handleUpdateTask:',['handleCreateTask'],{commitOperationalWrite,computeInputHash:hashes.computeInputHash})
const responses=compile('function jsonRpcResponse','// ── Auth ──',['jsonRpcResponse','jsonRpcError'],{corsHeaders:{}})
const {CANONICAL_RECEIPT_REPLAY_TOOLS}=compile('const CANONICAL_RECEIPT_REPLAY_TOOLS','const toolHandlers:',['CANONICAL_RECEIPT_REPLAY_TOOLS'],context)

export function actualOperationalDispatcher(staff,handlers={create_task:handleCreateTask},writeTools=new Set(Object.keys(handlers))){
  const {handleToolsCall}=compile('async function handleToolsCall','// ── HTTP Handler',['handleToolsCall'],{
    ...context,...hashes,...responses,ownsOperationalReceipt,
    resolveOperatingContext:async()=>({ok:true,staff}),
    handleResolveProjectContext:async()=>{throw Error('Not a bootstrap test')},
    isMcpErrorResult:result=>Boolean(result&&typeof result.error==='string'),
    toolHandlers:handlers,WRITE_TOOLS:writeTools,CANONICAL_RECEIPT_REPLAY_TOOLS,
  })
  return async(input,tool='create_task')=>{
    const response=await handleToolsCall(1,staff.supabase,staff.connection,tool,{context:{context_kind:'staff',staff_profile_id:staff.profileId},...input})
    return response.json()
  }
}
