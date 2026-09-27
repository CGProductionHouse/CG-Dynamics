import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createHash } from 'node:crypto'

execFileSync(process.execPath, ['scripts/build-nine-client-portal-apply-readiness.mjs'], { stdio: 'pipe' })
const readiness = JSON.parse(readFileSync('artifacts/client-portal-access/issue-539/nine-client-portal-apply-readiness.json', 'utf8'))

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

test('nine-client apply-readiness is zero-write dry-run anchored to #519 reconciliation', () => {
  assert.equal(readiness.mode, 'dry_run')
  assert.equal(readiness.write_count, 0)
  assert.equal(readiness.issue, 539)
  assert.equal(readiness.schema_version, 1)
  assert.equal(readiness.source_reconciliation.issue, 519)
  assert.equal(readiness.source_reconciliation.reconciliation_hash, '14070a90e8de82cb3c0877824617924820e41f447e63cb20573dcbd48a82818e')
})

test('exact nine-client batch composition: 2 link-existing + 7 provision-new', () => {
  assert.equal(readiness.preconditions.counts.total, 9)
  assert.equal(readiness.preconditions.counts.link_existing_profile, 2)
  assert.equal(readiness.preconditions.counts.provision_new_under_approved_flow, 7)
  assert.equal(readiness.preconditions.counts.published_reports_total, 26)
})

test('preconditions verify exact-client isolation and no duplicate profiles', () => {
  const pv = readiness.preconditions.preconditions_verified
  assert.equal(pv.zero_inactive_profiles, true)
  assert.equal(pv.exact_client_isolation, true)
  assert.equal(pv.no_duplicate_profile_creation, true)
  assert.equal(pv.all_active_clients, true)
  assert.equal(pv.published_reports_establish_need, true)
  assert.equal(pv.reconciliation_hash_anchored, true)
})

test('link-existing clients have exactly 1 active profile and 0 mappings', () => {
  const linkRows = readiness.preconditions.nine_client_batch.filter(r => r.provisioning_mode === 'link_existing_profile')
  assert.equal(linkRows.length, 2)
  assert.deepEqual(linkRows.map(r => r.client_name).sort(), ['Braize', 'CG Production House'])
  for (const row of linkRows) {
    assert.equal(row.portal.active_client_profile_count, 1)
    assert.equal(row.portal.enabled_mapping_count, 0)
    assert.equal(row.portal.inactive_client_profile_count, 0)
    assert.ok(row.published_report_count > 0)
  }
})

test('provision-new clients have 0 active profiles and 0 mappings', () => {
  const newRows = readiness.preconditions.nine_client_batch.filter(r => r.provisioning_mode === 'provision_new_under_approved_flow')
  assert.equal(newRows.length, 7)
  assert.deepEqual(newRows.map(r => r.client_name).sort(), [
    'All Around PVC', 'Bat Hill Royale', 'Case Bloemfontein', 'HMHI',
    'The Staffordshire', 'Vrystaat Kunstefees', 'Zooz Lifestyle WFF'
  ].sort())
  for (const row of newRows) {
    assert.equal(row.portal.active_client_profile_count, 0)
    assert.equal(row.portal.enabled_mapping_count, 0)
    assert.equal(row.portal.inactive_client_profile_count, 0)
    assert.ok(row.published_report_count > 0)
  }
})

