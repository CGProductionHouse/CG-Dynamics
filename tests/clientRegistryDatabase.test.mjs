import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'

// Explicitly opt in: isolated Docker PostgreSQL only. No URLs/credentials from
// production or .env are read, no ports are published, and networking is disabled.
test('isolated PostgreSQL proves registry uniqueness, role boundary and retained history', {
  skip: process.env.RUN_CLIENT_REGISTRY_DB_TESTS !== '1', timeout: 90000,
}, async () => {
  const container = `cg-registry-test-${randomUUID()}`
  const docker = args => execFileSync('docker', args, { encoding: 'utf8', timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] })
  const sql = input => execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], {
    input, encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'],
  }).trim()
  let created = false
  try {
    docker(['run', '--detach', '--network', 'none', '--name', container, '--label', 'cg-purpose=registry-isolated-test',
      '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17-alpine'])
    created = true
    let ready = false
    for (let attempt = 0; attempt < 40; attempt++) {
      try { docker(['exec', container, 'pg_isready', '-U', 'postgres']); ready = true; break } catch { /* bounded readiness */ }
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    assert.equal(ready, true, 'isolated database became ready')
    sql(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create table public.clients (id uuid primary key default gen_random_uuid(), name text not null,
        tier text, active boolean, package_settings jsonb, short_code text);
      create table public.time_entries (id uuid primary key, client_id uuid references public.clients(id), marker text);
      create table public.timesheet_rows (id uuid primary key, client_id uuid references public.clients(id), marker text);
      grant select, insert, update, delete on public.clients to anon, authenticated, service_role;
      insert into public.clients values ('11111111-1111-4111-8111-111111111111',' Red Oak ','standard',true,'{}',null),
        ('22222222-2222-4222-8222-222222222222','Madisons','standard',false,'{}',null);
      insert into public.time_entries values ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','retained');
      insert into public.timesheet_rows values ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','retained');
    `)
    const history = () => sql(`select md5(string_agg(row_to_json(t)::text, '' order by id)) from public.time_entries t;
      select md5(string_agg(row_to_json(t)::text, '' order by id)) from public.timesheet_rows t;`)
    const before = history()
    sql(readFileSync('supabase/migrations/20260918120000_cg_hours_client_registry_bridge.sql', 'utf8'))
    sql(readFileSync('supabase/migrations/20261003085222_client_registry_identity_history_guard.sql', 'utf8'))

    assert.throws(() => sql("insert into public.clients (name) values ('red oak')"), /duplicate key/)
    assert.throws(() => sql("insert into public.clients (name) values (' MADISONS ')"), /duplicate key/)
    assert.throws(() => sql("update public.clients set name='Red Oak' where name='Madisons'"), /duplicate key/)
    assert.throws(() => sql("set role authenticated; delete from public.clients where name='Madisons'"), /permission denied/)
    assert.throws(() => sql("set role anon; delete from public.clients where name='Madisons'"), /permission denied/)
    assert.equal(sql("select has_table_privilege('authenticated','public.clients','SELECT,INSERT,UPDATE')"), 't')
    assert.equal(sql("select has_table_privilege('service_role','public.clients','DELETE')"), 't')
    sql("set role authenticated; update public.clients set active=false where id='11111111-1111-4111-8111-111111111111'; reset role;")
    sql("set role authenticated; update public.clients set active=true where id='11111111-1111-4111-8111-111111111111'; reset role;")

    const ensure = (hoursId, name, requestId) => JSON.parse(sql(`set role service_role;
      select public.ensure_client_from_cg_hours('${hoursId}', '${name}', '${requestId}');`).split('\n').at(-1))
    const h = '55555555-5555-4555-8555-555555555555', r = '66666666-6666-4666-8666-666666666666'
    const createdClient = ensure(h, 'JFJ Electrical', r)
    assert.equal(createdClient.status, 'created')
    assert.deepEqual(ensure(h, 'JFJ Electrical', r), createdClient, 'same request replay is unchanged')
    const mapped = ensure(h, 'JFJ Electrical', '77777777-7777-4777-8777-777777777777')
    assert.equal(mapped.dynamicsClientId, createdClient.dynamicsClientId)
    assert.equal(mapped.status, 'mapped')
    const conflict = ensure('88888888-8888-4888-8888-888888888888', 'JFJ Electrical', '99999999-9999-4999-8999-999999999999')
    assert.equal(conflict.code, 'name_collision')
    assert.equal(sql("select count(*) from public.clients where name='JFJ Electrical'"), '1')
    assert.equal(sql('select count(*) from public.cg_hours_client_mapping'), '1')
    assert.throws(() => sql(`set role authenticated; select public.ensure_client_from_cg_hours('${h}','JFJ Electrical','${r}')`), /permission denied/)
    assert.throws(() => sql('set role authenticated; select * from public.cg_hours_client_mapping'), /permission denied/)
    assert.equal(history(), before, 'all original Hours-style history fingerprints are unchanged')
    assert.equal(sql("select count(*) from public.clients where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222')"), '2')
  } finally {
    if (created) docker(['rm', '--force', container]) // exact disposable test container only
  }
})
