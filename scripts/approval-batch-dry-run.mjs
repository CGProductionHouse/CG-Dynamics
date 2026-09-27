import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

function option(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

const DEFAULT_MANIFEST = 'artifacts/client-strategy-dossiers/issue-513/sep-oct-approval-publication-manifest.json'
const manifestPath = resolve(option('--manifest') ?? DEFAULT_MANIFEST)
const expectedManifestHash = option('--expected-manifest-hash')
const transition = option('--transition') ?? 'approval'
const apply = process.argv.includes('--apply')
const preflightOnly = process.argv.includes('--preflight-only') || !apply

if (!['approval', 'publication'].includes(transition)) {
  throw new Error('--transition must be "approval" or "publication"')
}
if (apply && !expectedManifestHash) {
  throw new Error('--apply requires --expected-manifest-hash <manifest hash>.')
}
if (!apply && expectedManifestHash == null) {
  throw new Error('Preflight requires --expected-manifest-hash <manifest hash>.')
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

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const manifestCore = Object.fromEntries(Object.entries(manifest).filter(([key]) => key !== 'manifest_hash'))
const actualManifestHash = sha(manifestCore)

if (actualManifestHash !== manifest.manifest_hash) {
  throw new Error(`Manifest artifact integrity failure: embedded=${manifest.manifest_hash} actual=${actualManifestHash}`)
}
if (expectedManifestHash !== actualManifestHash) {
  throw new Error(`Manifest hash mismatch: expected=${expectedManifestHash} actual=${actualManifestHash}`)
}
if (manifest.schema_version !== 1 || manifest.mode !== 'read_only_approval_publication_manifest' || manifest.write_count !== 0) {
  throw new Error('Only schema-v1 zero-write approval/publication manifests are accepted.')
}
if (manifest.issue !== 513) {
  throw new Error('Only Issue #513 strategy approval manifests are accepted.')
}

const rows = manifest.rows
const readyRows = rows.filter(row => row.audit_status === 'ready_for_human_approval')
const blockedRows = rows.filter(row => row.audit_status === 'blocked')

if (readyRows.length !== 94) {
  throw new Error(`Expected 94 ready rows, found ${readyRows.length}`)
}
if (blockedRows.length !== 0) {
  throw new Error(`Unexpected ${blockedRows.length} blocked rows in manifest`)
}
if (manifest.counts.ready_for_human_approval !== 94) {
  throw new Error(`Manifest count mismatch: ready_for_human_approval=${manifest.counts.ready_for_human_approval}`)
}
if (manifest.counts.blocked !== 0) {
  throw new Error(`Manifest count mismatch: blocked=${manifest.counts.blocked}`)
}
if (manifest.counts.approved !== 0 || manifest.counts.published !== 0) {
  throw new Error('Manifest must show 0 approved and 0 published rows.')
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

async function fetchLiveRows(ids) {
  const output = []
  const size = 200
  for (let index = 0; index < ids.length; index += size) {
    const slice = ids.slice(index, index + size)
    const { data, error } = await supabase
      .from('monthly_client_strategies')
      .select('id,client_id,strategy_month,workflow_status,version,updated_at,staff_amended_at,approved_at,published_at,strategy_data,seed_context,internal_notes')
      .in('id', slice)
    if (error) throw new Error(`strategy read failed: ${error.message}`)
    output.push(...(data ?? []))
  }
  return output
}

function stableLiveFingerprint(row) {
  return sha({
    id: row.id,
    client_id: row.client_id,
    strategy_month: row.strategy_month,
    workflow_status: row.workflow_status,
    version: row.version,
    updated_at: row.updated_at,
    staff_amended_at: row.staff_amended_at,
    approved_at: row.approved_at,
    published_at: row.published_at,
    strategy_data: row.strategy_data,
    seed_context: row.seed_context,
    internal_notes: row.internal_notes,
  })
}

function isExpectedPrecondition(row, live) {
  return live.id === row.strategy_id
    && live.client_id === row.client_id
    && live.strategy_month === row.strategy_month
    && live.workflow_status === 'draft'
    && Number(live.version) === Number(row.current_version)
    && sha(live.strategy_data) === row.strategy_hash
    && sha(live.seed_context) === row.seed_context_hash
    && (live.approved_at ?? null) === null
    && (live.published_at ?? null) === null
}

function isAppliedApprovalState(row, live) {
  return live.id === row.strategy_id
    && live.client_id === row.client_id
    && live.strategy_month === row.strategy_month
    && live.workflow_status === 'approved'
    && Number(live.version) === Number(row.current_version)
    && sha(live.strategy_data) === row.strategy_hash
    && sha(live.seed_context) === row.seed_context_hash
    && live.approved_at != null
    && live.published_at == null
}

function isAppliedPublicationState(row, live) {
  return live.id === row.strategy_id
    && live.client_id === row.client_id
    && live.strategy_month === row.strategy_month
    && live.workflow_status === 'published'
    && Number(live.version) === Number(row.current_version)
    && sha(live.strategy_data) === row.strategy_hash
    && sha(live.seed_context) === row.seed_context_hash
    && live.published_at != null
}

const allStrategyIds = rows.map(row => row.strategy_id)
const liveBefore = await fetchLiveRows(allStrategyIds)
const beforeById = new Map(liveBefore.map(row => [row.id, row]))

if (beforeById.size !== allStrategyIds.length) {
  throw new Error(`Live strategy count mismatch: expected ${allStrategyIds.length}, found ${beforeById.size}.`)
}

const pending = []
const alreadyTransitioned = []
const unexpectedState = []

for (const row of readyRows) {
  const live = beforeById.get(row.strategy_id)
  if (!live) throw new Error(`${row.client_name} ${row.strategy_month}: strategy row missing.`)
  
  const transitionData = transition === 'approval'
    ? row.approval_transition
    : row.publication_transition_after_separate_review
  
  if (transition === 'approval') {
    if (isExpectedPrecondition(row, live)) {
      pending.push(row)
    } else if (isAppliedApprovalState(row, live)) {
      alreadyTransitioned.push(row)
    } else {
      unexpectedState.push(`${row.client_name} ${row.strategy_month}: live state does not match approval precondition or approved state.`)
    }
  } else {
    if (isAppliedApprovalState(row, live)) {
      pending.push(row)
    } else if (isAppliedPublicationState(row, live)) {
      alreadyTransitioned.push(row)
    } else {
      unexpectedState.push(`${row.client_name} ${row.strategy_month}: live state does not match publication precondition (must be approved) or published state.`)
    }
  }
}

if (unexpectedState.length > 0) {
  throw new Error(unexpectedState.join('\n'))
}

const preflight = {
  manifest_hash: actualManifestHash,
  manifest_generated_at: manifest.generated_at,
  transition,
  ready_rows: readyRows.length,
  pending_rows: pending.length,
  already_transitioned_rows: alreadyTransitioned.length,
  blocked_rows: blockedRows.length,
  total_manifest_rows: rows.length,
}

if (preflightOnly) {
  process.stdout.write(`${JSON.stringify({ mode: 'preflight', ...preflight }, null, 2)}\n`)
  process.exit(0)
}

const actorId = process.env.CG_STRATEGY_TRANSITION_ACTOR_PROFILE_ID
if (!actorId) {
  throw new Error('CG_STRATEGY_TRANSITION_ACTOR_PROFILE_ID is required for --apply.')
}

let applied = 0
for (const row of pending) {
  const transitionData = transition === 'approval'
    ? row.approval_transition
    : row.publication_transition_after_separate_review
  
  const { data, error } = await supabase.rpc('transition_monthly_client_strategy', {
    p_client_id: transitionData.client_id,
    p_strategy_month: transitionData.strategy_month,
    p_expected_version: transitionData.expected_version,
    p_target_status: transitionData.target_status,
    p_actor_profile_id: actorId,
    p_idempotency_key: transitionData.idempotency_key,
  })
  if (error) {
    throw new Error(`${row.client_name} ${row.strategy_month}: ${error.message}`)
  }
  if (!data || data.strategy_id !== row.strategy_id || data.client_id !== transitionData.client_id || data.workflow_status !== transitionData.target_status) {
    throw new Error(`${row.client_name} ${row.strategy_month}: unexpected transition receipt.`)
  }
  applied += 1
}

const liveAfter = await fetchLiveRows(allStrategyIds)
const afterById = new Map(liveAfter.map(row => [row.id, row]))

for (const row of readyRows) {
  const live = afterById.get(row.strategy_id)
  if (!live) throw new Error(`${row.client_name} ${row.strategy_month}: strategy missing after transition.`)
  
  if (transition === 'approval') {
    if (!isAppliedApprovalState(row, live)) {
      throw new Error(`${row.client_name} ${row.strategy_month}: post-apply verification failed for approval.`)
    }
  } else {
    if (!isAppliedPublicationState(row, live)) {
      throw new Error(`${row.client_name} ${row.strategy_month}: post-apply verification failed for publication.`)
    }
  }
}

const readyIds = readyRows.map(row => row.strategy_id)
let revisionCount = 0
for (let index = 0; index < readyIds.length; index += 200) {
  const slice = readyIds.slice(index, index + 200)
  const { data, error } = await supabase
    .from('monthly_client_strategy_revisions')
    .select('strategy_id,idempotency_key,event_kind,record_version')
    .in('strategy_id', slice)
    .eq('event_kind', transition === 'approval' ? 'approved' : 'published')
  if (error) throw new Error(`revision verification failed: ${error.message}`)
  const expectedKeys = new Map(
    readyRows
      .filter(row => slice.includes(row.strategy_id))
      .map(row => {
        const transitionData = transition === 'approval'
          ? row.approval_transition
          : row.publication_transition_after_separate_review
        return [row.strategy_id, transitionData.idempotency_key]
      }),
  )
  for (const [strategyId, key] of expectedKeys) {
    if (!(data ?? []).some(item => item.strategy_id === strategyId && item.idempotency_key === key)) {
      throw new Error(`Missing durable #513 ${transition} receipt for strategy ${strategyId}.`)
    }
    revisionCount += 1
  }
}

process.stdout.write(`${JSON.stringify({
  mode: 'apply',
  ...preflight,
  applied_rows_this_run: applied,
  verified_ready_rows: readyRows.length,
  verified_transitioned_rows: alreadyTransitioned.length,
  verified_revision_receipts: revisionCount,
}, null, 2)}\n`)