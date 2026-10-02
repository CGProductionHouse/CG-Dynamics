// Offline evidence compiler only: no network, credentials, RPC execution or apply mode.
import { readFileSync, writeFileSync, realpathSync } from 'node:fs'
import { resolve, relative, isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'
import { sha } from './audit-monthly-strategy-approval-manifest.mjs'
import { indexOverrides, validateOverride } from './strategy-quality-reviewed-overrides.mjs'

const ROOT = resolve(import.meta.dirname, '..')
const FROZEN = resolve(ROOT, 'artifacts/client-strategy-dossiers/issue-513')
const NESHORA_EVIDENCE = '376630a6efc1dc5b008b25d4808832b9f8a384226c9974fb6ff3f1c36237ec33'
const PACKAGE_FIELDS = { professional_video: 'professional_videos_per_month', reels: 'reels_per_month', photo_content: 'photo_posts_per_month', design_poster: 'design_posters_per_month', animated_poster: 'animated_posters_per_month' }
const CLIENT_FIELDS = ['strategyDrivers', 'strategyGoingForward', 'clientActionsRequired', 'goldStandard', 'actionPlan', 'clientDirection', 'clientRequestNotes']
const INTERNAL = /(?:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}|\b(?:repository|repo|github|dossier|seed_context|source_id|evidence|workflow|staff review|source pack)\b|\.(?:md|pdf|json)\b|(?:docs|artifacts|sources)[\\/]|\b(?:increase engagement|build brand awareness|post consistently|create engaging content)\b)/i

export function fingerprint(row) { return sha(row) }
function deterministicUuid(seed) {
  const hex = sha(seed).slice(0,32).split('')
  hex[12] = '5'; hex[16] = ((parseInt(hex[16],16) & 3) | 8).toString(16)
  const value = hex.join('')
  return `${value.slice(0,8)}-${value.slice(8,12)}-${value.slice(12,16)}-${value.slice(16,20)}-${value.slice(20)}`
}
export function changes(before, after, path = '') {
  if (sha(before ?? null) === sha(after ?? null)) return []
  if (before && after && !Array.isArray(before) && !Array.isArray(after) && typeof before === 'object' && typeof after === 'object') {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].sort().flatMap(key => changes(before[key], after[key], path ? `${path}.${key}` : key))
  }
  return [{ field: path, current: before ?? null, proposed: after ?? null }]
}
function overlay(current, proposal) {
  if (!proposal || Array.isArray(proposal) || typeof proposal !== 'object') return structuredClone(proposal)
  return Object.fromEntries([...new Set([...Object.keys(current ?? {}), ...Object.keys(proposal)])].map(key => [key, Object.hasOwn(proposal, key) ? overlay(current?.[key], proposal[key]) : structuredClone(current[key])]))
}

export function neshoraCopyCorrection(data) {
  const next = structuredClone(data)
  const replacements = {
    'actionPlan.photo_content.items': ['Real lifestyle portrait from the September shoot with identity-led copy.', 'Second human moment from the same shoot focused on calm, everyday brand presence.', 'Brand-and-person detail frame using only the supplied image and exact creative details.', 'Fourth first-party lifestyle image selected for variety without inventing diagnosis, outcome or device details.'],
    'actionPlan.design_poster.notes': 'Confirmed package capacity: 4 per month. Factual service and medical copy requires client confirmation.',
    'goldStandard.audienceAndIntent': 'Demographic and diagnosis segments have not been confirmed. Address viewers who need to understand who Neshora is through calm, real-life brand presentation, and use direct factual intent only when client-approved service or product information is supplied.',
    'goldStandard.pillarsAndHooks': 'Pillars are limited to supplied material: Neshora brand identity, real human/lifestyle oxygen-use imagery from the September shoot, behind-the-brand visual trust, and client-confirmed factual information. Hooks should come from the real person or moment shown rather than generic healthcare slogans.',
    'goldStandard.channelIntegration': 'Carry the same exact Neshora identity and first-party shoot across only authorised social channels. TikTok/Instagram provider access does not confirm additional services; no extra format or channel entitlement may be inferred from account availability.',
    'goldStandard.testAndChange': 'Use the first complete month as a baseline test between human/lifestyle shoot content and identity-led graphic content. Change direction only from real Neshora platform response once provider coverage exists; missing metrics are unavailable, not zero performance.',
  }
  for (const [path, value] of Object.entries(replacements)) { const keys = path.split('.'); let node = next; for (const key of keys.slice(0,-1)) node = node[key]; node[keys.at(-1)] = value }
  return next
}

