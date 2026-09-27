import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const DIR = join(ROOT, 'artifacts/client-strategy-dossiers/issue-513')
const SOURCE = join(DIR, 'neshora-strategy-source-snapshot.json')
const DOSSIER_INDEX = join(DIR, 'index.json')
const OUTPUT = join(DIR, 'neshora-strategy-readiness-dry-run.json')

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

const source = JSON.parse(readFileSync(SOURCE, 'utf8'))
const index = JSON.parse(readFileSync(DOSSIER_INDEX, 'utf8'))
const expectedId = '3c20fae1-8e91-41d5-98eb-1c331600e6e3'
const dossier = index.clients.find(client => client.id === expectedId)

if (source.write_count !== 0 || source.client?.id !== expectedId || source.client?.name !== 'Neshora Oxygen' || source.client?.active !== true) {
  throw new Error('Neshora source snapshot identity or read-only contract is invalid.')
}
if (!dossier || dossier.strategy_status !== 'ready' || dossier.blockers.length !== 0) {
  throw new Error('Neshora dossier must be review-ready before draft creation.')
}

const settings = source.client.package_settings
if (settings.professional_videos_per_month !== 1 || settings.photo_posts_per_month !== 4 || settings.design_posters_per_month !== 4) {
  throw new Error('Neshora confirmed package quantities drifted.')
}
for (const field of ['reels_per_month', 'animated_posters_per_month', 'campaign_management_included', 'monthly_campaign_budget']) {
  if (settings[field] !== null) throw new Error(`Neshora unknown field ${field} must remain null.`)
}

const missing = Object.entries(source.evidence_counts).filter(([, count]) => count === 0).map(([name]) => name)

function proposal(strategyMonth) {
  const month = strategyMonth.slice(0, 7)
  const isOctober = month === '2026-10'
  const direction = isOctober
    ? 'Use the 21 September first-party shoot as the primary October visual bank and establish Neshora through calm, human-first brand storytelling.'
    : 'Introduce Neshora with the exact current brand identity and first-party lifestyle shoot while avoiding unsupported service or medical claims.'

  return {
    strategyDrivers: [
      'Confirmed package: 1 professional video, 4 photo posts and 4 design posters per month.',
      'Current Brand Identity folder contains exact Neshora logo/wordmark assets and a glossy logo motion asset.',
      'The 21 September 2026 first-party shoot contains 79 photo/video assets in the October production folder.',
      'Reviewed shoot samples show a real person wearing a nasal oxygen cannula in calm everyday/lifestyle scenes.',
    ],
    strategyGoingForward: direction,
    clientActionsRequired: [
      'Confirm exact current products/services, contact details and any factual education points before they appear in poster copy.',
      'Approve any health, safety, device or oxygen-use factual claim before publication.',
    ],
    actionPlan: {
      professional_video: {
        enabled: true,
        items: ['One concise human-first Neshora brand/lifestyle introduction using the real September shoot and exact brand identity.'],
        notes: 'Confirmed package capacity: 1 per month. Avoid clinical promises or inferred product/service claims.',
      },
      reels: { enabled: false, items: [], notes: 'Reel capacity is unknown and remains disabled.' },
      photo_content: {
        enabled: true,
        items: [
          'Real lifestyle portrait from the September shoot with identity-led copy.',
          'Second human moment from the same shoot focused on calm, everyday brand presence.',
          'Brand-and-person detail frame using only visible, exact creative evidence.',
          'Fourth first-party lifestyle image selected for variety without inventing diagnosis, outcome or device details.',
        ],
        notes: 'Confirmed package capacity: 4 per month.',
      },
      design_poster: {
        enabled: true,
        items: [
          'Brand introduction / Neshora identity.',
          'Identity-led trust visual using exact logo treatment.',
          'Client-fact placeholder: exact service/product information only after confirmation.',
          'Client-fact placeholder: approved educational or contact information only after confirmation.',
        ],
        notes: 'Confirmed package capacity: 4 per month. Factual service/medical copy remains evidence-gated.',
      },
      animated_poster: { enabled: false, items: [], notes: 'Animated-poster capacity is unknown and remains disabled.' },
      campaign_recommendation: { enabled: false, items: [], notes: 'No campaign-management entitlement or budget is inferred.' },
    },
    goldStandard: {
      objective: isOctober
        ? 'Establish Neshora’s first complete month of recognisable, human-first social content using the exact September shoot and current brand assets while staying strictly inside the confirmed 1 video / 4 photo / 4 poster package.'
        : 'Introduce Neshora consistently from the exact current brand assets and real September lifestyle shoot, creating a factual baseline without inventing products, medical outcomes, contacts or service terms.',
      audienceAndIntent: 'Current evidence does not justify invented demographic or diagnosis segments. Address viewers who need to understand who Neshora is through calm, real-life brand presentation, and use direct factual intent only when client-approved service or product information is supplied.',
      coreMessage: 'Neshora should be presented through real people, calm everyday imagery and a clean premium identity. The content may show oxygen use that exists in the supplied shoot, but it must never turn that visual into an unsupported therapeutic, diagnostic or outcome claim.',
      formatsAndRationale: 'Use exactly the confirmed monthly capacity: one professional video for the strongest brand/lifestyle narrative, four first-party photo posts for human proof and visual variety, and four design posters for identity or separately confirmed facts. Reels, animated posters and campaign work remain disabled because their package status is unknown.',
      testAndChange: 'Use the first complete month as a baseline test between human/lifestyle shoot content and identity-led graphic content. Change direction only from real Neshora platform response once provider coverage exists; missing metrics are unavailable evidence, not zero performance.',
      pillarsAndHooks: 'Pillars are limited to exact evidence: Neshora brand identity, real human/lifestyle oxygen-use imagery from the September shoot, behind-the-brand visual trust, and client-confirmed factual information. Hooks should come from the real person or moment shown rather than generic healthcare slogans.',
      mustAvoid: 'Do not invent product models, prices, rentals, delivery, emergency availability, operating hours, contacts, diagnoses, clinical outcomes, oxygen-flow/device specifications or medical/safety advice. Do not infer a condition from the person photographed and do not use stock claims as Neshora truth.',
      channelIntegration: 'Carry the same exact Neshora identity and first-party shoot across only authorised social channels. TikTok/Instagram provider access is operational state, not evidence of additional services; no extra format or channel entitlement may be inferred from account availability.',
      successSignals: 'Once provider analytics are available, compare real reach, video views and interactions for human/lifestyle assets versus identity-led graphics. Until then, success is factual consistency, complete use of the confirmed package and zero unsupported claims rather than invented numerical targets.',
      nextMonthGamePlan: isOctober
        ? 'Use October as the clean baseline month, then carry forward only the human-vs-graphic creative patterns supported by real Neshora metrics and newly confirmed client facts. Keep all unknown package fields disabled.'
        : 'Use the September introduction to seed October’s full package from the existing 21 September shoot, then add only client-confirmed product/service facts and measure the first complete month before expanding any content pillar.',
    },
  }
}

