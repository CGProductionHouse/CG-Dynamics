import { getMonthEvents, type CalendarEvent, type DeliverableType as CalendarDeliverableType } from './contentCalendar'
import { cardTargetsAgent } from '../features/ai-workforce/agents/agentRegistry'
import { readPackageAuthority } from './db/clients'
import { buildMonthlyBaseline, type BaselineEvidence } from './monthlyStrategySeed'
import { supabase } from './supabase'
import {
  emptyStrategyData,
  generateActionPlan,
  generateStrategyGoingForward,
  readStrategyData,
  type CalendarSelection,
  type StrategyData,
} from './strategyEngine'

export type MonthlyStrategyStatus = 'draft' | 'approved' | 'published'

export interface MonthlyClientStrategy {
  id: string
  client_id: string
  strategy_month: string
  workflow_status: MonthlyStrategyStatus
  strategy_data: StrategyData
  internal_notes: string | null
  seed_context: MonthlyStrategySeedContext
  seeded_from_report_id: string | null
  seeded_at: string
  staff_amended_at: string | null
  version: number
  published_version: number | null
  created_by_profile_id: string
  updated_by_profile_id: string
  approved_by_profile_id: string | null
  approved_at: string | null
  published_by_profile_id: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface MonthlyStrategySeedContext {
  version: 1
  generated_at: string
  client_id: string
  strategy_month: string
  sources: {
    previous_monthly_strategy_id: string | null
    previous_report_id: string | null
    client_package_id: string | null
    deliverable_ids: string[]
    client_calendar_event_ids: string[]
    approved_client_context_update_ids: string[]
    client_guide_id: string | null
    package_verification_confirmed_at?: string | null
    package_verification_actor_id?: string | null
    package_source_references?: string[]
    marketing_library_skill_card_ids?: string[]
    marketing_library_cards?: Array<{ id: string; title: string; confidence_level: string; evidence_label: string; source_id: string | null }>
    previous_post_ids?: string[]
  }
  calendar_events: Array<{
    authority: 'content_calendar' | 'company_calendar'
    source_id: string
    title: string
    date: string | null
    selected: boolean
    rationale: string
  }>
  intelligence_evidence: BaselineEvidence[]
  source_coverage: Record<string, 'available' | 'none' | 'unavailable'>
}

export interface MonthlyStrategyReceipt {
  replayed: boolean
  created?: boolean
  strategy_id: string
  client_id: string
  strategy_month: string
  version: number
  workflow_status: MonthlyStrategyStatus
  idempotency_key?: string
}

interface DeliverableSeedRow {
  id: string
  deliverable_type: string
}

interface ClientEventSeedRow {
  id: string
  title: string
  event_type: string
  start_at: string
}

interface ClientContextUpdateSeedRow {
  id: string
  title: string
  body: string | null
  decisions: unknown
}

interface ReadyClientGuideSeedRow {
  id: string
  guide_markdown: string
}

function monthStart(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error('Month must use YYYY-MM format.')
  }
  return `${month}-01`
}

function nextMonthStart(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10)
}

function calendarDeliverables(rows: DeliverableSeedRow[]): Set<CalendarDeliverableType> {
  const mapped = new Set<CalendarDeliverableType>()
  for (const row of rows) {
    if (row.deliverable_type === 'video') mapped.add('professional_video')
    if (row.deliverable_type === 'reel') mapped.add('reel')
    if (row.deliverable_type === 'photo') mapped.add('photo_post')
    if (row.deliverable_type === 'dp') mapped.add('design_poster')
  }
  return mapped
}

function calendarPriority(event: CalendarEvent): number {
  if (event.category === 'public_holiday') return 3
  if (event.category === 'commercial') return 2
  return 1
}

