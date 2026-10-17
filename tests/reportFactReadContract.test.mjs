import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'

const fact = { platform:'facebook', period_month:'2026-09', period_start:'2026-09-01', period_end:'2026-09-23',
  metric_key:'brand_views', source_metric:'page_media_view', value:0, availability:'valid_zero',
  includes_paid:'both', aggregation:'sum', comparable_group:'fb_views' }
const status = {normalized_attempted:true,current_fact_count:1,ready_fact_count:1}

test('report facts reject missing or malformed evidence without activating legacy fallback', async () => {
  const server = await createServer({configFile:false,server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true}})
  try {
    const {supabase}=await server.ssrLoadModule('/src/lib/supabase.ts')
    const {loadReportMetricFacts,loadReportPlatformFacts}=await server.ssrLoadModule('/src/lib/db/reportingTruth.ts')
    const original=supabase.rpc, calls=[]
    let facts=[fact],statuses=[status],failure=null,rejected=false
    supabase.rpc=async(name,args)=>{calls.push([name,args]);if(rejected)throw Error('PRIVATE transport');return{data:name==='get_report_metric_facts'?facts:statuses,error:failure}}
    const load=()=>loadReportPlatformFacts('report','2026-09','2026-08')
    const unavailable=result=>{
      assert.ok(result.error)
      assert.deepEqual(result.facts,[])
      assert.deepEqual(result.previousFacts,[])
      assert.doesNotMatch(JSON.stringify(result),/PRIVATE/)
    }
    try {
      for(const value of [null,undefined,{},'invalid',[null],[{}],[fact,null]]){facts=value;unavailable(await load())}
      for(const patch of [{value:'0'},{value:Infinity},{availability:'invented'},{period_month:'2026-13'},
        {period_start:'2026-02-30'},{period_end:'2026-08-31'},{platform:''},{metric_key:null},{aggregation:42}]){
        facts=[{...fact,...patch}];unavailable(await load())
      }
      facts=[fact]
      for(const value of [null,undefined,{},[],[null],[{}],[status,status],
        [{...status,normalized_attempted:'false'}],[{...status,current_fact_count:-1}],
        [{...status,ready_fact_count:2}],[{...status,ready_fact_count:'1'}],
        [{...status,normalized_attempted:false}]]){statuses=value;unavailable(await load())}
      statuses=[status];failure={message:'PRIVATE backend'}
      unavailable(await load())
      assert.ok((await loadReportMetricFacts('report')).error)
      failure=null;rejected=true;unavailable(await load())
      assert.ok((await loadReportMetricFacts('report')).error)
      assert.ok(calls.every(([name,args])=>['get_report_metric_facts','get_report_metric_fact_status'].includes(name)&&args.p_report_id==='report'))
    } finally {supabase.rpc=original}
  } finally {await server.close()}
})

test('report facts preserve genuine legacy, valid zero, partial and unknown data with a public projection', async () => {
  const server = await createServer({configFile:false,server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true}})
  try {
    const {supabase}=await server.ssrLoadModule('/src/lib/supabase.ts')
    const {loadReportMetricFacts,loadReportPlatformFacts}=await server.ssrLoadModule('/src/lib/db/reportingTruth.ts')
    const original=supabase.rpc
    let facts=[],statuses=[{normalized_attempted:false,current_fact_count:0,ready_fact_count:0}]
    supabase.rpc=async name=>({data:name==='get_report_metric_facts'?facts:statuses,error:null})
    try {
      const legacy=await loadReportPlatformFacts('report','2026-09',null)
      assert.equal(legacy.error,null);assert.equal(legacy.normalizedAttempted,false);assert.deepEqual(legacy.facts,[])
      statuses=[{...status,ready_fact_count:0}]
      assert.equal((await loadReportPlatformFacts('report','2026-09',null)).normalizedAttempted,true,'An attempted empty result stays attempted')
      for(const availability of ['complete','valid_zero','partial','unavailable','permission_blocked','error','stale']){
        facts=[{...fact,availability,value:['unavailable','permission_blocked','error','stale'].includes(availability)?null:0,internal_note:'PRIVATE'}]
        const result=await loadReportPlatformFacts('report','2026-09','2026-08')
        assert.equal(result.error,null);assert.equal(result.facts[0].availability,availability)
        assert.equal(result.facts[0].value,facts[0].value)
        assert.doesNotMatch(JSON.stringify(await loadReportMetricFacts('report')),/PRIVATE|internal_note/)
      }
      facts=[fact,{...fact,period_month:'2026-08',period_start:'2026-08-01',period_end:'2026-08-31'}]
      const result=await loadReportPlatformFacts('report','2026-09','2026-08')
      assert.equal(result.facts.length,1);assert.equal(result.previousFacts.length,1)
    } finally {supabase.rpc=original}
  } finally {await server.close()}
})
