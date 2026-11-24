import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { createServer } from 'vite'
import { isUuid, assertRecordClientMatchesContext } from '../supabase/functions/cg-dynamics-mcp/projectContext.ts'
import { buildGuidelineNavigation } from '../supabase/functions/cg-dynamics-mcp/contentGuidelineActions.ts'
import { actualOperationalDispatcher } from './helpers/mcpOperationalDispatcher.mjs'

const CLIENT='11111111-1111-4111-8111-111111111111', OTHER='22222222-2222-4222-8222-222222222222'
const ACTOR='33333333-3333-4333-8333-333333333333', RUN='44444444-4444-4444-8444-444444444444'
const GUIDE='55555555-5555-4555-8555-555555555555', EVENT='66666666-6666-4666-8666-666666666666'
let server, resolveGuidelinePreparation, setPreparedGuidelineMonth, ensure
before(async()=>{
  server=await createServer({logLevel:'error',optimizeDeps:{noDiscovery:true,entries:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
  const module=await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/guidelinePreparation.ts')
  resolveGuidelinePreparation=module.resolveGuidelinePreparation;setPreparedGuidelineMonth=module.setPreparedGuidelineMonth
  const source=readFileSync('supabase/functions/cg-dynamics-mcp/index.ts','utf8')
  const start=source.indexOf('async function resolveContentRunScope('),end=source.indexOf('/** Per-video evidence',start)
  assert.ok(start>=0&&end>start)
  const js=ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  ensure=new Function('isUuid','assertRecordClientMatchesContext','resolveGuidelinePreparation','setPreparedGuidelineMonth','buildGuidelineNavigation',`${js};return handleEnsureContentGuideline`)(isUuid,assertRecordClientMatchesContext,resolveGuidelinePreparation,setPreparedGuidelineMonth,buildGuidelineNavigation)
})
after(async()=>server?.close())

function fixture({runs=[],guides=[],fail=null,loseInsert=false,inactive=false}={}){
  const tables={clients:[{id:CLIENT,name:'Exact practice client',active:!inactive}],content_runs:structuredClone(runs),content_guidelines:structuredClone(guides),content_guide_ideas:[],company_calendar_events:[]}
  const writes=[],reads=[],receipts=new Map();let serial=0
  const db={tables,writes,reads,receipts,fail,rpcFailure:false,from(table){
    const filters=[];let from=0,to=Infinity,one=false,operation='read',payload
    const query={select(){return this},eq(k,v){filters.push(r=>r[k]===v);return this},is(k,v){filters.push(r=>r[k]===v);return this},neq(k,v){filters.push(r=>r[k]!==v);return this},order(){return this},range(a,b){from=a;to=b;return this},limit(n){to=n-1;return this},maybeSingle(){one=true;return this},single(){one=true;return this},insert(row){operation='insert';payload=row;return this},update(patch){operation='update';payload=patch;return this},then(done,reject){return Promise.resolve().then(()=>{
      reads.push({table,operation,from})
      if(db.fail===table||db.fail===`${table}:${from}`)return {data:null,error:{message:'Exact source unavailable'}}
      const rows=tables[table]??[]
      if(operation==='insert'){
        writes.push({table,payload})
        if(rows.some(r=>r.id===payload.id))return {data:null,error:{message:'duplicate key'}}
        rows.push({...payload,updated_at:`revision-${++serial}`})
        if(loseInsert)return {data:null,error:{message:'Lost accepted insert response'}}
      }
      let found=rows.filter(r=>filters.every(f=>f(r))).slice(from,to+1)
      if(operation==='update'){writes.push({table,payload});for(const row of found)Object.assign(row,payload,{updated_at:`revision-${++serial}`})}
      return {data:one?found[0]??null:found,error:null}
    }).then(done,reject)}};return query
  },async rpc(name,args){
    if(name==='mcp_check_idempotency'){
      const row=receipts.get(args.p_idempotency_key)
      return {data:[{already_executed:Boolean(row),existing_result:row?(row.input_hash===args.p_input_hash?row.result_payload:{status:'conflict'}):null}],error:null}
    }
    assert.equal(name,'get_or_create_content_guideline_as_actor')
    if(db.rpcFailure)return {data:null,error:{message:'Temporary canonical source failure'}}
    assert.equal(args.p_actor_profile_id,ACTOR)
    const run=tables.content_runs.find(r=>r.id===args.p_run_id)
    if(!run)return {data:null,error:{message:'No exact run'}}
    let guide=tables.content_guidelines.find(g=>g.content_run_id===run.id)
    if(!guide){guide={id:GUIDE,client_id:run.client_id,content_run_id:run.id,title:'Saved client direction',month:run.run_date?run.run_date.slice(0,7)+'-01':null,status:'draft',updated_at:`revision-${++serial}`};tables.content_guidelines.push(guide);writes.push({table:'canonical_guideline_rpc',payload:guide})}
    return {data:guide,error:null}
  }}
  // The actual dispatcher stores its original-result receipt in the existing log.
  const originalFrom=db.from.bind(db)
  db.from=table=>table==='mcp_idempotency_log'?{
    async insert(row){if(receipts.has(row.idempotency_key))return {error:{code:'23505'}};receipts.set(row.idempotency_key,{id:'receipt',...row});return {error:null}},
    update(patch){const filters=[];return {eq(key,value){filters.push([key,value]);return this},select(){return this},async maybeSingle(){const row=[...receipts.values()].find(r=>filters.every(([k,v])=>r[k]===v));if(row)Object.assign(row,patch);return {data:row??null,error:null}}}},
  }:originalFrom(table)
  return db
}
const actor=db=>({profileId:ACTOR,contextKind:'client',effectiveClientId:CLIENT,supabase:db,role:'admin',connection:{role:'admin',profileId:ACTOR,userId:ACTOR}})
const run=(extra={})=>({id:RUN,client_id:CLIENT,name:'Real saved shoot',run_date:null,status:'planning',calendar_event_id:null,...extra})
const guide=(extra={})=>({id:GUIDE,client_id:CLIENT,content_run_id:RUN,title:'Keep staff wording',month:'2026-12-01',status:'draft',updated_at:'original',...extra})
const payload=response=>JSON.parse(response.result.content[0].text)

test('actual client dispatcher prepares one undated run/document, sets coverage and returns usable links',async()=>{
  const db=fixture(),call=actualOperationalDispatcher(actor(db),{ensure_content_guideline:ensure})
  const args={context:{context_kind:'client',client_id:CLIENT},month:'2026-12',idempotency_key:'prepare-real-month'}
  const first=payload(await call(args,'ensure_content_guideline'))
  assert.equal(first.month,'2026-12-01');assert.equal(first.booking_state,'unbooked_preparation');assert.equal(first.run_date,null)
  assert.ok(new URL(first.guideline_url).searchParams.get('guideline'));assert.equal(first.video_count,0)
  assert.equal(db.tables.content_runs.length,1);assert.equal(db.tables.content_guidelines.length,1)
  assert.equal(db.tables.content_runs[0].calendar_event_id,null);assert.equal(db.tables.company_calendar_events.length,0)
  const second=payload(await call(args,'ensure_content_guideline'))
  assert.equal(second.guideline_id,first.guideline_id);assert.equal(second.content_run_id,first.content_run_id)
  assert.equal(db.tables.content_runs.length,1);assert.equal(db.tables.content_guidelines.length,1)
  const changed=await call({...args,month:'2027-01'},'ensure_content_guideline')
  assert.equal(changed.result.isError,true);assert.equal(db.tables.content_runs.length,1)
})

test('a different retry key reuses the monthly guideline and preserves staff wording, scripts and publication',async()=>{
  const db=fixture({runs:[run()],guides:[guide({status:'published'})]});db.tables.content_guide_ideas.push({id:'script',client_id:CLIENT,content_guideline_id:GUIDE,script:'Keep all eight full scripts.',status:'draft'})
  const before=JSON.stringify(db.tables),saved=await ensure(actor(db),{month:'2026-12',client_id:CLIENT})
  assert.equal(saved.guideline_id,GUIDE);assert.equal(saved.status,'published');assert.equal(saved.video_count,1)
  assert.equal(JSON.stringify(db.tables),before);assert.equal(db.writes.length,0)
})

test('legacy exact-run contract still works without a month or a planning insert',async()=>{
  const db=fixture({runs:[run()],guides:[guide()]});const saved=await ensure(actor(db),{content_run_id:RUN})
  assert.equal(saved.guideline_id,GUIDE);assert.equal(db.writes.length,0)
})

test('a real dated run is reused rather than inventing another booking',async()=>{
  const db=fixture({runs:[run({run_date:'2026-12-08'})]});const saved=await ensure(actor(db),{month:'2026-12',client_id:CLIENT})
  assert.equal(saved.content_run_id,RUN);assert.equal(saved.run_date,'2026-12-08');assert.equal(db.tables.content_runs.length,1)
})

test('exact saved calendar identity resolves its existing mirror, with no new event or run',async()=>{
  const db=fixture({runs:[run({calendar_event_id:EVENT,run_date:'2026-12-08'})]});db.tables.company_calendar_events.push({id:EVENT,client_id:CLIENT,event_type:'content_run',status:'planned'})
  const saved=await ensure(actor(db),{calendar_event_id:EVENT,client_id:CLIENT})
  assert.equal(saved.content_run_id,RUN);assert.equal(db.tables.content_runs.length,1);assert.equal(db.tables.company_calendar_events.length,1)
})

test('cross-client context, inactive client, invalid month and missing facts stop before insert',async()=>{
  for(const [options,input] of [[{},{month:'2026-12',client_id:OTHER}],[{inactive:true},{month:'2026-12',client_id:CLIENT}],[{},{month:'2026-13',client_id:CLIENT}],[{},{client_id:CLIENT}],[{},{content_run_id:RUN,month:'2026-12'}]]){
    const db=fixture(options),result=await ensure(actor(db),input);assert.ok(result.error);assert.equal(db.writes.length,0)
  }
})

test('history really reads row 1001; a failed later page never becomes missing history',async()=>{
  const history=Array.from({length:1000},(_,i)=>guide({id:`10000000-0000-4000-8000-${String(i).padStart(12,'0')}`,content_run_id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,month:'2026-10-01'}))
  const db=fixture({runs:[run()],guides:[...history,guide()]});const saved=await ensure(actor(db),{client_id:CLIENT,month:'2026-12'})
  assert.equal(saved.guideline_id,GUIDE);assert.ok(db.reads.some(r=>r.table==='content_guidelines'&&r.from===1000));assert.equal(db.writes.length,0)
  const failed=fixture({runs:[run()],guides:history,fail:'content_guidelines:1000'});assert.ok((await ensure(actor(failed),{client_id:CLIENT,month:'2026-12'})).error);assert.equal(failed.writes.length,0)
})

test('multiple real monthly documents or shoots are reported without duplication',async()=>{
  for(const options of [{runs:[run()],guides:[guide(),guide({id:EVENT})]},{runs:[run({run_date:'2026-12-02'}),run({id:EVENT,run_date:'2026-12-05'})]}]){
    const db=fixture(options),saved=await ensure(actor(db),{client_id:CLIENT,month:'2026-12'})
    assert.ok(saved.error);assert.equal(saved.candidates.length,2);assert.equal(db.writes.length,0)
  }
})

test('lost accepted planning insert response recovers by the same durable ID',async()=>{
  const db=fixture({loseInsert:true}),saved=await ensure(actor(db),{client_id:CLIENT,month:'2026-12'})
  assert.equal(saved.guideline_id,GUIDE);assert.equal(db.tables.content_runs.length,1);assert.equal(db.tables.content_guidelines.length,1)
})

test('published or changed coverage is never overwritten by a preparation request',async()=>{
  for(const existing of [guide({month:null,status:'published'}),guide({month:'2026-11-01'})]){
    const db=fixture({guides:[existing]});const result=await setPreparedGuidelineMonth(actor(db),existing,'2026-12-01')
    assert.ok(result.error);assert.equal(db.writes.length,0)
  }
})

test('an exact failed ensure recovers with the SAME key and upgrades only its failed receipt',async()=>{
  const db=fixture();db.rpcFailure=true
  const call=actualOperationalDispatcher(actor(db),{ensure_content_guideline:ensure})
  const args={context:{context_kind:'client',client_id:CLIENT},month:'2026-12',idempotency_key:'recover-exact-prepare'}
  const first=await call(args,'ensure_content_guideline');assert.equal(first.result.isError,true)
  assert.equal(db.tables.content_runs.length,1);assert.equal(db.tables.content_guidelines.length,0)
  db.rpcFailure=false
  const saved=await call(args,'ensure_content_guideline');assert.equal(saved.result.isError,false)
  assert.equal(payload(saved).guideline_id,GUIDE);assert.equal(db.tables.content_runs.length,1);assert.equal(db.tables.content_guidelines.length,1)
  assert.equal([...db.receipts.values()][0].result_status,'success')
  assert.deepEqual(await call(args,'ensure_content_guideline'),saved)
})
