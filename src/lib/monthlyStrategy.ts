import { getMonthEvents, type CalendarEvent, type DeliverableType as CalendarDeliverableType } from './contentCalendar'
import { readPackageSettings, type PackageSettings } from './db/clients'
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
  }
  calendar_events: Array<{
    authority: 'content_calendar' | 'company_calendar'
    source_id: string
    title: string
    date: string | null
    selected: boolean
    rationale: string
  }>
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

function packageFromDeliverables(rows: DeliverableSeedRow[], fallback: PackageSettings): PackageSettings {
  const count = (type: string) => rows.filter(row => row.deliverable_type === type).length
  return {
    professional_videos_per_month: count('video'),
    reels_per_month: count('reel'),
    photo_posts_per_month: count('photo'),
    design_posters_per_month: count('dp'),
    animated_posters_per_month: fallback.animated_posters_per_month,
    campaign_management_included: fallback.campaign_management_included,
    monthly_campaign_budget: fallback.monthly_campaign_budget,
    shoot_days_per_month: fallback.shoot_days_per_month,
    package_notes: fallback.package_notes,
  }
}

export async function prepareMonthlyStrategySeed(clientId: string, month: string): Promise<{
  strategyData: StrategyData
  seedContext: MonthlyStrategySeedContext
  previousReportId: string | null
}> {
  const targetMonth = monthStart(month)
  const followingMonth = nextMonthStart(month)

  const [clientResult, deliverablesResult, eventsResult, priorStrategyResult, reportResult, updatesResult, guideResult, packageResult] = await Promise.all([
    supabase.from('clients').select('id,name,active,package_settings').eq('id', clientId).maybeSingle(),
    supabase.from('monthly_deliverables').select('id,deliverable_type').eq('client_id', clientId).eq('month', targetMonth).is('archived_at', null),
    supabase.from('company_calendar_events').select('id,title,event_type,start_at').eq('client_id', clientId).gte('start_at', `${targetMonth}T00:00:00+02:00`).lt('start_at', `${followingMonth}T00:00:00+02:00`).neq('status', 'cancelled').is('superseded_by_event_id', null),
    supabase.from('monthly_client_strategies').select('id,strategy_data').eq('client_id', clientId).lt('strategy_month', targetMonth).order('strategy_month', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('reports').select('id,strategy_data,period_end').eq('client_id', clientId).eq('status', 'published').is('platform', null).lt('period_end', targetMonth).order('period_end', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('client_context_updates').select('id,title').eq('client_id', clientId).eq('review_state', 'incorporated').order('created_at', { ascending: false }).limit(5),
    supabase.from('client_guides').select('id,runtime_readiness').eq('client_id', clientId).eq('runtime_readiness', 'ready').order('version', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('client_packages').select('id').eq('client_id', clientId).eq('status', 'active').lt('start_date', followingMonth).or(`end_date.is.null,end_date.gte.${targetMonth}`).order('start_date', { ascending: false }).limit(1).maybeSingle(),
  ])

  if (clientResult.error || !clientResult.data?.active || clientResult.data.id !== clientId) {
    throw new Error(clientResult.error?.message ?? 'Active client not found.')
  }
  if (deliverablesResult.error) throw new Error(deliverablesResult.error.message)
  if (eventsResult.error) throw new Error(eventsResult.error.message)
  if (priorStrategyResult.error) throw new Error(priorStrategyResult.error.message)
  if (reportResult.error) throw new Error(reportResult.error.message)

  const deliverables = (deliverablesResult.data ?? []) as DeliverableSeedRow[]
  const clientEvents = (eventsResult.data ?? []) as ClientEventSeedRow[]
  const contextUpdates = updatesResult.error ? [] : (updatesResult.data ?? []) as ClientContextUpdateSeedRow[]
  const previousRaw = priorStrategyResult.data?.strategy_data ?? reportResult.data?.strategy_data
  const previous = readStrategyData(previousRaw)
  const packageSettings = packageFromDeliverables(deliverables, readPackageSettings(clientResult.data.package_settings))
  const calendar = buildCalendarSelections(month, deliverables, clientEvents)

  const strategyData = emptyStrategyData()
  strategyData.clientDirection = contextUpdates.length > 0
    ? contextUpdates.map(update => update.title)
    : previous.clientDirection
  strategyData.topContent = previous.topContent
  strategyData.strategyDrivers = previous.strategyDrivers.length > 0
    ? previous.strategyDrivers
    : ['Build a consistent monthly content rhythm', 'Align content with verified client priorities']
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
      client_guide_id: guideResult.error ? null : guideResult.data?.id ?? null,
    },
    calendar_events: calendar.audit,
    source_coverage: {
      previous_monthly_strategy: priorStrategyResult.data ? 'available' : 'none',
      previous_published_report: reportResult.data ? 'available' : 'none',
      monthly_deliverables: deliverables.length > 0 ? 'available' : 'none',
      company_calendar: clientEvents.length > 0 ? 'available' : 'none',
      approved_client_context: updatesResult.error ? 'unavailable' : contextUpdates.length > 0 ? 'available' : 'none',
      client_guide: guideResult.error ? 'unavailable' : guideResult.data ? 'available' : 'none',
      client_package: packageResult.error ? 'unavailable' : packageResult.data ? 'available' : 'none',
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
