import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FLEET_PLAN = resolve(ROOT, 'artifacts/client-strategy-dossiers/issue-513/sep-oct-strategy-mutation-dry-run.json')
const NESHORA_PLAN = resolve(ROOT, 'artifacts/client-strategy-dossiers/issue-513/neshora-strategy-readiness-dry-run.json')
const GOLD_FIELDS = [
  'objective', 'audienceAndIntent', 'coreMessage', 'formatsAndRationale', 'testAndChange',
  'pillarsAndHooks', 'mustAvoid', 'channelIntegration', 'successSignals', 'nextMonthGamePlan',
]
const GENERIC_FILLER = [
  /\bincrease engagement\b/i,
  /\bbuild (?:brand )?awareness\b/i,
  /\bpost consistently\b/i,
  /\bgrow social media\b/i,
  /\bcreate engaging content\b/i,
  /\bconnect with (?:the|our) audience\b/i,
]
const INTERNAL_OR_NON_STRATEGY_COPY = [
  /\bCGProductionHouse\//i,
  /\b(?:github|repository|repo)\b/i,
  /\b(?:source[_ -]?reference|source[_ -]?id|evidence[_ -]?label|confidence[_ -]?level|seed[_ -]?context)\b/i,
  /\b(?:verified facts?|exact-client evidence|evidence dossier|research dossier|source pack)\b/i,
  /\bPublished-content record:/i,
  /\bCorrect facts are only the starting point\b/i,
  /(?:^|[\\/])(?:docs|sources|artifacts)[\\/]/i,
  /\.(?:md|pdf|json)\b/i,
]
const ACTION_PACKAGE_FIELDS = {
  professional_video: 'professional_videos_per_month',
  reels: 'reels_per_month',
  photo_content: 'photo_posts_per_month',
  design_poster: 'design_posters_per_month',
  animated_poster: 'animated_posters_per_month',
}

export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  }
  return value
}

export function sha(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}

function selectReviewedFields(value, reviewedValue) {
  return Object.fromEntries(Object.keys(reviewedValue).map(key => [
    key,
    reviewedValue[key] && typeof reviewedValue[key] === 'object' && !Array.isArray(reviewedValue[key])
      ? selectReviewedFields(value?.[key] ?? {}, reviewedValue[key])
      : value?.[key],
  ]))
}

