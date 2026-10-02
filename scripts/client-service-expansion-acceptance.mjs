import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

// No project configuration or application secrets are read. Disposable PG only.
const container = `cg-389-acceptance-${randomUUID()}`
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
  return result.stdout
}
const args = ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-At']
const sql = input => docker(args, input)
function ddl(file, name) {
  const source = read(file)
  const match = source.match(new RegExp(`create table (?:if not exists )?public\\.${name} \\([\\s\\S]*?\\n\\);`, 'i'))
  assert.ok(match, `Canonical ${name} DDL not found`)
  return match[0]
}
function routine(name) {
  const source = read('supabase/migrations/20260728180000_planner_multi_assignment.sql')
  const start = source.indexOf(`create or replace function public.${name}()`)
  assert.ok(start >= 0)
  return source.slice(start, source.indexOf('$$;', start) + 3)
}
let created = false
try {
  docker(['run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_PASSWORD=local-fixture-only', 'postgres:17-alpine'])
  created = true
  for (let attempt = 0; attempt < 50; attempt++) {
    if (spawnSync('docker', ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']).status === 0) break
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  sql(`create schema auth; create role anon; create role authenticated;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;
    grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    create table public.clients(id uuid primary key,name text not null,active boolean not null default true);
    create table public.profiles(id uuid primary key,full_name text,role text,client_id uuid references public.clients(id),is_active boolean not null default true);
    create table auth.users(id uuid primary key);
    grant select on public.profiles to authenticated;
    alter table public.profiles enable row level security;
    create policy self_profile on public.profiles for select to authenticated using(id=auth.uid());`)
  // Real dependency DDL, not a FakeSupabase reproduction of request logic.
  for (const [file, names] of [
    ['supabase/phase-6-cg-planner-core.sql', ['planner_boards','planner_buckets','planner_activity_log']],
    ['supabase/phase-6e-teams-planner-import.sql', ['planner_tasks']],
    ['supabase/phase-4a-meta-sync-foundation.sql', ['meta_connections','meta_client_assets']],
    ['supabase/migrations/20260922140000_instagram_login_fallback_foundation.sql', ['meta_instagram_connections']],
    ['supabase/phase-5a-tiktok-provider-foundation.sql', ['tiktok_connections']],
    ['supabase/phase-20b-google-ads-shared-accounts.sql', ['google_ads_accounts','google_ads_campaign_links']],
    ['supabase/phase-20a-google-ads-reporting.sql', ['google_ads_account_links']],
  ]) for (const name of names) sql(ddl(file, name))
  sql(`alter table public.tiktok_connections add client_id uuid references public.clients;
    alter table public.google_ads_account_links add google_ads_account_id uuid references public.google_ads_accounts;
    alter table public.planner_tasks add helper_names text[] not null default '{}', add unresolved_assignee_names text[] not null default '{}', add recurrence_parent_id uuid;
    alter table public.planner_tasks enable row level security;
    alter table public.planner_activity_log enable row level security;
    revoke all on public.planner_tasks,public.planner_activity_log from authenticated,anon;`)
  // Exercise the actual canonical insert triggers. Flags must prevent duplicate
  // direct-write audit and accidental assignment projections for a client actor.
  sql(routine('audit_direct_planner_task_write'))
  sql(routine('sync_planner_task_legacy_assignees'))
  sql(`create trigger real_planner_audit after insert on public.planner_tasks for each row execute function public.audit_direct_planner_task_write();
    create trigger real_planner_projection after insert on public.planner_tasks for each row execute function public.sync_planner_task_legacy_assignees();`)
  sql(read('supabase/migrations/20261002124434_client_service_entitlements.sql'))
  sql(read('tests/sql/389_service_expansion_acceptance.sql'))
  sql('alter table public.clients add package_settings jsonb;')
  sql(read('supabase/migrations/20261002140843_client_entitlement_resolution_queue.sql'))
  sql(read('tests/sql/389_entitlement_resolution_acceptance.sql'))
  // Six distinct sessions race one tenant key through the actual transaction.
  const query = `set role authenticated; set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
    select public.submit_client_service_expansion_request('linkedin','concurrent','30000000-0000-0000-0000-000000000006','performance');`
  await Promise.all(Array.from({ length: 6 }, () => new Promise((resolve, reject) => {
    const child = spawn('docker', args); let stderr = ''
    child.stderr.on('data', data => { stderr += data })
    child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error(stderr)))
    child.stdin.end(query)
  })))
  assert.equal(sql("select count(*) from planner_tasks where import_hash like '%30000000-0000-0000-0000-000000000006';").trim(), '1')
  assert.equal(sql("select count(*) from planner_activity_log where metadata->>'idempotency_key'='30000000-0000-0000-0000-000000000006';").trim(), '1')
  console.log('PASS: 389 SQL acceptance + six-session race; real migration, canonical Planner insert guards, RLS, exact-client reads/writes, provenance, revision, replay conflict and rollback')
} finally {
  if (created) docker(['stop', container])
}
