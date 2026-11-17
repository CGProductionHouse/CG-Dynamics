import assert from 'node:assert/strict'
import test from 'node:test'
import {readFile} from 'node:fs/promises'
import {createServer} from 'vite'

test('workbook task reader fails closed on missing Planner, assignment RPC and bucket evidence',async()=>{
 const server=await createServer({configFile:false,envDir:false,define:{'import.meta.env.VITE_SUPABASE_URL':'"http://127.0.0.1:1"','import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':'"synthetic-test-key"'},server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true,entries:[]}})
 try{
  const {supabase}=await server.ssrLoadModule('/src/lib/supabase.ts')
  const {listTasks}=await server.ssrLoadModule('/src/lib/commandCentre.ts')
  const originalFrom=supabase.from,originalRpc=supabase.rpc
  let failure=''
  const native={id:'native-task',title:'Native',status:'to_do'}
  const planner={id:'planner-task',title:'Planner',status:'approved',bucket_id:'bucket-1',assigned_to_name:null}
  const query=key=>{
   const chain={then:(resolve,reject)=>{
    const error=key===failure?{code:key==='rpc'?'PGRST202':'42P01',message:'Required source does not exist'}:null
    const data=key==='command_centre_tasks'?[native]:key==='planner_tasks_canonical'?[planner]:key==='rpc'?[{task_id:planner.id,profile_id:'owner-1'}]:key==='planner_buckets'?[{id:'bucket-1',name:'Websites'}]:[]
    return Promise.resolve({data:error?null:data,error}).then(resolve,reject)
   }}
   for(const name of ['select','order','range','in','eq','is','not'])chain[name]=()=>chain
   return chain
  }
  supabase.from=table=>query(table);supabase.rpc=()=>query('rpc')
  try{
   for(failure of ['planner_tasks_canonical','rpc','planner_buckets']){
    assert((await listTasks({requireCompleteSources:true})).error, failure+' must not become a healthy workbook snapshot')
    assert.equal((await listTasks()).error,null,'Existing legacy callers retain their compatibility behavior')
   }
   failure='';const healthy=await listTasks({requireCompleteSources:true})
   assert.equal(healthy.error,null);assert.equal(healthy.data.length,2)
   const actual=healthy.data.find(t=>t.data_origin==='planner_tasks')
   assert.deepEqual(actual.assignee_user_ids,['owner-1']);assert.equal(actual.planner_status,'approved');assert.equal(actual.bucket,'Websites')
  }finally{supabase.from=originalFrom;supabase.rpc=originalRpc}
  assert.match(await readFile('src/pages/admin/NolanOverview.tsx','utf8'),/listTasks\(\{ requireCompleteSources: true \}\)/)
 }finally{await server.close()}
})
