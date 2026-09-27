import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const DIR = join(ROOT, 'artifacts/client-strategy-dossiers/issue-513')
const SOURCE = join(DIR, 'neshora-strategy-source-snapshot.json')
const READINESS = join(DIR, 'neshora-strategy-readiness-dry-run.json')
const DOSSIER_INDEX = join(DIR, 'index.json')
const OUTPUT = join(DIR, 'neshora-strategy-amendment-dry-run.json')

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  }
  return value
}

function sha(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}

function deterministicUuid(seed) {
  const bytes = Buffer.from(createHash('sha256').update(seed).digest().subarray(0, 16))
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const source = JSON.parse(readFileSync(SOURCE, 'utf8'))
const readiness = JSON.parse(readFileSync(READINESS, 'utf8'))
const index = JSON.parse(readFileSync(DOSSIER_INDEX, 'utf8'))
const expectedId = '3c20fae1-8e91-41d5-98eb-1c331600e6e3'
const dossier = index.clients.find(client => client.id === expectedId)

if (source.write_count !== 0 || source.client?.id !== expectedId || source.client?.name !== 'Neshora Oxygen' || source.client?.active !== true) {
  throw new Error('Neshora source snapshot identity or read-only contract is invalid.')
}
if (!dossier || dossier.strategy_status !== 'ready' || dossier.blockers.length !== 0) {
  throw new Error('Neshora dossier must be review-ready before amendment.')
}

const settings = source.client.package_settings
if (settings.professional_videos_per_month !== 1 || settings.photo_posts_per_month !== 4 || settings.design_posters_per_month !== 4) {
  throw new Error('Neshora confirmed package quantities drifted.')
}
for (const field of ['reels_per_month', 'animated_posters_per_month', 'campaign_management_included', 'monthly_campaign_budget']) {
  if (settings[field] !== null) throw new Error(`Neshora unknown field ${field} must remain null.`)
}

// Exact strategy IDs from production (auto-seeded 2026-09-23)
const STRATEGY_IDS = {
  '2026-09-01': '345ff5dc-a669-4e71-8312-e11472a3494f',
  '2026-10-01': 'c4db3ace-ceed-4c8f-99cb-2841edf12613',
}

// Expected preconditions for auto-seeded draft v1 rows
const EXPECTED_PRECONDITIONS = {
  workflow_status: 'draft',
  version: 1,
  staff_amended_at: null,
  approved_at: null,
  published_at: null,
  internal_notes: null,
}

// Build proposed seed context with package verification provenance
function buildSeedContext(strategyMonth) {
  const month = strategyMonth.slice(0, 7)
  return {
    version: 2,
    origin: 'issue-513-reviewed-amendment',
    generated_at: new Date().toISOString(),
    client_id: expectedId,
    strategy_month: strategyMonth,
    sources: {
      previous_monthly_strategy_id: null,
      previous_report_id: null,
      client_package_id: null,
      deliverable_ids: [],
      client_calendar_event_ids: [],
      approved_client_context_update_ids: [],
      client_guide_id: null,
      marketing_library_skill_card_ids: [],
      marketing_library_cards: [],
      package_verification_confirmed_at: settings.verification?.confirmed_at ?? null,
      package_verification_actor_id: settings.verification?.confirmed_by_profile_id ?? null,
      package_source_references: settings.verification?.source_references ?? [],
    },
    intelligence_evidence: readiness.rows.find(r => r.strategy_month === strategyMonth)?.reviewed_intelligence_sources.map(src => ({
      authority: 'exact_client_intelligence',
      source_id: src,
      field: 'strategy',
      excerpt: src,
    })) ?? [],
    blockers: [],
    source_coverage: {
      previous_monthly_strategy: 'auto_seeded_stale',
      previous_published_report: 'none',
      monthly_deliverables: 'none',
      client_package: 'confirmed',
      company_calendar: 'none',
      approved_client_context: 'none',
      client_guide: 'none',
      marketing_library: 'none',
    },
  }
}

const rows = readiness.rows.map(row => {
  const strategyMonth = row.strategy_month
  const strategyId = STRATEGY_IDS[strategyMonth]
  const proposedStrategyData = row.proposed_strategy_data
  const proposedSeedContext = buildSeedContext(strategyMonth)

  return {
    client_id: row.client_id,
    client_name: row.client_name,
    strategy_id: strategyId,
    strategy_month: strategyMonth,
    source_evidence_hash: row.source_evidence_hash,
    precondition: {
      ...EXPECTED_PRECONDITIONS,
      current_strategy_hash: 'AUTO_SEEDED_STALE_PLACEHOLDER_HASH',
      current_seed_context_hash: 'AUTO_SEEDED_STALE_PLACEHOLDER_HASH',
    },
    disposition: 'ready_for_amendment',
    reason: 'REVIEWED_EXACT_CLIENT_INTELLIGENCE_READY_STALE_AUTO_SEED_REQUIRES_AMENDMENT',
    proposed_strategy_data: proposedStrategyData,
    proposed_strategy_hash: sha(proposedStrategyData),
    proposed_seed_context: proposedSeedContext,
    proposed_seed_context_hash: sha(proposedSeedContext),
    proposed_internal_notes: 'Amendment from auto-seeded stale draft (PACKAGE_UNVERIFIED blockers) to reviewed exact-client intelligence per Issue #513. No approval or publication in this change.',
    safe_next_action: 'Preflight this amendment against live production row preconditions, then apply via amend_monthly_client_strategy_with_context RPC with deterministic idempotency key.',
    reviewed_intelligence_sources: row.reviewed_intelligence_sources,
    package: row.package,
    unavailable_evidence: row.unavailable_evidence,
  }
})

const core = {
  schema_version: 2,
  issue: 513,
  mode: 'dry_run',
  write_count: 0,
  preserves_reviewed_plan_hash: '4f84133b981aa449b0805fc11424c06f8acb2ec73b72cedcc0795a83502fef6b',
  source_snapshot_hash: sha(source),
  counts: { blocked: 0, ready_for_amendment: 2 },
  rows,
}
const output = { ...core, plan_hash: sha(core) }
writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({ output: OUTPUT, plan_hash: output.plan_hash, ...output.counts }, null, 2)}\n`)