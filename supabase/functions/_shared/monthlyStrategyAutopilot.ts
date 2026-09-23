// Issue #463 — canonical Monthly Strategy Autopilot pass.
//
// This module deliberately has no scheduler and does not modify the shared worker.
// It prepares current/next-month draft inputs, then delegates the only write to
// #391's seed_monthly_client_strategy RPC. That RPC is the concurrency boundary
// and never updates an existing client/month strategy.

import { getMonthEvents } from '../../../src/lib/contentCalendar.ts'
import { buildMonthlyBaseline } from '../../../src/lib/monthlyStrategySeed.ts'
import { readPackageAuthority } from '../../../src/lib/packageAuthority.ts'
import { readStrategyData } from '../../../src/lib/strategyEngine.ts'
import { cardTargetsAgent } from '../../../src/features/ai-workforce/agents/agentRegistry.ts'

export const STRATEGY_AUTOPILOT_PAGE_SIZE = 500
export const STRATEGY_AUTOPILOT_MAX_CLIENTS = 5_000

type QueryResult = { data: unknown; error: { message: string } | null }
type QueryBuilder = {
  select: (columns: string) => QueryBuilder
  eq: (column: string, value: unknown) => QueryBuilder
  lt: (column: string, value: unknown) => QueryBuilder
  gte: (column: string, value: unknown) => QueryBuilder
  in: (column: string, values: unknown[]) => QueryBuilder
  is: (column: string, value: unknown) => QueryBuilder
  neq: (column: string, value: unknown) => QueryBuilder
  or: (filters: string) => QueryBuilder
  order: (column: string, options: { ascending: boolean }) => QueryBuilder
  limit: (count: number) => QueryBuilder
  range: (from: number, to: number) => QueryBuilder
  maybeSingle: () => Promise<QueryResult>
  then: Promise<QueryResult>['then']
}

export type StrategyAutopilotClient = {
  from: (table: string) => QueryBuilder
  rpc: (name: string, args: Record<string, unknown>) => Promise<QueryResult>
}

type Evidence = { authority: string; source_id: string; field: string; excerpt: string }
type DraftData = {
  version: 1
  clientDirection: string[]
  clientRequestNotes: string
  topContent: {
    autoCaption: string | null
    autoPlatform: string | null
    autoMetricLabel: string | null
    autoMetricValue: number | null
    autoImageUrl: string | null
    coverImageUrl: string
    contentType: string
    whyItWorked: string[]
    whatThisTellsUs: string
  }
  strategyDrivers: string[]
  strategyGoingForward: string
  actionPlan: Record<string, { enabled: boolean; items: string[]; notes: string }>
  clientActionsRequired: string[]
  calendarSelections: Array<{ eventId: string; title: string; date: string | null; use: boolean; note: string }>
  goldStandard: {
    objective: string; audienceAndIntent: string; coreMessage: string; formatsAndRationale: string
    testAndChange: string; pillarsAndHooks: string; mustAvoid: string; channelIntegration: string
    successSignals: string; nextMonthGamePlan: string
  }
}

export type StrategyDraftEnhancer = (input: {
  clientId: string
  clientName: string
  strategyMonth: string
  draft: DraftData
  groundedEvidence: Evidence[]
}) => Promise<DraftData | null>

export interface StrategyAutopilotResult {
  ok: boolean
  operating_date: string
  target_months: string[]
  active_clients: number
  drafts_created: number
  existing_untouched: number
  failed: number
  blocked: number
  blockers: Record<string, number>
  receipts: Array<Record<string, unknown>>
}

const clean = (value: unknown, max = 220) => typeof value === 'string'
  ? value.replace(/\s+/g, ' ').trim().slice(0, max)
  : ''

function monthStart(value: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(value)) throw new Error('Exact first-of-month date required.')
  return value
}