function buildCalendarSelections(
  month: string,
  deliverables: DeliverableSeedRow[],
  clientEvents: ClientEventSeedRow[],
): { selections: CalendarSelection[]; audit: MonthlyStrategySeedContext['calendar_events'] } {
  const availableTypes = calendarDeliverables(deliverables)
  const deterministicEvents = getMonthEvents(month)
  const selectedIds = new Set(
    deterministicEvents
      .filter(event => event.deliverables.some(type => availableTypes.has(type)))
      .sort((a, b) => calendarPriority(b) - calendarPriority(a) || (a.date ?? '').localeCompare(b.date ?? ''))
      .slice(0, 3)
      .map(event => event.id),
  )

  const deterministicSelections: CalendarSelection[] = deterministicEvents.map(event => ({
    eventId: event.id,
    title: event.title,
    date: event.date,
    use: selectedIds.has(event.id),
    note: selectedIds.has(event.id) ? event.suggestedAngle : '',
  }))
  const clientSelections: CalendarSelection[] = clientEvents.map(event => ({
    eventId: `company:${event.id}`,
    title: event.title,
    date: event.start_at.slice(0, 10),
    use: event.event_type === 'client_event',
    note: event.event_type === 'client_event' ? 'Known client event recorded in CG Calendar.' : '',
  }))

  return {
    selections: [...clientSelections, ...deterministicSelections],
    audit: [
      ...clientEvents.map(event => ({
        authority: 'company_calendar' as const,
        source_id: event.id,
        title: event.title,
        date: event.start_at.slice(0, 10),
        selected: event.event_type === 'client_event',
        rationale: event.event_type === 'client_event'
          ? 'Selected because it is an exact-client event in the target month.'
          : 'Considered as exact-client operational context; not automatically selected as a marketing moment.',
      })),
      ...deterministicEvents.map(event => ({
        authority: 'content_calendar' as const,
        source_id: event.id,
        title: event.title,
        date: event.date,
        selected: selectedIds.has(event.id),
        rationale: selectedIds.has(event.id)
          ? `Selected because its suggested formats overlap this month's canonical deliverables. ${event.relevanceHint}`
          : `Considered from the canonical South African content calendar. ${event.relevanceHint}`,
      })),
    ],
  }
}

