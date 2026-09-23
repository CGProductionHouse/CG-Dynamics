import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

execFileSync(process.execPath, ['scripts/build-client-portal-reconciliation.mjs'], { stdio: 'pipe' })
const matrix = JSON.parse(readFileSync('artifacts/client-portal-access/issue-519/active-client-access-matrix.json', 'utf8'))

test('reconciles the exact 57-client production fleet without writes or credentials', () => {
  assert.equal(matrix.mode, 'read_only_reconciliation')
  assert.equal(matrix.write_count, 0)
  assert.equal(matrix.credential_fields_included, false)
  assert.equal(matrix.rows.length, 57)
  assert.equal(new Set(matrix.rows.map(row => row.client_id)).size, 57)
  assert.equal(matrix.counts.eligible, 47)
  assert.equal(matrix.counts.excluded, 10)
  assert.equal(matrix.counts.published_reports, 119)
})

test('preserves every existing mapping and produces the smallest safe launch batch', () => {
  assert.equal(matrix.counts.preserve, 37)
  assert.equal(matrix.counts.provision_link_existing_profile, 2)
  assert.equal(matrix.counts.provision_new_under_approved_flow, 7)
  assert.equal(matrix.counts.no_client_portal_needed, 11)
  assert.ok(matrix.rows.filter(row => row.action === 'preserve').every(row => row.portal.enabled_mapping_count === 1 && row.portal.active_client_profile_count === 1))
  assert.deepEqual(matrix.rows.filter(row => row.action === 'provision_link_existing_profile').map(row => row.client_name), ['Braize', 'CG Production House'])
})

test('does not infer portal need from social eligibility alone', () => {
  const neshora = matrix.rows.find(row => row.client_name === 'Neshora Oxygen')
  assert.equal(neshora.service_scope, 'eligible')
  assert.equal(neshora.published_report_count, 0)
  assert.equal(neshora.action, 'no_client_portal_needed')
  assert.equal(JSON.stringify(matrix).includes('username'), false)
  assert.equal(JSON.stringify(matrix).includes('password'), false)
  assert.equal(JSON.stringify(matrix).includes('email'), false)
})

test('never proposes duplicate users for existing profiles', () => {
  for (const row of matrix.rows.filter(row => row.portal.active_client_profile_count > 0)) {
    assert.notEqual(row.action, 'provision_new_under_approved_flow')
  }
  assert.ok(matrix.rows.every(row => row.portal.inactive_client_profile_count === 0))
})
