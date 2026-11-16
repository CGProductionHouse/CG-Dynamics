import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {transform} from 'esbuild'
const sql=readFileSync('docs/ops/sql/nolan_explicit_decision_requests.draft.sql','utf8')
const api=readFileSync('src/lib/nolanDecisionApi.ts','utf8')
const ui=readFileSync('src/pages/admin/NolanNeedsYou.tsx','utf8')
test('draft SQL denies direct table access and fixes privileged lookup scope',()=>{
 assert.match(sql,/enable row level security/)
 assert.match(sql,/revoke all on public.nolan_decision_requests from public, anon, authenticated/)
 assert.match(sql,/revoke all on function public.nolan_decision_actor\(\) from public,anon,authenticated/)
 assert.equal((sql.match(/security definer set search_path = pg_catalog set timezone = 'UTC' as/g)||[]).length,5)
 assert.doesNotMatch(sql,/execute format|update public.command_centre_tasks|grant .*on public.nolan_decision_requests/)
})
test('actor, explicit recipient, revision, idempotency and response boundaries are checked',()=>{
 for(const token of ["id=auth.uid()","role='admin'","p_recipient_id and is_active","for share","for update","pg_advisory_xact_lock","Idempotency key already used","md5(to_jsonb(v_task)::text)","p_expected_version","Only the named recipient","Only the requester","v_count > 500"]) assert.ok(sql.includes(token),token)
})
test('UI activation is held, scope separated and uncertain create retries retain key',()=>{
 assert.match(api,/NOLAN_DECISIONS_ACCEPTED = false/)
 assert.ok(ui.includes('if (!NOLAN_DECISIONS_ACCEPTED) return'))
 assert.ok(ui.includes("key.current??=crypto.randomUUID()"))
 assert.ok(ui.includes('disabled={!!key.current}'))
 assert.ok(ui.includes('No complete current queue is claimed'))
 assert.ok(ui.includes("r.recipientId===viewerId"))
})
test('malformed and duplicate server receipt sets cannot masquerade as a complete queue',async()=>{
 const compiled=await transform(api.replace("import { supabase } from './supabase'","const supabase = {}"),{loader:'ts',format:'cjs'})
 const m={exports:{}};new Function('module','exports',compiled.code)(m,m.exports)
 const validate=m.exports.validateNativeDecisionRows
 const row={id:'id',taskId:'task',title:'Title',question:'Question',recipientId:'user',requestedBy:'admin',createdAt:'2026-11-16T07:00:00Z',version:1,state:'pending',sourceRevision:'r1',currentRevision:'r1',recipientActive:true}
 assert.deepEqual(validate([row]),[row]);assert.deepEqual(validate([]),[])
 for(const invalid of [null,{},[row,row],[{...row,version:0}],[{...row,recipientActive:null}],[{...row,state:'approved'}]]) assert.throws(()=>validate(invalid))
})

test('native link and deterministic rejection retain honest navigation and retry behavior',()=>{assert.ok(ui.includes('/admin/work?tab=daily-tasks'));assert.ok(!ui.includes('tab=board&id='));assert.ok(ui.includes("['P0001','42501','22P02','23514','23503']"));assert.ok(ui.includes('Network/timeouts or an absent receipt keep the retry key'))})
