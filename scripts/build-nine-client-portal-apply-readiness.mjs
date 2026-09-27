import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const RECONCILIATION = join(ROOT, 'artifacts/client-portal-access/issue-519/active-client-access-matrix.json')
const OUTPUT_DIR = join(ROOT, 'artifacts/client-portal-access/issue-539')
const OUTPUT = join(OUTPUT_DIR, 'nine-client-portal-apply-readiness.json')

const NINE_CLIENT_NAMES = [
  'Braize',
  'CG Production House',
  'All Around PVC',
  'Bat Hill Royale',
  'Case Bloemfontein',
  'HMHI',
  'The Staffordshire',
  'Vrystaat Kunstefees',
  'Zooz Lifestyle WFF',
]

const LINK_EXISTING_PROFILE = new Set(['Braize', 'CG Production House'])
const PROVISION_NEW = new Set([
  'All Around PVC',
  'Bat Hill Royale',
  'Case Bloemfontein',
  'HMHI',
  'The Staffordshire',
  'Vrystaat Kunstefees',
  'Zooz Lifestyle WFF',
])

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

function proposedUsername(clientName) {
  if (clientName.trim().toLowerCase() === 'braize') return 'braizepromotions'
  return clientName.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function syntheticEmail(clientId) {
  return `client-${clientId}@portal.cgdynamics.co.za`
}

const reconciliation = JSON.parse(readFileSync(RECONCILIATION, 'utf8'))

if (reconciliation.mode !== 'read_only_reconciliation' || reconciliation.write_count !== 0) {
  throw new Error('Source reconciliation must be zero-write read-only mode.')
}
if (reconciliation.credential_fields_included) {
  throw new Error('Source reconciliation must not include credentials.')
}

const nineRows = reconciliation.rows.filter(row => NINE_CLIENT_NAMES.includes(row.client_name))
if (nineRows.length !== 9) {
  throw new Error(`Expected exactly 9 clients in the batch, found ${nineRows.length}.`)
}

const expectedLinkCount = nineRows.filter(row => LINK_EXISTING_PROFILE.has(row.client_name)).length
const expectedProvisionCount = nineRows.filter(row => PROVISION_NEW.has(row.client_name)).length
if (expectedLinkCount !== 2 || expectedProvisionCount !== 7) {
  throw new Error('Batch composition drifted: expected 2 link-existing + 7 provision-new.')
}

for (const row of nineRows) {
  if (row.portal.inactive_client_profile_count !== 0) {
    throw new Error(`${row.client_name}: inactive client profiles detected. Batch requires zero inactive profiles.`)
  }
  if (LINK_EXISTING_PROFILE.has(row.client_name)) {
    if (row.portal.active_client_profile_count !== 1) {
      throw new Error(`${row.client_name}: expected exactly 1 active client profile for link-existing action, found ${row.portal.active_client_profile_count}.`)
    }
    if (row.portal.enabled_mapping_count !== 0) {
      throw new Error(`${row.client_name}: expected 0 existing portal mappings for link-existing action, found ${row.portal.enabled_mapping_count}.`)
    }
    if (row.published_report_count === 0) {
      throw new Error(`${row.client_name}: link-existing requires published client-facing reports.`)
    }
  }
  if (PROVISION_NEW.has(row.client_name)) {
    if (row.portal.active_client_profile_count !== 0) {
      throw new Error(`${row.client_name}: expected 0 active client profiles for provision-new action, found ${row.portal.active_client_profile_count}. Duplicate-profile refusal triggered.`)
    }
    if (row.portal.enabled_mapping_count !== 0) {
      throw new Error(`${row.client_name}: expected 0 existing portal mappings for provision-new action, found ${row.portal.enabled_mapping_count}.`)
    }
    if (row.published_report_count === 0) {
      throw new Error(`${row.client_name}: provision-new requires published client-facing reports.`)
    }
  }
}

const preconditions = {
  reconciliation_hash: reconciliation.reconciliation_hash,
  reconciliation_captured_at: reconciliation.captured_at,
  database_project_id: reconciliation.database_project_id,
  nine_client_batch: nineRows.map(row => ({
    client_id: row.client_id,
    client_name: row.client_name,
    service_scope: row.service_scope,
    action: row.action,
    reason: row.reason,
    portal: {
      mapping_count: row.portal.mapping_count,
      enabled_mapping_count: row.portal.enabled_mapping_count,
      active_client_profile_count: row.portal.active_client_profile_count,
      inactive_client_profile_count: row.portal.inactive_client_profile_count,
    },
    published_report_count: row.published_report_count,
    proposed_username: proposedUsername(row.client_name),
    synthetic_email: syntheticEmail(row.client_id),
    idempotency_key: deterministicUuid(`issue-539:${reconciliation.reconciliation_hash}:${row.client_id}`),
    provisioning_mode: LINK_EXISTING_PROFILE.has(row.client_name) ? 'link_existing_profile' : 'provision_new_under_approved_flow',
  })),
  counts: {
    total: 9,
    link_existing_profile: expectedLinkCount,
    provision_new_under_approved_flow: expectedProvisionCount,
    published_reports_total: nineRows.reduce((sum, row) => sum + row.published_report_count, 0),
  },
  preconditions_verified: {
    zero_inactive_profiles: nineRows.every(row => row.portal.inactive_client_profile_count === 0),
    exact_client_isolation: new Set(nineRows.map(row => row.client_id)).size === 9,
    no_duplicate_profile_creation: nineRows.filter(row => LINK_EXISTING_PROFILE.has(row.client_name)).every(row => row.portal.active_client_profile_count === 1 && row.portal.enabled_mapping_count === 0) &&
      nineRows.filter(row => PROVISION_NEW.has(row.client_name)).every(row => row.portal.active_client_profile_count === 0 && row.portal.enabled_mapping_count === 0),
    all_active_clients: nineRows.every(row => row.service_scope === 'eligible'),
    published_reports_establish_need: nineRows.every(row => row.published_report_count > 0),
    reconciliation_hash_anchored: true,
  },
  stop_conditions: [
    'Any precondition verification fails.',
    'Live production state has drifted from the anchored reconciliation hash.',
    'Any client in the batch is no longer active.',
    'Any client in the batch has gained an unexpected portal mapping or duplicate profile.',
    'Service role key or Supabase URL not configured (dry-run only requires read access).',
    'Preflight detects live drift on any of the nine target rows.',
  ],
  rollback_evidence: [
    'Dry-run mode performs zero production writes by design.',
    'Preflight captures live state fingerprints for all nine target rows before any apply.',
    'Idempotency keys are deterministic and tied to the reviewed reconciliation hash.',
    'Non-target clients (the other 48) are never read or written.',
    'Post-apply verification re-reads only the nine target rows and compares against expected state.',
    'If any verification fails, no further rows are processed and the run exits with a detailed error.',
  ],
}

const planCore = {
  schema_version: 1,
  issue: 539,
  mode: 'dry_run',
  write_count: 0,
  source_reconciliation: {
    issue: 519,
    captured_at: reconciliation.captured_at,
    reconciliation_hash: reconciliation.reconciliation_hash,
  },
  preconditions,
  apply_plan: {
    link_existing_profile: preconditions.nine_client_batch
      .filter(row => row.provisioning_mode === 'link_existing_profile')
      .map(row => ({
        client_id: row.client_id,
        client_name: row.client_name,
        username: row.proposed_username,
        auth_user_id_source: 'existing_active_client_profile',
        idempotency_key: row.idempotency_key,
        expected_post_state: {
          client_portal_access: { client_id: row.client_id, username: row.proposed_username, enabled: true },
          profiles: { id: 'EXISTING_AUTH_USER_ID', role: 'client', client_id: row.client_id, is_active: true },
        },
      })),
    provision_new_under_approved_flow: preconditions.nine_client_batch
      .filter(row => row.provisioning_mode === 'provision_new_under_approved_flow')
      .map(row => ({
        client_id: row.client_id,
        client_name: row.client_name,
        username: row.proposed_username,
        auth_user_id_source: 'create_new_synthetic_auth_user',
        synthetic_email: row.synthetic_email,
        idempotency_key: row.idempotency_key,
        expected_post_state: {
          client_portal_access: { client_id: row.client_id, username: row.proposed_username, enabled: true },
          profiles: { id: 'NEW_AUTH_USER_ID', role: 'client', client_id: row.client_id, is_active: true, email: row.synthetic_email },
        },
      })),
  },
  post_apply_verification: {
    re_read_target_rows: true,
    verify_client_portal_access_rows: nineRows.length,
    verify_profiles_rows: nineRows.length,
    verify_enabled_mappings: nineRows.length,
    verify_zero_cross_client_leakage: true,
    verify_idempotency_receipts: true,
    verification_query_plan: [
      'SELECT * FROM client_portal_access WHERE client_id IN (...) AND enabled = true',
      'SELECT * FROM profiles WHERE client_id IN (...) AND role = \'client\' AND is_active = true',
      'Verify exact count = 9 for both tables.',
      'Verify username uniqueness across all 57 active clients.',
      'Verify no duplicate auth_user_id values.',
    ],
  },
}

const output = { ...planCore, plan_hash: sha(planCore) }

mkdirSync(OUTPUT_DIR, { recursive: true })
writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`)

process.stdout.write(`${JSON.stringify({ output: OUTPUT, plan_hash: output.plan_hash, ...planCore.preconditions.counts }, null, 2)}\n`)