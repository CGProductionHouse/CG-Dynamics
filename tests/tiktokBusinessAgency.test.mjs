import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const readSource = path => readFileSync(resolve(testDir, '..', path), 'utf8')

const MIGRATION = readSource('supabase/migrations/20260908184657_tiktok_business_agency_foundation.sql')
const SHARED = readSource('supabase/functions/_shared/tiktok-business.ts')
const STATUS = readSource('supabase/functions/tiktok-business-connection-status/index.ts')
const SCHEDULE = readSource('supabase/functions/tiktok-business-schedule/index.ts')
const FRONTEND = readSource('src/lib/tiktokBusiness.ts')
const PAGE = readSource('src/pages/admin/TikTokIntegrationPage.tsx')
const HANDOFF = readSource('docs/integrations/TIKTOK-BUSINESS-AGENCY-ROLLOUT-HANDOFF.md')

describe('TikTok Business provider separation', () => {
  it('uses the API for Business v1.3 contract without altering consumer API helpers', () => {
    assert.match(SHARED, /https:\/\/business-api\.tiktok\.com\/open_api\/v1\.3/)
    assert.doesNotMatch(SHARED, /open\.tiktokapis\.com\/v2\/post\/publish/)
    assert.match(HANDOFF, /Organic API, and Accounts API/)
    assert.match(PAGE, /separate TikTok API for Business \/ Organic Accounts API connection/)
  })

  it('keeps provider publishing fail closed behind a dedicated flag', () => {
    assert.match(SHARED, /TIKTOK_BUSINESS_PUBLISHING_ENABLED/)
    assert.match(SHARED, /=== 'true'/)
    assert.match(STATUS, /providerEligible && tiktokBusinessPublishingEnabled\(\)/)
  })
})

describe('exact-client authorization boundaries', () => {
  it('reuses the canonical TikTok connection instead of creating another client mapping', () => {
    assert.match(MIGRATION, /connection_id uuid not null unique references public\.tiktok_connections/)
    assert.match(MIGRATION, /guard_tiktok_business_client_mapping/)
    assert.match(MIGRATION, /connection\.client_id = new\.client_id/)
    assert.match(SHARED, /eq\('client_id', clientId\)/)
    assert.match(SHARED, /eq\('tiktok_connections\.client_id', clientId\)/)
  })

  it('keeps account tokens and OAuth state server only', () => {
    assert.match(MIGRATION, /alter table public\.tiktok_business_authorization_tokens enable row level security/)
    assert.match(MIGRATION, /alter table public\.tiktok_business_oauth_states enable row level security/)
    assert.doesNotMatch(MIGRATION, /policy[^;]+tiktok_business_authorization_tokens/is)
    assert.doesNotMatch(MIGRATION, /policy[^;]+tiktok_business_oauth_states/is)
    assert.doesNotMatch(FRONTEND, /access_token|refresh_token/)
  })

  it('only exposes safe authorization metadata to managers', () => {
    assert.match(MIGRATION, /tiktok business authorization manager read/)
    assert.match(MIGRATION, /using \(public\.is_manager\(\)\)/)
    assert.doesNotMatch(STATUS, /business_open_id|last_error_message|last_error_code/)
  })
})

describe('canonical Client Schedule publishing', () => {
  it('links every job to monthly_deliverables and an immutable review version', () => {
    assert.match(MIGRATION, /monthly_deliverable_id uuid not null references public\.monthly_deliverables/)
    assert.match(MIGRATION, /content_review_version_id uuid not null references public\.content_review_versions/)
    assert.match(MIGRATION, /unique \(authorization_id, monthly_deliverable_id, content_review_version_id\)/)
    assert.doesNotMatch(MIGRATION, /create table public\.[a-z_]*(calendar|schedule)/i)
  })

  it('requires the exact current approval, client, channel and schedule date', () => {
    assert.match(MIGRATION, /v_review\.client_id is distinct from v_deliverable\.client_id/)
    assert.match(MIGRATION, /v_review\.scheduled_date is distinct from v_deliverable\.scheduled_date/)
    assert.match(MIGRATION, /'tiktok' = any\(v_review\.channels\)/)
    assert.match(MIGRATION, /v_review\.internal_approved_at is null/)
    assert.match(MIGRATION, /v_review\.client_approval_required and v_review\.client_approved_at is null/)
  })

  it('claims due jobs with locking and revalidates all cross-client boundaries', () => {
    assert.match(MIGRATION, /for update of job skip locked/)
    assert.match(MIGRATION, /coalesce\(job\.next_attempt_at, job\.due_at\) <= now\(\)/)
    assert.match(MIGRATION, /deliverable\.client_id = job\.client_id/)
    assert.match(MIGRATION, /review\.client_id = job\.client_id/)
    assert.match(MIGRATION, /authorization\.client_id = job\.client_id/)
  })

  it('marks the canonical deliverable posted only after a public post id is supplied', () => {
    const postIdGuard = MIGRATION.indexOf("raise exception 'TikTok public post id is required'")
    const scheduleUpdate = MIGRATION.indexOf("set production_status = 'posted', posted_at = now()")
    assert.ok(postIdGuard >= 0)
    assert.ok(scheduleUpdate > postIdGuard)
    assert.match(MIGRATION, /and production_status = 'scheduled'/)
  })

  it('schedule endpoint accepts only the canonical deliverable id', () => {
    assert.match(SCHEDULE, /monthlyDeliverableId/)
    assert.match(SCHEDULE, /queue_tiktok_business_publish/)
    assert.doesNotMatch(SCHEDULE, /caption|assetPath|videoUrl|clientId/)
  })
})

describe('admin rollout truth', () => {
  it('does not present agency publishing as active without provider eligibility and rollout', () => {
    assert.match(PAGE, /Connected — rollout off/)
    assert.match(PAGE, /This account cannot publish from Dynamics yet/)
    assert.match(PAGE, /never stores TikTok passwords/)
  })

  it('does not invent an OAuth URL before the approved app exposes it', () => {
    assert.doesNotMatch(SHARED, /marketing_api\/auth/)
    assert.match(HANDOFF, /exact TikTok account holder authorization URL.*not guessed/is)
  })
})
