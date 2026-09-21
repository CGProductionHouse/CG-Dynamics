import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = relativePath => readFileSync(new URL(relativePath, import.meta.url), 'utf8')
const migration = read('../supabase/migrations/20260801190000_client_report_safe_projection.sql')
const reports = read('../src/lib/db/reports.ts')
const manualMetrics = read('../src/lib/db/manualMetrics.ts')
const dashboard = read('../src/pages/client/Dashboard.tsx')
const portalHome = read('../src/pages/client/ClientPortalHome.tsx')
const strategyPage = read('../src/pages/client/ClientStrategyPage.tsx')
const campaignsPage = read('../src/pages/client/ClientCampaignsPage.tsx')

function functionDefinition(name) {
  const start = migration.indexOf(`create or replace function public.${name}`)
  assert.notEqual(start, -1, `${name} must exist`)
  const next = migration.indexOf('\ncreate or replace function public.', start + 1)
  return migration.slice(start, next === -1 ? migration.length : next)
}

test('migration removes client SELECT policies from every report base table', () => {
  assert.match(migration, /drop policy if exists "reports: client reads own published" on public\.reports/)
  assert.match(migration, /drop policy if exists "posts: client reads own published" on public\.posts/)
  assert.match(migration, /drop policy if exists "manual_platform_metrics: client reads own" on public\.manual_platform_metrics/)
})

test('legacy Meta exclusion identifiers are callable only after a staff check', () => {
  const definition = functionDefinition('get_report_content_exclusions(p_report_id uuid)')
  assert.match(definition, /if not public\.is_staff\(\)[\s\S]*?then/)
  assert.match(definition, /raise exception 'Staff access required'/)
  assert.match(definition, /profile\.is_active/)
  assert.match(definition, /profile\.role in \('admin', 'manager', 'staff', 'team'\)/)
})

test('published report projection has an explicit safe allowlist', () => {
  const definition = functionDefinition('client_published_reports()')
  assert.match(definition, /r\.status = 'published'/)
  assert.match(definition, /r\.client_id = public\.my_client_id\(\)/)
  assert.match(definition, /profile\.is_active/)
  assert.match(definition, /profile\.role = 'client'/)
  assert.match(definition, /client_safe_strategy_data\(r\.strategy_data\)/)
  for (const forbidden of ['created_by', 'general_notes', 'ai_draft', 'best_poster_post_id', 'best_video_post_id']) {
    assert.doesNotMatch(definition, new RegExp(`\\b${forbidden}\\b`))
  }
})

test('client projections require active client profiles and strip nested strategy IDs', () => {
  for (const name of [
    'client_published_reports()',
    'client_published_report_posts(p_report_id uuid)',
    'client_published_report_manual_metrics(p_report_id uuid)',
  ]) {
    const definition = functionDefinition(name)
    assert.match(definition, /profile\.is_active/)
    assert.match(definition, /profile\.role = 'client'/)
    assert.match(definition, /Active client access required/)
  }
  const sanitizer = functionDefinition('client_safe_strategy_data(p_data jsonb)')
  assert.match(sanitizer, /'calendarSelections'/)
  assert.match(sanitizer, /'title'/)
  assert.match(sanitizer, /'date'/)
  assert.match(sanitizer, /'use'/)
  assert.match(sanitizer, /'note'/)
  assert.doesNotMatch(sanitizer, /eventId|event_id/)
})

test('post projection derives display metrics without exposing raw or provider IDs', () => {
  const definition = functionDefinition('client_published_report_posts(p_report_id uuid)')
  assert.match(definition, /r\.status = 'published'/)
  assert.match(definition, /v_client_id is distinct from public\.my_client_id\(\)/)
  assert.doesNotMatch(definition.slice(0, definition.indexOf('as $$')), /\b(raw|meta_post_id|post_id|report_id|created_at)\b/)
  assert.doesNotMatch(definition, /select\s+p\.id\b/i)
  assert.doesNotMatch(definition, /select\s+p\.meta_post_id\b/i)
})

test('manual projection is report-bound and omits every unapproved note field', () => {
  const definition = functionDefinition('client_published_report_manual_metrics(p_report_id uuid)')
  assert.match(definition, /r\.status = 'published'/)
  assert.match(definition, /v_client_id is distinct from public\.my_client_id\(\)/)
  const signature = definition.slice(0, definition.indexOf('as $$'))
  for (const forbidden of ['general_notes', 'top_content_notes', 'content_type_split_notes', 'created_by', 'client_id', 'id']) {
    assert.doesNotMatch(signature, new RegExp(`\\b${forbidden}\\b`))
  }
})

test('safe RPC execution is authenticated-only', () => {
  for (const signature of [
    'client_published_reports\\(\\)',
    'client_published_report_posts\\(uuid\\)',
    'client_published_report_manual_metrics\\(uuid\\)',
  ]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${signature} from public, anon`))
    assert.match(migration, new RegExp(`grant execute on function public\\.${signature} to authenticated`))
  }
})

test('client loaders use only safe report projections while staff helpers keep base access', () => {
  assert.match(reports, /supabase\.rpc\('client_published_reports'\)/)
  assert.match(reports, /\.rpc\('client_published_report_posts'/)
  assert.match(manualMetrics, /supabase\.rpc\('client_published_report_manual_metrics'/)
  assert.match(reports, /export async function listReports\(\)[\s\S]*?\.from\('reports'\)/)
  assert.match(reports, /export async function getReportWithPosts[\s\S]*?\.from\('reports'\)[\s\S]*?\.from\('posts'\)/)

  for (const source of [dashboard, portalHome, strategyPage, campaignsPage]) {
    assert.doesNotMatch(source, /listPublishedReportsForClient|getReportWithPosts|listManualMetricsForClientMonth/)
  }
  assert.doesNotMatch(dashboard, /loadReportContentExclusions/)
})

test('client dashboard discards stale profile, client, and report requests and fails closed', () => {
  assert.match(dashboard, /const reportsRequestRef = useRef\(0\)/)
  assert.match(dashboard, /const reportRequestRef = useRef\(0\)/)
  assert.match(dashboard, /requestedProfileId = profile\?\.id \?\? null/)
  assert.match(dashboard, /requestedClientId = profile\?\.client_id \?\? null/)
  assert.match(dashboard, /requestedReportId = selectedReportId/)
  assert.match(dashboard, /if \(!requestIsCurrent\(\)\) return/)
  assert.match(dashboard, /if \(error \|\| clientRes\.error \|\| !clientRes\.data\)/)
  assert.match(dashboard, /setReport\(null\)[\s\S]*Verified reporting data could not be loaded safely/)
})