// Explicit correction grounded ONLY in the committed Piek operational guide sections
// 1, 3, 7–12, 13–17. No new branches, partners, contacts, offers or format entitlement.
export function piekCorrection(data, month) {
  const next = structuredClone(data)
  next.strategyDrivers = ['Piek Group has distinct group, Engen, Sasol and Get Together identities; each piece needs its own voice rather than a single fuel-station message.', 'Get Together is a restaurant and coffee-shop gathering place: food, coffee, relaxed tables and real people are its visual starting points.', 'The monthly package contains four professional videos and twelve design posters; other format quantities remain unconfirmed.']
  next.strategyGoingForward = 'Make the fuel, food and convenience network easier to recognise without flattening its brands. Show the people and operations behind Piek Group, practical customer moments for Engen and Sasol, and relaxed food-and-coffee visits for Get Together. Name the branch actually shown; do not transfer a partner or offer to another location.'
  next.clientActionsRequired = ['Confirm the branch and current partner or service for each selected visual before copy is finalised.', 'Resolve the publishing-email discrepancy before adding an email address; do not silently substitute a contact.', 'Confirm any menu, price, promotion, voting deadline or operating-hour claim before it is used.']
  next.actionPlan.professional_video.items = ['Piek Group: a people-and-operations story from the supplied network footage.', 'Engen: one practical customer moment at the branch actually filmed.', 'Sasol: a helpful service story tied to the location and partner shown.', 'Get Together: a slower food-and-coffee walkthrough with real table or staff moments.']
  next.actionPlan.professional_video.notes = 'Four professional videos per month. These are proposed creative angles, not a booked shoot or a promise of footage that does not exist.'
  next.actionPlan.design_poster.items = ['Rotate group, Engen, Sasol and Get Together messages across the twelve-poster capacity, choosing the balance from available visuals and confirmed needs.', 'For practical service pieces, use the actual service as the title and one distinct customer detail as the subtitle.', 'Keep restaurant pieces warm and food-led; keep fuel/service pieces clear and location-specific.']
  next.actionPlan.design_poster.notes = 'Twelve design posters per month; no invented equal allocation between brands, promotion or scheduled date.'
  next.actionPlan.campaign_recommendation.notes = 'No paid campaign or budget is included in this proposal.'
  next.goldStandard = {
    objective: `For ${month}, make Piek’s fuel, food and convenience network recognisable through four distinct brand voices, using four professional videos and twelve design posters without borrowing branch facts between locations.`,
    audienceAndIntent: 'Help a person choosing a local fuel or convenience stop understand the Engen or Sasol location shown. Give Get Together viewers a reason to picture a relaxed food-and-coffee visit. Use group-level stories for people interested in Piek’s network and team, without claiming demographic segments.',
    coreMessage: 'One Piek network, distinct reasons to visit: practical Engen and Sasol service moments, welcoming Get Together tables, and the people behind the group. Match each message to its actual brand and branch.',
    formatsAndRationale: 'Four professional videos allow human operations and real hospitality moments to breathe. Twelve design posters carry concise service or food messages with one useful supporting detail. Photo posts, reels and animated posters remain unconfirmed; this plan adds no capacity for them.',
    testAndChange: 'Within Get Together, compare a calm food-or-coffee detail opening with a welcoming table or walkthrough opening when those visuals exist. Keep the location and factual offer consistent; only change the opening, then compare available responses rather than inventing an uplift.',
    pillarsAndHooks: 'Piek: people and network operations. Engen and Sasol: an actual local service moment, with the right brand visible. Get Together: coffee pouring, food detail and relaxed social tables. Start from a moment in the supplied visual rather than an interchangeable journey slogan.',
    mustAvoid: 'Do not mix Sasol branding into Engen pieces, transfer a partner between branches, reduce Get Together to a convenience coffee stop, or reinstate old branch rosters. Do not invent promotions, menus, hours, contacts or footage. Avoid forced audio, stock hospitality scenes and flashy transitions for Get Together.',
    channelIntegration: 'Keep group stories separate from branch-level Engen, Sasol and Get Together pieces on the channels already managed for Piek. Use branch-specific wording where the visual is local; use a consolidated roster only when that publishing pattern is appropriate.',
    successSignals: 'Compare available video views and interactions by brand mode and opening. Check whether enquiries reference the location or hospitality offering shown. If a metric or enquiry record is missing, leave it unavailable; no numerical target or return is claimed.',
    nextMonthGamePlan: 'Carry forward the Get Together opening and the branch-specific service angle only if real responses support them. Refresh the branch and partner details before reuse, and select the next four-video/twelve-poster mix from available visuals and confirmed client priorities.',
  }
  return next
}

