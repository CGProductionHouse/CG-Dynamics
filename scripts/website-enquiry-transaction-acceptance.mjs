import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

// An isolated, disposable container only. No application credentials or existing DB.
const container = `cg-405-acceptance-${randomUUID()}`
const image = 'postgres:17-alpine'
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Docker acceptance failed')
  return result.stdout
}
function sql(input, database = 'cg_website_enquiry_acceptance') {
  return docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-X'], input)
}
let created = false
try {
  docker(['run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_PASSWORD=postgres', image])
  created = true
  let ready = false
  for (let attempt = 0; attempt < 40; attempt++) {
    const result = spawnSync('docker', ['exec', container, 'pg_isready', '-U', 'postgres'], { encoding: 'utf8' })
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
    create table public.clients(id uuid primary key, name text not null, active boolean not null default true);
    create table public.profiles(id uuid primary key references auth.users(id), full_name text, role text,
      client_id uuid references public.clients(id), is_active boolean not null default true);`)
  sql(readFileSync(new URL('../supabase/migrations/20261001181932_website_enquiry_transaction.sql', import.meta.url), 'utf8'))
  sql(readFileSync(new URL('../tests/sql/405_website_enquiry_transaction_acceptance.sql', import.meta.url), 'utf8'))
  console.log('PASS: PostgreSQL transaction, six-session concurrency, replay, isolation, rollback, RLS/grants and outbox recovery')
} finally {
  // This exact container was created by this invocation, never a shared server.
  if (created) docker(['stop', container])
}
