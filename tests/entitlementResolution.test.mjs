import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'
import { resolutionFixtures, keys } from './fixtures/entitlementResolution.mjs'
import { readFileSync } from 'node:fs'

async function modules(run) {
  globalThis.__resolutionMock = {}
  const server = await createServer({ configFile:false,server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true,include:[]},plugins:[{name:'local-read-only-supabase',transform(_code,id){if(id.replaceAll('\\','/').endsWith('/lib/supabase.ts'))return 'export const supabase=globalThis.__resolutionMock'}}] })
  try { await run(await server.ssrLoadModule('/src/lib/entitlementResolution.ts'),await server.ssrLoadModule('/src/lib/entitlementResolutionRead.ts')) } finally { await server.close(); delete globalThis.__resolutionMock }
}
test('three exact accepted hints require approved unchanged receipts, never verify scope', async () => modules(async ({buildResolutionRows}) => {
  const fixture = resolutionFixtures(), rows = buildResolutionRows(fixture)
  assert.equal(rows.length,28); assert.equal(rows.filter(r=>r.ready).length,3)
  assert.ok(rows.every(r=>r.unresolved && !r.reviewed && !r.evidence))
  assert.ok(rows.some(r=>r.connection==='connected' && !r.ready && r.unresolved))
  const red = fixture.find(c=>c.client_name==='Red Oak')
  for (const changed of [{...red,client_id:'wrong-client'},{...red,package_settings:null},{...red,package_settings:{...red.package_settings,other_agreed_deliverables:'generic socials'}},{...red,package_settings:{...red.package_settings,verification:{...red.package_settings.verification,source_references:['unapproved']}}}]) {
    assert.equal(buildResolutionRows([changed]).filter(r=>r.ready).length,0)
  }
}))
test('filters keep unknown reviewed decisions, generic context and connection independent',async()=>modules(async({buildResolutionRows,filterResolutionRows})=>{
  const fixture=resolutionFixtures()
  fixture[0].entitlements=[{service_key:'tiktok',state:'unknown',evidence_note:'Awaiting agreement',source_references:[],verified_at:'2026-10-02T10:00:00Z',revision:1,notes:null}]
  const rows=buildResolutionRows(fixture), all={service:'',client:'',readiness:'',context:'',reviewed:''}
  assert.equal(filterResolutionRows(rows,{...all,readiness:'ready'}).length,3)
  assert.equal(filterResolutionRows(rows,{...all,readiness:'unresolved'}).length,25)
  assert.equal(filterResolutionRows(rows,{...all,reviewed:'reviewed'})[0].unresolved,true)
  assert.equal(filterResolutionRows(rows,{...all,context:'excluded'}).length,7)
  assert.equal(filterResolutionRows(rows,{...all,client:fixture[0].client_id,service:'tiktok'}).length,1)
  assert.equal(filterResolutionRows(rows,{...all,reviewed:'unreviewed'}).length,27)
}))
test('actual read helper pages 1001 rows, fails closed on later errors, repeats and malformed evidence',async()=>modules(async(_model,{readEntitlementResolutionQueue})=>{
  const clients=Array.from({length:1001},(_,i)=>({...resolutionFixtures()[0],client_id:`00000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`}))
  const calls=[]
  globalThis.__resolutionMock.rpc=async(name,p)=>{calls.push({name,p});return{data:clients.filter(c=>!p.p_after_client_id || c.client_id>p.p_after_client_id).slice(0,p.p_page_size),error:null}}
  assert.equal((await readEntitlementResolutionQueue()).length,1001);assert.equal(calls.length,21)
  assert.ok(calls.every(c=>c.name==='get_admin_entitlement_resolution_queue' && c.p.p_page_size===50))
  globalThis.__resolutionMock.rpc=async(_name,p)=>p.p_after_client_id ? {error:new Error('later read failed')} : {data:clients.slice(0,50)}
  await assert.rejects(readEntitlementResolutionQueue(),/later read failed/)
  for (const data of [null,[clients[0],clients[0]],[{...clients[0],connections:[]}],[{...clients[0],entitlements:[{service_key:'tiktok',state:'not_included'}]}]]) {
    globalThis.__resolutionMock.rpc=async()=>({data});await assert.rejects(readEntitlementResolutionQueue())
  }
  globalThis.__resolutionMock.rpc=async()=>({error:new Error('missing RPC')});await assert.rejects(readEntitlementResolutionQueue(),/missing RPC/)
  let capped=0
  globalThis.__resolutionMock.rpc=async()=>({data:Array.from({length:50},()=>({...clients[0],client_id:`00000000-0000-0000-0000-${String(++capped).padStart(12,'0')}`}))})
  await assert.rejects(readEntitlementResolutionQueue(),/bounded paging limit/);assert.equal(capped,5000)
  assert.equal(keys.length,7)
}))
test('admin connection projection stays identical to canonical client projection and read-only',()=>{
  const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
  const base=read('supabase/migrations/20261002124434_client_service_entitlements.sql')
  const queue=read('supabase/migrations/20261002140843_client_entitlement_resolution_queue.sql')
  const connection=source=>source.slice(source.indexOf("when s.key='instagram'"),source.indexOf("else 'unavailable' end",source.indexOf("when s.key='instagram'"))).replaceAll('v_client','client.id').replace(/\s+/g,' ')
  assert.equal(connection(base),connection(queue))
  assert.doesNotMatch(queue,/\b(insert into|update public|delete from|alter table)\b/i)
  assert.match(queue,/revoke all.*from public,anon/)
  const component=read('src/components/admin/EntitlementResolutionQueue.tsx')
  assert.match(component,/rows\.filter\(row => row\.unresolved\)/)
  assert.doesNotMatch(component,/verifyServiceEvidence|\.insert\(|\.update\(|\.upsert\(/)
})
