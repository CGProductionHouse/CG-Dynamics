import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let evidenceModule
before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
  evidenceModule = await server.ssrLoadModule('/src/lib/packageEvidence.ts')
})
after(async () => { await server?.close() })
const clientsPage = readFileSync(new URL('../src/pages/admin/ClientsList.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const reviewModal = readFileSync(new URL('../src/components/clients/PackageEvidenceReviewModal.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

function client(index, active = true, packageSettings = null) {
  return {
    id: `client-${index}`,
    name: `Client ${String(index).padStart(2, '0')}`,
    tier: 'standard',
    logo_url: null,
    active,
    created_at: '2026-01-01T00:00:00Z',
    package_settings: packageSettings,
  }
}

function build(overrides = {}) {
  return evidenceModule.buildActiveClientPackageEvidenceMatrix({
    clients: Array.from({ length: 56 }, (_, index) => client(index)).concat(client(99, false)),
    packages: [],
    templates: [],
    deliverables: [],
    guides: [],
    contextUpdates: [],
    today: '2026-09-23',
    ...overrides,
  })
}

test('the matrix represents all 56 active clients and excludes inactive clients', () => {
  const matrix = build()
  assert.equal(matrix.length, 56)
  assert.equal(matrix.some(row => row.clientId === 'client-99'), false)
  assert.ok(matrix.every(row => row.confirmed === false))
})

test('blank evidence remains unknown and never becomes proposed zero', () => {
  const row = build()[0]
  for (const field of Object.values(row.fields)) {
    assert.equal(field.state, 'unknown')
    assert.equal(field.proposedValue, null)
  }
})

test('only explicit current package templates prefill matching package fields', () => {
  const packages = [{
    id: 'package-a', client_id: 'client-0', package_name: 'Current exact package', status: 'active',
    start_date: '2026-01-01', end_date: null, notes: 'Exact package note', updated_at: '2026-09-20T00:00:00Z', archived_at: null,
  }]
  const templates = [
    { id: 'template-video', package_id: 'package-a', code: 'Video', deliverable_type: 'video', title_template: 'Video', count_per_month: 2, active: true },
    { id: 'template-dp', package_id: 'package-a', code: 'DP', deliverable_type: 'dp', title_template: 'Designed poster', count_per_month: 4, active: true },
  ]
  const row = build({ packages, templates })[0]
  assert.equal(row.fields.professional_videos_per_month.proposedValue, 2)
  assert.equal(row.fields.design_posters_per_month.proposedValue, 4)
  assert.equal(row.fields.reels_per_month.state, 'unknown')
  assert.equal(row.fields.reels_per_month.proposedValue, null)
  assert.equal(row.fields.package_notes.proposedValue, 'Exact package note')
  assert.match(row.fields.professional_videos_per_month.sourceReferences.join(' '), /package_template:template-video/)
})

test('posting and production cadence remains supporting evidence and cannot infer contractual scope', () => {
  const deliverables = Array.from({ length: 8 }, (_, index) => ({
    id: `deliverable-${index}`, client_id: 'client-1', package_id: null, template_id: null,
    month: '2026-09-01', deliverable_type: 'dp', microsoft_source_type: 'planner_task',
    microsoft_task_id: `task-${index}`, microsoft_last_synced_at: '2026-09-22T06:00:00Z',
  }))
  const row = build({ deliverables }).find(item => item.clientId === 'client-1')
  assert.equal(row.fields.design_posters_per_month.state, 'unknown')
  assert.equal(row.fields.design_posters_per_month.proposedValue, null)
  assert.equal(row.cadence[0].counts.design_posters_per_month, 8)
  assert.equal(row.cadence[0].microsoftMirrored, 8)
  assert.match(row.supportingSources.join(' '), /microsoft_task:task-0/)
})

test('competing current packages and conflicting unverified values fail closed', () => {
  const packages = ['a', 'b'].map(id => ({
    id: `package-${id}`, client_id: 'client-0', package_name: `Package ${id}`, status: 'active',
    start_date: '2026-01-01', end_date: null, notes: null, updated_at: null, archived_at: null,
  }))
  const multiple = build({ packages })[0]
  assert.equal(multiple.fields.professional_videos_per_month.state, 'conflict')
  assert.equal(multiple.fields.professional_videos_per_month.proposedValue, null)

  const existing = { professional_videos_per_month: 9 }
  const clients = Array.from({ length: 56 }, (_, index) => client(index, true, index === 0 ? existing : null))
  const singlePackage = [packages[0]]
  const templates = [{ id: 'template-video', package_id: 'package-a', code: 'Video', deliverable_type: 'video', title_template: 'Video', count_per_month: 2, active: true }]
  const mismatch = build({ clients, packages: singlePackage, templates })[0]
  assert.equal(mismatch.fields.professional_videos_per_month.state, 'conflict')
  assert.equal(mismatch.fields.professional_videos_per_month.proposedValue, null)
})

test('ready guides and incorporated context are references, not package values', () => {
  const row = build({
    guides: [{ id: 'guide-a', client_id: 'client-0', version: 3, runtime_readiness: 'ready', updated_at: '2026-09-20T00:00:00Z' }],
    contextUpdates: [{ id: 'context-a', client_id: 'client-0', title: 'Business priority', review_state: 'incorporated', created_at: '2026-09-20T00:00:00Z' }],
  })[0]
  assert.match(row.supportingSources.join(' '), /client_guide:guide-a/)
  assert.match(row.supportingSources.join(' '), /client_context_update:context-a/)
  assert.equal(row.fields.campaign_management_included.state, 'unknown')
})

test('review workflow is explicit, admin-triggered and advances to the next unconfirmed client', () => {
  assert.match(clientsPage, /Review next unconfirmed/)
  assert.match(clientsPage, /setReviewClientId\(next\?\.clientId \?\? null\)/)
  assert.match(clientsPage, /rows\.length} active clients represented/)
  assert.match(reviewModal, /I have verified every field for this exact client/)
  assert.match(reviewModal, /Confirm exact package and open next/)
  assert.match(reviewModal, /confirmClientPackage\(/)
  assert.match(reviewModal, /Recent production cadence was treated as supporting evidence only/)
  assert.doesNotMatch(reviewModal, /\|\|\s*0/)
})

test('evidence loading paginates the canonical sources and does not create a package store', () => {
  const source = readFileSync(new URL('../src/lib/packageEvidence.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  assert.match(source, /fetchAllPages<PackageRow>/)
  assert.match(source, /fetchAllPages<PackageDeliverableEvidenceRow>/)
  assert.match(source, /from\('client_packages'\)/)
  assert.match(source, /from\('package_deliverable_templates'\)/)
  assert.match(source, /from\('monthly_deliverables'\)/)
  assert.match(source, /from\('client_guides'\)/)
  assert.match(source, /from\('client_context_updates'\)/)
  assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/)
})
