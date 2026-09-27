import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const DIR = join(ROOT, 'artifacts/client-strategy-dossiers/issue-513')
const SOURCE = join(DIR, 'strategy-source-snapshot.json')
const INDEX = join(DIR, 'index.json')
const OUTPUT = join(DIR, 'sep-oct-strategy-mutation-dry-run.json')

const HELD = new Set([])
const NON_APPLICABLE = new Set([
  'Econofoods', 'First Technology Central', 'Kundedienste', 'Local Deli', 'Rusoord Farmstay',
  'Agri-Secure', 'Bloem Vascular', 'Ipopeng Office Supplies', 'Mimosa Mall', 'NCNA',
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

function usableEvidence(values) {
  const seen = new Set()
  return values.map(value => String(value ?? '').replace(/\s+/g, ' ').replace(/[.;]+$/, '').trim())
    .filter(value => value.length >= 8)
    .filter(value => !/(^exact client id:|^client id:|^tier:|https?:\/\/|^[0-9a-f]{8}-[0-9a-f-]{27,}$|CGProductionHouse\/|\.(?:pdf|md|json)\b|\bPDFs?\b|\b(?:repo(?:sitory)?|github|evidence|dossier|source pack|dynamics intelligence|this guide|authoritative public sources|old project|current client\/CG Production House correction)\b)/i.test(value))
    .filter(value => !/Correct facts are only the starting point/i.test(value))
    .filter(value => {
      const key = value.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function packageSummary(settings) {
  const mapping = [
    ['professional_videos_per_month', 'professional videos'],
    ['reels_per_month', 'reels'],
    ['photo_posts_per_month', 'photo posts'],
    ['design_posters_per_month', 'design posters'],
    ['animated_posters_per_month', 'animated posters'],
  ]
  const known = []
  const unknown = []
  for (const [field, label] of mapping) {
    const value = settings[field]
    if (Number.isInteger(value)) known.push(`${value} ${label}`)
    else unknown.push(label)
  }
  const other = typeof settings.other_agreed_deliverables === 'string' ? settings.other_agreed_deliverables.trim() : ''
  if (other) known.push(`other agreed scope: ${other}`)
  const knownText = known.length > 0 ? known.join(', ') : 'no fixed monthly quantities are confirmed'
  const unknownText = unknown.length > 0 ? `; unknown capacities remain disabled for ${unknown.join(', ')}` : ''
  return `Confirmed package scope: ${knownText}${unknownText}`
}

function buildGoldStandard({ live, drivers, recommendations, constraints }) {
  const evidence = usableEvidence(drivers)
  const actions = usableEvidence(recommendations)
  const direction = actions.slice(0, 3).join(' ') || evidence[0]
  const primary = actions[0] || evidence[0]
  const secondary = actions[1] || evidence[1] || primary
  const tertiary = actions[2] || evidence[2] || secondary
  const guardrails = usableEvidence(constraints).slice(0, 3)
  const guardrailText = guardrails.length > 0 ? guardrails.join('; ') : 'unverified offers, dates, prices, quantities, access claims or unsupported business facts'
  const scope = packageSummary(live.package_settings)
  const month = live.strategy_month.slice(0, 7)

  return {
    objective: `${live.name} ${month}: ${direction}. Keep every execution inside the confirmed monthly package.`,
    audienceAndIntent: `Audience detail is not confirmed. Shape each ${live.name} piece around the specific customer situation, asset and occasion named in the approved brief; do not invent demographics or intent.`,
    coreMessage: `${primary}. Add ${secondary.toLowerCase()} so the work gives people a useful reason to notice or act instead of merely repeating supplied artwork.`,
    formatsAndRationale: `${scope}. Use each enabled format to carry the approved message in a way suited to the supplied asset; do not infer capacity from posting history.`,
    testAndChange: `Test one controlled execution change: ${tertiary}. Keep the offer and business facts stable, then assess only available platform or enquiry signals.`,
    pillarsAndHooks: `Open with the real asset, customer situation or occasion. Then ${primary.toLowerCase()} and ${secondary.toLowerCase()}. Each hook must name the relevant branch, service or product when the brief confirms it.`,
    mustAvoid: `For ${live.name}, avoid ${guardrailText}. Also avoid invented package quantities, offers, dates, prices, audience claims or services outside confirmed scope.`,
    channelIntegration: `Carry the same approved message across only the channels and formats CG manages for ${live.name}. Adapt the opening and call to action per channel without adding an unsupported service or provider claim.`,
    successSignals: `Use only available views, interactions, profile actions or enquiries for ${month}; an unavailable metric stays unavailable and no target is invented.`,
    nextMonthGamePlan: `Sequence the work around these priorities: ${primary}; ${secondary}; ${tertiary}. Retain only the executions supported by the observed response and the next approved brief.`,
  }
}

function packageActionPlan(settings, recommendations, facts) {
  const sourceItems = usableEvidence([...recommendations, ...facts]).slice(0, 4)
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
      notes: enabled ? `Confirmed package capacity: ${quantity} per month; concepts remain subject to staff review.` : '',
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
      approved_at: live.approved_at,
      published_at: live.published_at,
      current_strategy_hash: sha(live.strategy_data),
      current_seed_context_hash: sha(live.seed_context),
      current_internal_notes: live.internal_notes ?? null,
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

  const verification = live.package_settings?.verification
  if (
    verification?.status !== 'confirmed'
    || ![1, 2].includes(Number(verification?.version))
    || !verification?.confirmed_at
    || !verification?.confirmed_by_profile_id
    || !Array.isArray(verification?.source_references)
    || verification.source_references.length === 0
  ) {
    rows.push({ ...base, disposition: 'blocked', reason: 'PACKAGE_PROVENANCE_INCOMPLETE' })
    continue
  }

  const markdown = readFileSync(join(DIR, dossier.file), 'utf8')
  const facts = section(markdown, 'Verified facts')
  const constraints = section(markdown, 'Client and CG constraints')
  const observations = section(markdown, 'Research observations')
  const recommendations = section(markdown, 'Evidence-backed recommendations')
  const meaningfulFacts = usableEvidence(facts)
  const safeRecommendations = usableEvidence(recommendations)
  const drivers = usableEvidence([...safeRecommendations, ...meaningfulFacts, ...observations]).slice(0, 8)
  if (safeRecommendations.length === 0) {
    rows.push({ ...base, disposition: 'blocked', reason: 'INSUFFICIENT_EXACT_STRATEGY_EVIDENCE' })
    continue
  }

  const guideMetaPath = join(DIR, 'runtime-guides', `${dossier.file.replace(/\.md$/, '')}.meta.json`)
  let guideId = live.seed_context?.sources?.client_guide_id ?? null
  try { guideId = JSON.parse(readFileSync(guideMetaPath, 'utf8')).guide_id } catch {}

  const actionPlan = packageActionPlan(live.package_settings, safeRecommendations, meaningfulFacts)
  const proposed = {
    ...live.strategy_data,
    strategyDrivers: drivers,
    strategyGoingForward: safeRecommendations.slice(0, 3).join(' '),
    clientActionsRequired: usableEvidence(constraints).filter(value => /confirm|verify|approval|current|must|do not|unknown|correct|valid/i.test(value)).slice(0, 6),
    actionPlan,
    goldStandard: buildGoldStandard({ live, drivers, recommendations: safeRecommendations, constraints }),
  }
  const proposedSeed = {
    ...live.seed_context,
    origin: 'issue_513_reviewed_dossier_plan',
    blockers: [],
    sources: {
      ...(live.seed_context?.sources ?? {}),
      client_guide_id: guideId,
      package_verification_confirmed_at: verification.confirmed_at,
      package_verification_actor_id: verification.confirmed_by_profile_id,
      package_source_references: verification.source_references,
      package_verification_version: verification.version,
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
    proposed_internal_notes: live.internal_notes ?? null,
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
  schema_version: 2,
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
