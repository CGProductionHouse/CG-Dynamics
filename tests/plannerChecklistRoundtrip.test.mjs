import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const page = readFileSync('src/pages/admin/PlannerPage.tsx', 'utf8')
const start = page.indexOf('const CHECKLIST_COMPLETION_FIELDS')
const end = page.indexOf('function checklistProgress(', start)
const code = ts.transpileModule(page.slice(start, end), {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
const rows = new Function(`${code}; return checklistRows`)()
const serialize = new Function(`${code}; return serializeChecklistRow`)()

test('actual drawer recognises Graph isChecked without resetting completed items', () => {
  const source = {title:'Reviewed cut',isChecked:true,orderHint:' !',lastModifiedDateTime:'2026-10-18T12:00:00Z'}
  const [row] = rows([source])
  assert.equal(row.recognized, true)
  assert.equal(row.done, true)
  assert.deepEqual(row.raw, source)
})

test('ambiguous or malformed completion flags stay held, not unchecked', () => {
  for(const raw of [{text:'Ambiguous',done:false,completed:true},{title:'Malformed',isChecked:'true'}]) {
    assert.equal(rows([raw])[0].recognized,false)
    assert.deepEqual(serialize(rows([raw])[0]),raw)
  }
})

test('completion toggles preserve source key, metadata and unrecognised rows without injecting text/done aliases',()=>{
  const fixtures = ['Plain', {text:'Native',done:false},{title:'Graph',isChecked:true,orderHint:' !',lastModifiedBy:{user:{id:'synthetic'}}},{name:'Legacy',completed:true},{text:'Snake',is_checked:true},{title:'Two equivalent flags',completed:true,isChecked:true},{text:'No flag'}]
  for (const raw of fixtures) {
    const [row]=rows([raw])
    assert.deepEqual(serialize(row),raw,'unchanged save must preserve original shape')
    const saved=serialize({...row,done:!row.done})
    assert.equal(rows([saved])[0].done,!row.done)
    if(raw?.orderHint) assert.deepEqual(saved.lastModifiedBy,raw.lastModifiedBy)
    if(raw?.title) assert.equal(Object.hasOwn(saved,'text'),false)
  }
  const unknown={foreign:{keep:'exact'}}
  assert.deepEqual(serialize(rows([unknown])[0]),unknown)
})
