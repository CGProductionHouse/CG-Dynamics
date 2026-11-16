import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve,extname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {randomBytes} from 'node:crypto'
import {build} from 'vite'
import react from '@vitejs/plugin-react'
import {createClient} from '@supabase/supabase-js'
import {startNolanIsolatedAcceptance} from './helpers/nolanIsolatedAcceptance.mjs'

export async function startAcceptance({decisions=false,signal}={}){
 signal?.throwIfAborted()
 const directory=await mkdtemp(join(tmpdir(),'nolan-same-origin-')),dist=join(directory,'app')
 let runtime,origin,ready=false,restAvailable=true,tasksAvailable=true
 const fixtureControl=randomBytes(32).toString('hex')
 const server=createServer(async(req,res)=>{
  try{
   if(!ready){res.writeHead(503);res.end('Isolated acceptance starting');return}
   if(req.headers.host!==new URL(origin).host||(req.headers.origin&&req.headers.origin!==origin)){res.writeHead(403);res.end('Same-origin only');return}
   res.setHeader('Cache-Control','no-store')
   res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; base-uri 'self'; form-action 'self'; frame-src 'none'")
   const url=new URL(req.url,origin)
   if(url.pathname==='/__nolan_acceptance/scenario'){
    if(req.method!=='POST'||req.headers['x-nolan-fixture-control']!==fixtureControl){res.writeHead(403);res.end();return}
    let body='';for await(const chunk of req){body+=chunk;if(body.length>256){res.writeHead(413);res.end();return}}
    const action=JSON.parse(body).action
    if(action==='fail-rest')restAvailable=false
    else if(action==='restore-rest')restAvailable=true
    else if(action==='fail-tasks')tasksAvailable=false
    else if(action==='restore-tasks')tasksAvailable=true
    else runtime.scenario(action)
    res.writeHead(204);res.end();return
   }
   const port=url.pathname.startsWith('/auth/v1/')?9999:url.pathname.startsWith('/rest/v1/')?3000:null
   if(port){
    if(port===3000&&(!restAvailable||(!tasksAvailable&&url.pathname==='/rest/v1/command_centre_tasks'))){res.writeHead(503);res.end('Deliberate isolated REST interruption');return}
    if(!['GET','POST','PATCH','DELETE'].includes(req.method)){res.writeHead(405);res.end();return}
    const chunks=[];let bytes=0
    for await(const chunk of req){bytes+=chunk.length;if(bytes>1024*1024){res.writeHead(413);res.end();return}chunks.push(chunk)}
    const headers={}
    for(const key of ['authorization','apikey','content-type','accept','prefer','range','range-unit','accept-profile','content-profile'])if(req.headers[key])headers[key]=req.headers[key]
    const path=url.pathname.replace(port===9999?'/auth/v1':'/rest/v1','')+url.search
    const reply=await runtime.exchange(port,path,{method:req.method,headers,body:bytes?Buffer.concat(chunks):undefined})
    for(const key of ['content-type','content-range','range-unit','preference-applied','www-authenticate'])if(reply.headers[key])res.setHeader(key,reply.headers[key])
    res.writeHead(reply.status);res.end(reply.body);return
   }
   if(url.pathname==='/__nolan_acceptance/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({isolated:true,decisions,backend:'GoTrue/PostgREST/PostgreSQL',production:false}));return}
   if(url.pathname.startsWith('/functions/')||url.pathname.startsWith('/storage/')||url.pathname.startsWith('/realtime/')){res.writeHead(501);res.end('Service outside isolated acceptance scope');return}
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return}
   const requested=resolve(dist,'.'+decodeURIComponent(url.pathname))
   if(requested!==dist&&!requested.startsWith(dist+'/')){res.writeHead(403);res.end();return}
   const info=await stat(requested).catch(()=>null)
   if(!info?.isFile()&&extname(requested)){res.writeHead(404);res.end();return}
   const file=info?.isFile()?requested:join(dist,'index.html')
   const data=await readFile(file)
   res.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.html':'text/html','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.json':'application/json','.webmanifest':'application/manifest+json','.woff2':'font/woff2'}[extname(file)]??'application/octet-stream'))
   res.end(req.method==='HEAD'?undefined:data)
  }catch{res.writeHead(502);res.end('Isolated source unavailable')}
 })
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes)})
 origin=`http://127.0.0.1:${server.address().port}`
 const stop=async()=>{ready=false;server.closeAllConnections();await new Promise(r=>server.close(r));runtime?.stop();await rm(directory,{recursive:true,force:true})}
 try{
  runtime=await startNolanIsolatedAcceptance(origin,join(directory,'canonical-replay.json'),{signal})
  let gateTransforms=0
  const isolatedGate={name:'explicit-isolated-nolan-gate',enforce:'pre',transform(code,id){if(decisions&&id.replaceAll('\\','/').endsWith('/src/lib/nolanDecisionApi.ts')){assert(code.includes('NOLAN_DECISIONS_ACCEPTED = false'));gateTransforms++;return code.replace('NOLAN_DECISIONS_ACCEPTED = false','NOLAN_DECISIONS_ACCEPTED = true')}}}
  await build({configFile:false,envDir:false,plugins:[isolatedGate,react()],logLevel:'error',define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(origin),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':'"isolated-synthetic-publishable-key"'},build:{outDir:dist,emptyOutDir:true}})
  signal?.throwIfAborted()
  assert.equal(gateTransforms,decisions?1:0)
  assert.match(await readFile('src/lib/nolanDecisionApi.ts','utf8'),/NOLAN_DECISIONS_ACCEPTED = false/)
  assert.equal(JSON.parse(await readFile('vercel.json','utf8')).git.deploymentEnabled,false)
  const manifest={origin,decisions,accounts:runtime.accounts,taskId:runtime.taskId,plannerTaskId:runtime.plannerTaskId,sources:runtime.sources,fixtureControl,scope:'Synthetic isolated accounts only. No signed-in browser acceptance yet.'}
  const manifestPath=join(directory,'private-browser-manifest.json')
  await writeFile(manifestPath,JSON.stringify(manifest,null,2),{mode:0o600})
  assert.equal((await stat(manifestPath)).mode&0o777,0o600)
  ready=true
  return {origin,manifest,manifestPath,reportPath:join(directory,'canonical-replay.json'),stop}
 }catch(error){await stop();throw error}
}

export async function smokeAcceptance(app){
 const post=(path,body,token)=>fetch(app.origin+path,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)})
 const html=await fetch(app.origin+'/admin/work?tab=nolan');assert.equal(html.status,200)
 const document=await html.text(),entry=document.match(/src="([^"]+\.js)"/)?.[1];assert(entry)
 const bundle=await fetch(app.origin+entry);assert.equal(bundle.status,200);assert.match(bundle.headers.get('content-type'),/javascript/);assert((await bundle.text()).length>1000)
 assert.equal((await fetch(app.origin+'/missing.js')).status,404)
 const health=await fetch(app.origin+'/__nolan_acceptance/health');assert.equal((await health.json()).production,false)
 assert.equal((await fetch(app.origin+'/auth/v1/health',{headers:{origin:'https://example.invalid'}})).status,403)
 assert.equal((await fetch(app.origin+'/functions/v1/not-configured')).status,501)
 const tokens={}
 for(const role of ['admin','manager','staff','client']){
  const account=app.manifest.accounts[role]
  const login=await post('/auth/v1/token?grant_type=password',{email:account.email,password:account.password})
  assert.equal(login.status,200,'Genuine loopback password sign-in must succeed')
  tokens[role]=(await login.json()).access_token;assert(tokens[role])
  const profile=await fetch(app.origin+'/rest/v1/profiles?id=eq.'+account.id+'&select=id,role',{headers:{authorization:'Bearer '+tokens[role]}})
  assert.equal(profile.status,200);assert.equal((await profile.json())[0].role,role)
 }
 const sdk=createClient(app.origin,'isolated-synthetic-publishable-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
 const sdkLogin=await sdk.auth.signInWithPassword({email:app.manifest.accounts.admin.email,password:app.manifest.accounts.admin.password})
 assert.equal(sdkLogin.error,null,'Actual application SDK password grant must succeed')
 const sdkProfile=await sdk.from('profiles').select('id,role').eq('id',app.manifest.accounts.admin.id).single()
 assert.equal(sdkProfile.error,null,'Actual SDK object response must survive the relay');assert.equal(sdkProfile.data.role,'admin')
 assert.equal((await sdk.auth.signOut()).error,null)
 const preview=await post('/rest/v1/rpc/preview_nolan_decision_task',{p_task_id:app.manifest.taskId},tokens.admin)
 assert.equal(preview.status,200)
 const result=await preview.json();assert(result.revision)
 assert.equal((await post('/rest/v1/rpc/preview_nolan_decision_task',{p_task_id:app.manifest.taskId},tokens.manager)).status,403)
 const denied=await post('/auth/v1/token?grant_type=password',{email:app.manifest.accounts.admin.email,password:'wrong'})
 assert.equal(denied.status,400);assert((await denied.json()).error_code,'Real Auth error body preserved')
 const activity=await fetch(app.origin+'/rest/v1/planner_activity_log?entity_type=eq.planner_task&entity_id=eq.'+app.manifest.plannerTaskId,{headers:{authorization:'Bearer '+tokens.admin}})
 assert.equal(activity.status,200);assert((await activity.json()).length>0)
 return {checks:['actual app HTML and JS','same-origin boundary','four password grants and profile roles','actual Supabase SDK sign-in/profile/sign-out','admin-only decision preview','real Auth error body','exact-task activity'],accounts:4,browser:false,origin:app.origin}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(!process.argv.includes('--serve')&&!process.argv.includes('--smoke'))throw new Error('Choose --serve or --smoke; never starts a browser')
 const controller=new AbortController()
 let app
 const stop=()=>{controller.abort();if(app)void app.stop()}
 process.once('SIGINT',stop);process.once('SIGTERM',stop)
 try{
  app=await startAcceptance({decisions:process.argv.includes('--enable-decisions-for-isolated-acceptance'),signal:controller.signal})
  if(process.argv.includes('--smoke')){try{console.log(JSON.stringify(await smokeAcceptance(app)))}finally{await app.stop()}}
  else console.log(JSON.stringify({origin:app.origin,privateManifest:app.manifestPath,replayReport:app.reportPath,decisions:app.manifest.decisions,instruction:'Same-host approved sandboxed browser only; Ctrl-C cleans up.'}))
 }catch(error){if(!controller.signal.aborted)throw error}
}
