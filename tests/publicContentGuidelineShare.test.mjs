import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test, { before, after } from 'node:test'
import { createServer } from 'vite'
import ts from 'typescript'
import { shapeGuidelineShare, withGuidelineWriteReceipt } from '../supabase/functions/cg-dynamics-mcp/contentGuidelineActions.ts'

process.env.VITE_SUPABASE_URL ||= 'http://127.0.0.1:1'
process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||= 'local-public-fixture'
const run='30000000-0000-4000-8000-000000000001', client='20000000-0000-4000-8000-000000000001', guide='40000000-0000-4000-8000-000000000001'
const scope={runId:run,clientId:client}, token='a'.repeat(64)
const saved={state:'published_for_review',content_run_id:run,client_id:client,guideline_id:guide,client_name:'Germoparts',public_slug:'germoparts-content-guideline',share_token:token,published_at:'2026-11-09T10:00:00Z',video_count:4}
let server,api
before(async()=>{server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true}});api=await server.ssrLoadModule('/src/lib/publicContentGuidelines.ts')})
after(async()=>{await server?.close()})

test('connector returns a named no-login client URL and retains the separate staff link',()=>{
  const result=shapeGuidelineShare(saved,scope)
  assert.equal(result.client_share_url,`https://www.cgdynamics.co.za/guidelines/germoparts-content-guideline/${token}`)
  assert.equal(result.link_access,'anyone_with_link')
  assert.match(result.note,/not client approval/)
  assert.match(result.guideline_url,/\/admin\/content\?/)
  assert.equal(result.share_token,undefined)
  assert.equal(withGuidelineWriteReceipt(result,'publish_content_guideline','actor','key').receipt.tool_name,'publish_content_guideline')
})

test('sharing rejects foreign, malformed or guessed identities and never manufactures a client URL',()=>{
  for(const patch of [{client_id:guide},{content_run_id:client},{guideline_id:'invalid'},{public_slug:'../admin'},{share_token:'short'},{published_at:'invalid'},{video_count:0}]) {
    assert.ok(shapeGuidelineShare({...saved,...patch},scope).error)
  }
  for(const state of ['revoked','not_shared']) {
    const result=shapeGuidelineShare({...saved,state},scope)
    assert.equal(result.client_share_url,null)
    assert.equal(result.share_token,undefined)
  }
})

test('actual sharing handler enforces client scope first and injects the canonical staff actor',async()=>{
  const source=readFileSync('supabase/functions/cg-dynamics-mcp/index.ts','utf8')
  const body=source.slice(source.indexOf('async function manageGuidelineShare('),source.indexOf('// ── Tool Router'))
  const js=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  let calls=0, denied=false
  const handle=new Function('resolveContentRunScope','shapeGuidelineShare',`${js};return handlePublishContentGuideline`)(async()=>denied?{error:'Cross-client refused'}:scope,shapeGuidelineShare)
  const staff={profileId:'canonical-actor',supabase:{async rpc(name,args){calls++;assert.equal(name,'manage_content_guideline_share_as_actor');assert.deepEqual(args,{p_run_id:run,p_actor_profile_id:'canonical-actor',p_action:'publish'});return{data:saved,error:null}}}}
  assert.equal((await handle(staff,{content_run_id:run,actor_profile_id:'untrusted'})).link_access,'anyone_with_link')
  denied=true
  assert.equal((await handle(staff,{content_run_id:run})).error,'Cross-client refused')
  assert.equal(calls,1)
})

test('public projection preserves full scripts and excludes every extra staff/source field',()=>{
  const snapshot={client:{name:'Germoparts',email:'PRIVATE'},guide:{row_key:'shared',title:'Germoparts Content Guideline',month:'2026-11-01',run_name:'November',filming_date:'2026-11-10',published_at:'2026-11-09T10:00:00Z',internal_notes:'PRIVATE',videos:[{position:1,title:'Exact saved video',script:'Scene 1\nKeep every line.\nScene 2 — exact ending.',objective:null,hook:null,shot_breakdown:null,cta:null,visual_notes:null,platform:null,format:null,editor:'PRIVATE',drive_id:'PRIVATE'}]}}
  const projected=api.projectSharedGuideline(snapshot)
  assert.equal(projected.guide.videos[0].script,snapshot.guide.videos[0].script)
  assert.doesNotMatch(JSON.stringify(projected),/PRIVATE|drive_id|internal_notes|email/)
  for(const invalid of [null,{}, {...snapshot,guide:{...snapshot.guide,videos:[]}}, {...snapshot,guide:{...snapshot.guide,videos:[{...snapshot.guide.videos[0],script:null}]}}]) assert.equal(api.projectSharedGuideline(invalid),null)
})

test('public route requires no session, uses isolated anonymous reads and preserves desktop renderer',()=>{
  const app=readFileSync('src/App.tsx','utf8'),page=readFileSync('src/pages/PublicContentGuidelinePage.tsx','utf8')
  assert.ok(app.indexOf('path="/guidelines/:slug/:token"')<app.indexOf('element={<RequireStaff'))
  assert.doesNotMatch(page,/useAuth|navigate\(.\/login|profile\.client_id/)
  assert.match(page,/ContentGuidelineDocument/)
  assert.match(page,/resolvedKey !== requestKey/)
  const apiSource=readFileSync('src/lib/publicContentGuidelines.ts','utf8')
  assert.match(apiSource,/persistSession: false, autoRefreshToken: false, detectSessionInUrl: false/)
  const headers=JSON.parse(readFileSync('vercel.json','utf8')).headers[0].headers
  assert.ok(headers.some(h=>h.key==='X-Robots-Tag'&&h.value.includes('noindex')))
  assert.ok(headers.some(h=>h.key==='Referrer-Policy'&&h.value==='no-referrer'))
})

test('connector instructions permit guideline publication while retaining strategy and identity boundaries',()=>{
  const source=readFileSync('supabase/functions/cg-dynamics-mcp/toolCatalog.ts','utf8')
  const instructions=source.slice(source.indexOf('export const CG_DYNAMICS_MCP_SERVER_INSTRUCTIONS'))
  assert.match(instructions,/use publish_content_guideline and return its client_share_url/)
  assert.match(instructions,/requires NO login/)
  assert.match(instructions,/Publication for review is not client approval/)
  assert.match(instructions,/monthly strategy tools do not approve or publish strategies/)
  assert.doesNotMatch(instructions,/no tool here approves or publishes|the only writes are/)
  assert.match(instructions,/Never reuse another Project/)
})