const rows = ['2026-09-01', '2026-10-01'].map(strategyMonth => ({
  client_id: expectedId,
  client_name: source.client.name,
  strategy_month: strategyMonth,
  disposition: 'ready_for_draft_creation',
  reason: 'REVIEWED_EXACT_CLIENT_INTELLIGENCE_READY_CANONICAL_DRAFT_MISSING',
  source_evidence_hash: dossier.evidence_hash,
  package: {
    professional_videos_per_month: 1,
    photo_posts_per_month: 4,
    design_posters_per_month: 4,
  },
  unavailable_evidence: missing.filter(name => name !== 'client_guides'),
  reviewed_intelligence_sources: [
    'OneDrive:/Clients/Neshora Oxygen/Brand Identity',
    'OneDrive:/Clients/Neshora Oxygen/VIDEOS/2026/2026_10_OCT/2026_09_21',
    'https://github.com/CGProductionHouse/CG-Dynamics/issues/516#issuecomment-5801092086',
  ],
  proposed_strategy_data: proposal(strategyMonth),
  safe_next_action: 'Create this exact client/month as a canonical draft through the existing monthly strategy contract, then review before any approval or publication.',
}))

const core = {
  schema_version: 2,
  issue: 513,
  mode: 'dry_run',
  write_count: 0,
  preserves_reviewed_plan_hash: '4f84133b981aa449b0805fc11424c06f8acb2ec73b72cedcc0795a83502fef6b',
  source_snapshot_hash: sha(source),
  counts: { blocked: 0, ready_for_draft_creation: 2 },
  rows,
}
const output = { ...core, plan_hash: sha(core) }
writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({ output: OUTPUT, plan_hash: output.plan_hash, ...output.counts }, null, 2)}\n`)
