import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import vm from 'node:vm'
import {buildPreview,options} from '../scripts/build-nolan-review-preview.mjs'
const temp=await mkdtemp(join(tmpdir(),'nolan-review-contract-'))
const compiled=await build({entryPoints:['tests/fixtures/nolan-review/adapters.tsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',packages:'external'})
const modulePath=resolve('node_modules/.cache/nolan-review-adapter-test.mjs')
await import('node:fs/promises').then(fs=>fs.mkdir(resolve(modulePath,'..'),{recursive:true}))
await writeFile(modulePath,compiled.outputFiles[0].text)
const a=await import(modulePath)
test.after(async()=>{await rm(temp,{recursive:true,force:true});await rm(modulePath,{force:true})})
test('single HTML bundles actual Nolan components and CSS with no production backend or external resources',async()=>{
 const {html,receipt}=await buildPreview(join(temp,'review.html'))
 assert.match(html,/Interactive review preview/)
 assert.match(html,/connect-src 'none'/)
 assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+href=|<iframe|<img[^>]+src="https?:/i)
 assert(!receipt.inputs.some(p=>/supabase|cgWebsiteFleet\.ts|AuthContext\.tsx/.test(p)))
 assert(receipt.inputs.includes('src/pages/admin/nolanOverview.css'))
 new vm.Script(html.match(/<script>([\s\S]*)<\/script>/)[1])
 assert.match(await readFile('src/lib/nolanDecisionApi.ts','utf8'),/NOLAN_DECISIONS_ACCEPTED\s*=\s*false/)
 assert.equal(JSON.parse(await readFile('vercel.json','utf8')).git.deploymentEnabled,false)
})
test('sample readers expose populated, unavailable and empty contracts',async()=>{
 a.setMode('healthy');assert.equal((await a.listTasks()).data.length,4)
 assert.equal((await a.loadNolanPackageEvidence()).data[0].conflicts.length,1)
 a.setMode('unavailable');await assert.rejects(a.listTasks(),/Simulated source outage/)
 a.setMode('empty');assert.deepEqual((await a.listTasks()).data,[])
 a.setMode('healthy')
})
test('sample decision adapter supports uncertainty retry, account switch and stale revision boundaries',async()=>{
 a.setActor(a.ADMIN);const before=await a.listMyNativeDecisions()
 a.setLostReceipt(true)
 const p={taskId:a.TASK,revision:(await a.previewDecisionTask(a.TASK)).revision,recipientId:a.REVIEWER,question:'Sample review question',key:'one-idempotency-key'}
 await assert.rejects(a.createNativeDecision(p),/lost response/)
 const id=await a.createNativeDecision(p)
 assert.equal(await a.createNativeDecision(p),id)
 assert.equal((await a.listMyNativeDecisions()).length,before.length+1)
 a.setActor(a.REVIEWER)
 assert((await a.listMyNativeDecisions()).some(r=>r.id===id))
 await a.closeNativeDecision(id,1,'resolve','Sample answer')
 assert(!(await a.listMyNativeDecisions()).some(r=>r.id===id))
 a.setActor(a.ADMIN);a.changeRevision()
 await assert.rejects(a.closeNativeDecision('sample-current',1,'resolve','Sample answer'),/blocked/)
 await assert.rejects(a.createNativeDecision({...p,key:'new-key'}),/revision changed/)
})

test('actual components execute server rendering with sample evidence and all navigation lanes',async()=>{
 const entry=`import React from 'react';import {renderToString} from 'react-dom/server';import {MemoryRouter} from 'react-router-dom';import NolanOverview from './src/pages/admin/NolanOverview';import {NolanPackageRecordEvidence} from './src/pages/admin/NolanPackageRecordEvidence';import {NolanTaskOwnership} from './src/pages/admin/NolanTaskOwnership';import {loadNolanPackageEvidence,sampleTasks,ADMIN,REVIEWER,setActor,setMode} from './tests/fixtures/nolan-review/adapters';setActor(ADMIN);setMode('healthy');export async function render(){const packageRow=(await loadNolanPackageEvidence()).data[0];return ['master','work','decisions','needs','ownership','special','done','videos','packages','systems','editor','apps'].map(lane=>renderToString(<MemoryRouter initialEntries={['/admin/work?nolan_view='+lane]}><NolanOverview/></MemoryRouter>)).join('')+renderToString(<><NolanPackageRecordEvidence client={packageRow}/><NolanTaskOwnership task={sampleTasks[0]} directory={new Map([[ADMIN,'Sample Administrator'],[REVIEWER,'Sample Reviewer']])}/></>)}`
 const result=await build({...options,entryPoints:undefined,stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'}})
 const path=resolve('node_modules/.cache/nolan-review-render-test.mjs')
 await writeFile(path,result.outputFiles.find(f=>f.path.endsWith('.js')).text)
 try {const rendered=await (await import(path)).render();assert.match(rendered,/Here’s the situation/);assert.match(rendered,/Ask for an explicit decision/);assert.match(rendered,/Fictional allowance/);assert.match(rendered,/Sample Administrator/)}finally{await rm(path,{force:true})}
})
