import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'

const clientId='11111111-1111-4111-8111-111111111111'
const asset={id:'22222222-2222-4222-8222-222222222222',category:'video',displayName:'Reviewed final',mimeType:'video/mp4',sizeBytes:null,publishedAt:'2026-10-01T12:00:00Z',deliverableTitle:'Exact linked work',planMonth:'2026-10'}
const summary={clientName:'Synthetic client',clientLogoUrl:null,available:true,categories:[{category:'video',fileCount:1,years:[{year:2026,fileCount:1,months:[{month:10,fileCount:1}]}]}]}

async function fixture(run) {
  const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true}})
  try {
    const {supabase}=await server.ssrLoadModule('/src/lib/supabase.ts')
    const api=await server.ssrLoadModule('/src/features/client-portal-library/api.ts')
    const descriptor=Object.getOwnPropertyDescriptor(supabase,'functions'); const calls=[]; let reply
    Object.defineProperty(supabase,'functions',{configurable:true,value:{invoke:async(name,args)=>{calls.push({name,...args});if(reply instanceof Error)throw reply;return reply}}})
    try {await run(api,value=>{reply=value},calls)} finally {if(descriptor)Object.defineProperty(supabase,'functions',descriptor);else delete supabase.functions}
  } finally {await server.close()}
}

test('library summary rejects missing/malformed counts and read rejection; verified zero stays zero',async()=>fixture(async(api,reply,calls)=>{
  for(const data of [null,{}, {...summary,categories:null},{...summary,available:'yes'},{...summary,categories:[{...summary.categories[0],fileCount:null}]},{...summary,categories:[{...summary.categories[0],fileCount:2}]},{...summary,categories:[{...summary.categories[0],fileCount:-1}]},{...summary,categories:[{...summary.categories[0],years:[{year:2026,fileCount:1,months:[{month:13,fileCount:1}]}]}]}]) {
    reply({data:{ok:true,data},error:null});const result=await api.loadClientPortalLibrary(clientId);assert.equal(result.data,null);assert.ok(result.error)
  }
  const zero={...summary,categories:[{category:'video',fileCount:0,years:[]}]}
  const original=structuredClone(summary)
  reply({data:{ok:true,data:summary},error:null});assert.deepEqual((await api.loadClientPortalLibrary(clientId)).data,summary);assert.deepEqual(summary,original)
  reply({data:{ok:true,data:{...zero,internal_note:'PRIVATE'}},error:null})
  assert.deepEqual((await api.loadClientPortalLibrary(clientId)).data,zero)
  reply({data:{ok:true,data:{...summary,available:false,categories:[]}},error:null})
  assert.equal((await api.loadClientPortalLibrary(clientId)).data.available,false)
  reply(new Error('transport unavailable'));assert.ok((await api.loadClientPortalLibrary(clientId)).error)
  assert.ok(calls.every(call=>call.name==='client-onboarding'&&call.body.action==='staff_preview_portal_library_load'&&call.body.clientId===clientId))
}))

test('library file projection fails closed on malformed/cross-category/mixed rows and preserves null/zero',async()=>fixture(async(api,reply,calls)=>{
  const read=()=>api.loadClientPortalLibraryFiles('video',2026,10,0,clientId)
  for(const data of [null,{}, {assets:null,nextOffset:null},{assets:[null],nextOffset:null},{assets:[asset,{...asset,id:'33333333-3333-4333-8333-333333333333',category:'graphic_design'}],nextOffset:null},{assets:[{...asset,sizeBytes:-1}],nextOffset:null},{assets:[{...asset,planMonth:'2026-99'}],nextOffset:null},{assets:[asset],nextOffset:1},{assets:[asset,asset],nextOffset:null}]) {
    reply({data:{ok:true,data},error:null});const result=await read();assert.equal(result.data,null);assert.ok(result.error)
  }
  reply({data:{ok:true,data:{assets:[{...asset,internal_note:'PRIVATE',drive_id:'PRIVATE'}],nextOffset:null}},error:null})
  assert.deepEqual((await read()).data,{assets:[asset],nextOffset:null})
  reply({data:{ok:true,data:{assets:[{...asset,sizeBytes:0,deliverableTitle:null,planMonth:null}],nextOffset:null}},error:null})
  assert.equal((await read()).data.assets[0].sizeBytes,0)
  reply({data:{ok:true,data:{assets:[],nextOffset:null}},error:null});assert.deepEqual((await read()).data,{assets:[],nextOffset:null})
  reply(new Error('transport unavailable'));assert.ok((await read()).error)
  assert.ok(calls.every(call=>call.body.action==='staff_preview_portal_library_month'&&call.body.clientId===clientId&&call.body.category==='video'&&call.body.year===2026&&call.body.month===10))
}))

test('library pagination, numeric range and real-client reads keep the existing canonical contract',async()=>fixture(async(api,reply,calls)=>{
  reply({data:{ok:true,data:summary},error:null});assert.ok((await api.loadClientPortalLibrary()).data)
  assert.deepEqual(calls[0].body,{action:'portal_library_load'})
  for(const sizeBytes of [NaN,Infinity,0.5,Number.MAX_SAFE_INTEGER+1,'0']){
    reply({data:{ok:true,data:{assets:[{...asset,sizeBytes}],nextOffset:null}},error:null})
    assert.ok((await api.loadClientPortalLibraryFiles('video',2026,10)).error)
  }
  reply({data:{ok:true,data:{assets:[{...asset,publishedAt:'2026-02-30T00:00:00Z'}],nextOffset:null}},error:null})
  assert.ok((await api.loadClientPortalLibraryFiles('video',2026,10)).error)
  const assets=Array.from({length:24},(_,index)=>({...asset,id:`22222222-2222-4222-8222-${String(index).padStart(12,'0')}`,sizeBytes:index}))
  const page={assets,nextOffset:48};reply({data:{ok:true,data:page},error:null})
  assert.deepEqual((await api.loadClientPortalLibraryFiles('video',2026,10,24)).data,page)
  assert.deepEqual(calls.at(-1).body,{action:'portal_library_month',category:'video',year:2026,month:10,offset:24})
  reply({data:{ok:'yes',data:page},error:null});assert.ok((await api.loadClientPortalLibraryFiles('video',2026,10,24)).error)
  reply({data:{ok:true,data:summary},error:new Error('denied')});assert.ok((await api.loadClientPortalLibrary()).error)
}))
