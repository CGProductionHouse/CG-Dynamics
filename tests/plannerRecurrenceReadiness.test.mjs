import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { businessDateKey } from '../src/lib/businessTime.ts'
import { fetchAllPages } from '../src/lib/paginatedQuery.ts'
import { parseRecurrenceRule } from '../src/lib/recurrenceRule.ts'

const source=readFileSync('src/lib/recurrence.ts','utf8')
function load(supabase={},Clock=Date){
  const code=ts.transpileModule(source.replace(/^import[^\n]+/gm,'').replace(/^export \{[^\n]+from[^\n]+/gm,'').replace(/^export /gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  return new Function('supabase','businessDateKey','fetchAllPages','parseRecurrenceRule','Date',`${code};return {parseRecurrenceRule,occurrencesInWindow,materializeRecurringTasks}`)(supabase,businessDateKey,fetchAllPages,parseRecurrenceRule,Clock)
}
const {parseRecurrenceRule:parse,occurrencesInWindow:dates}=load()

test('explicit monthly ordinal weekdays keep distinct first/second and last/fifth rules',()=>{
  const cases=[['1MO','2026-11-02'],['1TH','2026-11-05'],['2MO','2026-11-09'],['2TH','2026-11-12']]
  for(const[token,expected]of cases){
    const rule=parse(`FREQ=MONTHLY;BYDAY=${token}`)
    assert.ok(rule,`explicit ${token} rule must be representable without guessed fixed dates`)
    assert.deepEqual(dates(rule,new Date('2026-11-01T10:00:00Z'),14,null,'2026-10-01'),[expected])
    assert.deepEqual(dates(rule,new Date('2026-11-02T10:00:00Z'),13,null,'2026-10-01'),[expected])
  }
  assert.deepEqual(dates(parse('FREQ=MONTHLY;BYDAY=-1FR'),new Date('2026-10-20T10:00:00Z'),14,null,'2026-10-01'),['2026-10-30'])
  assert.deepEqual(dates(parse('FREQ=MONTHLY;BYDAY=5TH'),new Date('2026-11-17T10:00:00Z'),14,null,'2026-10-01'),[],'a missing fifth weekday is not the fourth or next month')
})

test('monthly ordinal evaluation matches independent calendar enumeration across leap years and month boundaries',()=>{
  const tokens=['SU','MO','TU','WE','TH','FR','SA']
  for(const year of [2024,2026,2027,2028,2100])for(let month=1;month<=12;month++)for(let day=0;day<7;day++)for(const position of [1,2,3,4,5,-1,-2,-3,-4,-5]){
    const prefix=`${year}-${String(month).padStart(2,'0')}`
    const calendar=Array.from({length:31},(_,i)=>`${prefix}-${String(i+1).padStart(2,'0')}`).filter(key=>{
      const date=new Date(`${key}T10:00:00Z`)
      return date.toISOString().startsWith(prefix)&&date.getUTCDay()===day
    })
    const expected=calendar.at(position>0?position-1:position)
    const rule=parse(`FREQ=MONTHLY;BYDAY=${position}${tokens[day]}`)
    assert.ok(rule)
    const actual=[...new Set([1,15,28].flatMap(start=>dates(rule,new Date(`${prefix}-${String(start).padStart(2,'0')}T10:00:00Z`),14,null,`${prefix}-01`)))].filter(key=>key.startsWith(prefix))
    assert.deepEqual(actual,expected?[expected]:[],`${prefix} ${position}${tokens[day]}`)
  }
})

test('ordinal rules preserve interval, until, exact anchor and unsupported-rule refusal',()=>{
  const rule=parse('FREQ=MONTHLY;INTERVAL=2;BYDAY=2TH')
  assert.ok(rule)
  assert.deepEqual(dates(rule,new Date('2026-11-01T10:00:00Z'),14,null,'2026-09-01'),['2026-11-12'])
  assert.deepEqual(dates(rule,new Date('2026-10-01T10:00:00Z'),14,null,'2026-09-01'),[])
  assert.deepEqual(dates(rule,new Date('2026-11-01T10:00:00Z'),14,'2026-11-11','2026-09-01'),[])
  assert.deepEqual(dates(rule,new Date('2026-11-01T10:00:00Z'),14,null,'2026-11-13'),[])
  for(const raw of ['FREQ=MONTHLY;BYDAY=0MO','FREQ=MONTHLY;BYDAY=6MO','FREQ=MONTHLY;BYDAY=-6MO','FREQ=MONTHLY;BYDAY=1XX','FREQ=MONTHLY;BYDAY=1MO,2TH','FREQ=WEEKLY;BYDAY=1MO','FREQ=DAILY;BYDAY=1MO','FREQ=MONTHLY;BYDAY=1MO;BYMONTHDAY=2','FREQ=MONTHLY;BYDAY=1MO;COUNT=2','FREQ=MONTHLY;BYDAY=1MO;BYSETPOS=1'])assert.equal(parse(raw),null,raw)
})

test('daily/weekly/monthly intervals stay anchored when Planner opens on another day',()=>{
  const daily=parse('FREQ=DAILY;INTERVAL=2')
  const first=dates(daily,new Date('2026-10-18T12:00:00Z'),8,null,'2026-10-01')
  const second=dates(daily,new Date('2026-10-19T12:00:00Z'),7,null,'2026-10-01')
  assert.deepEqual(first,second)
  assert.deepEqual(first,['2026-10-19','2026-10-21','2026-10-23','2026-10-25'])
  assert.deepEqual(dates(parse('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE'),new Date('2026-10-18T12:00:00Z'),14,null,'2026-10-05'),['2026-10-19','2026-10-21'])
  assert.deepEqual(dates(parse('FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=3'),new Date('2026-11-01T12:00:00Z'),14,null,'2026-09-01'),['2026-11-03'])
  assert.deepEqual(dates(parse('FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=3'),new Date('2026-10-01T12:00:00Z'),14,null,'2026-09-01'),[])
})

test('Johannesburg dates, weekdays, until, future anchor and 14-day cap remain exact',()=>{
  assert.deepEqual(dates(parse('FREQ=DAILY'),new Date('2026-10-18T22:30:00Z'),0,null,'2026-10-01'),['2026-10-19'])
  assert.deepEqual(dates(parse('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'),new Date('2026-10-18T10:00:00Z'),7,'2026-10-21','2026-10-01'),['2026-10-19','2026-10-20','2026-10-21'])
  assert.deepEqual(dates(parse('FREQ=DAILY'),new Date('2026-10-18T10:00:00Z'),3,null,'2026-10-20'),['2026-10-20','2026-10-21'])
  assert.equal(dates(parse('FREQ=DAILY'),new Date('2026-10-18T10:00:00Z'),10000,null,'2026-10-01').length,15)
  for(const interval of ['0','-1','1.5','13','Infinity','wat'])assert.equal(parse(`FREQ=DAILY;INTERVAL=${interval}`),null)
  for(const rule of ['FREQ=DAILY;COUNT=3','FREQ=MONTHLY;BYMONTHDAY=31','FREQ=MONTHLY;BYDAY=MO','FREQ=WEEKLY;BYDAY=XX','FREQ=WEEKLY;BYMONTHDAY=3'])assert.equal(parse(rule),null)
  assert.deepEqual(dates(parse('FREQ=DAILY'),new Date(),14,null,'bad'),[])
})

function adapter(rows,{readError=false,nullRead=false,repeat=false,failBatch=0,unknownBatch=0,receiptIds=null}={}){
  const writes=[],pages=[],keys=new Set()
  return {writes,pages,db:{from(table){assert.equal(table,'planner_tasks');let from=0,to=999,insert=false,payload
    return {select(){return this},not(){return this},is(){return this},order(){return this},range(a,b){from=a;to=b;pages.push([a,b]);return this},upsert(value,options){insert=true;payload=value;assert.deepEqual(options,{onConflict:'import_hash',ignoreDuplicates:true});return this},then(resolve,reject){
      if(!insert)return Promise.resolve({data:nullRead?null:rows.slice(repeat?0:from,repeat?1000:to+1),error:readError?{message:'Read unavailable'}:null}).then(resolve,reject)
      writes.push(payload)
      if(writes.length===failBatch)return Promise.resolve({data:null,error:{message:'Synthetic batch unavailable'}}).then(resolve,reject)
      if(writes.length===unknownBatch)return Promise.resolve({data:null,error:null}).then(resolve,reject)
      const inserted=payload.filter(row=>{if(keys.has(row.import_hash))return false;keys.add(row.import_hash);return true})
      return Promise.resolve({data:inserted.map((row,i)=>({id:receiptIds ? receiptIds(i,writes.length) : `synthetic-${row.import_hash}`})),error:null}).then(resolve,reject)
    }}
  }}}
}
const template=i=>({id:`template-${String(i).padStart(4,'0')}`,board_id:'board',bucket_id:'bucket',title:'Synthetic recurring work',recurrence_rule:'FREQ=DAILY',recurrence_until:null,created_at:'2026-10-01T10:00:00Z',start_date:null})

test('actual native materialiser preserves four explicitly distinct monthly series and deterministic retry keys',async()=>{
  class NovemberClock extends Date { constructor(...args){super(...(args.length?args:['2026-11-01T10:00:00Z']))} }
  const fixtures=adapter(['1MO','1TH','2MO','2TH'].map((token,i)=>({...template(i),recurrence_rule:`FREQ=MONTHLY;BYDAY=${token}`})))
  const runtime=load(fixtures.db,NovemberClock)
  assert.equal((await runtime.materializeRecurringTasks()).created,4)
  assert.deepEqual(fixtures.writes[0].map(row=>[row.recurrence_parent_id,row.due_date]),[['template-0000','2026-11-02'],['template-0001','2026-11-05'],['template-0002','2026-11-09'],['template-0003','2026-11-12']])
  assert.ok(fixtures.writes[0].every(row=>row.import_hash===`rec-${row.recurrence_parent_id}-${row.due_date}`))
  assert.equal((await runtime.materializeRecurringTasks()).created,0)
  assert.equal(new Set(fixtures.writes.flat().map(row=>row.import_hash)).size,4)
})

test('actual materialiser reads beyond 1000, uses deterministic instance keys and never duplicates retries',async()=>{
  const fixture=adapter(Array.from({length:1001},(_,i)=>template(i))),runtime=load(fixture.db)
  const first=await runtime.materializeRecurringTasks(),second=await runtime.materializeRecurringTasks()
  assert.equal(first.error,null)
  assert.equal(first.templates,1001)
  assert.equal(first.created,1001*15)
  assert.equal(second.created,0)
  assert.ok(fixture.pages.some(([from])=>from===1000))
  assert.ok(fixture.writes.flat().some(row=>row.import_hash.startsWith('rec-template-1000-')))
  assert.ok(fixture.writes.every(batch=>batch.length<=200))
})

test('a failed or unconfirmed later batch reports only acknowledged work and safely retries deterministic keys',async()=>{
  for(const option of [{failBatch:2},{unknownBatch:2}]){
    const fixture=adapter(Array.from({length:20},(_,i)=>template(i)),option),runtime=load(fixture.db)
    const first=await runtime.materializeRecurringTasks()
    assert.equal(first.created,200)
    assert.ok(first.error)
    const retry=await runtime.materializeRecurringTasks()
    assert.equal(retry.error,null)
    assert.equal(retry.created,100)
    assert.equal(new Set(fixture.writes.flat().map(row=>row.import_hash)).size,300)
  }
})

test('failed/null/repeated template reads, invalid rules and missing anchors perform zero materialisation writes',async()=>{
  for(const [rows,options] of [[[template(0)],{readError:true}],[[template(0)],{nullRead:true}],[Array.from({length:1000},(_,i)=>template(i)),{repeat:true}],[[{...template(0),recurrence_rule:'FREQ=DAILY;INTERVAL=1.5'}],{}],[[{...template(0),created_at:'invalid'}],{}]]){
    const fixture=adapter(rows,options),result=await load(fixture.db).materializeRecurringTasks()
    assert.ok(result.error)
    assert.equal(result.created,0)
    assert.equal(fixture.writes.length,0)
  }
})

test('invalid recurring end dates stop the entire pass before any instance write; expired and null remain valid',async()=>{
  for(const until of ['2026-02-30','not-a-date','2026-10-20T12:00:00Z','',0,false]){
    const fixture=adapter([template(0),{...template(1),recurrence_until:until}])
    const result=await load(fixture.db).materializeRecurringTasks()
    assert.ok(result.error,`invalid end date ${JSON.stringify(until)} must not mean no work due`)
    assert.equal(result.created,0)
    assert.equal(fixture.writes.length,0)
  }
  const expired=adapter([{...template(0),recurrence_until:'2020-01-01'}])
  assert.equal((await load(expired.db).materializeRecurringTasks()).error,null)
  assert.equal(expired.writes.length,0)
  assert.equal((await load(adapter([template(0)]).db).materializeRecurringTasks()).created,15)
})

test('blank, repeated and reused save identities are unconfirmed, not counted as created instances',async()=>{
  for(const receiptIds of [()=>'',()=>'   ',()=> 'same-id']){
    const result=await load(adapter([template(0)],{receiptIds}).db).materializeRecurringTasks()
    assert.ok(result.error)
    assert.equal(result.created,0)
  }
  const result=await load(adapter(Array.from({length:20},(_,i)=>template(i)),{receiptIds:i=>`batch-local-${i}`}).db).materializeRecurringTasks()
  assert.ok(result.error,'a later batch must not acknowledge an earlier identity twice')
  assert.equal(result.created,200,'retain only previously confirmed batch count')
})