export function buildQualityPlan({ snapshot, fleet, neshora, manifest, quality, reviewedOverrides }) {
  const overrides = indexOverrides(reviewedOverrides)
  const live = snapshot.strategies
  const reviews = manifest.rows
  const proposals = [...fleet.rows.filter(r => r.disposition === 'ready'), ...neshora.rows]
  const key = r => `${r.client_id}:${r.strategy_month}`
  const indexed = rows => { const m = new Map(rows.map(r => [key(r), r])); if (m.size !== rows.length) throw new Error('Duplicate exact client/month identity'); return m }
  const liveBy = indexed(live), proposedBy = indexed(proposals), qualityBy = indexed(quality.rows)
  if (live.length !== 114 || reviews.length !== 94 || proposals.length !== 94 || quality.rows.length !== 94 || new Set(reviews.map(r => r.client_id)).size !== 47) throw new Error('Expected exact 114/94/47 partition')
  const reviewedKeys = new Set(reviews.map(key))
  for (const overrideKey of overrides.keys()) if (!reviewedKeys.has(overrideKey)) throw new Error('Override outside exact reviewed partition')
  const excluded = live.filter(r => !reviewedKeys.has(key(r)))
  const expectedExcluded = fleet.rows.filter(r => r.disposition === 'non_applicable')
  if (excluded.length !== 20 || expectedExcluded.length !== 20 || excluded.some(r => !expectedExcluded.some(e => e.strategy_id === r.id && key(e) === key(r)) || r.version !== 1 || r.staff_amended_at || r.workflow_status !== 'draft' || r.approved_at || r.published_at)) throw new Error('Non-applicable partition drift')
  for (const row of excluded) {
    const expected = expectedExcluded.find(e => e.strategy_id === row.id).precondition
    if (sha(row.strategy_data) !== expected.current_strategy_hash || sha(row.seed_context) !== expected.current_seed_context_hash || row.internal_notes !== expected.current_internal_notes) throw new Error(`Frozen non-applicable hash drift: ${row.id}`)
  }
  const rows = reviews.map(review => {
    const current = liveBy.get(key(review)), proposal = proposedBy.get(key(review)), q = qualityBy.get(key(review))
    if (!current || !proposal || !q) throw new Error(`Missing exact identity: ${key(review)}`)
    const stop = []
    const revision = snapshot.revisions?.find(r => r.strategy_id === current.id)
    if (!revision || revision.client_id !== current.client_id || revision.strategy_month !== current.strategy_month || revision.record_version !== current.version || revision.event_kind !== 'amended') stop.push('MISSING_OR_DRIFTED_DURABLE_AMENDMENT_REVISION')
    if (current.id !== review.strategy_id || current.client_name !== review.client_name || current.client_active !== true || current.version !== 2 || !current.staff_amended_at || current.workflow_status !== 'draft' || current.approved_at || current.published_at || current.published_strategy_data != null) stop.push('LIVE_IDENTITY_REVISION_OR_STATUS_DRIFT')
    if (sha(current.strategy_data) !== review.strategy_hash || sha(current.seed_context) !== review.seed_context_hash) stop.push('LIVE_REVIEWED_HASH_DRIFT_PRESERVE_STAFF_CONTENT')
    if (sha(proposal.proposed_strategy_data) !== q.reviewed_strategy_hash) stop.push('COMMITTED_567_PROPOSAL_HASH_DRIFT')
    const pkg = current.package_settings, receipt = pkg?.verification, sources = current.seed_context?.sources
    if (receipt?.status !== 'confirmed' || receipt.version !== sources?.package_verification_version || receipt.confirmed_at !== sources?.package_verification_confirmed_at || receipt.confirmed_by_profile_id !== sources?.package_verification_actor_id || sha(receipt.source_references) !== sha(sources?.package_source_references) || sources?.issue_513_evidence_hash !== review.source_evidence_hash) stop.push('PACKAGE_OR_ORIGINAL_PROVENANCE_DRIFT')
    const isPiek = review.client_name === 'Piek Group', isNeshora = review.client_name === 'Neshora Oxygen'
    let proposed = overlay(current.strategy_data, proposal.proposed_strategy_data)
    if (isPiek) proposed = piekCorrection(proposed, review.strategy_month.slice(0, 7))
    if (isNeshora) proposed = neshoraCopyCorrection(proposed)
    const override = overrides.get(key(review))
    const overrideStops = override ? validateOverride(current, override, revision) : []
    stop.push(...overrideStops)
    if (override && !overrideStops.length) proposed = overlay(current.strategy_data, override.patch)
    for (const [action, field] of Object.entries(PACKAGE_FIELDS)) {
      const enabled = Number.isInteger(pkg?.[field]) && pkg[field] > 0
      if (proposed.actionPlan?.[action]?.enabled !== enabled || (!enabled && proposed.actionPlan?.[action]?.items?.length)) stop.push(`PACKAGE_FORMAT_MISMATCH:${field}`)
    }
    if (proposed.actionPlan?.campaign_recommendation?.enabled) stop.push('UNREVIEWED_CAMPAIGN')
    const text = [...CLIENT_FIELDS.map(f => JSON.stringify(proposed[f])), JSON.stringify(proposed.topContent?.whyItWorked), JSON.stringify(proposed.topContent?.whatThisTellsUs), JSON.stringify(proposed.calendarSelections?.map(e=>({title:e.title,note:e.note})))].join('\n')
    if (INTERNAL.test(text)) stop.push('PROPOSED_INTERNAL_OR_UUID_COPY')
    for (const other of live) if (other.client_id !== current.client_id && other.client_name !== 'CG Production House' && other.client_name.length > 4 && text.toLowerCase().includes(other.client_name.toLowerCase())) stop.push(`FOREIGN_CLIENT_COPY:${other.client_name}`)
    if (isNeshora && (sources?.issue_513_evidence_hash !== NESHORA_EVIDENCE || pkg.professional_videos_per_month !== 1 || pkg.photo_posts_per_month !== 4 || pkg.design_posters_per_month !== 4 || ['reels_per_month', 'animated_posters_per_month', 'campaign_management_included', 'monthly_campaign_budget'].some(f => pkg[f] !== null))) stop.push('NESHORA_546_SCOPE_OR_PROVENANCE_DRIFT')
    // Existing #567 regex approval is not proof of a client-specific monthly plan.
    // Never auto-clear the other 45 clients merely because their names occur in copy.
    if (!isPiek && !isNeshora && (!override || overrideStops.length)) stop.push('CLIENT_SPECIFIC_MONTHLY_QUALITY_REVIEW_REQUIRED_567_IS_NOT_ACCEPTANCE')
    const diff = changes(current.strategy_data, proposed), proposedHash = sha(proposed)
    const preserved = Object.keys(current.strategy_data).filter(f => !diff.some(d => d.field === f || d.field.startsWith(`${f}.`)))
    return {
      ...(override ? { reviewed_override: { packet_hash: reviewedOverrides.packet_hash, reviewed_hash: override.reviewed_hash, source_receipts: override.source_receipts, report_context: override.report_context } } : {}),
      row_id: current.id, client_id: current.client_id, client_name: current.client_name, strategy_month: current.strategy_month,
      current_revision: current.version, current_revision_receipt: revision ?? null, current_status: current.workflow_status, current_strategy_hash: sha(current.strategy_data),
      committed_567_proposed_hash: q.reviewed_strategy_hash, proposed_strategy_hash: proposedHash,
      quality_correction: isPiek ? { source: 'artifacts/client-strategy-dossiers/issue-513/runtime-guides/piek-group.md', sections: [1,3,7,8,9,10,11,12,13,14,15,16,17], reason: 'Replace caption-process directions with four-mode monthly direction; separately reviewed proposal, not silent alteration of #567' } : isNeshora ? { source: '#546; committed neshora-strategy-readiness-dry-run.json', reason: 'Copy-only removal of internal evidence terminology; facts, quantities and provenance unchanged.' } : null,
      amendment_needed: diff.length > 0, disposition: stop.length ? 'blocked' : diff.length ? 'amendment_needed' : 'already_quality_equal',
      stop_reasons: [...new Set(stop)], fields_changed: diff, current_strategy_data: current.strategy_data, proposed_strategy_data: proposed,
      package_receipt: pkg, package_hash: sha(pkg), original_reviewed_provenance: { ...review, seed_context: current.seed_context },
      staff_content_preservation: { internal_notes: current.internal_notes, seed_context: current.seed_context, unchanged_fields: preserved, current_full_fingerprint: fingerprint(current), rule: 'Only this exact reviewed field diff; any later staff edit stops the entire plan, never rebase automatically.' },
      later_guard: { expected_version: current.version, expected_updated_at: current.updated_at, expected_fingerprint: fingerprint(current), idempotency_key: deterministicUuid(`513-quality:${current.id}:${current.version}:${sha(current.strategy_data)}:${proposedHash}:${sha(current.seed_context)}:${sha(pkg)}`), rpc: 'amend_monthly_client_strategy_with_context', seed_context: current.seed_context, internal_notes: current.internal_notes, stop_condition: 'Any identity, version, status, strategy, provenance, notes, package or protected-row fingerprint drift; blocked quality; no explicit protected-action approval.' },
    }
  })
  const core = { schema_version: 1, issue: 513, mode: 'ZERO_WRITE_QUALITY_AMENDMENT_PLAN', write_count: 0, captured_at: snapshot.captured_at, authority: { reviewed_manifest_hash: manifest.manifest_hash, regenerated_fleet_hash: fleet.plan_hash, neshora_plan_hash: neshora.plan_hash }, counts: { reviewed: rows.length, clients: new Set(rows.map(r=>r.client_id)).size, amendment_needed: rows.filter(r=>r.disposition==='amendment_needed').length, already_quality_equal: rows.filter(r=>r.disposition==='already_quality_equal').length, blocked: rows.filter(r=>r.disposition==='blocked').length, differing_payloads: rows.filter(r=>r.amendment_needed).length, non_applicable_untouched: excluded.length, approved: live.filter(r=>r.approved_at).length, published: live.filter(r=>r.published_at).length }, rows, excluded: excluded.map(r=>({ row_id:r.id, client_id:r.client_id, client_name:r.client_name, strategy_month:r.strategy_month, fingerprint:fingerprint(r), database_fingerprint:r.database_fingerprint })) }
  return structuredClone({ ...core, plan_hash: sha(core) })
}

