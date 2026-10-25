// Replay the ACTUAL bridge classifier against a private, SELECT-only capture.
// No credentials, provider calls, run creation, apply RPC or business write exists here.
import { readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, relative } from 'node:path'
import { createServer } from 'vite'

const capture=JSON.parse(readFileSync(process.argv[2],'utf8'))
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true,include:[]},logLevel:'error'})
try{
  const {assembleAutomaticSnapshot}=await server.ssrLoadModule('/supabase/functions/microsoft-transition-sync/automatic-snapshot.ts')
  const {previewAutomaticMicrosoftMirrors}=await server.ssrLoadModule('/supabase/functions/microsoft-transition-sync/automatic-reconciliation.ts')
  const snapshot=assembleAutomaticSnapshot(capture.sources,capture.job.assignee_map,capture.job.exported_at)
  function adapter(oldProjection=false){
    return{from(table){
      if(!Array.isArray(capture.tables[table]))throw Error('Missing captured authority')
      const filters=[],orders=[];let first=0,last=999,columns=''
      const query={select(v){columns=v;return this},eq(k,v){filters.push(r=>r[k]===v);return this},is(k,v){filters.push(r=>(r[k]??null)===v);return this},not(k,op,v){if(op!=='is'||v!==null)throw Error('Unsupported preflight filter');filters.push(r=>r[k]!=null);return this},order(k){orders.push(k);return this},range(a,b){first=a;last=b;return this},then(resolve,reject){
        const rows=capture.tables[table].filter(r=>filters.every(f=>f(r))).sort((a,b)=>{for(const k of orders){const c=String(a[k]??'').localeCompare(String(b[k]??''));if(c)return c}return 0}).slice(first,last+1)
        return Promise.resolve({data:rows.map(r=>Object.fromEntries(columns.split(',').map(k=>[k,oldProjection&&k==='microsoft_source_description'?r.notes:r[k]]))),error:null}).then(resolve,reject)
      }};return query
    },rpc(){throw Error('ZERO WRITE: an RPC is forbidden in this preflight')}}
  }
  const before=await previewAutomaticMicrosoftMirrors(adapter(true),snapshot),after=await previewAutomaticMicrosoftMirrors(adapter(),snapshot)
  if(before.error||after.error)throw Error(before.error||after.error)
  const tally=items=>items.reduce((a,i)=>{const key=`${i.destination}/${i.reconciliationAction}/${i.conflictCode??'none'}`;a[key]=(a[key]??0)+1;return a},{})
  const result={source_exported_at:snapshot.exportedAt,source_counts:snapshot.sources.map(s=>({name:s.sourceName,complete:s.complete,count:s.recordCount})),client_schedule_excluded:after.clientScheduleExcluded,
    before:tally(before.items),after:tally(after.items),after_items:after.items.map(i=>({source_type:i.sourceType,source_container_id:i.sourceCalendarId??i.sourcePlanId,source_item_id:i.sourceEventId??i.sourceTaskId,target_id:i.existingTargetId,expected_updated_at:i.expectedTargetUpdatedAt,action:i.reconciliationAction,conflict_code:i.conflictCode,conflict_reason:i.conflictReason,requires_removal_approval:i.requiresRemovalApproval??false})),writes:0}
  const outputIndex=process.argv.indexOf('--output')
  if(outputIndex!==-1){const path=process.argv[outputIndex+1];if(!path||!isAbsolute(path)||!relative(process.cwd(),path).startsWith('..'))throw Error('Keep private evidence outside Git');writeFileSync(path,JSON.stringify(result,null,2))}
  console.log(JSON.stringify({...result,after_items:undefined}))
}finally{await server.close()}
