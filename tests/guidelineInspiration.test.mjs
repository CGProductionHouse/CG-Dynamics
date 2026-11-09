import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { createServer } from 'vite'
import { guidelineInspiration, inspirationInputError } from '../src/lib/guidelineInspiration.ts'
import { validateVideoPatch, validateNewVideo, shapeVideoForAssistant } from '../supabase/functions/cg-dynamics-mcp/contentGuidelineActions.ts'
let server, api
before(async () => { process.env.VITE_SUPABASE_URL ||= 'http://127.0.0.1:1'; process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||= 'local-public-fixture'; server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true}});api=await server.ssrLoadModule('/src/lib/clientContentGuides.ts') })
after(async () => { await server?.close() })
const links=[['https://www.tiktok.com/@example/video/123456','TikTok'],['https://vt.tiktok.com/ZSample/','TikTok'],['https://vm.tiktok.com/ZSample/','TikTok'],['https://www.instagram.com/reel/Example/','Instagram'],['https://www.facebook.com/share/r/Example/','Facebook'],['https://fb.watch/Example/','Facebook'],['https://www.youtube.com/watch?v=sample123','YouTube'],['https://youtu.be/sample123','YouTube'],['https://www.youtube.com/shorts/sample123','YouTube']]
test('all four social platforms and their normal short links are supported',()=>{for(const [url,platform] of links)assert.deepEqual(guidelineInspiration(url),{url,platform})})
test('unsafe protocols, credential/host tricks, private hosts, redirect paths and malformed URLs are refused',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,test','http://youtube.com/watch?v=x','https://youtube.com.evil.example/watch?v=x','https://youtube.com@evil.example/watch?v=x','https://user:pass@www.youtube.com/watch?v=x','https://127.0.0.1/video','https://www.youtube.com:8080/watch?v=x','https://www.youtube.com/redirect?q=https://evil.example','https://www.facebook.com/l.php?u=https://evil.example','https://www.instagram.com/accounts/login','https://www.youtube.com/','https://www.youtube.com\\@evil.example/watch','https://www.youtube.com/watch?value=spaces here','https://www.youtube.com/watch?'+ 'a'.repeat(2048)]) assert.equal(guidelineInspiration(url),null,url)
})
test('inspiration is optional, bounded, independently editable and clearable without touching scripts',()=>{
  assert.equal(inspirationInputError(null,null),null);assert.equal(inspirationInputError('', 'Our vision.'),null)
  assert.ok(inspirationInputError('', 'x'.repeat(1001)))
  const patch=validateVideoPatch({inspiration_url:links[0][0],inspiration_note:'Use the playful opening, adapted for this client.'})
  assert.deepEqual(patch,{ok:true,value:{inspiration_url:links[0][0],inspiration_note:'Use the playful opening, adapted for this client.'}})
  assert.equal(Object.hasOwn(patch.value,'script'),false)
  assert.deepEqual(validateVideoPatch({inspiration_url:'',inspiration_note:''}),{ok:true,value:{inspiration_url:null,inspiration_note:null}})
  assert.equal(validateNewVideo({title:'A reference-led idea',inspiration_url:links[1][0]}).ok,true)
  assert.equal(validateVideoPatch({inspiration_url:'https://evil.example/video'}).ok,false)
  assert.equal(validateVideoPatch({inspiration_url:'https://WWW.YOUTUBE.COM:443/shorts/example'}).value.inspiration_url,'https://www.youtube.com/shorts/example')
})
test('public projections retain inspiration and full script while legacy documents remain readable',()=>{
  const video={position:1,title:'A video',script:'KEEP exact script.\nScene 2.',objective:null,hook:null,shot_breakdown:null,cta:null,visual_notes:null,platform:null,format:null}
  const guide={row_key:'shared',title:'Guideline',month:'2026-11-01',run_name:'Run',filming_date:'2026-11-10',published_at:'2026-11-09T11:00:00Z',videos:[video]}
  const old=api.projectGuide(guide);assert.equal(old.videos[0].inspiration_url,null)
  const current=api.projectGuide({...guide,videos:[{...video,inspiration_url:links[2][0],inspiration_note:'Our own take on this visual rhythm.',internal_notes:'PRIVATE'}]})
  assert.equal(current.videos[0].script,video.script);assert.equal(current.videos[0].inspiration_url,links[2][0]);assert.equal(current.videos[0].inspiration_note,'Our own take on this visual rhythm.');assert.doesNotMatch(JSON.stringify(current),/PRIVATE/)
  assert.equal(api.projectGuide({...guide,videos:[{...video,inspiration_url:'javascript:alert(1)'}]}),null)
})
test('normal ChatGPT video read-back includes the optional reference and vision',()=>{
  const shaped=shapeVideoForAssistant({video:{title:'Video',inspiration_url:links[0][0],inspiration_note:'Make this our own.'},position:1,folderName:null,folderState:'UNVERIFIED',folderBlocked:null,raw:{},readiness:{readiness:'UNVERIFIED'},finalOutputState:'unverified'})
  assert.equal(shaped.inspiration_url,links[0][0]);assert.equal(shaped.inspiration_note,'Make this our own.')
})