export function strategyAutopilotMonths(today: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error('Operating date must use YYYY-MM-DD.')
  const current = monthStart(`${today.slice(0, 7)}-01`)
  const date = new Date(`${current}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + 1)
  return [current, date.toISOString().slice(0, 10)]
}

async function fetchAll(query: QueryBuilder): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = []
  for (let from = 0; from < STRATEGY_AUTOPILOT_MAX_CLIENTS; from += STRATEGY_AUTOPILOT_PAGE_SIZE) {
    const result = await query.range(from, from + STRATEGY_AUTOPILOT_PAGE_SIZE - 1)
    if (result.error) throw new Error(`Paginated active-client query failed: ${result.error.message}`)
    const page = (result.data ?? []) as Array<Record<string, unknown>>
    rows.push(...page)
    if (page.length < STRATEGY_AUTOPILOT_PAGE_SIZE) return rows
  }
  throw new Error(`Active-client scan exceeded ${STRATEGY_AUTOPILOT_MAX_CLIENTS}-row safety cap.`)
}

function emptyDraft(): DraftData {
  const section = () => ({ enabled: false, items: [] as string[], notes: '' })
  return {
    version: 1,
    clientDirection: [], clientRequestNotes: '',
    topContent: { autoCaption: null, autoPlatform: null, autoMetricLabel: null, autoMetricValue: null, autoImageUrl: null, coverImageUrl: '', contentType: '', whyItWorked: [], whatThisTellsUs: '' },
    strategyDrivers: [], strategyGoingForward: '',
    actionPlan: { professional_video: section(), reels: section(), photo_content: section(), design_poster: section(), animated_poster: section(), campaign_recommendation: section() },
    clientActionsRequired: [], calendarSelections: [],
    goldStandard: { objective: '', audienceAndIntent: '', coreMessage: '', formatsAndRationale: '', testAndChange: '', pillarsAndHooks: '', mustAvoid: '', channelIntegration: '', successSignals: '', nextMonthGamePlan: '' },
  }
}

function deliverableLabel(type: string): string {
  return ({ video: 'professional video', reel: 'reel', photo: 'photo post', dp: 'design poster' } as Record<string, string>)[type] ?? type
}

function addUnique(target: string[], value: string, limit: number) {
  if (value.length >= 12 && !target.some(item => item.toLowerCase() === value.toLowerCase()) && target.length < limit) target.push(value)
}

/** PostgreSQL date semantics: a card remains current through its expiry date. */
export function strategyKnowledgeCardIsCurrent(card: { review_expires_at?: unknown }, operatingDate: string): boolean {
  const expiresOn = clean(card.review_expires_at, 10)
  return !expiresOn || expiresOn >= operatingDate
}

export function approvedIndustryProfile(row: Record<string, unknown> | null): Record<string, unknown> | null {
  return row && (row.review_state === 'reviewed' || row.review_state === 'active') ? row : null
}

async function prepareDraft(sb: StrategyAutopilotClient, client: Record<string, unknown>, strategyMonth: string, operatingDate: string) {
  const clientId = String(client.id)
  const next = new Date(`${strategyMonth}T00:00:00Z`)
  next.setUTCMonth(next.getUTCMonth() + 1)
  const nextMonth = next.toISOString().slice(0, 10)
  const [deliverables, events, prior, report, updates, guide, packageRow, industry, sharedCards, clientCards] = await Promise.all([
    sb.from('monthly_deliverables').select('id,deliverable_type,title').eq('client_id', clientId).eq('month', strategyMonth).is('archived_at', null),
    sb.from('company_calendar_events').select('id,title,event_type,start_at').eq('client_id', clientId).gte('start_at', `${strategyMonth}T00:00:00+02:00`).lt('start_at', `${nextMonth}T00:00:00+02:00`).neq('status', 'cancelled').is('superseded_by_event_id', null),
    sb.from('monthly_client_strategies').select('id,strategy_data').eq('client_id', clientId).lt('strategy_month', strategyMonth).order('strategy_month', { ascending: false }).limit(1).maybeSingle(),
    sb.from('reports').select('id,strategy_data,performance_comments,period_end').eq('client_id', clientId).eq('status', 'published').is('platform', null).lt('period_end', strategyMonth).order('period_end', { ascending: false }).limit(1).maybeSingle(),
    sb.from('client_context_updates').select('id,title,body,decisions').eq('client_id', clientId).eq('review_state', 'incorporated').order('created_at', { ascending: false }).limit(5),
    sb.from('client_guides').select('id,guide_markdown').eq('client_id', clientId).eq('runtime_readiness', 'ready').order('version', { ascending: false }).limit(1).maybeSingle(),
    sb.from('client_packages').select('id').eq('client_id', clientId).eq('status', 'active').lt('start_date', nextMonth).or(`end_date.is.null,end_date.gte.${strategyMonth}`).order('start_date', { ascending: false }).limit(1).maybeSingle(),
    sb.from('client_industry_profiles').select('primary_industry,secondary_industry,review_state').eq('client_id', clientId).maybeSingle(),
    sb.from('skill_cards').select('id,title,principle,summary,knowledge_layer,category,subcategory,active_client_id,review_expires_at,relevant_agents,confidence_level,evidence_label,source_id').eq('status', 'active').is('active_client_id', null).in('knowledge_layer', ['universal_principle', 'south_african_market', 'industry_specific']).or(`review_expires_at.is.null,review_expires_at.gte.${operatingDate}`).limit(30),
    sb.from('skill_cards').select('id,title,principle,summary,knowledge_layer,category,subcategory,active_client_id,review_expires_at,relevant_agents,confidence_level,evidence_label,source_id').eq('status', 'active').eq('active_client_id', clientId).or(`review_expires_at.is.null,review_expires_at.gte.${operatingDate}`).limit(30),
  ])
  for (const result of [deliverables, events, prior, report, updates, guide, packageRow, industry, sharedCards, clientCards]) {
    if (result.error) throw new Error(result.error.message)
  }

  const ds = (deliverables.data ?? []) as Array<Record<string, unknown>>
  const evs = (events.data ?? []) as Array<Record<string, unknown>>
  const updateRows = (updates.data ?? []) as Array<Record<string, unknown>>
  const industryRow = approvedIndustryProfile(industry.data as Record<string, unknown> | null)
  const primaryIndustry = clean(industryRow?.primary_industry, 100).toLowerCase()
  const cardRows = [
    ...((clientCards.data ?? []) as Array<Record<string, unknown>>),
    ...((sharedCards.data ?? []) as Array<Record<string, unknown>>),
  ].filter(card => {
    if (!strategyKnowledgeCardIsCurrent(card, operatingDate)) return false
    const agents = Array.isArray(card.relevant_agents) ? card.relevant_agents.filter((value): value is string => typeof value === 'string') : []
    if (!cardTargetsAgent(agents, 'marketing_strategist') && !cardTargetsAgent(agents, 'content_planner')) return false
    if (card.active_client_id) return card.active_client_id === clientId
    if (card.knowledge_layer !== 'industry_specific') return true
    const labels = `${clean(card.category, 100)} ${clean(card.subcategory, 100)}`.toLowerCase()
    return Boolean(primaryIndustry) && labels.includes(primaryIndustry)
  }).sort((left, right) => String(left.id).localeCompare(String(right.id))).slice(0, 30)
  const draft = emptyDraft()
  const evidence: Evidence[] = []
  const blockers: string[] = []
  const packageAuthority = readPackageAuthority(client.package_settings)
  const guideRow = guide.data as Record<string, unknown> | null
  const previousData = readStrategyData((prior.data as Record<string, unknown> | null)?.strategy_data ?? (report.data as Record<string, unknown> | null)?.strategy_data)
  const baseline = buildMonthlyBaseline({
    clientName: String(client.name),
    guideId: guideRow?.id as string | undefined,
    readyGuideMarkdown: guideRow?.guide_markdown as string | undefined,
    contextUpdates: updateRows.map(row => ({ id: String(row.id), title: clean(row.title), body: clean(row.body, 1_000), decisions: row.decisions })),
    previousDirection: previousData.clientDirection,
    previousDrivers: previousData.strategyDrivers,
    deliverables: ds.map(row => ({ id: String(row.id), deliverable_type: String(row.deliverable_type) })),
  })
  draft.clientDirection = baseline.clientDirection
  draft.strategyDrivers = baseline.strategyDrivers
  evidence.push(...baseline.evidence)
  if (!packageAuthority.settings || !packageAuthority.verification) blockers.push('PACKAGE_UNVERIFIED')
  if (!prior.data && !report.data && updateRows.length === 0 && !guideRow) blockers.push('CLIENT_EVIDENCE_UNVERIFIED')
  if (industryRow?.primary_industry) {
    const value = `Apply relevant ${clean(industryRow.primary_industry, 80)} category context without adding unverified client claims.`
    addUnique(draft.strategyDrivers, value, 6)
  }
  for (const card of cardRows.slice(0, 3)) {
    const value = clean(card.principle || card.summary)
    if (!value) continue
    addUnique(draft.strategyDrivers, value, 6)
    evidence.push({ authority: 'marketing_library_skill_card', source_id: String(card.id), field: 'strategyDrivers', excerpt: value })
  }

  const counts = new Map<string, number>()
  if (packageAuthority.settings) {
    const observedCounts: Array<[string, number | null]> = [
      ['video', packageAuthority.settings.professional_videos_per_month],
      ['reel', packageAuthority.settings.reels_per_month],
      ['photo', packageAuthority.settings.photo_posts_per_month],
      ['dp', packageAuthority.settings.design_posters_per_month],
    ]
    for (const [type, count] of observedCounts) {
      if (typeof count === 'number') counts.set(type, count)
    }
  }
  for (const [type, count] of counts) {
    const key = ({ video: 'professional_video', reel: 'reels', photo: 'photo_content', dp: 'design_poster' } as Record<string, string>)[type]
    if (!key || !draft.actionPlan[key]) continue
    draft.actionPlan[key] = { enabled: count > 0, items: count > 0 ? [`Prepare ${count} ${deliverableLabel(type)}${count === 1 ? '' : 's'} from the confirmed package.`] : [], notes: 'Scope comes from the explicitly confirmed client package; Client Schedule remains execution evidence.' }
  }
  const mix = [...counts].map(([type, count]) => `${count} ${deliverableLabel(type)}${count === 1 ? '' : 's'}`).join(', ')
  if (mix) addUnique(draft.strategyDrivers, `Deliver the confirmed monthly mix: ${mix}.`, 6)
  if (packageAuthority.verification) {
    evidence.push({ authority: 'confirmed_client_package', source_id: clientId, field: 'actionPlan', excerpt: `Confirmed ${packageAuthority.verification.confirmed_at}: ${mix}.` })
  }

  for (const event of evs) {
    const selected = event.event_type === 'client_event'
    draft.calendarSelections.push({ eventId: `company:${event.id}`, title: clean(event.title, 120), date: clean(event.start_at, 10) || null, use: selected, note: selected ? 'Exact-client event recorded in CG Calendar.' : '' })
    evidence.push({ authority: 'company_calendar', source_id: String(event.id), field: 'calendarSelections', excerpt: clean(event.title, 160) })
  }

  const scheduleTypes = new Set(ds.map(row => String(row.deliverable_type)))
  for (const event of getMonthEvents(strategyMonth.slice(0, 7))) {
    const selected = event.deliverables.some(type =>
      (type === 'professional_video' && scheduleTypes.has('video')) ||
      (type === 'reel' && scheduleTypes.has('reel')) ||
      (type === 'photo_post' && scheduleTypes.has('photo')) ||
      (type === 'design_poster' && scheduleTypes.has('dp')),
    )
    draft.calendarSelections.push({ eventId: event.id, title: event.title, date: event.date, use: selected, note: selected ? event.suggestedAngle : '' })
    evidence.push({ authority: 'content_calendar', source_id: event.id, field: 'calendarSelections', excerpt: event.title })
  }

  const reportRow = report.data as Record<string, unknown> | null
  if (reportRow?.id) {
    const postResult = await sb.from('posts').select('id,caption,platform,reach,views,reactions,comments,shares,total_clicks,raw').eq('report_id', reportRow.id).order('reach', { ascending: false }).limit(5)
    if (postResult.error) throw new Error(postResult.error.message)
    const topPost = ((postResult.data ?? []) as Array<Record<string, unknown>>)[0]
    if (topPost) {
      const reach = typeof topPost.reach === 'number' ? topPost.reach : null
      draft.topContent.autoCaption = clean(topPost.caption, 500) || null
      draft.topContent.autoPlatform = clean(topPost.platform, 30) || null
      draft.topContent.autoMetricLabel = reach == null ? null : 'Reach'
      draft.topContent.autoMetricValue = reach
      evidence.push({ authority: 'published_report_post', source_id: String(topPost.id), field: 'topContent', excerpt: clean(topPost.caption, 180) || 'Top post from the previous published report.' })
    }
  }
  const performance = clean(reportRow?.performance_comments)
  if (performance) {
    draft.topContent.whatThisTellsUs = performance
    evidence.push({ authority: 'published_report', source_id: String(reportRow?.id), field: 'topContent', excerpt: performance })
  }
  draft.strategyGoingForward = [
    draft.clientDirection[0] ? `Prioritise ${draft.clientDirection[0].replace(/[.]$/, '').toLowerCase()}.` : '',
    mix ? `Execute the confirmed ${mix} package without extending scope.` : 'Keep production scope provisional until the package and deliverables are confirmed.',
    evs.length ? 'Use only the recorded client events selected above; staff must verify any promotional detail.' : '',
  ].filter(Boolean).join(' ')
  draft.goldStandard.objective = draft.clientDirection[0] ? `${String(client.name)}: ${draft.clientDirection[0]}` : ''
  draft.goldStandard.formatsAndRationale = mix ? `Work within ${String(client.name)}’s confirmed package of ${mix}; each format still needs an evidence-backed role.` : ''
  draft.goldStandard.testAndChange = draft.topContent.whatThisTellsUs ? `Use the previous exact-client finding “${draft.topContent.whatThisTellsUs}” to define one controlled change.` : ''
  draft.goldStandard.nextMonthGamePlan = mix ? `Sequence only the confirmed ${mix}; do not add channels or deliverables outside package.` : ''
  if (blockers.length) draft.clientActionsRequired.push('Confirm the monthly package and Client Schedule scope before approval.')

  return {
    draft, evidence, blockers,
    seedContext: {
      version: 1, origin: 'monthly_strategy_autopilot', generated_at: new Date().toISOString(), client_id: clientId, strategy_month: strategyMonth,
      sources: {
        previous_monthly_strategy_id: (prior.data as Record<string, unknown> | null)?.id ?? null,
        previous_report_id: reportRow?.id ?? null,
        client_package_id: (packageRow.data as Record<string, unknown> | null)?.id ?? null,
        deliverable_ids: ds.map(row => row.id), client_calendar_event_ids: evs.map(row => row.id),
        approved_client_context_update_ids: updateRows.map(row => row.id), client_guide_id: guideRow?.id ?? null,
        marketing_library_skill_card_ids: cardRows.slice(0, 3).map(row => row.id),
        marketing_library_cards: cardRows.slice(0, 3).map(row => ({
          id: row.id, title: row.title, confidence_level: row.confidence_level,
          evidence_label: row.evidence_label, source_id: row.source_id ?? null,
        })),
        package_verification_confirmed_at: packageAuthority.verification?.confirmed_at ?? null,
        package_verification_actor_id: packageAuthority.verification?.confirmed_by_profile_id ?? null,
        package_source_references: packageAuthority.verification?.source_references ?? [],
      },
      intelligence_evidence: evidence,
      blockers,
      source_coverage: {
        previous_monthly_strategy: prior.data ? 'available' : 'none', previous_published_report: report.data ? 'available' : 'none',
        monthly_deliverables: ds.length ? 'available' : 'none', client_package: packageAuthority.settings ? 'available' : 'none',
        company_calendar: evs.length ? 'available' : 'none', approved_client_context: updateRows.length ? 'available' : 'none',
        client_guide: guide.data ? 'available' : 'none', marketing_library: cardRows.length ? 'available' : 'none',
      },
    },
    previousReportId: reportRow?.id ?? null,
  }
}

export async function runMonthlyStrategyAutopilot(
  sb: StrategyAutopilotClient,
  options: { today: string; systemProfileId: string; enhanceDraft?: StrategyDraftEnhancer },
): Promise<StrategyAutopilotResult> {
  if (!options.systemProfileId) throw new Error('Configured system profile is required.')
  const clients = await fetchAll(sb.from('clients').select('id,name,active,package_settings').eq('active', true).order('id', { ascending: true }))
  const months = strategyAutopilotMonths(options.today)
  const blockers: Record<string, number> = {}
  const receipts: Array<Record<string, unknown>> = []
  let draftsCreated = 0
  let existingUntouched = 0
  let failed = 0
  let blocked = 0
  const note = (code: string) => { blockers[code] = (blockers[code] ?? 0) + 1 }

  for (const client of clients) for (const strategyMonth of months) {
    try {
      const existing = await sb.from('monthly_client_strategies').select('id,workflow_status,version').eq('client_id', client.id).eq('strategy_month', strategyMonth).maybeSingle()
      if (existing.error) throw new Error(existing.error.message)
      if (existing.data) { existingUntouched += 1; continue }
      const prepared = await prepareDraft(sb, client, strategyMonth, options.today)
      for (const blocker of prepared.blockers) note(blocker)
      if (prepared.blockers.length > 0) { blocked += 1; continue }
      const enhanced = options.enhanceDraft ? await options.enhanceDraft({ clientId: String(client.id), clientName: String(client.name), strategyMonth, draft: prepared.draft, groundedEvidence: prepared.evidence }) : null
      const idempotency = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`monthly-strategy-autopilot:${client.id}:${strategyMonth}`))
      const hex = Array.from(new Uint8Array(idempotency), byte => byte.toString(16).padStart(2, '0')).join('')
      const idempotencyKey = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
      const seeded = await sb.rpc('seed_monthly_client_strategy', {
        p_client_id: client.id, p_strategy_month: strategyMonth, p_strategy_data: enhanced ?? prepared.draft,
        p_seed_context: { ...prepared.seedContext, ai_enhanced: Boolean(enhanced) }, p_seeded_from_report_id: prepared.previousReportId,
        p_actor_profile_id: options.systemProfileId, p_idempotency_key: idempotencyKey,
      })
      if (seeded.error) throw new Error(seeded.error.message)
      const receipt = (seeded.data ?? {}) as Record<string, unknown>
      receipts.push(receipt)
      if (receipt.created === true) draftsCreated += 1
      else existingUntouched += 1
    } catch {
      failed += 1
      note('STRATEGY_PREPARATION_FAILED')
    }
  }
  return { ok: failed === 0, operating_date: options.today, target_months: months, active_clients: clients.length, drafts_created: draftsCreated, existing_untouched: existingUntouched, blocked, failed, blockers, receipts }
}
