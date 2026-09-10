import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const MIGRATION = readFileSync(
  new URL('../supabase/migrations/20260910180000_client_ga4_mapping.sql', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

test('creates exactly the three mapping tables the issue requires', () => {
  for (const table of ['client_ga4_properties', 'client_website_domains', 'client_cta_event_definitions']) {
    assert.match(MIGRATION, new RegExp(`create table if not exists public\\.${table}`))
  }
})

// ── no fuzzy matching / no sibling-client fallback, enforced by the database ──

test('a client can have at most one ACTIVE GA4 property', () => {
  assert.match(
    MIGRATION,
    /create unique index if not exists client_ga4_properties_one_active_per_client[\s\S]*?\(client_id\) where is_active/,
  )
})

test('a GA4 property cannot be active for two different clients', () => {
  assert.match(
    MIGRATION,
    /create unique index if not exists client_ga4_properties_property_single_client[\s\S]*?\(property_id\) where is_active/,
  )
})

test('a website domain cannot be active for two different clients', () => {
  assert.match(
    MIGRATION,
    /create unique index if not exists client_website_domains_single_client[\s\S]*?\(domain\) where is_active/,
  )
})

test('identifiers are format-constrained so a name can never be stored as a property id', () => {
  assert.match(MIGRATION, /property_id text not null check \(property_id ~ '\^\[0-9\]\{6,20\}\$'\)/)
  assert.match(MIGRATION, /measurement_id ~ '\^G-\[A-Z0-9\]\{4,20\}\$'/)
  assert.match(MIGRATION, /domain text not null check \(domain ~/)
})

// ── isolation matches the existing Google Ads model ─────────────────────────

test('every new table enables row level security', () => {
  for (const table of ['client_ga4_properties', 'client_website_domains', 'client_cta_event_definitions']) {
    assert.match(MIGRATION, new RegExp(`alter table public\\.${table} enable row level security`))
  }
})

test('base-table reads are manager-only, matching the existing google_ads_* tables', () => {
  const policies = MIGRATION.match(/create policy[\s\S]*?using \(public\.is_manager\(\)\)/g) ?? []
  assert.equal(policies.length, 3, 'each table needs a manager select policy')
  assert.doesNotMatch(MIGRATION, /using \(true\)/, 'no unrestricted policy')
})

test('client-facing access is not granted directly on the base tables', () => {
  assert.doesNotMatch(MIGRATION, /grant\s+select[\s\S]*?to\s+anon/i)
  assert.doesNotMatch(MIGRATION, /to\s+authenticated/i)
})

// ── prepared-only and additive ──────────────────────────────────────────────

test('the migration is additive: it never drops or alters an existing table', () => {
  assert.doesNotMatch(MIGRATION, /drop table/i)
  assert.doesNotMatch(MIGRATION, /drop column/i)
  assert.doesNotMatch(MIGRATION, /drop policy/i)
  // The only ALTERs permitted are enabling RLS on tables this migration itself creates.
  const alters = MIGRATION.match(/alter table [^\n;]+/gi) ?? []
  for (const statement of alters) {
    assert.match(statement, /enable row level security/i, `unexpected ALTER: ${statement}`)
  }
})

test('the migration touches no existing data', () => {
  assert.doesNotMatch(MIGRATION, /\bdelete from\b/i)
  assert.doesNotMatch(MIGRATION, /\bupdate\s+public\./i)
  assert.doesNotMatch(MIGRATION, /\binsert into\b/i)
})

test('no mapping is seeded — a property or domain must come from real provider evidence', () => {
  assert.doesNotMatch(MIGRATION, /values\s*\(/i)
  assert.match(MIGRATION, /Deliberately NO seed data/i)
})

test('the migration is marked prepared-only so it is not applied by habit', () => {
  assert.match(MIGRATION, /PREPARED ONLY — DO NOT APPLY WITHOUT CA APPROVAL/)
})

test('it is wrapped in a single transaction', () => {
  assert.match(MIGRATION, /^begin;/m)
  assert.match(MIGRATION, /^commit;/m)
})
