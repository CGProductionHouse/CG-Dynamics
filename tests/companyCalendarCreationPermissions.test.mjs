import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import test from 'node:test'

const migration = readFileSync('supabase/migrations/20261025135859_calendar_creation_attempt_identity.sql', 'utf8')
test('calendar attempt migration adds exactly one column privilege, not table/role/provider/visibility access', () => {
  assert.equal(migration.replace(/--[^\n]*/g, '').trim(), 'grant insert (id) on public.company_calendar_events to authenticated;')
})

test('actual calendar column ACLs reproduce denied attempt IDs, then allow safe replay while retaining RLS/protected fields', { skip: !process.env.CG_LOCAL_PGLITE_MODULE }, async () => {
  const { PGlite } = await import(pathToFileURL(process.env.CG_LOCAL_PGLITE_MODULE).href)
  const db = await PGlite.create()
  try {
    const baseline = readFileSync('supabase/phase-10a-company-calendar-events.sql', 'utf8')
    const start = baseline.indexOf('create table public.company_calendar_events (')
    await db.exec('create role authenticated; create role anon; create table public.clients(id uuid primary key);')
    await db.exec(baseline.slice(start, baseline.indexOf('\n);', start) + 4))
    await db.exec(`alter table company_calendar_events add column microsoft_event_id text, add column client_visible boolean not null default false;
      create function public.is_staff() returns boolean language sql stable as $$select current_setting('test.role',true) in ('admin','staff')$$;
      create function public.is_admin() returns boolean language sql stable as $$select current_setting('test.role',true)='admin'$$;
      grant usage on schema public to authenticated,anon;
      grant select on public.company_calendar_events to authenticated;
      -- Production has a pre-existing anonymous table ACL; row admission still
      -- requires is_staff(). The new authenticated column grant does not alter it.
      grant all on public.company_calendar_events to anon;`)
    const policies = baseline.slice(baseline.indexOf('alter table public.company_calendar_events enable row level security;'), baseline.indexOf('-- ── 3. INDEXES'))
    await db.exec(policies)
    const outlook = readFileSync('supabase/migrations/20260809120000_calendar_outlook_identity.sql', 'utf8')
    const grants = outlook.slice(outlook.indexOf('revoke insert, update on public.company_calendar_events from authenticated;'), outlook.indexOf('-- Superseded rows are retained'))
    assert.ok(grants.includes('grant insert ('))
    await db.exec(grants)
    await db.exec("select set_config('test.role','admin',false); set role authenticated;")
    const id = '10000000-0000-4000-8000-000000000321'
    const insert = () => db.query("insert into company_calendar_events(id,title,start_at,notes) values($1,'Synthetic',now(),'Retained staff text') returning id", [id])
    await assert.rejects(insert(), error => error.code === '42501')
    await db.exec('reset role')
    await db.exec(migration)
    await db.exec(migration)
    await db.exec('set role authenticated')
    assert.equal((await insert()).rows[0].id, id)
    await assert.rejects(insert(), error => error.code === '23505')
    assert.deepEqual((await db.query('select notes,client_visible,microsoft_event_id from company_calendar_events where id=$1', [id])).rows, [{ notes: 'Retained staff text', client_visible: false, microsoft_event_id: null }])
    await assert.rejects(db.query('update company_calendar_events set id=$1 where id=$2', ['10000000-0000-4000-8000-000000000322', id]), error => error.code === '42501')
    for (const field of ['microsoft_event_id', 'client_visible']) {
      await assert.rejects(db.query(`insert into company_calendar_events(id,title,start_at,${field}) values(gen_random_uuid(),'Forbidden',now(),$1)`, [field === 'client_visible' ? true : 'foreign-source']), error => error.code === '42501')
    }
    await db.exec("select set_config('test.role','client',false)")
    await assert.rejects(insert(), error => error.code === '42501')
    assert.deepEqual((await db.query('select id from company_calendar_events')).rows, [])
    await db.exec("reset role; select set_config('test.role','',false); set role anon")
    await assert.rejects(insert(), error => error.code === '42501')
    await db.exec('reset role')
    assert.equal((await db.query('select count(*)::int n from company_calendar_events')).rows[0].n, 1)
    assert.equal((await db.query("select relrowsecurity from pg_class where oid='company_calendar_events'::regclass")).rows[0].relrowsecurity, true)
    await db.exec('revoke insert(id) on company_calendar_events from authenticated')
    assert.equal((await db.query("select has_column_privilege('authenticated','company_calendar_events','title','INSERT') v")).rows[0].v, true)
    assert.equal((await db.query("select has_column_privilege('authenticated','company_calendar_events','id','INSERT') v")).rows[0].v, false)
  } finally { await db.close() }
})
