import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { transform } from 'esbuild'
const text=readFileSync(new URL('../src/lib/nolanReadContinuity.ts',import.meta.url),'utf8')
const compiled=await transform(text,{loader:'ts',format:'cjs'})
const module={exports:{}}
new Function('module','exports',compiled.code)(module,module.exports)
const {retainNolanRows:retain,nolanReadScope:scope}=module.exports
test('failure retains only last successful display rows without rewriting lifecycle',()=>{
 const rows=Object.freeze([Object.freeze({status:'in_progress'}),Object.freeze({status:'blocked'})])
 const good=retain(rows,false,'success')
 const failed=retain([{status:'done'}],true,'failure',good)
 assert.equal(failed.data,rows);assert.equal(failed.stale,true)
 assert.equal(failed.lastSuccessAt,'success')
 assert.deepEqual(failed.data.map(x=>x.status),['in_progress','blocked'])
 const again=retain([],true,'later failure',failed)
 assert.equal(again.data,rows);assert.equal(again.lastSuccessAt,'success')
})
test('successful empty results clear stale rows; absent evidence is not invented',()=>{
 const stale=retain([],true,'failure',retain([{id:'old'}],false,'old success'))
 assert.deepEqual(retain([],false,'new success',stale),{data:[],stale:false,lastSuccessAt:'new success'})
 assert.deepEqual(retain([],true,'failure'),{data:[],stale:false,lastSuccessAt:null})
})
test('scope requires exact identity and manager role; account/month/role boundaries differ',()=>{
 for(const args of [[undefined,'a','admin'],['a',undefined,'admin'],['a','b','admin'],['a','a','staff'],['a','a',undefined]]) assert.equal(scope(...args,'2026-11'),null)
 const base=scope('a','a','admin','2026-11')
 for(const args of [['b','b','admin','2026-11'],['a','a','manager','2026-11'],['a','a','admin','2026-12']]) assert.notEqual(scope(...args),base)
})
test('render gating and request cleanup guard retained rows; directory never retained as authority',()=>{
 const page=readFileSync(new URL('../src/pages/admin/NolanOverview.tsx',import.meta.url),'utf8')
 for(const value of ['rawSnapshot?.scope === scope','previous?.scope === readScope','if (cancelled) return','return () => { cancelled = true }','[month, generation, scope, user?.id, profile?.id, profile?.role]','profile?.is_active === false','if (!scope) return <div','NolanPackageEvidence key={scope}','NolanWebsiteConnections key={`${scope}:${generation}`}','Last-known record','includes last-known records','Open the authoritative record before acting.']) assert.ok(page.includes(value),value)
 assert.ok(page.includes('const staff = staffRead.result && !staffRead.result.error'))
 assert.ok(page.includes(': null'))
 assert.doesNotMatch(page,/staff:\s*previous/)
})