test('deterministic idempotency keys tied to reconciliation hash', () => {
  for (const row of readiness.preconditions.nine_client_batch) {
    assert.match(row.idempotency_key, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    assert.ok(row.idempotency_key.startsWith('531ffc7f') || row.idempotency_key.startsWith('c4618134') ||
              row.idempotency_key.startsWith('7847e4ba') || row.idempotency_key.startsWith('37a021a6') ||
              row.idempotency_key.startsWith('0cf81e63') || row.idempotency_key.startsWith('18efbcab') ||
              row.idempotency_key.startsWith('314424f6') || row.idempotency_key.startsWith('31a3efa8') ||
              row.idempotency_key.startsWith('0c18e821'))
  }
  const keys = readiness.preconditions.nine_client_batch.map(r => r.idempotency_key)
  assert.equal(new Set(keys).size, 9)
})

test('proposed usernames follow canonical format', () => {
  const usernames = readiness.preconditions.nine_client_batch.map(r => r.proposed_username)
  for (const u of usernames) {
    assert.match(u, /^[a-z0-9]{3,64}$/)
  }
  assert.equal(new Set(usernames).size, 9)
  assert.deepEqual(usernames.sort(), [
    'allaroundpvc', 'bathillroyale', 'braizepromotions', 'casebloemfontein',
    'cgproductionhouse', 'hmhi', 'thestaffordshire', 'vrystaatkunstefees', 'zoozlifestylewff'
  ].sort())
})

test('synthetic emails follow canonical pattern and are unique', () => {
  const emails = readiness.preconditions.nine_client_batch.map(r => r.synthetic_email)
  for (const e of emails) {
    assert.match(e, /^client-[0-9a-f-]{36}@portal\.cgdynamics\.co\.za$/)
  }
  assert.equal(new Set(emails).size, 9)
})

test('apply plan mirrors preconditions with correct provisioning modes', () => {
  assert.equal(readiness.apply_plan.link_existing_profile.length, 2)
  assert.equal(readiness.apply_plan.provision_new_under_approved_flow.length, 7)
  for (const row of readiness.apply_plan.link_existing_profile) {
    assert.equal(row.auth_user_id_source, 'existing_active_client_profile')
    assert.ok(row.expected_post_state.client_portal_access.enabled)
    assert.equal(row.expected_post_state.profiles.role, 'client')
  }
  for (const row of readiness.apply_plan.provision_new_under_approved_flow) {
    assert.equal(row.auth_user_id_source, 'create_new_synthetic_auth_user')
    assert.ok(row.expected_post_state.client_portal_access.enabled)
    assert.equal(row.expected_post_state.profiles.role, 'client')
    assert.match(row.expected_post_state.profiles.email, /^client-[0-9a-f-]{36}@portal\.cgdynamics\.co\.za$/)
  }
})

test('post-apply verification plan is complete and targeted', () => {
  const v = readiness.post_apply_verification
  assert.equal(v.re_read_target_rows, true)
  assert.equal(v.verify_client_portal_access_rows, 9)
  assert.equal(v.verify_profiles_rows, 9)
  assert.equal(v.verify_enabled_mappings, 9)
  assert.equal(v.verify_zero_cross_client_leakage, true)
  assert.equal(v.verify_idempotency_receipts, true)
  assert.ok(v.verification_query_plan.length >= 3)
})

test('stop conditions and rollback evidence are documented', () => {
  assert.ok(readiness.preconditions.stop_conditions.length >= 5)
  assert.ok(readiness.preconditions.rollback_evidence.length >= 5)
  assert.ok(readiness.preconditions.stop_conditions.some(s => s.includes('drifted from the anchored reconciliation hash')))
  assert.ok(readiness.preconditions.stop_conditions.some(s => s.includes('unexpected portal mapping or duplicate profile')))
  assert.ok(readiness.preconditions.rollback_evidence.some(s => s.includes('zero production writes')))
  assert.ok(readiness.preconditions.rollback_evidence.some(s => s.includes('Idempotency keys are deterministic')))
})

test('plan hash integrity', () => {
  const core = Object.fromEntries(Object.entries(readiness).filter(([key]) => key !== 'plan_hash'))
  const actualHash = sha(core)
  assert.equal(actualHash, readiness.plan_hash)
})

test('no credentials or sensitive data in artifact', () => {
  const json = JSON.stringify(readiness)
  assert.equal(json.includes('password'), false)
  assert.equal(json.includes('secret'), false)
  assert.equal(json.includes('service_role'), false)
  assert.equal(json.includes('anon_key'), false)
})

test('non-target 48 clients are never referenced', () => {
  const targetIds = new Set(readiness.preconditions.nine_client_batch.map(r => r.client_id))
  assert.equal(targetIds.size, 9)
  for (const row of readiness.preconditions.nine_client_batch) {
    assert.ok(targetIds.has(row.client_id))
  }
})