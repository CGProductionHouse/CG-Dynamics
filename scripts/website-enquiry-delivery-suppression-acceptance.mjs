import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

// Issue #405 delivery suppression. An isolated, disposable container only. No application credentials or existing DB.
const container = `cg-405-suppression-acceptance-${randomUUID()}`
const image = 'postgres:17-alpine'
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Docker acceptance failed')
  return result.stdout
}
function sql(input, database = 'cg_website_enquiry_acceptance') {
  return docker(['exec', '-i', '-e', 'PGPASSWORD=postgres', container, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-X'], input)
}
let created = false
try {
  docker(['run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_PASSWORD=postgres', image])
  created = true
  let ready = false
  for (let attempt = 0; attempt < 40; attempt++) {
    // The image's temporary init server accepts sockets before its final restart.
    // TCP readiness proves the final server, avoiding the init/shutdown race.
    const result = spawnSync('docker', ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], { encoding: 'utf8' })
    if (result.status === 0) { ready = true; break }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  if (!ready) throw new Error('Disposable PostgreSQL did not become ready')
  sql('create database cg_website_enquiry_acceptance;', 'postgres')
  sql(`create extension pgcrypto; create schema auth; create schema extensions;
    create role anon nologin; create role authenticated nologin;
    create role service_role nologin bypassrls;
    alter default privileges grant all on tables to service_role;
    create role supabase_admin login superuser password 'postgres';
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
    create table public.clients(id uuid primary key, name text not null, active boolean not null default true);
    create table public.profiles(id uuid primary key references auth.users(id), full_name text, role text,
      client_id uuid references public.clients(id), is_active boolean not null default true);`)
  for (const migration of [
    '20261001181932_website_enquiry_transaction.sql',
    '20261002085355_website_enquiry_intake_guard.sql',
    '20261002090000_website_lead_lifecycle.sql',
    '20261002110000_website_enquiry_delivery_runtime.sql',
    '20261002140000_website_enquiry_delivery_suppression.sql',
  ]) sql(readFileSync(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8'))
  sql(readFileSync(new URL('../tests/sql/405_website_enquiry_delivery_suppression_acceptance.sql', import.meta.url), 'utf8'))
  console.log('PASS: #405 delivery suppression — admin/manager-only, audited, terminal, never claimed, in-flight/sent refused, reconcile suppressible, race-safe against claim, evidence preserved')
} finally {
  // This exact container was created by this invocation, never a shared server.
  if (created) docker(['stop', container])
}