function deterministicUuid(seed) {
  const bytes = Buffer.from(createHash('sha256').update(seed).digest().subarray(0, 16))
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function normalizedText(value) {
  return String(value ?? '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim()
}

export function auditStrategyRow({ row, client, reviewed, allClients }) {
  const errors = []
  const strategyText = JSON.stringify(row.strategy_data)
  const provenanceText = JSON.stringify(row.seed_context)
  const combinedNormalized = normalizedText(`${strategyText} ${provenanceText}`)

  if (row.client_id !== client.id || reviewed.client_id !== client.id) errors.push('EXACT_CLIENT_ID_MISMATCH')
  if (row.strategy_month !== reviewed.strategy_month) errors.push('EXACT_MONTH_MISMATCH')
  if (row.workflow_status !== 'draft' || row.approved_at || row.published_at || row.published_strategy_data) errors.push('NOT_UNPUBLISHED_DRAFT')
  if (Number(row.version) !== 2 || !row.staff_amended_at) errors.push('NOT_AMENDED_V2')
  if (row.seed_context?.client_id !== row.client_id || row.seed_context?.strategy_month !== row.strategy_month) errors.push('PROVENANCE_SCOPE_MISMATCH')

  const verification = client.package_settings?.verification
  if (verification?.status !== 'confirmed' || ![1, 2].includes(Number(verification?.version))) errors.push('PACKAGE_NOT_CONFIRMED')
  if (row.seed_context?.sources?.package_verification_confirmed_at !== verification?.confirmed_at) errors.push('PACKAGE_TIMESTAMP_MISMATCH')
  if (row.seed_context?.sources?.package_verification_actor_id !== verification?.confirmed_by_profile_id) errors.push('PACKAGE_ACTOR_MISMATCH')
  if (JSON.stringify(row.seed_context?.sources?.package_source_references ?? null) !== JSON.stringify(verification?.source_references ?? null)) errors.push('PACKAGE_REFERENCES_MISMATCH')

  const reviewedLiveStrategy = reviewed.strategy_match_mode === 'selected_fields'
    ? selectReviewedFields(row.strategy_data, reviewed.strategy_data)
    : row.strategy_data
  const strategyMatchesReview = sha(reviewedLiveStrategy) === reviewed.strategy_hash
  if (!strategyMatchesReview) errors.push('REVIEWED_STRATEGY_HASH_MISMATCH')
  if (reviewed.seed_context_hash && sha(row.seed_context) !== reviewed.seed_context_hash) errors.push('REVIEWED_PROVENANCE_HASH_MISMATCH')
  if (row.seed_context?.sources?.issue_513_evidence_hash !== reviewed.source_evidence_hash) errors.push('REVIEWED_EVIDENCE_HASH_MISMATCH')

  const gold = row.strategy_data?.goldStandard
  for (const field of GOLD_FIELDS) {
    const value = typeof gold?.[field] === 'string' ? gold[field].trim() : ''
    if (value.length < 20) errors.push(`GOLD_FIELD_INCOMPLETE:${field}`)
  }
  if (GENERIC_FILLER.some(pattern => pattern.test(strategyText))) errors.push('GENERIC_FILLER_DETECTED')
  if (INTERNAL_OR_NON_STRATEGY_COPY.some(pattern => pattern.test(strategyText))) errors.push('INTERNAL_OR_NON_STRATEGY_COPY')

  for (const [action, packageField] of Object.entries(ACTION_PACKAGE_FIELDS)) {
    const expected = Number.isInteger(client.package_settings?.[packageField]) && client.package_settings[packageField] > 0
    if (row.strategy_data?.actionPlan?.[action]?.enabled !== expected) errors.push(`PACKAGE_ACTION_MISMATCH:${action}`)
  }
  const campaignExpected = client.package_settings?.campaign_management_included === true
  if (row.strategy_data?.actionPlan?.campaign_recommendation?.enabled !== campaignExpected) errors.push('PACKAGE_ACTION_MISMATCH:campaign_recommendation')

  const foreignClientIds = allClients.filter(other => other.id !== client.id && provenanceText.includes(other.id)).map(other => other.id)
  if (foreignClientIds.length) errors.push(`FOREIGN_CLIENT_IDS:${foreignClientIds.join(',')}`)
  const foreignClientNames = allClients
    .filter(other => other.id !== client.id && normalizedText(other.name).length >= 7)
    .filter(other => combinedNormalized.includes(normalizedText(other.name)))
    .map(other => other.name)
  if (foreignClientNames.length && (!strategyMatchesReview || reviewed.strategy_match_mode !== 'exact')) {
    errors.push(`FOREIGN_CLIENT_NAMES:${foreignClientNames.join(',')}`)
  }

  return {
    errors,
    strategy_hash: sha(row.strategy_data),
    seed_context_hash: sha(row.seed_context),
    package_verification_version: verification?.version ?? null,
    reviewed_boundary_references: strategyMatchesReview && reviewed.strategy_match_mode === 'exact' ? foreignClientNames : [],
  }
}

export function buildManifest({ liveRows, clients, fleetPlan, neshoraPlan, auditedAt }) {
  const clientsById = new Map(clients.map(client => [client.id, client]))
  const reviewed = [
    ...fleetPlan.rows.filter(row => row.disposition === 'ready').map(row => ({
      client_id: row.client_id,
      client_name: row.client_name,
      strategy_id: row.strategy_id,
      strategy_month: row.strategy_month,
      strategy_hash: row.proposed_strategy_hash,
      strategy_data: row.proposed_strategy_data,
      strategy_match_mode: 'exact',
      seed_context_hash: row.proposed_seed_context_hash,
      source_evidence_hash: row.source_evidence_hash,
      reviewed_plan_hash: fleetPlan.plan_hash,
    })),
    ...neshoraPlan.rows.map(row => ({
      client_id: row.client_id,
      client_name: row.client_name,
      strategy_id: null,
      strategy_month: row.strategy_month,
      strategy_hash: sha(row.proposed_strategy_data),
      strategy_data: row.proposed_strategy_data,
      strategy_match_mode: 'selected_fields',
      seed_context_hash: null,
      source_evidence_hash: row.source_evidence_hash,
      reviewed_plan_hash: neshoraPlan.plan_hash,
    })),
  ]
  const reviewedByIdentity = new Map(reviewed.map(row => [`${row.client_id}:${row.strategy_month}`, row]))
  const manifestRows = []
  const globalErrors = []

  if (reviewed.length !== 94 || new Set(reviewed.map(row => row.client_id)).size !== 47) globalErrors.push('REVIEWED_PARTITION_NOT_94_ROWS_47_CLIENTS')
  if (liveRows.length !== 114) globalErrors.push(`LIVE_ROW_COUNT_NOT_114:${liveRows.length}`)

  for (const row of liveRows.filter(item => item.staff_amended_at != null)) {
    const identity = `${row.client_id}:${row.strategy_month}`
    const client = clientsById.get(row.client_id)
    const review = reviewedByIdentity.get(identity)
    if (!client || !review) {
      globalErrors.push(`UNREVIEWED_AMENDED_ROW:${identity}`)
      continue
    }
    if (review.strategy_id && review.strategy_id !== row.id) globalErrors.push(`STRATEGY_ID_MISMATCH:${identity}`)
    const audit = auditStrategyRow({ row, client, reviewed: review, allClients: clients })
    manifestRows.push({
      client_id: client.id,
      client_name: client.name,
      strategy_id: row.id,
      strategy_month: row.strategy_month,
      current_version: row.version,
      current_status: row.workflow_status,
      strategy_hash: audit.strategy_hash,
      seed_context_hash: audit.seed_context_hash,
      source_evidence_hash: review.source_evidence_hash,
      reviewed_plan_hash: review.reviewed_plan_hash,
      package_verification_version: audit.package_verification_version,
      reviewed_boundary_references: audit.reviewed_boundary_references,
      audit_status: audit.errors.length === 0 ? 'ready_for_human_approval' : 'blocked',
      audit_errors: audit.errors,
      approval_transition: {
        client_id: client.id,
        strategy_month: row.strategy_month,
        expected_version: row.version,
        target_status: 'approved',
        idempotency_key: deterministicUuid(`strategy-approval:${row.id}:${audit.strategy_hash}`),
      },
      publication_transition_after_separate_review: {
        client_id: client.id,
        strategy_month: row.strategy_month,
        expected_version: row.version,
        target_status: 'published',
        idempotency_key: deterministicUuid(`strategy-publication:${row.id}:${audit.strategy_hash}`),
      },
    })
  }

  manifestRows.sort((left, right) => left.client_name.localeCompare(right.client_name) || left.strategy_month.localeCompare(right.strategy_month))
  const nonApplicable = liveRows.filter(row => row.staff_amended_at == null)
  if (manifestRows.length !== 94) globalErrors.push(`AMENDED_ROW_COUNT_NOT_94:${manifestRows.length}`)
  if (nonApplicable.length !== 20) globalErrors.push(`NON_APPLICABLE_ROW_COUNT_NOT_20:${nonApplicable.length}`)
  const blocked = manifestRows.filter(row => row.audit_status === 'blocked')
  if (blocked.length) globalErrors.push(`BLOCKED_REVIEWED_ROWS:${blocked.length}`)

  const core = {
    schema_version: 1,
    issue: 513,
    mode: 'read_only_approval_publication_manifest',
    generated_at: auditedAt,
    write_count: 0,
    authority: {
      fleet_plan_hash: fleetPlan.plan_hash,
      neshora_plan_hash: neshoraPlan.plan_hash,
    },
    counts: {
      canonical_sep_oct_rows: liveRows.length,
      reviewed_amended_v2_rows: manifestRows.length,
      reviewed_clients: new Set(manifestRows.map(row => row.client_id)).size,
      non_applicable_unamended_v1_rows: nonApplicable.length,
      ready_for_human_approval: manifestRows.filter(row => row.audit_status === 'ready_for_human_approval').length,
      blocked: blocked.length,
      approved: liveRows.filter(row => row.approved_at != null).length,
      published: liveRows.filter(row => row.published_at != null).length,
    },
    audit_errors: globalErrors,
    execution_gate: 'This manifest is evidence only. Approval and publication are separate protected actions and were not performed.',
    rows: manifestRows,
  }
  return { ...core, manifest_hash: sha(core) }
}

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for this read-only audit.')
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: clients, error: clientError } = await supabase.from('clients').select('id,name,active,package_settings').eq('active', true)
  if (clientError) throw new Error(`client read failed: ${clientError.message}`)
  const { data: liveRows, error: strategyError } = await supabase
    .from('monthly_client_strategies')
    .select('id,client_id,strategy_month,workflow_status,version,staff_amended_at,approved_at,published_at,published_strategy_data,strategy_data,seed_context')
    .in('strategy_month', ['2026-09-01', '2026-10-01'])
  if (strategyError) throw new Error(`strategy read failed: ${strategyError.message}`)

  const fleetPlan = JSON.parse(readFileSync(FLEET_PLAN, 'utf8'))
  const neshoraPlan = JSON.parse(readFileSync(NESHORA_PLAN, 'utf8'))
  const manifest = buildManifest({ liveRows: liveRows ?? [], clients: clients ?? [], fleetPlan, neshoraPlan, auditedAt: new Date().toISOString() })
  const outputIndex = process.argv.indexOf('--output')
  if (outputIndex >= 0) writeFileSync(resolve(process.argv[outputIndex + 1]), `${JSON.stringify(manifest, null, 2)}\n`)
  process.stdout.write(`${JSON.stringify({ ...manifest.counts, manifest_hash: manifest.manifest_hash, audit_errors: manifest.audit_errors }, null, 2)}\n`)
  if (manifest.audit_errors.length) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main()
