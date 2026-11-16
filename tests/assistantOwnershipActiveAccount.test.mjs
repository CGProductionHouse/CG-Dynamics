import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
const modulePath = process.env.CG_LOCAL_PGLITE_MODULE

test('ownership summary denies inactive identities while preserving manager policy and history', { skip: !modulePath }, async () => {
  const { PGlite } = await import(modulePath)
  const db = new PGlite()
  const id = '11111111-1111-4111-8111-111111111111'
  const original = readFileSync('supabase/migrations/20260805120000_canonical_ownership_notifications.sql', 'utf8')
  const start = original.indexOf('create or replace function public.assistant_ownership_review_summary()')
  const endText = 'grant execute on function public.assistant_ownership_review_summary() to authenticated, service_role;'
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('fixture.uid',true),'')::uuid$$;
      create table profiles(id uuid primary key, role text, is_active boolean, full_name text);
      create function public.is_manager() returns boolean language sql security definer as $$select role in ('manager','admin') from public.profiles where id=auth.uid()$$;
      create table planner_tasks_canonical(id uuid primary key,assignment_review_state text,title text,client_name text,due_date date,assigned_to_name text,unresolved_assignee_names text[],helper_names text[],source text,microsoft_task_id text);
      create table planner_task_assignees(task_id uuid,profile_id uuid);
      insert into profiles values('${id}','manager',false,'Synthetic Manager');
      insert into planner_tasks_canonical(id,assignment_review_state,title) values('${id}','conflict','Historical conflict');
      set fixture.uid='${id}';`)
    await db.exec(original.slice(start, original.indexOf(endText, start) + endText.length))
    await db.exec('set role authenticated')
    const call = async () => (await db.query('select public.assistant_ownership_review_summary() as result')).rows[0].result
    const before = await call() // Reproduces the reported bypass under the original RPC.
    assert.equal(before.conflicts, 1)
    await db.exec('reset role')
    await db.exec(readFileSync('supabase/migrations/20261116170000_guard_assistant_ownership_summary.sql', 'utf8'))
    await db.exec('set role authenticated')
    await assert.rejects(call(), /Manager access/)
    for (const role of ['manager', 'admin', 'staff', 'team']) {
      await db.exec(`reset role; update profiles set role='${role}',is_active=true; set role authenticated`)
      if (['manager', 'admin'].includes(role)) assert.deepEqual(await call(), before)
      else await assert.rejects(call(), /Manager access/)
    }
    await db.exec("reset role; update profiles set role='admin',is_active=false; set role authenticated")
    await assert.rejects(call(), /Manager access/)
    await db.exec("set fixture.uid='';")
    await assert.rejects(call(), /Manager access/)
    await db.exec("set fixture.uid='22222222-2222-4222-8222-222222222222'")
    await assert.rejects(call(), /Manager access/)
    await db.exec('reset role; set role anon')
    await assert.rejects(call(), /permission denied/)
    await db.exec('reset role')
    assert.equal((await db.query('select count(*)::int n from planner_tasks_canonical')).rows[0].n, 1)
    assert.equal((await db.query('select title from planner_tasks_canonical')).rows[0].title, 'Historical conflict')
  } finally { await db.close() }
})
