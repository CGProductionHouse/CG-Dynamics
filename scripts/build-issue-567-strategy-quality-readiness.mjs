import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const DIR = process.env.CG_STRATEGY_ARTIFACT_DIR ? resolve(process.env.CG_STRATEGY_ARTIFACT_DIR) : resolve(ROOT, 'artifacts/client-strategy-dossiers/issue-513')
const FLEET = resolve(DIR, 'sep-oct-strategy-mutation-dry-run.json')
const NESHORA = resolve(DIR, 'neshora-strategy-readiness-dry-run.json')
const CURRENT = resolve(DIR, 'sep-oct-approval-publication-manifest.json')
const OUTPUT = resolve(DIR, 'issue-567-sep-oct-strategy-quality-readiness.json')

const FORBIDDEN = [
  /\bCGProductionHouse\//i,
  /\b(?:github|repository|repo)\b/i,
  /\b(?:verified facts?|exact-client evidence|evidence dossier|research dossier|source pack)\b/i,
  /\bPublished-content record:/i,
  /\bCorrect facts are only the starting point\b/i,
  /(?:^|[\\/])(?:docs|sources|artifacts)[\\/]/i,
  /\.(?:md|pdf|json)\b/i,
]
const GENERIC = [
  /\bincrease engagement\b/i,
  /\bbuild (?:brand )?awareness\b/i,
  /\bpost consistently\b/i,
  /\bgrow social media\b/i,
  /\bcreate engaging content\b/i,
]

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  return value
}

function sha(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}

function qualityErrors(strategy) {
  const text = JSON.stringify(strategy)
  const errors = []
  if (FORBIDDEN.some(pattern => pattern.test(text))) errors.push('INTERNAL_OR_NON_STRATEGY_COPY')
  if (GENERIC.some(pattern => pattern.test(text))) errors.push('GENERIC_FILLER')
  return errors
}

const fleet = JSON.parse(readFileSync(FLEET, 'utf8'))
const neshora = JSON.parse(readFileSync(NESHORA, 'utf8'))
const current = JSON.parse(readFileSync(CURRENT, 'utf8'))
const currentByIdentity = new Map(current.rows.map(row => [`${row.client_id}:${row.strategy_month}`, row]))
const proposals = [
  ...fleet.rows.filter(row => row.disposition === 'ready').map(row => ({ ...row, proposed_hash: row.proposed_strategy_hash })),
  ...neshora.rows.map(row => ({ ...row, proposed_hash: sha(row.proposed_strategy_data) })),
]

const rows = proposals.map(proposal => {
  const identity = `${proposal.client_id}:${proposal.strategy_month}`
  const live = currentByIdentity.get(identity)
  const errors = qualityErrors(proposal.proposed_strategy_data)
  const matches = live?.strategy_hash === proposal.proposed_hash
  return {
    client_id: proposal.client_id,
    client_name: proposal.client_name,
    strategy_month: proposal.strategy_month,
    current_strategy_id: live?.strategy_id ?? null,
    current_version: live?.current_version ?? null,
    current_status: live?.current_status ?? 'draft',
    current_strategy_hash: live?.strategy_hash ?? null,
    reviewed_strategy_hash: proposal.proposed_hash,
    quality_status: errors.length === 0 ? 'quality_review_passed' : 'blocked',
    quality_errors: errors,
    canonical_readiness: errors.length > 0
      ? 'blocked'
      : matches
        ? 'current_draft_matches_review'
        : 'requires_separate_canonical_amendment',
  }
}).sort((a, b) => a.client_name.localeCompare(b.client_name) || a.strategy_month.localeCompare(b.strategy_month))

if (rows.length !== 94 || new Set(rows.map(row => row.client_id)).size !== 47) {
  throw new Error('Issue #567 readiness must cover exactly 94 rows / 47 clients.')
}

const output = {
  schema_version: 1,
  issue: 567,
  mode: 'zero_write_strategy_quality_readiness',
  generated_at: '2026-09-27T00:00:00+02:00',
  write_count: 0,
  production_observation: { canonical_sep_oct_rows: 114, amended_v2_rows: 94, drafts: 114, approved: 0, published: 0 },
  counts: {
    reviewed_rows: rows.length,
    reviewed_clients: new Set(rows.map(row => row.client_id)).size,
    quality_review_passed: rows.filter(row => row.quality_status === 'quality_review_passed').length,
    blocked: rows.filter(row => row.quality_status === 'blocked').length,
    current_draft_matches_review: rows.filter(row => row.canonical_readiness === 'current_draft_matches_review').length,
    requires_separate_canonical_amendment: rows.filter(row => row.canonical_readiness === 'requires_separate_canonical_amendment').length,
  },
  approval_publication_gate: 'No strategy was amended, approved or published. Rows requiring amendment must use the existing exact-client optimistic contract in a separately authorised action before any approval review.',
  rows,
}

writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({ output: OUTPUT, ...output.counts }, null, 2)}\n`)