export async function prepareMonthlyStrategySeed(clientId: string, month: string): Promise<{
  strategyData: StrategyData
  seedContext: MonthlyStrategySeedContext
  previousReportId: string | null
}> {
  const targetMonth = monthStart(month)
  const followingMonth = nextMonthStart(month)

  const operatingDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date())
  const [clientResult, deliverablesResult, eventsResult, priorStrategyResult, reportResult, updatesResult, guideResult, packageResult, sharedCardsResult, clientCardsResult] = await Promise.all([
    supabase.from('clients').select('id,name,active,package_settings').eq('id', clientId).maybeSingle(),
    supabase.from('monthly_deliverables').select('id,deliverable_type').eq('client_id', clientId).eq('month', targetMonth).is('archived_at', null),
    supabase.from('company_calendar_events').select('id,title,event_type,start_at').eq('client_id', clientId).gte('start_at', `${targetMonth}T00:00:00+02:00`).lt('start_at', `${followingMonth}T00:00:00+02:00`).neq('status', 'cancelled').is('superseded_by_event_id', null),
    supabase.from('monthly_client_strategies').select('id,strategy_data').eq('client_id', clientId).lt('strategy_month', targetMonth).order('strategy_month', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('reports').select('id,strategy_data,performance_comments,period_end').eq('client_id', clientId).eq('status', 'published').is('platform', null).lt('period_end', targetMonth).order('period_end', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('client_context_updates').select('id,title,body,decisions').eq('client_id', clientId).eq('review_state', 'incorporated').order('created_at', { ascending: false }).limit(5),
    supabase.from('client_guides').select('id,guide_markdown').eq('client_id', clientId).eq('runtime_readiness', 'ready').order('version', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('client_packages').select('id').eq('client_id', clientId).eq('status', 'active').lt('start_date', followingMonth).or(`end_date.is.null,end_date.gte.${targetMonth}`).order('start_date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('skill_cards').select('id,title,principle,summary,relevant_agents,confidence_level,evidence_label,source_id,review_expires_at').eq('status', 'active').is('active_client_id', null).in('knowledge_layer', ['universal_principle', 'south_african_market']).or(`review_expires_at.is.null,review_expires_at.gte.${operatingDate}`).limit(30),
    supabase.from('skill_cards').select('id,title,principle,summary,relevant_agents,confidence_level,evidence_label,source_id,review_expires_at').eq('status', 'active').eq('active_client_id', clientId).or(`review_expires_at.is.null,review_expires_at.gte.${operatingDate}`).limit(30),
  ])

  if (clientResult.error || !clientResult.data?.active || clientResult.data.id !== clientId) {
    throw new Error(clientResult.error?.message ?? 'Active client not found.')
  }
  if (deliverablesResult.error) throw new Error(deliverablesResult.error.message)
  if (eventsResult.error) throw new Error(eventsResult.error.message)
  if (priorStrategyResult.error) throw new Error(priorStrategyResult.error.message)
  if (reportResult.error) throw new Error(reportResult.error.message)
  if (packageResult.error) throw new Error(packageResult.error.message)
  if (sharedCardsResult.error) throw new Error(sharedCardsResult.error.message)
  if (clientCardsResult.error) throw new Error(clientCardsResult.error.message)

  const deliverables = (deliverablesResult.data ?? []) as DeliverableSeedRow[]
  const clientEvents = (eventsResult.data ?? []) as ClientEventSeedRow[]
  const contextUpdates = updatesResult.error ? [] : (updatesResult.data ?? []) as ClientContextUpdateSeedRow[]
  const readyGuide = guideResult.error ? null : guideResult.data as ReadyClientGuideSeedRow | null
  const previousRaw = priorStrategyResult.data?.strategy_data ?? reportResult.data?.strategy_data
  const previous = readStrategyData(previousRaw)
  const postResult = reportResult.data?.id
    ? await supabase.from('posts').select('id,caption,platform,reach,views,raw').eq('report_id', reportResult.data.id).order('reach', { ascending: false }).limit(5)
    : { data: [], error: null }
  if (postResult.error) throw new Error(postResult.error.message)
  const previousPosts = (postResult.data ?? []) as Array<{ id: string; caption: string | null; platform: string | null; reach: number | null; views: number | null }>
  const packageAuthority = readPackageAuthority(clientResult.data.package_settings)
  if (!packageAuthority.settings || !packageAuthority.verification) {
    throw new Error('PACKAGE_UNVERIFIED: confirm this active client’s exact package before preparing strategy.')
  }
  const hasExactClientEvidence = Boolean(
    priorStrategyResult.data || reportResult.data || readyGuide || contextUpdates.length > 0,
  )
  if (!hasExactClientEvidence) {
    throw new Error('CLIENT_EVIDENCE_UNVERIFIED: approved client intelligence or previous exact-client work is required.')
  }
  const packageSettings = packageAuthority.settings
  const calendar = buildCalendarSelections(month, deliverables, clientEvents)
  const baseline = buildMonthlyBaseline({
    clientName: clientResult.data.name,
    guideId: readyGuide?.id,
    readyGuideMarkdown: readyGuide?.guide_markdown,
    contextUpdates,
    previousDirection: previous.clientDirection,
    previousDrivers: previous.strategyDrivers,
    deliverables,
  })
  const marketingCards = [
    ...((clientCardsResult.data ?? []) as Array<Record<string, unknown>>),
    ...((sharedCardsResult.data ?? []) as Array<Record<string, unknown>>),
  ].filter(card => {
    const agents = Array.isArray(card.relevant_agents) ? card.relevant_agents.filter((value): value is string => typeof value === 'string') : []
    return cardTargetsAgent(agents, 'marketing_strategist') || cardTargetsAgent(agents, 'content_planner')
  }).sort((left, right) => String(left.id).localeCompare(String(right.id))).slice(0, 5)
  for (const card of marketingCards) {
    const principle = typeof card.principle === 'string' ? card.principle.trim() : ''
    if (!principle || baseline.strategyDrivers.some(value => value.toLocaleLowerCase() === principle.toLocaleLowerCase())) continue
    baseline.strategyDrivers.push(principle)
    baseline.evidence.push({ authority: 'marketing_library_skill_card', source_id: String(card.id), field: 'strategyDrivers', excerpt: principle.slice(0, 180) })
  }

  const strategyData = emptyStrategyData()
  strategyData.clientDirection = baseline.clientDirection
  strategyData.topContent = previous.topContent
  const topPost = previousPosts[0]
  if (topPost) {
    const observedMetric = typeof topPost.reach === 'number'
      ? { label: 'Reach', value: topPost.reach }
      : typeof topPost.views === 'number' ? { label: 'Views', value: topPost.views } : null
    strategyData.topContent.autoCaption = topPost.caption
    strategyData.topContent.autoPlatform = (topPost.platform ?? null) as StrategyData['topContent']['autoPlatform']
    strategyData.topContent.autoMetricLabel = observedMetric?.label ?? null
    strategyData.topContent.autoMetricValue = observedMetric?.value ?? null
    baseline.evidence.push({
      authority: 'published_report_post', source_id: topPost.id, field: 'topContent',
      excerpt: topPost.caption?.slice(0, 180) || 'Previous published report post with observed performance.',
    })
  }
  if (!strategyData.topContent.whatThisTellsUs && typeof reportResult.data?.performance_comments === 'string') {
    strategyData.topContent.whatThisTellsUs = reportResult.data.performance_comments
  }
  strategyData.strategyDrivers = baseline.strategyDrivers
  strategyData.calendarSelections = calendar.selections
  strategyData.actionPlan = generateActionPlan({
    clientName: clientResult.data.name,
    data: strategyData,
    selectedCalendar: calendar.selections,
    packageSettings,
  })
  strategyData.strategyGoingForward = generateStrategyGoingForward({
    clientName: clientResult.data.name,
    data: strategyData,
    selectedCalendar: calendar.selections,
    packageSettings,
  })
  strategyData.clientActionsRequired = ['Confirm any priority offers, events or deadlines for this month.']
  const packageMix = ([
    [packageSettings.professional_videos_per_month, 'professional videos'],
    [packageSettings.reels_per_month, 'reels'],
    [packageSettings.photo_posts_per_month, 'photo posts'],
    [packageSettings.design_posters_per_month, 'design posters'],
    [packageSettings.animated_posters_per_month, 'animated posters'],
    [packageSettings.website_updates_per_month, 'website updates'],
  ] as Array<[number | null, string]>)
    .filter((entry): entry is [number, string] => typeof entry[0] === 'number')
    .map(([count, label]) => `${count} ${label}`)
    .join(', ')
  const confirmedPackageMix = packageMix || 'no quantitatively confirmed deliverables'
  strategyData.goldStandard.objective = baseline.clientDirection[0]
    ? `${clientResult.data.name}: ${baseline.clientDirection[0]}`
    : ''
  strategyData.goldStandard.formatsAndRationale = `Work within ${clientResult.data.name}’s confirmed monthly package of ${confirmedPackageMix}; staff must tie each selected format to an evidenced objective before approval.`
  strategyData.goldStandard.testAndChange = previous.topContent.whatThisTellsUs
    ? `Use the previous exact-client finding “${previous.topContent.whatThisTellsUs}” to define one controlled change for ${clientResult.data.name}.`
    : ''
  strategyData.goldStandard.nextMonthGamePlan = `Plan and sequence only the confirmed ${confirmedPackageMix}. ${packageSettings.package_exclusions ? `Excluded: ${packageSettings.package_exclusions}` : 'No additional scope may be inferred.'}`
  baseline.evidence.push({
    authority: 'confirmed_client_package',
    source_id: clientId,
    field: 'actionPlan',
    excerpt: `${confirmedPackageMix}. Confirmed ${packageAuthority.verification.confirmed_at}.`,
  })

  const seedContext: MonthlyStrategySeedContext = {
    version: 1,
    generated_at: new Date().toISOString(),
    client_id: clientId,
    strategy_month: targetMonth,
    sources: {
      previous_monthly_strategy_id: priorStrategyResult.data?.id ?? null,
      previous_report_id: reportResult.data?.id ?? null,
      client_package_id: packageResult.error ? null : packageResult.data?.id ?? null,
      deliverable_ids: deliverables.map(row => row.id),
      client_calendar_event_ids: clientEvents.map(row => row.id),
      approved_client_context_update_ids: contextUpdates.map(row => row.id),
      client_guide_id: readyGuide?.id ?? null,
      package_verification_confirmed_at: packageAuthority.verification.confirmed_at,
      package_verification_actor_id: packageAuthority.verification.confirmed_by_profile_id,
      package_source_references: packageAuthority.verification.source_references,
      marketing_library_skill_card_ids: marketingCards.map(card => String(card.id)),
      marketing_library_cards: marketingCards.map(card => ({
        id: String(card.id),
        title: String(card.title ?? ''),
        confidence_level: String(card.confidence_level ?? ''),
        evidence_label: String(card.evidence_label ?? ''),
        source_id: card.source_id ? String(card.source_id) : null,
      })),
      previous_post_ids: previousPosts.map(post => post.id),
    },
    calendar_events: calendar.audit,
    intelligence_evidence: baseline.evidence,
    source_coverage: {
      previous_monthly_strategy: priorStrategyResult.data ? 'available' : 'none',
      previous_published_report: reportResult.data ? 'available' : 'none',
      monthly_deliverables: deliverables.length > 0 ? 'available' : 'none',
      company_calendar: clientEvents.length > 0 ? 'available' : 'none',
      approved_client_context: updatesResult.error ? 'unavailable' : contextUpdates.length > 0 ? 'available' : 'none',
      client_guide: guideResult.error ? 'unavailable' : guideResult.data ? 'available' : 'none',
      client_package: packageAuthority.settings ? 'available' : 'none',
      marketing_library: marketingCards.length > 0 ? 'available' : 'none',
    },
  }

  return { strategyData, seedContext, previousReportId: reportResult.data?.id ?? null }
}

export async function seedMonthlyStrategy(input: {
  clientId: string
  month: string
  actorProfileId?: string
  idempotencyKey: string
}) {
  const prepared = await prepareMonthlyStrategySeed(input.clientId, input.month)
  return supabase.rpc('seed_monthly_client_strategy', {
    p_client_id: input.clientId,
    p_strategy_month: monthStart(input.month),
    p_strategy_data: prepared.strategyData,
    p_seed_context: prepared.seedContext,
    p_seeded_from_report_id: prepared.previousReportId,
    p_actor_profile_id: input.actorProfileId ?? null,
    p_idempotency_key: input.idempotencyKey,
  }) as unknown as Promise<{ data: MonthlyStrategyReceipt | null; error: { message: string } | null }>
}

export async function getMonthlyStrategy(clientId: string, month: string) {
  const { data, error } = await supabase
    .from('monthly_client_strategies')
    .select('*')
    .eq('client_id', clientId)
    .eq('strategy_month', monthStart(month))
    .maybeSingle()
  return { data: data as MonthlyClientStrategy | null, error }
}

export async function amendMonthlyStrategy(input: {
  clientId: string
  month: string
  expectedVersion: number
  strategyData: StrategyData
  internalNotes?: string | null
  actorProfileId?: string
  idempotencyKey: string
}) {
  return supabase.rpc('amend_monthly_client_strategy', {
    p_client_id: input.clientId,
    p_strategy_month: monthStart(input.month),
    p_expected_version: input.expectedVersion,
    p_strategy_data: input.strategyData,
    p_internal_notes: input.internalNotes ?? null,
    p_actor_profile_id: input.actorProfileId ?? null,
    p_idempotency_key: input.idempotencyKey,
  }) as unknown as Promise<{ data: MonthlyStrategyReceipt | null; error: { message: string } | null }>
}

export async function transitionMonthlyStrategy(input: {
  clientId: string
  month: string
  expectedVersion: number
  targetStatus: 'approved' | 'published'
  actorProfileId?: string
  idempotencyKey: string
}) {
  return supabase.rpc('transition_monthly_client_strategy', {
    p_client_id: input.clientId,
    p_strategy_month: monthStart(input.month),
    p_expected_version: input.expectedVersion,
    p_target_status: input.targetStatus,
    p_actor_profile_id: input.actorProfileId ?? null,
    p_idempotency_key: input.idempotencyKey,
  }) as unknown as Promise<{ data: MonthlyStrategyReceipt | null; error: { message: string } | null }>
}

export async function getClientPublishedMonthlyStrategy(month: string) {
  const { data, error } = await supabase.rpc('client_monthly_strategy', {
    p_strategy_month: monthStart(month),
  })
  const row = Array.isArray(data) ? data[0] : null
  return {
    data: row as { strategy_month: string; strategy_data: StrategyData; published_at: string } | null,
    error,
  }
}
