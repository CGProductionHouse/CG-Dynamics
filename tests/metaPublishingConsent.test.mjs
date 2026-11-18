import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { webcrypto } from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'

const reportingScopes = ['pages_show_list','pages_read_engagement','read_insights','instagram_basic','instagram_manage_insights','business_management']
const purpose = '?purpose=facebook_photo_publishing&confirm_permission_request=true'
function fixture({ enabled = false, role = 'manager', active = true, insertError = false, gateValue, changedRole, profileError = false } = {}) {
  let handler; const writes = [], envReads = []
  const sb = { auth: { getUser: async () => ({ data: { user: { id: '11111111-1111-4111-8111-111111111111' } }, error: null }) },
    from(name) {
      if (name === 'profiles') return { select() { return this }, eq() { return this }, single: async () => ({ data: { role, is_active: active }, error: null }),
        maybeSingle: async () => ({ data: { role:changedRole??role, is_active:active }, error:profileError?{code:'SYNTHETIC'}:null }) }
      assert.equal(name,'meta_oauth_states')
      return { insert: async row => { writes.push(row); return { error: insertError ? { code: 'SYNTHETIC' } : null } } }
    } }
  const env = { META_APP_ID:'123456',META_REDIRECT_URI:'https://fixture.invalid/callback',SUPABASE_URL:'https://fixture.invalid',
    SUPABASE_SERVICE_ROLE_KEY:'fixture-only',SOCIAL_FACEBOOK_PHOTO_CONSENT_ENABLED:gateValue??(enabled?'true':'false') }
  const code = ts.transpileModule(readFileSync('supabase/functions/meta-oauth-start/index.ts','utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022} }).outputText
  vm.runInNewContext(code,{exports:{},crypto:webcrypto,TextEncoder,btoa,URL,URLSearchParams,Date,Response,
    console:{error(){}}, Deno:{env:{get(name){envReads.push(name);return env[name]}},serve(fn){handler=fn}},
    require(name){
      if(name.endsWith('/cors.ts'))return {corsHeaders:{},jsonResponse:(body,status=200)=>Response.json(body,{status})}
      if(name.endsWith('/meta.ts'))return {resolveMetaGraphConfig:()=>({version:'v27.0'})}
      if(name==='https://esm.sh/@supabase/supabase-js@2')return {createClient:()=>sb}
      throw Error('Unexpected OAuth dependency')
    } })
  return {writes,envReads,async call(query='',method='POST',authenticated=true){
    const res=await handler(new Request('https://fixture.invalid/meta-oauth-start'+query,{method,headers:authenticated?{Authorization:'Bearer fixture-only'}:{}}))
    return {status:res.status,body:method==='OPTIONS'||res.status===204?null:await res.json()}
  }}
}

test('normal reporting OAuth retains its six scopes even when the separate consent gate is enabled',async()=>{
  for(const enabled of [false,true]){
    const f=fixture({enabled}),r=await f.call(),url=new URL(r.body.url)
    assert.equal(r.status,200);assert.deepEqual(url.searchParams.get('scope').split(','),reportingScopes)
    assert.equal(url.searchParams.get('auth_type'),null);assert.equal(f.writes.length,1)
    assert.equal(url.origin,'https://www.facebook.com');assert.equal(url.pathname,'/v27.0/dialog/oauth')
    assert.match(f.writes[0].state_hash,/^[a-f0-9]{64}$/);assert.equal(f.writes[0].state,undefined)
  }
})

test('explicit publishing consent is default-off and creates no OAuth state while disabled',async()=>{
  const f=fixture(),r=await f.call(purpose)
  assert.equal(r.status,409);assert.equal(r.body.code,'META_PUBLISHING_CONSENT_DISABLED')
  assert.equal(r.body.url,undefined);assert.equal(f.writes.length,0)
})

test('active manager opt-in adds only Page-post permission, reuses existing hashed state and never claims readiness',async()=>{
  const f=fixture({enabled:true}),r=await f.call(purpose),url=new URL(r.body.url)
  assert.equal(r.status,200);assert.deepEqual(url.searchParams.get('scope').split(','),[...reportingScopes,'pages_manage_posts'])
  assert.equal(url.searchParams.get('auth_type'),'rerequest');assert.equal(f.writes.length,1)
  assert.equal(r.body.consent_purpose,'facebook_photo_publishing');assert.equal(r.body.publishing_ready,false)
  assert.match(r.body.note,/permission request/i)
  assert.equal(f.envReads.includes('META_APP_SECRET'),false)
  assert.equal(f.envReads.includes('META_TOKEN_ENCRYPTION_KEY_B64'),false)
})

test('new consent mode refuses inactive and non-manager profiles before state creation',async()=>{
  for(const options of [{active:false},{role:'staff'},{role:'client'}]){
    const f=fixture({enabled:true,...options}),r=await f.call(purpose)
    assert.equal(r.status,403);assert.equal(f.writes.length,0);assert.equal(r.body.url,undefined)
  }
})

test('only the exact server gate enables the extra permission; a changed role or unreadable profile refuses state',async()=>{
  for(const gateValue of ['TRUE','1',' true','']){
    const f=fixture({enabled:true,gateValue}),r=await f.call(purpose)
    assert.equal(r.status,409);assert.equal(f.writes.length,0)
  }
  for(const change of [{changedRole:'staff'},{profileError:true}]){
    const f=fixture({enabled:true,...change}),r=await f.call(purpose)
    assert.equal(r.status,403);assert.equal(f.writes.length,0)
  }
})

test('an active admin can request permission but receives no client binding, approval or publishing authority',async()=>{
  const f=fixture({enabled:true,role:'admin'}),r=await f.call(purpose)
  assert.equal(r.status,200);assert.equal(r.body.publishing_ready,false)
  assert.equal(r.body.client_id,undefined);assert.equal(r.body.connection_id,undefined)
  assert.equal(r.body.job_id,undefined);assert.equal(f.writes.length,1)
})

test('ambiguous, malformed, unconfirmed or injected publishing requests cannot create OAuth state',async()=>{
  for(const query of ['?purpose=facebook_photo_publishing','?purpose=facebook_photo_publishing&confirm_permission_request=false',
    '?purpose=instagram','?confirm_permission_request=true',purpose+'&purpose=facebook_photo_publishing',
    purpose+'&confirm_permission_request=true',purpose+'&scope=ads_management',purpose+'&redirect_uri=https://foreign.invalid']){
    const f=fixture({enabled:true}),r=await f.call(query)
    assert.equal(r.status,400,query);assert.equal(f.writes.length,0);assert.equal(r.body.url,undefined)
  }
})

test('legacy caller scope overrides never widen the normal request',async()=>{
  const f=fixture({enabled:true}),r=await f.call('?scope=ads_management&redirect_uri=https://foreign.invalid')
  const url=new URL(r.body.url)
  assert.deepEqual(url.searchParams.get('scope').split(','),reportingScopes)
  assert.equal(url.searchParams.get('redirect_uri'),'https://fixture.invalid/callback')
})

test('state persistence failure yields no provider URL for an explicit permission request',async()=>{
  const f=fixture({enabled:true,insertError:true}),r=await f.call(purpose)
  assert.equal(r.status,500);assert.equal(r.body.url,undefined);assert.equal(f.writes.length,1)
})

test('preflight, method and authentication guards do not create OAuth states',async()=>{
  const f=fixture({enabled:true})
  assert.equal((await f.call(purpose,'OPTIONS')).status,200)
  assert.equal((await f.call(purpose,'GET')).status,405)
  assert.equal((await f.call(purpose,'POST',false)).status,401)
  assert.equal(f.writes.length,0)
})
