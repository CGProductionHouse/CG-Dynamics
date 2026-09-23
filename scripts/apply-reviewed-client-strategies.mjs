import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

function option(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

const DEFAULT_PLAN = 'artifacts/client-strategy-dossiers/issue-513/sep-oct-strategy-mutation-dry-run.json'
const planPath = resolve(option('--plan') ?? DEFAULT_PLAN)
const expectedPlanHash = option('--expected-plan-hash')
const apply = process.argv.includes('--apply')
const preflightOnly = process.argv.includes('--preflight-only') || !apply

if (apply && !expectedPlanHash) {
  throw new Error('--apply requires --expected-plan-hash <reviewed hash>.')
}
if (!apply && expectedPlanHash == null) {
  throw new Error('Preflight requires --expected-plan-hash <reviewed hash>.')
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

function deterministicUuid(seed) {
  const bytes = Buffer.from(createHash('sha256').update(seed).digest().subarray(0, 16))
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function sameNullable(left, right) {
  return (left ?? null) === (right ?? null)
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

const plan = JSON.parse(readFileSync(planPath, 'utf8'))
const planCore = Object.fromEntries(Object.entries(plan).filter(([key]) => key !== 'plan_hash'))
const actualPlanHash = sha(planCore)

if (actualPlanHash !== plan.plan_hash) {
  throw new Error(`Plan artifact integrity failure: embedded=${plan.plan_hash} actual=${actualPlanHash}`)
}
if (expectedPlanHash !== actualPlanHash) {
  throw new Error(`Reviewed plan hash mismatch: expected=${expectedPlanHash} actual=${actualPlanHash}`)
}
if (plan.schema_version !== 2 || plan.mode !== 'dry_run' || plan.write_count !== 0) {
  throw new Error('Only reviewed schema-v2 zero-write #513 plans are accepted.')
}
if (plan.issue !== 513) {
  throw new Error('Only Issue #513 strategy plans are accepted.')
}

const ready = plan.rows.filter(row => row.disposition === 'ready')
const nonApplicable = plan.rows.filter(row => row.disposition === 'non_applicable')
const held = plan.rows.filter(row => row.disposition === 'held')
const blocked = plan.rows.filter(row => row.disposition === 'blocked')

if (
  ready.length !== 92
  || new Set(ready.map(row => row.client_id)).size !== 46
  || nonApplicable.length !== 20
  || new Set(nonApplicable.map(row => row.client_id)).size !== 10
  || held.length !== 0
  || blocked.length !== 0
) {
  throw new Error('Plan partition is not the reviewed 46-social / 10-non-social / 0-held contract.')
}

for (const row of ready) {
  if (!row.proposed_strategy_data || !row.proposed_seed_context) {
    throw new Error(`${row.client_name} ${row.strategy_month}: ready row lacks proposed payload.`)
  }
  if (row.proposed_seed_context.client_id !== row.client_id || row.proposed_seed_context.strategy_month !== row.strategy_month) {
    throw new Error(`${row.client_name} ${row.strategy_month}: proposed provenance identity mismatch.`)
  }
  if (sha(row.proposed_strategy_data) !== row.proposed_strategy_hash) {
    throw new Error(`${row.client_name} ${row.strategy_month}: proposed strategy hash mismatch.`)
  }
  if (sha(row.proposed_seed_context) !== row.proposed_seed_context_hash) {
    throw new Error(`${row.client_name} ${row.strategy_month}: proposed seed-context hash mismatch.`)
  }
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

async function rowsByIds(ids) {
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

function isFrozenPrecondition(row, live) {
  const p = row.precondition
  return live.id === row.strategy_id
    && live.client_id === row.client_id
    && live.strategy_month === row.strategy_month
    && live.workflow_status === p.workflow_status
    && Number(live.version) === Number(p.version)
    && live.updated_at === p.updated_at
    && sameNullable(live.staff_amended_at, p.staff_amended_at)
    && sameNullable(live.approved_at, p.approved_at)
    && sameNullable(live.published_at, p.published_at)
    && sha(live.strategy_data) === p.current_strategy_hash
    && sha(live.seed_context) === p.current_seed_context_hash
    && sameNullable(live.internal_notes, p.current_internal_notes)
}

function isAppliedState(row, live) {
  return live.id === row.strategy_id
    && live.client_id === row.client_id
    && live.strategy_month === row.strategy_month
    && live.workflow_status === 'draft'
    && Number(live.version) === Number(row.precondition.version) + 1
    && live.staff_amended_at != null
    && live.approved_at == null
    && live.published_at == null
    && sha(live.strategy_data) === row.proposed_strategy_hash
    && sha(live.seed_context) === row.proposed_seed_context_hash
    && sameNullable(live.internal_notes, row.proposed_internal_notes)
}

const allPlanRows = [...ready, ...nonApplicable]
const liveBefore = await rowsByIds(allPlanRows.map(row => row.strategy_id))
const beforeById = new Map(liveBefore.map(row => [row.id, row]))

if (beforeById.size !== allPlanRows.length) {
  throw new Error(`Live strategy count mismatch: expected ${allPlanRows.length}, found ${beforeById.size}.`)
}

const nonApplicableBaseline = new Map()
for (const row of nonApplicable) {
  const live = beforeById.get(row.strategy_id)
  if (!live) throw new Error(`${row.client_name} ${row.strategy_month}: non-applicable row missing.`)
  if (!isFrozenPrecondition(row, live)) {
    throw new Error(`${row.client_name} ${row.strategy_month}: non-applicable row drifted from the reviewed snapshot.`)
  }
  nonApplicableBaseline.set(row.strategy_id, stableLiveFingerprint(live))
}

const pending = []
const alreadyApplied = []
for (const row of ready) {
  const live = beforeById.get(row.strategy_id)
  if (!live) throw new Error(`${row.client_name} ${row.strategy_month}: ready row missing.`)
  if (isFrozenPrecondition(row, live)) {
    pending.push(row)
  } else if (isAppliedState(row, live)) {
    alreadyApplied.push(row)
  } else {
    throw new Error(`${row.client_name} ${row.strategy_month}: live drift detected. No additional writes were attempted.`)
  }
}

const preflight = {
  plan_hash: actualPlanHash,
  source_snapshot_generated_at: plan.source_snapshot_generated_at,
  ready_rows: ready.length,
  pending_rows: pending.length,
  already_applied_rows: alreadyApplied.length,
  non_applicable_rows: nonApplicable.length,
  held_rows: held.length,
  blocked_rows: blocked.length,
}

if (preflightOnly) {
  process.stdout.write(`${JSON.stringify({ mode: 'preflight', ...preflight }, null, 2)}\n`)
  process.exit(0)
}

const actorId = process.env.CG_STRATEGY_APPLY_ACTOR_PROFILE_ID
if (!actorId) {
  throw new Error('CG_STRATEGY_APPLY_ACTOR_PROFILE_ID is required for --apply.')
}

let applied = 0
for (const row of pending) {
  const idempotencyKey = deterministicUuid(`issue-513:${actualPlanHash}:${row.strategy_id}`)
  const { data, error } = await supabase.rpc('amend_monthly_client_strategy_with_context', {
    p_client_id: row.client_id,
    p_strategy_month: row.strategy_month,
    p_expected_version: row.precondition.version,
    p_strategy_data: row.proposed_strategy_data,
    p_seed_context: row.proposed_seed_context,
    p_internal_notes: row.proposed_internal_notes ?? null,
    p_actor_profile_id: actorId,
    p_idempotency_key: idempotencyKey,
  })
  if (error) {
    throw new Error(`${row.client_name} ${row.strategy_month}: ${error.message}`)
  }
  if (!data || data.strategy_id !== row.strategy_id || data.client_id !== row.client_id || data.workflow_status !== 'draft') {
    throw new Error(`${row.client_name} ${row.strategy_month}: unexpected amendment receipt.`)
  }
  applied += 1
}

const liveAfter = await rowsByIds(allPlanRows.map(row => row.strategy_id))
const afterById = new Map(liveAfter.map(row => [row.id, row]))

for (const row of ready) {
  const live = afterById.get(row.strategy_id)
  if (!live || !isAppliedState(row, live)) {
    throw new Error(`${row.client_name} ${row.strategy_month}: post-apply verification failed.`)
  }
}

for (const row of nonApplicable) {
  const live = afterById.get(row.strategy_id)
  if (!live) throw new Error(`${row.client_name} ${row.strategy_month}: non-applicable row missing after apply.`)
  const before = nonApplicableBaseline.get(row.strategy_id)
  if (stableLiveFingerprint(live) !== before) {
    throw new Error(`${row.client_name} ${row.strategy_month}: non-applicable row changed during apply.`)
  }
}

const readyIds = ready.map(row => row.strategy_id)
let revisionCount = 0
for (let index = 0; index < readyIds.length; index += 200) {
  const slice = readyIds.slice(index, index + 200)
  const { data, error } = await supabase
    .from('monthly_client_strategy_revisions')
    .select('strategy_id,idempotency_key,event_kind,record_version')
    .in('strategy_id', slice)
    .eq('event_kind', 'amended')
  if (error) throw new Error(`revision verification failed: ${error.message}`)
  const expectedKeys = new Map(
    ready
      .filter(row => slice.includes(row.strategy_id))
      .map(row => [row.strategy_id, deterministicUuid(`issue-513:${actualPlanHash}:${row.strategy_id}`)]),
  )
  for (const [strategyId, key] of expectedKeys) {
    if (!(data ?? []).some(item => item.strategy_id === strategyId && item.idempotency_key === key)) {
      throw new Error(`Missing durable #513 amendment receipt for strategy ${strategyId}.`)
    }
    revisionCount += 1
  }
}

process.stdout.write(`${JSON.stringify({
  mode: 'apply',
  ...preflight,
  applied_rows_this_run: applied,
  verified_ready_rows: ready.length,
  verified_non_applicable_unchanged: nonApplicable.length,
  verified_revision_receipts: revisionCount,
}, null, 2)}\n`)
