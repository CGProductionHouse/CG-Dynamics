import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { webcrypto } from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'

export function metaConsentFixture({ enabled = false, role = 'manager', active = true, insertError = false, gateValue, changedRole, profileError = false } = {}) {
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
  return {writes,envReads,handle: req => handler(req),async call(query='',method='POST',authenticated=true){
    const res=await handler(new Request('https://fixture.invalid/meta-oauth-start'+query,{method,headers:authenticated?{Authorization:'Bearer fixture-only'}:{}}))
    return {status:res.status,body:method==='OPTIONS'||res.status===204?null:await res.json()}
  }}
}

