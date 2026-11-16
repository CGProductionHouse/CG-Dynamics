import assert from 'node:assert/strict'
import test from 'node:test'
import {readFile} from 'node:fs/promises'
import {spawnSync} from 'node:child_process'
import {startAcceptance,smokeAcceptance} from '../scripts/nolan-same-origin-acceptance.mjs'

test('same-origin acceptance runner preserves production guards and never substitutes auth or a browser sandbox bypass',async()=>{
 const source=await readFile('scripts/nolan-same-origin-acceptance.mjs','utf8')
 const browser=await readFile('scripts/nolan-same-origin-browser.py','utf8')
 assert.match(source,/envDir:false/);assert.match(source,/server.listen\(0,'127.0.0.1'/)
 assert.match(browser,/chromium_sandbox=True/)
 assert.doesNotMatch(browser,/add_init_script|storage_state\s*=|connect_over_cdp|args\s*=|setSession\(/)
 assert.match(await readFile('src/lib/nolanDecisionApi.ts','utf8'),/NOLAN_DECISIONS_ACCEPTED = false/)
 assert.equal(JSON.parse(await readFile('vercel.json','utf8')).git.deploymentEnabled,false)
 const parsed=spawnSync('python3',['-c',`
import ast
tree = ast.parse(open('scripts/nolan-same-origin-browser.py').read())
parents = {child: parent for parent in ast.walk(tree) for child in ast.iter_child_nodes(parent)}
for action in ['revoke-manager', 'restore-manager']:
    calls = [n for n in ast.walk(tree) if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)
             and n.func.id == 'scenario' and n.args and isinstance(n.args[0], ast.Constant)
             and n.args[0].value == action]
    assert len(calls) == 1, action
    parent = parents.get(calls[0])
    while parent:
        assert not (isinstance(parent, ast.If) and "manifest['decisions']" in ast.unparse(parent.test)), action + ' must cover read-only mode'
        parent = parents.get(parent)
`],{encoding:'utf8'})
 assert.equal(parsed.status,0,parsed.stderr)
})

test('actual app and real isolated services support same-origin password/JWT acceptance', {skip:process.env.RUN_NOLAN_SAME_ORIGIN_TESTS!=='1',timeout:240000},async()=>{
 const app=await startAcceptance({decisions:true})
 try{
  const receipt=await smokeAcceptance(app)
  assert.equal(receipt.accounts,4);assert.equal(receipt.browser,false)
  const manifest=JSON.parse(await readFile(app.manifestPath,'utf8'))
  assert.equal(manifest.origin,app.origin);assert.equal(manifest.decisions,true)
  const report=JSON.parse(await readFile(app.reportPath,'utf8'))
  assert(report)
 }finally{await app.stop()}
})

test('cancelled acceptance setup stops before any service or listener starts',async()=>{
 const controller=new AbortController();controller.abort()
 await assert.rejects(startAcceptance({signal:controller.signal}),{name:'AbortError'})
})
