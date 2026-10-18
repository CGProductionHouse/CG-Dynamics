import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'

const clientId='11111111-1111-4111-8111-111111111111'
const reportId='22222222-2222-4222-8222-222222222222'
const postId='33333333-3333-4333-8333-333333333333'
const post={id:postId,report_id:reportId,platform:'facebook',caption:'Reviewed public post',views:0,reach:null,raw:{},created_at:'2026-10-01T12:00:00Z'}
const report={id:reportId,client_id:clientId,platform:null,status:'published',period_start:'2026-10-01',period_end:'2026-10-16',published_at:'2026-10-17T12:00:00Z',general_notes:'PRIVATE staff notes'}

async function fixture(run){
  const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true}})
  try{
    const{getPreviewReport}=await server.ssrLoadModule('/src/lib/clientPortalPreview.ts')
    const{supabase}=await server.ssrLoadModule('/src/lib/supabase.ts')
    const original=supabase.from,calls=[]
    const state={exclusions:[],posts:[post],owned:{id:reportId},report,fail:null,reject:null,exclusionCount:'auto'}
    supabase.from=table=>{
      calls.push(['from',table]);let ownership=false
      const chain={then(resolve,reject){
        const data=table==='reports'?(ownership?state.owned:state.report):table==='posts'?state.posts:state.exclusions
        const response=state.reject===table?Promise.reject(Error('PRIVATE transport')):Promise.resolve({data,error:state.fail===table?{message:'PRIVATE backend'}:null,
          count:table==='report_content_exclusions'?(state.exclusionCount==='auto'?(Array.isArray(data)?data.length:null):state.exclusionCount):null})
        return response.then(resolve,reject)
      }}
      for(const method of['select','eq','is','order','single','maybeSingle'])chain[method]=(...args)=>{calls.push([method,...args]);if(method==='select'&&args[0]==='id')ownership=true;return chain}
      return chain
    }
    try{await run(getPreviewReport,state,calls)}finally{supabase.from=original}
  }finally{await server.close()}
}

test('preview report needs complete typed exclusion evidence, not missing data interpreted as no hidden posts',()=>fixture(async(read,state,calls)=>{
  for(const exclusions of[null,undefined,{},[null],[{post_id:postId,excluded:'false'}],[{post_id:postId,excluded:null}],[{post_id:'foreign-post',excluded:true}],[{post_id:postId,excluded:true},{post_id:postId,excluded:false}]]){
    state.exclusions=exclusions
    const result=await read(clientId,reportId)
    assert.equal(result.data,null,'Unknown/malformed visibility must not expose a report')
    assert.ok(result.error)
    assert.doesNotMatch(JSON.stringify(result),/PRIVATE/)
  }
  state.exclusions=[]
  let result=await read(clientId,reportId)
  assert.equal(result.error,null);assert.equal(result.data.posts[0].excluded,false)
  assert.equal(result.data.posts[0].impressions,0);assert.equal(result.data.posts[0].reach,null)
  state.exclusions=[{post_id:postId,excluded:true,staff_note:'PRIVATE'}]
  result=await read(clientId,reportId)
  assert.equal(result.error,null);assert.equal(result.data.posts[0].excluded,true)
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE|staff_note|general_notes|report_id/)
  state.exclusions=[{post_id:postId,excluded:false}]
  assert.equal((await read(clientId,reportId)).data.posts[0].excluded,false)
  for(const count of[null,undefined,2,-1,0.5]){
    state.exclusionCount=count
    assert.equal((await read(clientId,reportId)).data,null,'A missing/invalid count or truncated decisions page must fail unavailable')
  }
  state.exclusionCount='auto'
  assert.ok(calls.some(call=>JSON.stringify(call)===JSON.stringify(['eq','client_id',clientId])))
  assert.ok(calls.some(call=>JSON.stringify(call)===JSON.stringify(['eq','report_id',reportId])))
  assert.ok(!calls.some(([method])=>['insert','update','upsert','delete'].includes(method)))
}))

test('preview report rejects missing ownership, mismatched child identity and rejected reads without leaking transport details',()=>fixture(async(read,state,calls)=>{
  state.owned={id:'another-report'}
  assert.equal((await read(clientId,reportId)).data,null)
  assert.deepEqual(calls.filter(([method])=>method==='from'),[['from','reports']],'No child read before exact ownership proof')
  state.owned={id:reportId}
  for(const posts of[null,undefined,[null],[{...post,report_id:'foreign-report'}],[{...post,id:''}],[post,post]]){
    state.posts=posts
    const result=await read(clientId,reportId)
    assert.equal(result.data,null);assert.ok(result.error)
  }
  state.posts=[post];state.report={...report,id:'another-report'}
  assert.equal((await read(clientId,reportId)).data,null)
  state.report=report
  for(const table of['reports','posts','report_content_exclusions']){
    state.reject=table
    let result=await read(clientId,reportId)
    assert.equal(result.data,null);assert.ok(result.error);assert.doesNotMatch(JSON.stringify(result),/PRIVATE/)
    state.reject=null;state.fail=table
    result=await read(clientId,reportId)
    assert.equal(result.data,null);assert.ok(result.error);assert.doesNotMatch(JSON.stringify(result),/PRIVATE/)
    state.fail=null
  }
  state.posts=[];state.exclusions=[]
  assert.deepEqual((await read(clientId,reportId)).data.posts,[],'Genuine empty posts/decisions remain valid')
}))
