import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const DIR = join(ROOT, 'artifacts/client-strategy-dossiers/issue-513')
const SOURCE = join(DIR, 'strategy-source-snapshot.json')
const INDEX = join(DIR, 'index.json')
const OUTPUT = join(DIR, 'sep-oct-strategy-mutation-dry-run.json')

const HELD = new Set([
  'Agri-Secure', 'Bloem Vascular', 'Ipopeng Office Supplies', 'Mimosa Mall', 'NCNA',
])
const NON_APPLICABLE = new Set([
  'Econofoods', 'First Technology Central', 'Kundedienste', 'Local Deli', 'Rusoord Farmstay',
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

function section(markdown, title) {
  const match = markdown.match(new RegExp(`## ${title}\\r?\\n\\r?\\n([\\s\\S]*?)(?=\\r?\\n## |$)`, 'i'))
  if (!match) return []
  return match[1].split(/\r?\n/).filter(line => /^- /.test(line)).map(line => line.slice(2).trim())
    .filter(line => !/No exact evidence available|None at dossier level|Missing history is unavailable/i.test(line))
}

function packageActionPlan(settings, recommendations, facts) {
  const sourceItems = [...recommendations, ...facts].slice(0, 4)
  const mapping = {
    professional_video: 'professional_videos_per_month',
    reels: 'reels_per_month',
    photo_content: 'photo_posts_per_month',
    design_poster: 'design_posters_per_month',
    animated_poster: 'animated_posters_per_month',
  }
  const plan = {}
  for (const [key, field] of Object.entries(mapping)) {
    const quantity = settings[field]
    const enabled = Number.isInteger(quantity) && quantity > 0
    plan[key] = {
      enabled,
      items: enabled ? sourceItems.slice(0, Math.min(quantity, sourceItems.length)) : [],
      notes: enabled ? `Confirmed #504 capacity: ${quantity} per month; concepts remain subject to staff review.` : '',
    }
  }
  plan.campaign_recommendation = { enabled: false, items: [], notes: 'No campaign budget or campaign-management entitlement is inferred.' }
  return plan
}

const source = JSON.parse(readFileSync(SOURCE, 'utf8'))
const index = JSON.parse(readFileSync(INDEX, 'utf8'))
const dossierById = new Map(index.clients.map(client => [client.id, client]))
const rows = []

for (const live of source.rows) {
  const dossier = dossierById.get(live.client_id)
  if (!dossier) throw new Error(`Missing exact dossier for ${live.name}`)
  const base = {
    client_id: live.client_id,
    client_name: live.name,
    strategy_id: live.strategy_id,
    strategy_month: live.strategy_month,
    source_evidence_hash: dossier.evidence_hash,
    precondition: {
      workflow_status: live.workflow_status,
      version: live.version,
      updated_at: live.updated_at,
      staff_amended_at: live.staff_amended_at,
      current_strategy_hash: sha(live.strategy_data),
    },
  }
  if (NON_APPLICABLE.has(live.name)) {
    rows.push({ ...base, disposition: 'non_applicable', reason: 'CONFIRMED_NO_RECURRING_SOCIAL_SERVICE_SCOPE' })
    continue
  }
  if (HELD.has(live.name)) {
    rows.push({ ...base, disposition: 'held', reason: 'ISSUE_516_SERVICE_SCOPE_HELD' })
    continue
  }
  if (dossier.strategy_status !== 'ready') {
    rows.push({ ...base, disposition: 'blocked', reason: dossier.blockers.join('+') || 'DOSSIER_NOT_READY' })
    continue
  }
  if (live.workflow_status !== 'draft' || live.staff_amended_at || live.approved_at || live.published_at) {
    rows.push({ ...base, disposition: 'blocked', reason: 'LIVE_STRATEGY_NOT_SAFE_DRAFT' })
    continue
  }

  const markdown = readFileSync(join(DIR, dossier.file), 'utf8')
  const facts = section(markdown, 'Verified facts')
  const constraints = section(markdown, 'Client and CG constraints')
  const observations = section(markdown, 'Research observations')
  const recommendations = section(markdown, 'Evidence-backed recommendations')
  const meaningfulFacts = facts.filter(value => !/^docs\//i.test(value))
  const drivers = [...meaningfulFacts, ...observations, ...recommendations].slice(0, 8)
  if (meaningfulFacts.length === 0 || recommendations.length === 0) {
    rows.push({ ...base, disposition: 'blocked', reason: 'INSUFFICIENT_EXACT_STRATEGY_EVIDENCE' })
    continue
  }
  const guideMetaPath = join(DIR, 'runtime-guides', `${dossier.file.replace(/\.md$/, '')}.meta.json`)
  let guideId = live.seed_context?.sources?.client_guide_id ?? null
  try { guideId = JSON.parse(readFileSync(guideMetaPath, 'utf8')).guide_id } catch {}
  const proposed = {
    ...live.strategy_data,
    strategyDrivers: drivers,
    strategyGoingForward: recommendations.slice(0, 2).join(' '),
    clientActionsRequired: constraints.filter(value => /confirm|verify|approval|current|must|do not|unknown/i.test(value)).slice(0, 6),
    actionPlan: packageActionPlan(live.package_settings, recommendations, meaningfulFacts),
  }
  const proposedSeed = {
    ...live.seed_context,
    origin: 'issue_513_reviewed_dossier_dry_run',
    blockers: [],
    sources: {
      ...(live.seed_context?.sources ?? {}),
      client_guide_id: guideId,
      issue_513_evidence_hash: dossier.evidence_hash,
      issue_515_service_scope: 'eligible',
    },
    source_coverage: {
      ...(live.seed_context?.source_coverage ?? {}),
      client_guide: guideId ? 'available' : 'repository_evidence',
      client_package: 'confirmed',
    },
  }
  rows.push({
    ...base,
    disposition: 'ready',
    reason: 'EXACT_EVIDENCE_AND_CONFIRMED_SOCIAL_SCOPE',
    proposed_strategy_data: proposed,
    proposed_seed_context: proposedSeed,
    proposed_strategy_hash: sha(proposed),
    proposed_seed_context_hash: sha(proposedSeed),
  })
}

const counts = rows.reduce((acc, row) => {
  acc[row.disposition] = (acc[row.disposition] ?? 0) + 1
  const month = row.strategy_month.slice(0, 7)
  acc.by_month[month] ??= { ready: 0, non_applicable: 0, held: 0, blocked: 0 }
  acc.by_month[month][row.disposition] += 1
  if (row.disposition === 'blocked') acc.blocked_reasons[row.reason] = (acc.blocked_reasons[row.reason] ?? 0) + 1
  return acc
}, { ready: 0, non_applicable: 0, held: 0, blocked: 0, by_month: {}, blocked_reasons: {} })

const planCore = {
  schema_version: 1,
  issue: 513,
  mode: 'dry_run',
  write_count: 0,
  source_snapshot_generated_at: source.generated_at,
  service_scope_authority: {
    eligible: 'https://github.com/CGProductionHouse/CG-Dynamics/issues/515',
    held: 'https://github.com/CGProductionHouse/CG-Dynamics/issues/516',
  },
  counts,
  rows,
}
const output = { ...planCore, plan_hash: sha(planCore) }
writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({ output: OUTPUT, plan_hash: output.plan_hash, ...counts }, null, 2)}\n`)
