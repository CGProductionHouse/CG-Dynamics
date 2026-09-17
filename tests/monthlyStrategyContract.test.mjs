import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const migration = read('../supabase/migrations/20260917173138_canonical_monthly_client_strategy.sql')
const runtime = read('../src/lib/monthlyStrategy.ts')
const contract = read('../docs/canonical-monthly-client-strategy.md')

function functionDefinition(signatureStart) {
  const start = migration.indexOf(signatureStart)
  assert.notEqual(start, -1, `Missing function: ${signatureStart}`)
  const end = migration.indexOf('\n$$;', start)
  assert.notEqual(end, -1, `Unterminated function: ${signatureStart}`)
  return migration.slice(start, end + 4)
}

test('one canonical strategy is owned by an exact client and first-of-month target', () => {
  assert.match(migration, /unique \(client_id, strategy_month\)/)
  assert.match(migration, /strategy_month = date_trunc\('month', strategy_month\)::date/)
  assert.match(migration, /client_id uuid not null references public\.clients\(id\) on delete restrict/)
})

test('seed is idempotent and never overwrites an existing staff-owned strategy', () => {
  const seed = functionDefinition('create or replace function public.seed_monthly_client_strategy(')
  const existingGuard = seed.indexOf('if v_strategy.id is not null then')
  const insert = seed.indexOf('insert into public.monthly_client_strategies')
  assert.ok(existingGuard > 0 && existingGuard < insert)
  assert.doesNotMatch(seed, /update public\.monthly_client_strategies/)
  assert.match(seed, /pg_advisory_xact_lock/)
  assert.match(seed, /'replayed', true, 'created', false/)
})

test('historical report strategy can seed only an unambiguous later target month', () => {
  const seed = functionDefinition('create or replace function public.seed_monthly_client_strategy(')
  assert.match(seed, /report\.client_id = p_client_id/)
  assert.match(seed, /report\.period_end < p_strategy_month/)
  assert.match(migration, /seeded_from_report_id uuid references public\.reports\(id\)/)
  assert.match(contract, /`reports\.strategy_data` remains historical report evidence/)
})

test('staff amendments are optimistic, durable, retry-safe and preserve the published snapshot', () => {
  const amend = functionDefinition('create or replace function public.amend_monthly_client_strategy(')
  assert.match(amend, /p_expected_version <> v_strategy\.version/)
  assert.match(amend, /Strategy version conflict/)
  assert.match(amend, /revision\.idempotency_key = p_idempotency_key/)
  assert.match(amend, /request_fingerprint <> v_fingerprint/)
  assert.match(amend, /before_strategy_data, after_strategy_data/)
  assert.match(amend, /workflow_status = 'draft'/)
  assert.doesNotMatch(amend, /published_strategy_data\s*=/)
  assert.match(migration, /monthly_client_strategy_revisions is append-only/)
})

test('client projection is exact-client, published-only and field-whitelisted', () => {
  const projection = functionDefinition('create or replace function public.client_monthly_strategy(')
  const publish = functionDefinition('create or replace function public.transition_monthly_client_strategy(')
  assert.match(publish, /public\.client_safe_strategy_data\(strategy_data\)/)
  assert.match(projection, /profile\.id = auth\.uid\(\).*profile\.role = 'client'/s)
  assert.match(projection, /strategy\.client_id = v_client_id/)
  assert.match(projection, /strategy\.strategy_month = p_strategy_month/)
  assert.match(projection, /strategy\.published_strategy_data is not null/)
  assert.doesNotMatch(projection, /internal_notes|seed_context|actor_profile_id|strategy\.id/)
})

test('direct writes are closed and future assistant writes retain an effective staff actor', () => {
  const actor = functionDefinition('create or replace function public.resolve_monthly_strategy_actor(')
  assert.match(migration, /revoke all on public\.monthly_client_strategies from anon, authenticated/)
  assert.match(migration, /grant select on public\.monthly_client_strategies to authenticated/)
  assert.match(actor, /auth\.jwt\(\)->>'role'.*= 'service_role'/s)
  assert.match(actor, /profile\.id = v_actor_id/)
  assert.match(actor, /profile\.is_active/)
  assert.match(actor, /profile\.role in \('admin', 'manager', 'staff', 'team'\)/)
  assert.match(migration, /p_client_id uuid,[\s\S]*p_strategy_month date,[\s\S]*p_idempotency_key uuid/)
})

test('automatic baseline reuses the existing strategy engine and calendar authority', () => {
  assert.match(runtime, /from '\.\/contentCalendar'/)
  assert.match(runtime, /getMonthEvents\(month\)/)
  assert.match(runtime, /from '\.\/strategyEngine'/)
  assert.match(runtime, /readStrategyData\(previousRaw\)/)
  assert.match(runtime, /generateActionPlan/)
  assert.match(runtime, /generateStrategyGoingForward/)
  assert.doesNotMatch(runtime, /Heritage Day|Christmas Day|Good Friday|Family Day/)
  assert.match(runtime, /\.slice\(0, 3\)/)
  assert.match(runtime, /selected: selectedIds\.has\(event\.id\)/)
})

test('seed context exposes considered and selected calendar evidence without creating another schedule', () => {
  assert.match(runtime, /authority: 'content_calendar'/)
  assert.match(runtime, /authority: 'company_calendar'/)
  assert.match(runtime, /calendar_events: calendar\.audit/)
  assert.match(runtime, /\.from\('monthly_deliverables'\)/)
  assert.match(runtime, /\.from\('company_calendar_events'\)/)
  assert.doesNotMatch(migration, /create table public\.(company_calendar_events|monthly_deliverables)/)
})