export function assertNoDrift(plan, snapshot) {
  const { plan_hash, ...core } = plan
  if (sha(core) !== plan_hash) throw new Error('Plan hash mismatch')
  if (snapshot.strategies.length !== 114) throw new Error('Snapshot partition drift')
  const byId = new Map(snapshot.strategies.map(r=>[r.id,r]))
  if (byId.size !== 114) throw new Error('Duplicate live row')
  for (const row of [...plan.rows.map(r=>({row_id:r.row_id,fingerprint:r.later_guard.expected_fingerprint})), ...plan.excluded]) if (!byId.has(row.row_id) || fingerprint(byId.get(row.row_id)) !== row.fingerprint) throw new Error(`Drift refusal: ${row.row_id}`)
  for (const row of plan.rows) if (sha(snapshot.revisions?.find(r=>r.strategy_id===row.row_id) ?? null) !== sha(row.current_revision_receipt)) throw new Error(`Revision drift refusal: ${row.row_id}`)
  return true
}

export function assertIsolated(directory) {
  const actual = realpathSync(directory), frozen = realpathSync(FROZEN)
  const rel = relative(frozen, actual)
  if (!rel || (!rel.startsWith('..') && !isAbsolute(rel))) throw new Error('Frozen reviewed artifact directory is forbidden')
  return actual
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (![4,5].includes(process.argv.length)) throw new Error('Usage: node scripts/build-strategy-quality-amendment-plan.mjs LIVE_SNAPSHOT ISOLATED_DIRECTORY [REVIEWED_OVERRIDES] (no apply mode)')
  const directory = assertIsolated(resolve(process.argv[3]))
  const read = path => JSON.parse(readFileSync(path,'utf8'))
  const plan = buildQualityPlan({ snapshot:read(resolve(process.argv[2])), fleet:read(resolve(directory,'sep-oct-strategy-mutation-dry-run.json')), neshora:read(resolve(directory,'neshora-strategy-readiness-dry-run.json')), manifest:read(resolve(FROZEN,'sep-oct-approval-publication-manifest.json')), quality:read(resolve(FROZEN,'issue-567-sep-oct-strategy-quality-readiness.json')), reviewedOverrides:process.argv[4] ? read(resolve(process.argv[4])) : undefined })
  writeFileSync(resolve(directory,'canonical-quality-amendment-plan.json'),`${JSON.stringify(plan,null,2)}\n`)
  process.stdout.write(`${JSON.stringify({plan_hash:plan.plan_hash,...plan.counts},null,2)}\n`)
}
