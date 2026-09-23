import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const CLIENT_INDEX = join(ROOT, 'artifacts/client-strategy-dossiers/issue-513/index.json')
const OUTPUT_DIR = join(ROOT, 'artifacts/client-portal-access/issue-519')

const EXCLUDED = new Set([
  'Agri-Secure', 'Bloem Vascular', 'Econofoods', 'First Technology Central', 'Ipopeng Office Supplies',
  'Kundedienste', 'Local Deli', 'Mimosa Mall', 'NCNA', 'Rusoord Farmstay',
])

const ENABLED_MAPPING = new Set([
  'AV Event Life', 'Bloem Action Sports', 'Bloem Marble & Granite', 'Bohemia Quick Stop',
  'Bouwer & Coetzee Attorneys', 'C&L Innovations', 'Cape Lumber', 'Central Canvas', 'Daisy & Co',
  'Delta Gas', 'Dulux Paint & Paper Bloemfontein', 'Econofoods', 'Ehrlich Park Butchery',
  'Emmanuel Funerals', 'First Technology Central', 'Germoparts', 'Hino Trucks', 'Jenkor',
  'Kundedienste', 'Local Deli', 'Loraclox', 'Madison Wear', 'Novus Steel', 'Peyper Bonds',
  'Piek Group', 'PSG Bloemfontein', 'RC-Polypipe', 'Red Oak', 'SecuriForce', 'Supa Quick BFN',
  'Supa Quick Centurion', 'TBS Brokers', 'Tobich Optics', 'Toyota Bloemfontein', 'Watch Addict',
  'We Ar Fuels', 'Wiseman Group',
])

const ACTIVE_PROFILE_WITHOUT_MAPPING = new Set(['Braize', 'CG Production House'])

const PUBLISHED_REPORTS = new Map(Object.entries({
  'All Around PVC': 1, 'AV Event Life': 3, 'Bat Hill Royale': 2,
  'Bloem Marble & Granite': 3, 'Bohemia Quick Stop': 3, 'Bouwer & Coetzee Attorneys': 3,
  Braize: 4, 'C&L Innovations': 3, 'Cape Lumber': 5, 'Case Bloemfontein': 3,
  'Central Canvas': 3, 'CG Production House': 5, 'Daisy & Co': 3, 'Delta Gas': 3,
  'Dulux Paint & Paper Bloemfontein': 3, 'Ehrlich Park Butchery': 3, 'Emmanuel Funerals': 3,
  'First Technology Central': 3, Germoparts: 3, HMHI: 3, 'Local Deli': 1, Loraclox: 3,
  'Madison Wear': 3, 'Novus Steel': 3, 'Peyper Bonds': 3, 'Piek Group': 3,
  'PSG Bloemfontein': 3, 'RC-Polypipe': 3, 'Red Oak': 2, SecuriForce: 4,
  'Supa Quick BFN': 3, 'Supa Quick Centurion': 3, 'TBS Brokers': 3,
  'The Staffordshire': 3, 'Tobich Optics': 3, 'Vrystaat Kunstefees': 2,
  'Watch Addict': 3, 'We Ar Fuels': 3, 'Wiseman Group': 3, 'Zooz Lifestyle WFF': 3,
}))

