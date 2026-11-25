import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { join } from 'node:path'
import { publicationCodecVite } from './fixtures/publicationCodecVite.mjs'
import { actualOperationalDispatcher } from './helpers/mcpOperationalDispatcher.mjs'

let server, authorization, staff, store, management, runtime, catalog, context
const sourceRoot = process.env.CG_MCP_PUBLICATION_PACKET_ROOT ?? process.cwd()
before(async () => {
  server = await createServer({ root: sourceRoot, configFile: false, plugins: [publicationCodecVite], ssr: { external: ['jpeg-js'] }, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error' })
  ;[authorization, staff, store, management, runtime, catalog, context] = await Promise.all([
    '/supabase/functions/_shared/socialPublicationAuthorization.ts', '/supabase/functions/_shared/facebookPublicationStaff.ts',
    '/supabase/functions/_shared/socialPublicationAuthorizationStore.ts', '/supabase/functions/_shared/socialPublicationManagement.ts',
    '/supabase/functions/_shared/facebookPublicationRuntime.ts', '/supabase/functions/cg-dynamics-mcp/toolCatalog.ts',
    '/supabase/functions/cg-dynamics-mcp/projectContext.ts',
  ].map(path => server.ssrLoadModule(path)))
})
after(async () => server?.close())

async function fixture() {
  const ids = Object.fromEntries(['actor', 'client', 'review', 'deliverable', 'connection', 'job'].map(k => [k, randomUUID()]))
  const date = new Date(Date.now() + 3600000).toISOString(), assetHash = 'a'.repeat(64)
  const tables = { profiles: [{ id: ids.actor, role: 'manager', is_active: true }],
    content_review_versions: [{ id: ids.review, client_id: ids.client, deliverable_id: ids.deliverable, state: 'approved',
      asset_path: `${ids.deliverable}/approved.jpg`, media_type: 'image/jpeg', caption: 'Approved exact caption', channels: ['facebook'], scheduled_at: date }],
    monthly_deliverables: [{ id: ids.deliverable, client_id: ids.client, scheduled_date: new Date(Date.parse(date) + 7200000).toISOString().slice(0, 10), archived_at: null, posted_at: null }], background_jobs: [] }
  const errors = new Set(), calls = [], env = { SOCIAL_FACEBOOK_PHOTO_MCP_ENABLED: 'true', SOCIAL_FACEBOOK_PHOTO_CONFIRMATION_ENABLED: 'true',
    SOCIAL_PUBLISHING_ENABLED: 'true', SOCIAL_FACEBOOK_PHOTO_ENABLED: 'true', SOCIAL_FACEBOOK_PHOTO_RELEASE: JSON.stringify({clientId:ids.client,connectionId:ids.connection,accountId:'123'}),
    META_GRAPH_VERSION:'v27.0', META_APP_ID:'789', META_APP_SECRET:'PRIVATE_APP_SECRET', SUPABASE_URL:'https://fixture.supabase.co',
    META_TOKEN_ENCRYPTION_KEY_B64:Buffer.alloc(32,3).toString('base64'),META_TOKEN_ENCRYPTION_KEY_VERSION:'v1' }
  const binding = { clientId:ids.client,connectionId:ids.connection,accountId:'123',route:'facebook_page',active:true,
    grantedScopes:['pages_show_list','pages_manage_posts','pages_read_engagement'],tokenValidUntil:new Date(Date.now()+7200000).toISOString(),
    appAccessVerified:true,accountPublishingVerified:true,mediaContractVerified:true }
  const idempotency = new Map()
  let writes = 0, builds = 0, failAfterCommit = false, mutateDuringCandidate = () => {}, mutateAfterCommit = () => {}
  const sb = { from(table) {
    assert(Object.hasOwn(tables,table));const filters=[]
    const matches=()=>tables[table].filter(r=>filters.every(([key,value])=>key.split(/->>?/).reduce((o,k)=>o?.[k],r)===value))
    const q={select(){return q},eq(k,v){filters.push([k,v]);return q},order(){return q},async maybeSingle(){
      calls.push(['read',table]);const rows=matches();return {data:rows.length===1?rows[0]:null,error:errors.has(table)||rows.length>1?{message:'PRIVATE DATABASE ERROR'}:null}
    },async range(first,last){calls.push(['read',table]);return {data:matches().slice(first,last+1),error:errors.has(table)?{message:'PRIVATE DATABASE ERROR'}:null}}}
    return q
  },async rpc(name,args){
    calls.push(['rpc',name])
    if(name==='mcp_check_idempotency'){
      if(errors.has('idempotency'))return {data:null,error:{message:'PRIVATE LOOKUP ERROR'}}
      const previous=idempotency.get(args.p_idempotency_key)
      return {data:[{already_executed:!!previous,existing_result:previous?{status:previous.hash===args.p_input_hash?previous.status:'conflict'}:null}],error:null}
    }
    if(name==='mcp_record_idempotency_with_context'||name==='mcp_record_idempotency'){
      idempotency.set(args.p_idempotency_key,{hash:args.p_input_hash,status:args.p_result_status});return {data:null,error:null}
    }
    assert.equal(name,'authorize_social_publication')
    if(!tables.background_jobs.length){writes++;const intent=structuredClone(args.p_intent)
      tables.background_jobs.push({id:ids.job,job_type:'social_publish',status:'queued',payload:{intent,authorized_by:ids.actor},publication:{state:'queued',authorization:{
        id:intent.authorizationId,actorId:ids.actor,fingerprint:args.p_fingerprint,confirmedAt:new Date().toISOString(),revokedAt:null}}})}
    mutateAfterCommit()
    if(failAfterCommit)throw Error('PRIVATE RESPONSE LOST AFTER COMMIT')
    const row=tables.background_jobs[0]
    return {data:{jobId:row.id,authorizationId:row.publication.authorization.id,fingerprint:row.publication.authorization.fingerprint,status:row.status,state:row.publication.state},error:null}
  }}
  const source=ts.transpileModule(readFileSync(join(sourceRoot,'supabase/functions/cg-dynamics-mcp/facebookPublicationActions.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
  const exports={}
  vm.runInNewContext(source,{exports,Request,Response,URL,Date,crypto,require(name){
    if(name.endsWith('/facebookPublicationRuntime.ts'))return {...runtime,facebookPublicationRuntime(){builds++;return {
      targetForReview:async()=>({clientId:ids.client,deliverableId:ids.deliverable,reviewVersionId:ids.review,connectionId:ids.connection,accountId:'123',route:'facebook_page'}),
      readCandidate:async()=>{
        mutateDuringCandidate()
        const c={review:structuredClone(tables.content_review_versions[0]),deliverable:structuredClone(tables.monthly_deliverables[0]),binding,authorization:null,
          assetSha256:assetHash,teamsScheduleVerified:true,rolloutApproved:true}
        const i={clientId:ids.client,deliverableId:ids.deliverable,reviewVersionId:ids.review,platform:'facebook',route:'facebook_page',connectionId:ids.connection,accountId:'123',
          assetPath:c.review.asset_path,assetSha256:assetHash,mediaType:c.review.media_type,caption:c.review.caption,scheduledAt:c.review.scheduled_at}
        return {context:c,evidence:{intentFingerprint:await authorization.socialPublicationFingerprint(i),checkedAt:new Date().toISOString(),teamsRecordId:'fixture-task',teamsRevision:'fixture-revision',mediaProfile:'fixture-image'}}
      }} }}
    if(name.endsWith('/facebookPublicationStaff.ts'))return staff
    if(name.endsWith('/socialPublicationAuthorizationStore.ts'))return store
    if(name.endsWith('/socialPublicationManagement.ts'))return management
    throw Error('Unexpected MCP dependency')
  }})
  const input={client_id:ids.client,review_id:ids.review}
  const mcp = actualOperationalDispatcher({profileId:ids.actor,contextKind:'company_admin',effectiveClientId:null,connection:{userId:ids.actor,profileId:ids.actor,role:'admin'},supabase:sb},
    {prepare_facebook_photo_publication:(_staff,body)=>exports.facebookPublicationAction(sb,ids.actor,'preview',body,name=>env[name]),
      confirm_facebook_photo_publication:(_staff,body)=>exports.facebookPublicationAction(sb,ids.actor,'confirm',body,name=>env[name]),
      get_social_publication_status:(_staff,body)=>exports.facebookPublicationAction(sb,ids.actor,'status',body,name=>env[name])},new Set(['confirm_facebook_photo_publication']))
  return {ids,tables,errors,calls,env,binding,input,get writes(){return writes},get builds(){return builds},
    set failAfterCommit(v){failAfterCommit=v},set mutateDuringCandidate(v){mutateDuringCandidate=v},set mutateAfterCommit(v){mutateAfterCommit=v},
    call:(action,body=input)=>exports.facebookPublicationAction(sb,ids.actor,action,body,name=>env[name]),
    mcp:(tool,body=input)=>mcp({context:{context_kind:'company_admin'},...body},tool),
    confirmation:fingerprint=>({...input,expected_fingerprint:fingerprint,confirm_scheduling:true,idempotency_key:'same-explicit-request'})}
}

test('the three actual tools are company-admin only; confirmation declares a write and original-receipt replay',()=>{
  const names=['prepare_facebook_photo_publication','confirm_facebook_photo_publication','get_social_publication_status']
  for(const name of names){const tool=catalog.CG_DYNAMICS_MCP_TOOLS.find(t=>t.name===name);assert(tool)
    assert.equal(context.assertToolAllowedInContext(name,'company_admin').allowed,true)
    for(const kind of ['staff','client'])assert.equal(context.assertToolAllowedInContext(name,kind).allowed,false)
    assert.equal(tool.annotations.readOnlyHint,name!=='confirm_facebook_photo_publication')
    assert.equal(tool.inputSchema.additionalProperties,false)
  }
  const index=readFileSync('supabase/functions/cg-dynamics-mcp/index.ts','utf8')
  for(const set of ['WRITE_TOOLS','CANONICAL_RECEIPT_REPLAY_TOOLS'])assert.match(index,new RegExp(`const ${set} = new Set\\(\\[[\\s\\S]*?'confirm_facebook_photo_publication'`))
})
test('default-off MCP/staff/dispatch gates and exact-account release cannot be bypassed by scheduling input',async()=>{
  for(const gate of ['SOCIAL_FACEBOOK_PHOTO_MCP_ENABLED','SOCIAL_FACEBOOK_PHOTO_CONFIRMATION_ENABLED','SOCIAL_PUBLISHING_ENABLED','SOCIAL_FACEBOOK_PHOTO_ENABLED']){
    const f=await fixture();delete f.env[gate];assert.equal((await f.call('preview')).data_state,'unavailable');assert.equal(f.builds,0);assert.equal(f.writes,0)
  }
  const f=await fixture();f.env.SOCIAL_FACEBOOK_PHOTO_RELEASE=JSON.stringify({clientId:randomUUID(),connectionId:f.ids.connection,accountId:'123'})
  assert.equal((await f.call('preview')).error,'EXACT_ACCOUNT_RELEASE_REQUIRED');assert.equal(f.builds,0)
})
test('preview uses actual shared preflight, has no write port invocation and exposes only the exact review fields',async()=>{
  const f=await fixture(),r=await f.call('preview')
  assert.equal(r.data_state,'available',JSON.stringify(r));assert.equal(r.canConfirm,true);assert.equal(r.canPublish,false)
  assert.equal(r.preview.clientId,f.ids.client);assert.equal(r.preview.accountId,'123');assert.equal(r.preview.caption,'Approved exact caption')
  assert.match(r.preview.fingerprint,/^[a-f0-9]{64}$/);assert.equal(f.writes,0);assert.equal(f.calls.some(c=>c[0]==='rpc'),false)
  assert.doesNotMatch(JSON.stringify(r),/PRIVATE|assetPath|connectionId|signedUrl/)
})
test('explicit exact confirmation shares the original durable receipt; status does not claim native publication',async()=>{
  const f=await fixture(),p=await f.call('preview'),input=f.confirmation(p.preview.fingerprint)
  const a=await f.call('confirm',input),b=await f.call('confirm',input)
  assert.equal(a.data_state,'available',JSON.stringify(a));assert.deepEqual(b,a);assert.equal(f.writes,1)
  assert.equal(a.providerPublicationVerified,false);assert.equal(a.canPublish,false)
  delete f.env.SOCIAL_FACEBOOK_PHOTO_MCP_ENABLED
  const s=await f.call('status');assert.equal(s.data_state,'available');assert.equal(s.nativeSchedulesChecked,false)
  assert.equal(s.status.items[0].state,'queued');assert.equal(s.status.items[0].confirmationFingerprint,p.preview.fingerprint)
})
test('foreign review/client and caller account/content/schedule/approval overrides refuse before runtime or writes',async()=>{
  for(const change of [{client_id:randomUUID()},{review_id:randomUUID()},{accountId:'foreign'},{caption:'override'},{scheduled_at:'2099-01-01'},{approved:true},{context:{context_kind:'company_admin'}}]){
    const f=await fixture(),r=await f.call('preview',{...f.input,...change})
    assert.equal(r.data_state,'unavailable');assert.equal(f.builds,0);assert.equal(f.writes,0)
  }
})
test('client/staff/inactive and unreadable actor profiles cannot prepare or read publication receipts',async()=>{
  for(const change of [{role:'client'},{role:'staff'},{is_active:false}])for(const action of ['preview','status']){
    const f=await fixture();Object.assign(f.tables.profiles[0],change);assert.equal((await f.call(action)).error,'ACTIVE_MANAGER_REQUIRED')
    assert.deepEqual(f.calls,[['read','profiles']]);assert.equal(f.builds,0)
  }
  const f=await fixture();f.errors.add('profiles');assert.equal((await f.call('preview')).error,'ACTIVE_MANAGER_REQUIRED')
})
test('unapproved content, unapproved channel, expired token and missing publishing permission remain blocked',async()=>{
  for(const mutate of [f=>f.tables.content_review_versions[0].state='draft',f=>f.tables.content_review_versions[0].channels=['instagram'],
    f=>f.binding.tokenValidUntil=new Date(Date.now()-1).toISOString(),f=>f.binding.grantedScopes=[]]){
    const f=await fixture();mutate(f);assert.equal((await f.call('preview')).data_state,'unavailable');assert.equal(f.writes,0)
  }
})
test('changed approved caption invalidates the old exact confirmation fingerprint',async()=>{
  const f=await fixture(),p=await f.call('preview');f.tables.content_review_versions[0].caption='A new approved revision'
  assert.equal((await f.call('confirm',f.confirmation(p.preview.fingerprint))).error,'PUBLICATION_PREVIEW_CHANGED');assert.equal(f.writes,0)
})
test('confirmation requires explicit scheduling, exact fingerprint and a stable nonempty MCP key',async()=>{
  const f=await fixture(),p=await f.call('preview'),input=f.confirmation(p.preview.fingerprint)
  for(const change of [{confirm_scheduling:false},{expected_fingerprint:'bad'},{idempotency_key:''},{idempotency_key:'x'.repeat(241)},{accountId:'foreign'}])
    assert.equal((await f.call('confirm',{...input,...change})).error,'PUBLICATION_INPUT_INVALID')
  assert.equal(f.writes,0)
})
test('a lost committed response is uncertain and recoverable through original status without another write',async()=>{
  const f=await fixture(),p=await f.call('preview');f.failAfterCommit=true
  const r=await f.call('confirm',f.confirmation(p.preview.fingerprint))
  assert.equal(r.mayHaveCommitted,true);assert.equal(r.outcome,'unverified');assert.equal(f.writes,1)
  const s=await f.call('status');assert.equal(s.status.items[0].jobId,f.ids.job);assert.equal(f.writes,1)
  assert.doesNotMatch(JSON.stringify(r),/PRIVATE/)
})
test('role revoked during preparation or after commit cannot expose a fresh receipt or silently repeat work',async()=>{
  const f=await fixture();f.mutateDuringCandidate=()=>{f.tables.profiles[0].is_active=false}
  assert.equal((await f.call('preview')).error,'PUBLICATION_RECEIPT_UNVERIFIED');assert.equal(f.writes,0)
  const g=await fixture(),p=await g.call('preview');g.mutateAfterCommit=()=>{g.tables.profiles[0].is_active=false}
  const r=await g.call('confirm',g.confirmation(p.preview.fingerprint));assert.equal(r.mayHaveCommitted,true);assert.equal(g.writes,1)
})
test('job reads with partial/failed evidence are unavailable, never a verified empty queue',async()=>{
  const f=await fixture();f.errors.add('background_jobs');assert.equal((await f.call('status')).data_state,'unavailable')
})
test('actual MCP dispatcher canonicalizes keys, preserves the original queue receipt and refuses conflicting reuse',async()=>{
  const f=await fixture(),parse=r=>JSON.parse(r.result.content[0].text)
  const p=parse(await f.mcp('prepare_facebook_photo_publication'))
  const body=f.confirmation(p.preview.fingerprint),a=parse(await f.mcp('confirm_facebook_photo_publication',body))
  const b=parse(await f.mcp('confirm_facebook_photo_publication',body))
  assert.equal(a.publication.jobId,b.publication.jobId);assert.equal(f.writes,1)
  const conflict=await f.mcp('confirm_facebook_photo_publication',{...body,expected_fingerprint:'b'.repeat(64)})
  assert.equal(conflict.result.isError,true);assert.equal(f.writes,1)
  // A cached generic success cannot bypass current source/role validation.
  f.tables.profiles[0].is_active=false
  assert.equal((await f.mcp('confirm_facebook_photo_publication',body)).result.isError,true)
  assert.equal(f.writes,1)
})
test('actual MCP dispatcher denies staff/client contexts, missing keys and unavailable retry receipts before a write',async()=>{
  for(const context of [{context_kind:'staff',staff_profile_id:randomUUID()},{context_kind:'client',client_id:randomUUID()}]){
    const f=await fixture();assert((await f.mcp('prepare_facebook_photo_publication',{...f.input,context})).error);assert.equal(f.builds,0)
  }
  const f=await fixture(),p=await f.call('preview'),body=f.confirmation(p.preview.fingerprint)
  const missing={...body};delete missing.idempotency_key
  assert((await f.mcp('confirm_facebook_photo_publication',missing)).error)
  f.errors.add('idempotency');assert((await f.mcp('confirm_facebook_photo_publication',body)).error)
  assert.equal(f.writes,0)
})
