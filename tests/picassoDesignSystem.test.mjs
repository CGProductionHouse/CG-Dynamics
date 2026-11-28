import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { runPreflight } from '../scripts/poster-studio/design-preflight.mjs'

let server, s, adapter
const id='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222'
const now='2026-11-25T12:00:00Z', sha='a'.repeat(64)
const ref=(provider='OneDrive')=>({provider,locator:'private-drive/item/version-1',observedAt:'2026-11-25T10:00:00Z',sha256:sha})
const makePack=()=>({schemaVersion:1,clientId:id,revision:'r1',status:'reviewed',reviewedBy:'Test CG reviewer',reviewedAt:'2026-11-25T10:00:00Z',reviewDue:'2027-01-01T00:00:00Z',source:ref(),scopes:[{
  key:'group',name:'Synthetic Group',canvaKitId:'testKit123',logos:[{variant:'primary',clearSpace:'One mark-height',validFor:'January 2027',source:ref()}],
  fonts:[{family:'Fixture Sans',weights:['700'],roles:'Headline',availability:'verified',licence:ref()}],colours:[{hex:'#123456',roles:'Small accents',source:ref('Canva')}],
  visualLanguage:Object.fromEntries(['typography','shapes','gradients','texture','depth','photoTreatment','motion','avoid'].map(k=>[k,`Evidenced ${k} direction`])),
  voice:'Specific and warm',claimsAndContacts:ref('CG Dynamics'),photography:ref(),approvedExamples:[ref('Canva')],feedback:[ref('CG Dynamics')],
}]})
const ctx=()=>({clientId:id,scopeKey:'group',packRevision:'r1',packSha256:sha,rulesSha256:sha,briefSha256:sha,artifactSha256:sha,captionSha256:sha,format:'still_poster',stage:'internal_review',hasAudio:false,isPrint:false})
const makeReview=c=>({systemVersion:s.PICASSO_VERSION,context:{...c},reviewer:'Test agent visual review',reviewedAt:'2026-11-25T11:00:00Z',checks:s.PICASSO_CHECKS.map(d=>({id:d.id,result:s.applicableCheck(d,c)?'pass':'na',reason:'Inspected fixture evidence for this exact revision.',evidence:[{kind:d.evidence,locator:'private-receipts/fixture',observation:'Specific observed test result; not real creative approval.',artifactSha256:c.artifactSha256}]}))})
before(async()=>{server=await createServer({logLevel:'error',optimizeDeps:{noDiscovery:true,entries:[]},server:{middlewareMode:true},appType:'custom'});s=await server.ssrLoadModule('/supabase/functions/_shared/picassoDesignSystem.ts');adapter=await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/picassoContext.ts')})
after(async()=>{await server?.close()})

test('complete exact-client pack is ready only for its explicit scope',()=>{
  const p=makePack();assert.deepEqual(s.validateDesignBrandPack(p,id),[])
  assert.equal(s.brandPackReadiness(p,id,'group',now).status,'ready')
  for(const [client,scope] of [[other,'group'],[id,'sibling'],[id,'']]) assert.equal(s.brandPackReadiness(p,client,scope,now).status,'hold')
})
test('draft, expired, future and conflicting/incomplete packs stay held',()=>{
  for(const mutate of [p=>p.status='draft',p=>p.reviewDue='2026-11-24',p=>p.reviewedAt='2026-12-01',p=>p.scopes[0].fonts[0].availability='unknown',p=>p.scopes[0].colours[0].roles='',p=>p.scopes[0].logos[0].source.sha256='',p=>p.scopes.push({...p.scopes[0]}),p=>p.scopes[0].visualLanguage.motion='']) {
    const p=makePack();mutate(p);assert.equal(s.brandPackReadiness(p,id,'group',now).status,'hold')
  }
})
test('partial and malformed data cannot become reviewed branding',()=>{
  for(const p of [null,{},[],123,{...makePack(),scopes:[null]},{...makePack(),source:{...ref(),locator:'https://files.invalid/photo?token=secret'}}]) assert.equal(s.brandPackReadiness(p,id,'group',now).status,'hold')
})
test('complete declarations support review without approving or sending',()=>{
  const c=ctx(),result=s.evaluateDesignReview(makeReview(c),c,now)
  assert.equal(result.status,'checklist_complete');assert.equal(result.creativeApprovalEstablished,false);assert.equal(result.sendAuthorised,false);assert.equal(result.publicationAuthorised,false)
})
test('every mandatory item independently blocks when failed, absent or claimed not applicable',()=>{
  const c=ctx()
  for(const definition of s.PICASSO_CHECKS.filter(d=>s.applicableCheck(d,c))) for(const state of ['fail','hold','na','missing']) {
    const r=makeReview(c);if(state==='missing')r.checks=r.checks.filter(x=>x.id!==definition.id);else r.checks.find(x=>x.id===definition.id).result=state
    assert.equal(s.evaluateDesignReview(r,c,now).status,'hold',`${definition.id} ${state}`)
  }
})
test('missing evidence, wrong kind and old image evidence do not pass',()=>{
  const c=ctx()
  for(const mutate of [r=>r.checks[0].evidence=[],r=>r.checks[0].evidence[0].kind='measurement',r=>r.checks.find(x=>x.id==='final_visual').evidence[0].artifactSha256='b'.repeat(64),r=>r.checks[0].reason='',r=>r.checks.push(r.checks[0])]) {
    const r=makeReview(c);mutate(r);assert.equal(s.evaluateDesignReview(r,c,now).status,'hold')
  }
})
test('changing any current binding invalidates the previous review',()=>{
  const c=ctx(),r=makeReview(c)
  for(const field of ['clientId','scopeKey','packRevision','packSha256','rulesSha256','briefSha256','artifactSha256','captionSha256','format','stage','hasAudio','isPrint']) {
    const changed={...c,[field]:typeof c[field]==='boolean'?!c[field]:field.endsWith('Sha256')?'b'.repeat(64):field==='format'?'animated_poster':field==='stage'?'approved_final':'different'}
    assert.equal(s.evaluateDesignReview(r,changed,now).status,'hold',field)
  }
})
test('animation and video require temporal checks without forcing JPEG or audio',()=>{
  for(const format of ['animated_poster','video']) {
    const c={...ctx(),format},r=makeReview(c)
    assert.equal(s.evaluateDesignReview(r,c,now).status,'checklist_complete')
    assert.equal(r.checks.find(x=>x.id==='audio').result,'na')
    r.checks.find(x=>x.id==='motion_readability').result='na'
    assert.equal(s.evaluateDesignReview(r,c,now).status,'hold')
  }
})
test('audio, print and final approval become mandatory only for their actual context',()=>{
  for(const [field,value,key] of [['hasAudio',true,'audio'],['isPrint',true,'print'],['stage','approved_final','human_approval']]) {
    const c={...ctx(),[field]:value},r=makeReview(c)
    assert.equal(s.evaluateDesignReview(r,c,now).status,'checklist_complete')
    r.checks.find(x=>x.id===key).result='na';assert.equal(s.evaluateDesignReview(r,c,now).status,'hold')
  }
})
test('fingerprints are key-order stable but bind content changes',async()=>{
  assert.equal(await s.designFingerprint({a:1,b:2}),await s.designFingerprint({b:2,a:1}))
  assert.notEqual(await s.designFingerprint({a:1}),await s.designFingerprint({a:2}))
})
function fakeDb(profile,rules=[],fail=false) {
  const calls=[]
  return {calls,from(table){const q={select(x){calls.push([table,'select',x]);return q},eq(k,v){calls.push([table,'eq',k,v]);return q},is(k,v){calls.push([table,'is',k,v]);return q},or(x){calls.push([table,'or',x]);return q},maybeSingle(){return q},then(resolve,reject){return Promise.resolve({data:table==='client_brand_profiles'?profile:rules,error:fail?{message:'private backend error'}:null}).then(resolve,reject)}};return q}}
}
test('read adapter scopes profile and rules exactly; never returns foreign rules',async()=>{
  const db=fakeDb({client_id:id,design_pack:makePack()},[{id:'own',client_id:id,retired_at:null},{id:'house',client_id:null,retired_at:null},{id:'foreign',client_id:other,retired_at:null},{id:'old',client_id:id,retired_at:now}])
  const result=await adapter.loadPicassoContext(db,id,'group',now)
  assert.equal(result.status,'ready');assert.deepEqual(result.rules.map(r=>r.id),['house','own'])
  assert.ok(db.calls.some(c=>c[0]==='client_brand_profiles'&&c[1]==='eq'&&c[2]==='client_id'&&c[3]===id))
  assert.ok(db.calls.some(c=>c[1]==='or'&&c[2]===`client_id.eq.${id},client_id.is.null`))
  assert.equal(result.normalChatGPTInvocationVerified,false)
})
test('missing deployment/schema, foreign profile or missing scope fails closed',async()=>{
  for(const [db,scope] of [[fakeDb(null),'group'],[fakeDb({client_id:other,design_pack:makePack()}),'group'],[fakeDb({client_id:id,design_pack:makePack()},[],true),'group'],[fakeDb({client_id:id,design_pack:makePack()}),'sibling']]) assert.equal((await adapter.loadPicassoContext(db,id,scope,now)).status,'hold')
  const db=fakeDb(null);assert.equal((await adapter.loadPicassoContext(db,'bad,client_id.is.null','group',now)).status,'hold');assert.deepEqual(db.calls,[])
  assert.equal((await adapter.loadPicassoContext(db,id,'group',now,{recordedUpdates:{status:'unavailable'}})).status,'hold')
})
test('fresh guide and recorded feedback changes invalidate the brief fingerprint',async()=>{
  const db=fakeDb({client_id:id,design_pack:makePack()})
  const first=await adapter.loadPicassoContext(db,id,'group',now,{guide:{version:1},recordedUpdates:{status:'available',view:{updates:[]}}})
  const next=await adapter.loadPicassoContext(db,id,'group',now,{guide:{version:1},recordedUpdates:{status:'available',view:{updates:[{body:'New current feedback'}]}}})
  assert.notEqual(first.briefSha256,next.briefSha256)
})
test('portable checklist stays identical to shared code',()=>{
  const portable=JSON.parse(readFileSync('docs/ai-workforce/graphic-designer/picasso-standard.v1.json','utf8'))
  assert.equal(portable.version,s.PICASSO_VERSION);assert.deepEqual(portable.checks,s.PICASSO_CHECKS)
})
test('prepared extension preserves existing RLS and exact client constraint',()=>{
  const sql=readFileSync('supabase/migrations/20261125073157_picasso_design_pack.sql','utf8')
  assert.match(sql,/alter table public.client_brand_profiles/);assert.match(sql,/client_id::text/)
  assert.doesNotMatch(sql,/create table|security definer|disable row level|grant |create policy/i)
})

test('real local preflight binds file bytes, writes a hold skeleton, rejects stale receipts and never overwrites',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'picasso-gate-fixture-'))
  try {
    const p=makePack(),time=new Date().toISOString()
    // Fixture review valid relative to real runtime, regardless of host date.
    p.reviewedAt=new Date(Date.now()-60_000).toISOString();p.reviewDue=new Date(Date.now()+86_400_000).toISOString()
    const packet={status:'ready',clientId:id,scopeKey:'group',observedAt:time,brandPack:p,rules:[],briefSha256:sha,packSha256:await s.designFingerprint(p),rulesSha256:await s.designFingerprint([])}
    const paths=Object.fromEntries(['packet','job','artifact','caption','review','hold','pass','changed','stale'].map(k=>[k,join(folder,k+'.json')]))
    await Promise.all([writeFile(paths.packet,JSON.stringify(packet)),writeFile(paths.job,JSON.stringify(ctx())),writeFile(paths.artifact,'SYNTHETIC export bytes, not a genuine client output'),writeFile(paths.caption,'Allocated unsigned fixture caption\n')])
    const base=['--packet',paths.packet,'--job',paths.job,'--artifact',paths.artifact,'--caption',paths.caption]
    const hold=await runPreflight([...base,'--init-review',paths.review,'--out',paths.hold])
    assert.equal(hold.status,'hold')
    const r=JSON.parse(await readFile(paths.review,'utf8'))
    assert.equal(r.context.artifactSha256,createHash('sha256').update(await readFile(paths.artifact)).digest('hex'))
    const reviewed=makeReview(r.context);reviewed.reviewedAt=new Date(Date.now()-1000).toISOString()
    await writeFile(paths.review,JSON.stringify(reviewed))
    const pass=await runPreflight([...base,'--review',paths.review,'--out',paths.pass])
    assert.equal(pass.status,'checklist_complete');assert.equal(pass.sendAuthorised,false)
    await assert.rejects(runPreflight([...base,'--review',paths.review,'--out',paths.pass]),/EEXIST/)
    await writeFile(paths.artifact,'Changed export bytes')
    assert.equal((await runPreflight([...base,'--review',paths.review,'--out',paths.changed])).status,'hold')
    packet.observedAt=new Date(Date.now()-25*60*60*1000).toISOString();await writeFile(paths.packet,JSON.stringify(packet))
    const stale=await runPreflight([...base,'--review',paths.review,'--out',paths.stale]);assert.ok(stale.problems.some(x=>x.includes('24 hours')))
  } finally { await rm(folder,{recursive:true,force:true}) }
})
