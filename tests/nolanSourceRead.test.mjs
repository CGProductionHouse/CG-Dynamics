import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
let server, capture
before(async () => {
  server = await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'})
  ;({captureNolanSource:capture} = await server.ssrLoadModule('/src/lib/nolanSourceRead.ts'))
})
after(async()=>{await server?.close()})
test('a thrown reader does not discard successful independent source results', async()=>{
  const [good,bad] = await Promise.all([
    capture(async()=>({data:[{id:'fixture'}],error:null}),()=> 'good-time'),
    capture(async()=>{throw new Error('source unavailable')},()=> 'bad-time'),
  ])
  assert.deepEqual(good,{result:{data:[{id:'fixture'}],error:null},error:null,checkedAt:'good-time'})
  assert.deepEqual(bad,{result:null,error:'source unavailable',checkedAt:'bad-time'})
})
test('source receipt is captured only after that reader settles', async()=>{
  let resolve, clocks=0
  const waiting = capture(()=>new Promise(r=>{resolve=r}),()=>{clocks++;return 'finished'})
  assert.equal(clocks,0)
  resolve({data:[]})
  assert.equal((await waiting).checkedAt,'finished')
  assert.equal(clocks,1)
})
test('native error results remain intact, not converted into a successful data read', async()=>{
  const result = {data:[{id:'partial'}],error:{message:'late page failed'}}
  assert.equal((await capture(async()=>result)).result,result)
})
test('non-error failures expose a stable gap and never leak arbitrary thrown objects', async()=>{
  const result = await capture(async()=>{throw {secret:'do not render'}})
  assert.equal(result.error,'Source read failed.')
  assert.equal(result.result,null)
})
test('overview distinguishes source receipts and failures from upstream refresh',()=>{
  const page=readFileSync('src/pages/admin/NolanOverview.tsx','utf8')
  assert.ok(page.includes('Individual source read receipts'))
  assert.ok(page.includes('Unavailable; no successful read claimed'))
  assert.ok(page.includes('not upstream provider refresh times'))
  assert.ok(page.includes('unavailable: !!videos.error || !!videos.migrationNeeded'))
  assert.ok(page.includes('tasks.error ? []'))
})

test('empty and whitespace Error messages still mark a thrown source unavailable', async()=>{
  for (const message of ['', '   ']) {
    const result=await capture(async()=>{throw new Error(message)})
    assert.equal(result.result,null)
    assert.equal(result.error,'Source read failed.')
  }
})
