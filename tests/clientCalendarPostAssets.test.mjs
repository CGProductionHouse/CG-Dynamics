import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { createServer } from 'vite'

test('calendar asset projection accepts only bounded published final metadata, never private fields',async()=>{
  const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true}})
  try{
    const {projectCalendarPostAssets}=await server.ssrLoadModule('/src/features/client-portal-library/projection.ts')
    const asset={id:'22222222-2222-4222-8222-222222222222',category:'graphic_design',displayName:'Final poster',mimeType:'application/pdf',sizeBytes:null,publishedAt:'2026-10-01T12:00:00Z',deliverableTitle:'Exact post',planMonth:'2026-10'}
    assert.deepEqual(projectCalendarPostAssets([{...asset,drive_id:'PRIVATE'}],'2026-10'),[asset])
    assert.deepEqual(projectCalendarPostAssets([],'2026-10'),[])
    for(const value of [null,{},[null],[{...asset,category:'brand_identity'}],[{...asset,planMonth:'2026-09'}],[{...asset,publishedAt:null}],[asset,asset],Array(25).fill(asset)])assert.equal(projectCalendarPostAssets(value,'2026-10'),null)
  }finally{await server.close()}
})

test('new post-assets RPC executes real ownership/publication/RLS checks in disposable local PostgreSQL', {skip:process.env.CG_RUN_LOCAL_DB!=='1'},()=>{
  const name=`cg-post-assets-${randomUUID()}`
  const docker=(args,input)=>spawnSync('docker',args,{input,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024})
  const created=docker(['run','--pull=never','--detach','--name',name,'--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine'])
  assert.equal(created.status,0,created.stderr)
  const id=created.stdout.trim();assert.match(id,/^[a-f0-9]{64}$/)
  try{
    let ready=false
    for(let attempt=0;attempt<60;attempt++){
      if(docker(['exec',id,'pg_isready','-U','postgres']).status===0){ready=true;break}
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250)
    }
    assert.ok(ready,'Disposable local database startup')
    const read=path=>readFileSync(new URL(path,import.meta.url),'utf8')
    const visibility=read('../supabase/migrations/20260809130000_client_portal_visibility_contract.sql')
    const start=visibility.indexOf('create function public.client_portal_month_ahead_posts_v2')
    const end=visibility.indexOf('-- Migration-first compatibility',start)
    const sql=read('./sql/668_post_assets_local_setup.sql')+visibility.slice(start,end)
      +read('../supabase/migrations/20260918113000_client_portal_library_foundation.sql')
      +read('../supabase/migrations/20261007100000_client_portal_post_assets.sql')
      +read('./sql/668_post_assets_local_acceptance.sql')
    const result=docker(['exec','-i',id,'psql','-U','postgres','-v','ON_ERROR_STOP=1'],sql)
    assert.equal(result.status,0,result.stdout+'\n'+result.stderr)
    assert.match(result.stdout,/POST ASSET ACCEPTANCE PASS/)
  }finally{
    const removed=docker(['rm','--force',id])
    assert.equal(removed.status,0,'Remove only this test-owned disposable container: '+removed.stderr)
  }
})
