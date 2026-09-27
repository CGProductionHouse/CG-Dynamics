import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

function option(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

const DEFAULT_MANIFEST = 'artifacts/client-strategy-dossiers/issue-513/approval-readiness-manifest.json'
const manifestPath = resolve(option('--manifest') ?? DEFAULT_MANIFEST)
const expectedCombinedHash = option('--expected-combined-hash')
const preflightOnly = true // Always dry-run for approval readiness

if (!expectedCombinedHash) {
  throw new Error('--expected-combined-hash <reviewed combined hash> is required.')
}

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  throw new Error('SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required.')
}

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

function sameNullable(left, right) {
  return (left ?? null) === (right ?? null)
}

function deterministicUuid(seed) {
  const bytes = Buffer.from(createHash('sha256').update(seed).digest().subarray(0, 16))
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

// Verify manifest integrity
const manifestCore = Object.fromEntries(Object.entries(manifest).filter(([key]) => key !== 'combined_plan_hash'))
if (sha(manifestCore) !== manifest.combined_plan_hash) {
  throw new Error(`Manifest integrity failure: embedded=${manifest.combined_plan_hash} actual=${sha(manifestCore)}`)
}
if (expectedCombinedHash !== manifest.combined_plan_hash) {
  throw new Error(`Reviewed combined hash mismatch: expected=${expectedCombinedHash} actual=${manifest.combined_plan_hash}`)
}
if (manifest.schema_version !== 1 || manifest.mode !== 'zero_write_approval_readiness' || manifest.issue !== 556) {
  throw new Error('Only schema-v1 zero-write Issue #556 approval readiness manifests are accepted.')
}

// Extract all 94 reviewed v2 strategy IDs
const fleetReadyIds = manifest.reviewed_v2_rows.fleet_ready_92.map(r => r.strategy_id)
const neshoraIds = manifest.reviewed_v2_rows.neshora_2.map(r => r.strategy_id)
const allReviewedV2Ids = [...fleetReadyIds, ...neshoraIds]
const nonApplicableIds = manifest.non_applicable_v1_rows_excluded.map(r => r.strategy_id)

if (allReviewedV2Ids.length !== 94) throw new Error(`Expected 94 reviewed v2 IDs, got ${allReviewedV2Ids.length}`)
if (nonApplicableIds.length !== 20) throw new Error(`Expected 20 non-applicable IDs, got ${nonApplicableIds.length}`)
if (new Set(allReviewedV2Ids).size !== 94) throw new Error('Duplicate reviewed v2 strategy IDs detected')
if (new Set(nonApplicableIds).size !== 20) throw new Error('Duplicate non-applicable strategy IDs detected')

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

async function fetchStrategies(ids) {
  const output = []
  const size = 200
  for (let index = 0; index < ids.length; index += size) {
    const slice = ids.slice(index, index + size)
    const { data, error } = await supabase
      .from('monthly_client_strategies')
      .select('id,client_id,strategy_month,workflow_status,version,updated_at,staff_amended_at,approved_at,published_at,strategy_data,seed_context,internal_notes')
      .in('id', slice)
    if (error) throw new Error(`Strategy read failed: ${error.message}`)
    output.push(...(data ?? []))
  }
  return output
}

function isApprovalReadyPrecondition(row, live, manifestRow) {
  // Verify exact frozen precondition from amendment completion
  const p = manifestRow.preconditions || manifestRow.immutable_preconditions?.preconditions
  return live.id === row.strategy_id
    && live.client_id === row.client_id
    && live.strategy_month === row.strategy_month
    && live.workflow_status === 'draft'
    && Number(live.version) === 2
    && live.staff_amended_at != null
    && live.approved_at == null
    && live.published_at == null
    && sha(live.strategy_data) === (manifestRow.immutable_preconditions?.strategy_hash || row.proposed_strategy_hash)
    && sha(live.seed_context) === (manifestRow.immutable_preconditions?.seed_context_hash || row.proposed_seed_context_hash)
    && sameNullable(live.internal_notes, manifestRow.proposed_internal_notes ?? null)
}

function isNonApplicableUnchanged(row, live) {
  return live.id === row.strategy_id
    && live.client_id === row.client_id
    && live.strategy_month === row.strategy_month
    && live.workflow_status === 'draft'
    && Number(live.version) === 1
    && live.staff_amended_at == null
    && live.approved_at == null
    && live.published_at == null
}

async function verifyGoldStandardCompleteness(liveRow) {
  const gold = liveRow.strategy_data?.goldStandard
  if (!gold || typeof gold !== 'object') return { ok: false, reason: 'missing goldStandard object' }
  for (const field of GOLD_STANDARD_FIELDS) {
    const value = gold[field]
    if (!value || typeof value !== 'string' || value.trim().length < 20) {
      return { ok: false, reason: `goldStandard.${field} missing or too short (${value?.length ?? 0} chars)` }
    }
    const normalized = value.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
    if (['increase engagement', 'build awareness', 'build brand awareness', 'post consistently', 'grow social media', 'create engaging content'].includes(normalized)) {
      return { ok: false, reason: `goldStandard.${field} is generic filler` }
    }
  }
  return { ok: true }
}

const GOLD_STANDARD_FIELDS = [
  'objective', 'audienceAndIntent', 'coreMessage', 'formatsAndRationale',
  'testAndChange', 'pillarsAndHooks', 'mustAvoid', 'channelIntegration',
  'successSignals', 'nextMonthGamePlan',
]

const allPlanIds = [...allReviewedV2Ids, ...nonApplicableIds]
const liveBefore = await fetchStrategies(allPlanIds)
const liveById = new Map(liveBefore.map(row => [row.id, row]))

if (liveById.size !== allPlanIds.length) {
  throw new Error(`Live strategy count mismatch: expected ${allPlanIds.length}, found ${liveById.size}.`)
}

// Build lookup maps for manifest rows
const fleetReadyById = new Map(manifest.reviewed_v2_rows.fleet_ready_92.map(r => [r.strategy_id, r]))
const neshoraById = new Map(manifest.reviewed_v2_rows.neshora_2.map(r => [r.strategy_id, r]))
const nonApplicableById = new Map(manifest.non_applicable_v1_rows_excluded.map(r => [r.strategy_id, r]))

const approvalReady = []
const approvalBlocked = []
const nonApplicableVerified = []
const nonApplicableDrifted = []

for (const id of allReviewedV2Ids) {
  const live = liveById.get(id)
  if (!live) {
    approvalBlocked.push({ strategy_id: id, reason: 'LIVE_ROW_MISSING' })
    continue
  }
  const manifestRow = fleetReadyById.get(id) ?? neshoraById.get(id)
  if (!manifestRow) {
    approvalBlocked.push({ strategy_id: id, reason: 'MANIFEST_ROW_MISSING' })
    continue
  }
  const precondOk = isApprovalReadyPrecondition({ strategy_id: id }, live, manifestRow)
  const goldOk = await verifyGoldStandardCompleteness(live)
  const blockers = live.seed_context?.blockers ?? []
  const blockersEmpty = Array.isArray(blockers) && blockers.length === 0
  const pkgProv = manifestRow.package_provenance
  const pkgConfirmed = pkgProv?.verification_confirmed_at && pkgProv?.verification_actor_id

  if (precondOk && goldOk.ok && blockersEmpty && pkgConfirmed) {
    approvalReady.push({
      strategy_id: id,
      client_id: live.client_id,
      strategy_month: live.strategy_month,
      version: live.version,
      gold_standard_verified: true,
      blockers_empty: true,
      package_provenance_verified: true,
      approval_idempotency_key: deterministicUuid(`issue-556-approval:${manifest.combined_plan_hash}:${id}`),
    })
  } else {
    approvalBlocked.push({
      strategy_id: id,
      client_id: live.client_id,
      strategy_month: live.strategy_month,
      reason: [
        !precondOk && 'PRECONDITION_MISMATCH',
        !goldOk.ok && `GOLD_STANDARD_${goldOk.reason.toUpperCase().replace(/\s+/g, '_')}`,
        !blockersEmpty && 'BLOCKERS_NOT_EMPTY',
        !pkgConfirmed && 'PACKAGE_PROVENANCE_INCOMPLETE',
      ].filter(Boolean).join('+') || 'UNKNOWN',
    })
  }
}

for (const id of nonApplicableIds) {
  const live = liveById.get(id)
  const manifestRow = nonApplicableById.get(id)
  if (!live || !manifestRow) {
    nonApplicableDrifted.push({ strategy_id: id, reason: 'MISSING' })
    continue
  }
  if (isNonApplicableUnchanged({ strategy_id: id }, live)) {
    nonApplicableVerified.push({ strategy_id: id, client_name: manifestRow.client_name, strategy_month: manifestRow.strategy_month })
  } else {
    nonApplicableDrifted.push({ strategy_id: id, reason: 'NON_APPLICABLE_DRIFTED' })
  }
}

const preflight = {
  manifest_hash: manifest.combined_plan_hash,
  generated_at: manifest.generated_at,
  reviewed_v2_rows: allReviewedV2Ids.length,
  approval_ready_rows: approvalReady.length,
  approval_blocked_rows: approvalBlocked.length,
  non_applicable_rows: nonApplicableIds.length,
  non_applicable_verified_unchanged: nonApplicableVerified.length,
  non_applicable_drifted: nonApplicableDrifted.length,
  blocked_details: approvalBlocked,
  drifted_details: nonApplicableDrifted,
  approval_ready_ids: approvalReady.map(r => r.strategy_id),
  approval_idempotency_keys: Object.fromEntries(approvalReady.map(r => [r.strategy_id, r.approval_idempotency_key])),
}

process.stdout.write(`${JSON.stringify({ mode: 'approval_preflight', ...preflight }, null, 2)}\n`)

if (approvalBlocked.length > 0) {
  process.exitCode = 1
}
if (nonApplicableDrifted.length > 0) {
  process.exitCode = 1
}