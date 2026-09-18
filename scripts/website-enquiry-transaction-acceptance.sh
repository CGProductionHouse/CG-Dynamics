#!/usr/bin/env bash
# Focused #405 M2A acceptance against a disposable PostgreSQL database.
# The caller must provide a local PostgreSQL server; this script creates and drops
# only cg_website_enquiry_acceptance and never reads application credentials.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATABASE="cg_website_enquiry_acceptance"
PSQL=(psql -v ON_ERROR_STOP=1 -X)

cleanup() {
  "${PSQL[@]}" -d postgres -c "drop database if exists $DATABASE with (force)" >/dev/null
}
trap cleanup EXIT

cleanup
"${PSQL[@]}" -d postgres -c "create database $DATABASE" >/dev/null

"${PSQL[@]}" -d "$DATABASE" <<'SQL'
create extension if not exists pgcrypto;
create schema if not exists auth;
create schema if not exists extensions;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    create role supabase_admin login superuser password 'postgres';
  end if;
end $$;

create table auth.users (id uuid primary key);

create table public.clients (
  id uuid primary key,
  name text not null,
  active boolean not null default true
);

create table public.profiles (
  id uuid primary key references auth.users(id),
  full_name text,
  role text,
  client_id uuid references public.clients(id),
  is_active boolean not null default true
);
SQL

"${PSQL[@]}" -d "$DATABASE" -f "$ROOT/supabase/migrations/20260918124936_website_enquiry_transaction.sql"
"${PSQL[@]}" -d "$DATABASE" -f "$ROOT/tests/sql/405_website_enquiry_transaction_acceptance.sql"
