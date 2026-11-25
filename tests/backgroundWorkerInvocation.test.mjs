import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHmac, webcrypto } from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'

const helperSource = readFileSync('supabase/functions/_shared/backgroundWorkerInvocation.ts', 'utf8')
const helperContext = { exports: {}, Request, Response, TextEncoder, Uint8Array, crypto: webcrypto }
vm.runInNewContext(ts.transpileModule(helperSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, helperContext)
const authorize = helperContext.exports.authorizeBackgroundWorkerInvocation
const key = 'a'.repeat(64)
const now = 1795586400000, seconds = now / 1000
const proof = (stamp = seconds, secret = key, domain = 'cg-background-worker:v1', method = 'POST') => ({
  'X-CG-Worker-Timestamp': String(stamp),
  'X-CG-Worker-Signature': createHmac('sha256', secret).update([domain,method,String(stamp)].join('\n')).digest('hex'),
})
const request = (headers = {}, method = 'POST') => new Request('https://fixture.invalid', { method, headers })

for (const [label, headers] of [
  ['anonymous', {}], ['public bearer', { Authorization: 'Bearer fixture-public-key' }],
  ['legacy raw key', { 'X-CG-Worker-Token': key }],
  ['wrong key', proof(seconds,'b'.repeat(64))], ['wrong purpose',proof(seconds,key,'another-worker:v1')],
  ['wrong method proof',proof(seconds,key,'cg-background-worker:v1','GET')],
  ['stale',proof(seconds-91)], ['future',proof(seconds+16)],
  ['fractional timestamp',proof(seconds+0.1)], ['leading zero timestamp',proof('0'+seconds)],
  ['exponential timestamp',proof('1e9')], ['timestamp tampering',{...proof(),'X-CG-Worker-Timestamp':String(seconds-1)}],
  ['missing timestamp',{'X-CG-Worker-Signature':'a'.repeat(64)}],
  ['short signature',{...proof(),'X-CG-Worker-Signature':proof()['X-CG-Worker-Signature'].slice(1)}],
  ['long signature',{...proof(),'X-CG-Worker-Signature':proof()['X-CG-Worker-Signature']+'a'}],
  ['non-hex signature',{...proof(),'X-CG-Worker-Signature':'z'.repeat(64)}],
  ['uppercase signature',{...proof(),'X-CG-Worker-Signature':proof()['X-CG-Worker-Signature'].toUpperCase()}],
  ['duplicate timestamp',{...proof(),'X-CG-Worker-Timestamp':seconds+', '+seconds}],
]) test(`worker capability refuses ${label}`, async () => {
  const result = await authorize(request(headers), () => key, now)
  assert.equal(result.status, 401); assert.equal(result.headers.get('cache-control'), 'no-store')
  assert.equal((await result.json()).error, 'WORKER_AUTH_REQUIRED')
})

test('worker capability requires its one private key with no anon/service-role fallback', async () => {
  const names = []
  assert.equal(await authorize(request(proof()), name => { names.push(name); return key }, now), null)
  assert.deepEqual(names, ['BACKGROUND_WORKER_INVOCATION_SECRET'])
  for (const missing of [undefined, '', 'old-placeholder', 'A'.repeat(64)])
    assert.equal((await authorize(request(proof()), () => missing, now)).status, 503)
  assert.equal((await authorize(request(), () => { throw Error('private fixture failure') }, now)).status, 503)
})

test('WebCrypto accepts Node proofs at freshness boundaries without revealing the key; proofs are not single-use', async () => {
  for (const offset of [-90,0,15]) {
    const headers=proof(seconds+offset)
    assert.doesNotMatch(JSON.stringify(headers),new RegExp(key))
    assert.equal(await authorize(request(headers),()=>key,now),null)
  }
  assert.equal((await authorize(request(proof()),()=>key,NaN)).status,401)
  assert.equal(await authorize(request(proof()),()=>key,now),null)
  assert.equal(await authorize(request(proof()),()=>key,now),null)
})

test('crypto failures refuse without disclosing exception details',async()=>{
  const context={...helperContext,exports:{},crypto:{subtle:{importKey(){throw Error('PRIVATE_CRYPTO_FAILURE')}}}}
  vm.runInNewContext(ts.transpileModule(helperSource,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context)
  const result=await context.exports.authorizeBackgroundWorkerInvocation(request(proof()),()=>key,now)
  assert.equal(result.status,503);assert.doesNotMatch(await result.text(),/PRIVATE_CRYPTO_FAILURE/)
})

test('worker accepts POST only, before reading configuration or body', async () => {
  for (const method of ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']) {
    const result = await authorize(request(proof(), method), () => { throw Error('Must not read configuration') }, now)
    assert.equal(result.status, 405); assert.equal(result.headers.get('allow'), 'POST')
    assert.equal((await result.json()).error, 'POST_REQUIRED')
  }
})

function actualEntry(secret = key) {
  const source = readFileSync('supabase/functions/background-worker/index.ts', 'utf8')
  const ast = ts.createSourceFile('worker.ts', source, ts.ScriptTarget.Latest, true)
  const statement = ast.statements.find(s => ts.isExpressionStatement(s) && s.expression.getText(ast).startsWith('Deno.serve('))
  assert.ok(statement, 'Actual worker must expose exactly its reviewed entry')
  let handler, clients = 0
  const context = { Request, Response, authorizeBackgroundWorkerInvocation: authorize,
    Deno: { serve(fn) { handler = fn }, env: { get(name) {
      return name === 'BACKGROUND_WORKER_INVOCATION_SECRET' ? secret : 'fixture-server-configuration'
    } } },
    createClient() { clients++; throw Error('FIXTURE_STOP_BEFORE_JOBS') },
  }
  vm.runInNewContext(ts.transpileModule(statement.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context)
  return { invoke: req => handler(req), clientCount: () => clients }
}

test('actual Edge entry refuses anonymous/wrong/missing configuration before any privileged client or housekeeping', async () => {
  const actualSeconds=Math.floor(Date.now()/1000)
  for (const [secret, headers, status] of [[key, {}, 401], [key, proof(actualSeconds,'b'.repeat(64)), 401], ['', {}, 503], [key,proof(actualSeconds-91),401]]) {
    const entry = actualEntry(secret), response = await entry.invoke(request(headers))
    assert.equal(response.status, status); assert.equal(entry.clientCount(), 0)
    assert.doesNotMatch(await response.text(), /fixture-server|private fixture|aaaaaaa|bbbbbbb/)
  }
})

test('actual Edge entry permits the exact caller through the guard without changing the queue handler', async () => {
  const entry = actualEntry()
  await assert.rejects(entry.invoke(request(proof(Math.floor(Date.now()/1000)))), /FIXTURE_STOP_BEFORE_JOBS/)
  assert.equal(entry.clientCount(), 1)
})
