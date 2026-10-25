import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import {businessDateKey,businessMonthKey} from '../src/lib/businessTime.ts'
import {shiftPlannerMonth} from '../src/lib/plannerViews.ts'
const planner=readFileSync('src/pages/admin/PlannerPage.tsx','utf8')
const calendar=readFileSync('src/pages/admin/CompanyCalendarPage.tsx','utf8')
function actual(source,start,end,injections){
  const section=source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)))
  const code=ts.transpileModule(section,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  return new Function(...Object.keys(injections),`${code}; return ${start.split('(')[0].replace('function ','')}`)(...Object.values(injections))
}
test('actual Planner today uses Johannesburg even on a browser in another timezone',()=>{
  const before=process.env.TZ
  try{
    process.env.TZ='America/Los_Angeles'
    const date=actual(planner,'function dateKey(','function formatPlannerDate(',{businessDateKey})
    assert.equal(date(new Date('2026-10-19T22:30:00Z')),'2026-10-20')
  }finally{if(before===undefined)delete process.env.TZ;else process.env.TZ=before}
})
test('actual CG Calendar month navigation never converts a calendar month through browser midnight',()=>{
  const before=process.env.TZ
  try{
    process.env.TZ='Pacific/Kiritimati'
    const shift=actual(calendar,'function shiftMonth(','function formatMonthHeading(',{monthKey:businessMonthKey,shiftPlannerMonth})
    assert.equal(shift('2026-10',1),'2026-11')
    assert.equal(shift('2026-01',-1),'2025-12')
    assert.equal(shift('2026-12',1),'2027-01')
  }finally{if(before===undefined)delete process.env.TZ;else process.env.TZ=before}
})
