import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createGuidelinePreviewHandler, guidelinePreviewTarget } from '../server/guidelinePreview.js'
import { shapeGuidelineShare } from '../supabase/functions/cg-dynamics-mcp/contentGuidelineActions.ts'

const token='a'.repeat(64), slug='germoparts-content-guideline'
const url=`https://www.cgdynamics.co.za/guidelines/${slug}/${token}`
const snapshot={client:{name:'Germoparts',privateEmail:'PRIVATE CONTACT'},guide:{month:'2026-11-01',published_at:'2026-11-09T10:24:27.044Z',videos:[{script:'PRIVATE FULL SCRIPT'},{script:'SECOND SCRIPT'},{},{}],internal_notes:'PRIVATE NOTE'}}
const template='<html><head><title>CG Dynamics</title></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>'
const make=(fetchSnapshot=async()=>snapshot)=>createGuidelinePreviewHandler({loadTemplate:async()=>template,fetchSnapshot,logoForClient:name=>name==='Germoparts'?'/client-logos/germoparts.png':null})

test('reproduced generic SPA preview is replaced in initial HTML with the exact client, month, count and logo',async()=>{
  assert.equal(template.includes('og:title'),false)
  const response=await make()(new Request(url,{headers:{'user-agent':'WhatsApp/2.24'}})), html=await response.text()
  assert.equal(response.status,200)
  assert.match(html,/<title>Germoparts · Content Guideline<\/title>/)
  assert.match(html,/<meta property="og:title" content="Germoparts · Content Guideline"/)
  assert.match(html,/November 2026 · 4 videos. Ready for your review/)
  assert.match(html,/https:\/\/www.cgdynamics.co.za\/client-logos\/germoparts.png/)
  assert.match(html,/<div id="root"><\/div><script type="module" src="\/assets\/app.js"><\/script>/)
  assert.doesNotMatch(html,/PRIVATE|SECOND SCRIPT|internal_notes|privateEmail/)
})

test('server canonical and ChatGPT share URL agree and change on explicit republish',async()=>{
  const run='30000000-0000-4000-8000-000000000001',client='20000000-0000-4000-8000-000000000001'
  const shaped=shapeGuidelineShare({state:'published_for_review',content_run_id:run,client_id:client,guideline_id:'40000000-0000-4000-8000-000000000001',client_name:'Germoparts',public_slug:slug,share_token:token,published_at:snapshot.guide.published_at,video_count:4},{runId:run,clientId:client})
  const html=await(await make()(new Request(url+'?utm_source=chatgpt.com'))).text()
  assert.ok(html.includes(`property="og:url" content="${shaped.client_share_url}"`))
  const newer={...snapshot,guide:{...snapshot.guide,published_at:'2026-11-10T11:00:00Z'}}
  const next=await(await make(async()=>newer)(new Request(url))).text()
  assert.ok(!next.includes(shaped.client_share_url))
})

test('old and versioned links resolve the same exact capability without trusting query labels',async()=>{
  for(const link of [url,url+'?v=cg2-123&client=Other',`https://local/api/guideline-preview?slug=${slug}&token=${token}`]){
    let target
    const html=await(await make(async value=>{target=value;return snapshot})(new Request(link))).text()
    assert.deepEqual(target,{slug,token})
    assert.match(html,/Germoparts · Content Guideline/)
    assert.doesNotMatch(html,/Other · Content/)
  }
  assert.equal(guidelinePreviewTarget(`https://local/api/guideline-preview?slug=${slug}&slug=other&token=${token}`),null)
})

test('revoked/foreign links reveal no client identity and malformed paths never call the upstream',async()=>{
  const unavailable=await make(async()=>null)(new Request(url))
  assert.equal(unavailable.status,404)
  assert.doesNotMatch(await unavailable.text(),/Germoparts|og:title|client-logos/)
  let calls=0
  const bad=await make(async()=>{calls++;return snapshot})(new Request('https://local/guidelines/../../admin/short'))
  assert.equal(bad.status,404);assert.equal(calls,0)
})

test('HTML attributes are escaped and external/private image URLs are refused',async()=>{
  const hostile={...snapshot,client:{name:'ACME"><img src=x onerror=alert(1)>'}}
  const handler=createGuidelinePreviewHandler({loadTemplate:async()=>template,fetchSnapshot:async()=>hostile,logoForClient:()=> 'https://private.example/secret'})
  const html=await(await handler(new Request(url))).text()
  assert.match(html,/ACME&quot;&gt;&lt;img/)
  assert.doesNotMatch(html,/<img|private.example|onerror="/)
})

test('every request rechecks publication and never carries the last client into another response',async()=>{
  let current=snapshot
  const handler=make(async()=>current)
  assert.match(await(await handler(new Request(url))).text(),/Germoparts · Content Guideline/)
  current={...snapshot,client:{name:'Cape Lumber'}}
  const second=await(await handler(new Request(url.replace(slug,'cape-lumber-content-guideline')))).text()
  assert.match(second,/Cape Lumber · Content Guideline/);assert.doesNotMatch(second,/Germoparts|germoparts.png/)
  current=null
  assert.equal((await handler(new Request(url))).status,404)
})

test('HEAD, invalid methods and provider failure retain no-store/no-referrer and truthful status',async()=>{
  const head=await make()(new Request(url,{method:'HEAD'}));assert.equal(head.status,200);assert.equal(await head.text(),'')
  assert.equal(head.headers.get('cache-control'),'private, no-store');assert.equal(head.headers.get('referrer-policy'),'no-referrer')
  assert.match(head.headers.get('x-robots-tag'),/noindex/)
  assert.equal((await make()(new Request(url,{method:'POST'}))).status,405)
  const failed=await make(async()=>{throw new Error('PRIVATE TOKEN')})(new Request(url))
  assert.equal(failed.status,503);assert.equal(failed.headers.get('retry-after'),'30')
  assert.doesNotMatch(await failed.text(),/PRIVATE TOKEN|Germoparts/)
})

test('deployment keeps the public preview ahead of SPA fallback and includes the exact built shell',()=>{
  const config=JSON.parse(readFileSync('vercel.json','utf8'))
  assert.equal(config.git.deploymentEnabled,false)
  assert.equal(config.rewrites[0].source,'/guidelines/:slug/:token')
  assert.match(config.rewrites[0].destination,/\/api\/guideline-preview/)
  assert.match(config.functions['api/guideline-preview.js'].includeFiles,/dist\/index.html/)
  const api=readFileSync('api/guideline-preview.js','utf8')
  assert.match(api,/read_public_content_guideline_share/);assert.doesNotMatch(api,/SERVICE_ROLE|SUPABASE_SECRET|Authorization|req\.headers|request\.headers/)
})