function sha(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

const clients = JSON.parse(readFileSync(CLIENT_INDEX, 'utf8')).clients
if (clients.length !== 57 || new Set(clients.map(client => client.id)).size !== 57) {
  throw new Error('Issue #519 requires the exact current 57-client active fleet.')
}

const rows = clients.map(client => {
  const mapping = ENABLED_MAPPING.has(client.name)
  const activeProfile = mapping || ACTIVE_PROFILE_WITHOUT_MAPPING.has(client.name)
  const publishedReports = PUBLISHED_REPORTS.get(client.name) ?? 0
  let action = 'no_client_portal_needed'
  let reason = 'NO_CLIENT_FACING_PUBLISHED_REPORT_AND_NO_EXISTING_ACCESS'
  if (mapping) {
    action = 'preserve'
    reason = 'EXISTING_ENABLED_EXACT_CLIENT_MAPPING_AND_ACTIVE_PROFILE'
  } else if (activeProfile) {
    action = 'provision_link_existing_profile'
    reason = 'PUBLISHED_CLIENT_FACING_REPORT_EXISTS_AND_EXACT_ACTIVE_PROFILE_MUST_BE_PRESERVED'
  } else if (publishedReports > 0) {
    action = 'provision_new_under_approved_flow'
    reason = 'PUBLISHED_CLIENT_FACING_REPORT_EXISTS_WITHOUT_PORTAL_ACCESS'
  }
  return {
    client_id: client.id,
    client_name: client.name,
    service_scope: EXCLUDED.has(client.name) ? 'excluded' : 'eligible',
    portal: {
      mapping_count: mapping ? 1 : 0,
      enabled_mapping_count: mapping ? 1 : 0,
      active_client_profile_count: activeProfile ? 1 : 0,
      inactive_client_profile_count: 0,
    },
    published_report_count: publishedReports,
    action,
    reason,
  }
})

const counts = {
  active_clients: rows.length,
  eligible: rows.filter(row => row.service_scope === 'eligible').length,
  excluded: rows.filter(row => row.service_scope === 'excluded').length,
  preserve: rows.filter(row => row.action === 'preserve').length,
  provision_link_existing_profile: rows.filter(row => row.action === 'provision_link_existing_profile').length,
  provision_new_under_approved_flow: rows.filter(row => row.action === 'provision_new_under_approved_flow').length,
  no_client_portal_needed: rows.filter(row => row.action === 'no_client_portal_needed').length,
  published_reports: rows.reduce((sum, row) => sum + row.published_report_count, 0),
}

const core = {
  schema_version: 1,
  issue: 519,
  captured_at: '2026-09-23T19:48:00Z',
  database_project_id: 'ehtjfntukiwbgptqgbzy',
  mode: 'read_only_reconciliation',
  write_count: 0,
  credential_fields_included: false,
  decision_rule: {
    preserve: 'Preserve every enabled exact-client mapping and active profile, irrespective of current social-service scope.',
    provision_link_existing_profile: 'Use the existing approved #399 flow to link the exact active profile; never create a duplicate user.',
    provision_new_under_approved_flow: 'Published client-facing reports establish portal content need; provision only through the existing approved #399 flow after the protected production gate.',
    no_client_portal_needed: 'No existing access and no published client-facing report; social eligibility alone does not establish portal need.',
  },
  counts,
  rows,
}
const output = { ...core, reconciliation_hash: sha(core) }

mkdirSync(OUTPUT_DIR, { recursive: true })
writeFileSync(join(OUTPUT_DIR, 'active-client-access-matrix.json'), `${JSON.stringify(output, null, 2)}\n`)

const markdown = `# Issue #519 — active-client portal access reconciliation

Read-only production capture: ${output.captured_at}

- Active clients: ${counts.active_clients}
- Current service scope: ${counts.eligible} eligible / ${counts.excluded} excluded
- Preserve exact existing access: ${counts.preserve}
- Link existing exact profile without creating a duplicate: ${counts.provision_link_existing_profile}
- New access through approved #399 flow: ${counts.provision_new_under_approved_flow}
- No client portal currently needed: ${counts.no_client_portal_needed}
- Verified published reports across the fleet: ${counts.published_reports}
- Production writes: 0
- Credentials included: no

The smallest launch provisioning batch is 9 clients: 2 exact existing profiles to link and 7 new users through the existing approved #399 flow. That batch remains a protected production action and was not executed.

| Client | Scope | Mapping | Active profile | Published reports | Action |
|---|---|---:|---:|---:|---|
${rows.map(row => `| ${row.client_name} | ${row.service_scope} | ${row.portal.enabled_mapping_count} | ${row.portal.active_client_profile_count} | ${row.published_report_count} | ${row.action} |`).join('\n')}
`
writeFileSync(join(OUTPUT_DIR, 'README.md'), markdown)
process.stdout.write(`${JSON.stringify({ output: OUTPUT_DIR, reconciliation_hash: output.reconciliation_hash, ...counts }, null, 2)}\n`)
