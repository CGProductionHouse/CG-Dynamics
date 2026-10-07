import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

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

export function qualityErrors(strategy) {
  if (!strategy || typeof strategy !== 'object' || Array.isArray(strategy)) return ['MISSING_STRATEGY_COPY']
  const text = JSON.stringify(strategy)
  const errors = []
  if (FORBIDDEN.some(pattern => pattern.test(text))) errors.push('INTERNAL_OR_NON_STRATEGY_COPY')
  if (GENERIC.some(pattern => pattern.test(text))) errors.push('GENERIC_FILLER')
  return errors
}

export function buildReadiness({ fleet, neshora, current, generatedAt }) {
if (typeof generatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(generatedAt) || !Number.isFinite(Date.parse(generatedAt))) throw new Error('Explicit generation timestamp required')
const key = row => `${row.client_id}:${row.strategy_month}`
const index = rows => {
  const result = new Map()
  for (const row of rows) {
    if (typeof row.client_id !== 'string' || !row.client_id || !['2026-09-01', '2026-10-01'].includes(row.strategy_month)) throw new Error('Invalid exact client/month identity')
    if (result.has(key(row))) throw new Error('Duplicate exact client/month identity')
    result.set(key(row), row)
  }
  return result
}
const currentByIdentity = index(current.rows)
const proposals = [
  // Keep blocked social rows in the matrix: extraction becoming more honest
  // must not silently remove clients from the readiness denominator.
  ...fleet.rows.filter(row => ['ready', 'blocked'].includes(row.disposition)).map(row => ({ ...row, proposed_hash: row.proposed_strategy_hash ?? null })),
  ...neshora.rows.map(row => ({ ...row, proposed_hash: row.proposed_strategy_data ? sha(row.proposed_strategy_data) : null })),
]
index(proposals)

const rows = proposals.map(proposal => {
  const identity = `${proposal.client_id}:${proposal.strategy_month}`
  const live = currentByIdentity.get(identity)
  const errors = proposal.disposition === 'blocked'
    ? ['INSUFFICIENT_EXACT_STRATEGY_EVIDENCE']
    : qualityErrors(proposal.proposed_strategy_data)
  if (proposal.disposition !== 'blocked' && !proposal.proposed_hash) errors.push('PROPOSAL_HASH_MISSING')
  if (proposal.proposed_hash && proposal.proposed_strategy_data && sha(proposal.proposed_strategy_data) !== proposal.proposed_hash) errors.push('PROPOSAL_HASH_MISMATCH')
  const matches = typeof proposal.proposed_hash === 'string' && /^[a-f0-9]{64}$/.test(proposal.proposed_hash) && live?.strategy_hash === proposal.proposed_hash
  return {
    client_id: proposal.client_id,
    client_name: proposal.client_name,
    strategy_month: proposal.strategy_month,
    current_strategy_id: live?.strategy_id ?? null,
    current_version: live?.current_version ?? null,
    current_status: live?.current_status ?? null,
    current_strategy_hash: live?.strategy_hash ?? null,
    reviewed_strategy_hash: proposal.proposed_hash,
    quality_status: errors.length === 0 ? 'copy_screen_passed_requires_semantic_review' : 'blocked',
    semantic_review_status: 'not_established_by_this_screen',
    quality_errors: errors,
    canonical_readiness: errors.length > 0
      ? 'blocked'
      : !live
        ? 'current_evidence_unavailable'
      : matches
        ? 'current_copy_matches_proposal'
        : 'requires_separate_canonical_amendment',
  }
}).sort((a, b) => a.client_name.localeCompare(b.client_name) || a.strategy_month.localeCompare(b.strategy_month))

if (rows.length !== 94 || new Set(rows.map(row => row.client_id)).size !== 47) {
  throw new Error('Issue #567 readiness must cover exactly 94 rows / 47 clients.')
}

const output = {
  schema_version: 2,
  issue: 567,
  mode: 'zero_write_strategy_quality_readiness',
  generated_at: generatedAt,
  write_count: 0,
  source_observation: {
    generated_at: current.generated_at ?? null,
    counts: Object.fromEntries(['canonical_sep_oct_rows', 'approved', 'published'].map(field => [field, Number.isSafeInteger(current.counts?.[field]) && current.counts[field] >= 0 ? current.counts[field] : null])),
    freshness: 'historical_input_not_live_verification',
  },
  counts: {
    screened_rows: rows.length,
    screened_clients: new Set(rows.map(row => row.client_id)).size,
    semantic_review_passed: 0,
    copy_screen_passed_requires_semantic_review: rows.filter(row => row.quality_status === 'copy_screen_passed_requires_semantic_review').length,
    blocked: rows.filter(row => row.quality_status === 'blocked').length,
    current_copy_matches_proposal: rows.filter(row => row.canonical_readiness === 'current_copy_matches_proposal').length,
    current_evidence_unavailable: rows.filter(row => row.canonical_readiness === 'current_evidence_unavailable').length,
    requires_separate_canonical_amendment: rows.filter(row => row.canonical_readiness === 'requires_separate_canonical_amendment').length,
  },
  approval_publication_gate: 'Copy screening and matching hashes do NOT prove a client-specific strategy or semantic approval. Review exact business objective, audience/obstacle, creative choices, package, timing, source support and measurement separately. No strategy was amended, approved or published. This output authorizes no transition.',
  rows,
}
return output
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
// Never overwrite frozen reviewed evidence by running this script without an
// explicit isolated output directory. Historical artifacts remain audit receipts.
const frozen = resolve(ROOT, 'artifacts/client-strategy-dossiers/issue-513')
const normalise = path => process.platform === 'win32' ? path.toLowerCase() : path
const frozenReal = normalise(realpathSync(frozen))
const isFrozen = path => {
  const real = normalise(realpathSync(path))
  return real === frozenReal || real.startsWith(`${frozenReal}/`) || real.startsWith(`${frozenReal}\\`)
}
if (!process.env.CG_STRATEGY_ARTIFACT_DIR || isFrozen(DIR) || (existsSync(OUTPUT) && isFrozen(OUTPUT))) throw new Error('Use an isolated CG_STRATEGY_ARTIFACT_DIR; frozen evidence must remain unchanged')
const output = buildReadiness({
  fleet: JSON.parse(readFileSync(FLEET, 'utf8')),
  neshora: JSON.parse(readFileSync(NESHORA, 'utf8')),
  current: JSON.parse(readFileSync(CURRENT, 'utf8')),
  generatedAt: new Date().toISOString(),
})
writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({ output: OUTPUT, ...output.counts }, null, 2)}\n`)
}
