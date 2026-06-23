// Guided strategy engine — types, defaults and draft generators.
//
// Replaces the old open-ended report notes with a structured, guided strategy
// and action plan. The structured result is stored on reports.strategy_data
// (JSONB, added by phase-3j) and rendered both in the report builder and on the
// client-facing report. Selected option *labels* are stored here, so editing
// the global option library never changes already-saved reports.

import type { Platform } from './reportStats'
import type { PackageSettings } from './db/clients'

export const CONTENT_TYPES = [
  'Professional video',
  'Reel',
  'Poster',
  'Animated poster',
  'Photo post',
  'Carousel',
  'Other',
] as const
export type ContentType = (typeof CONTENT_TYPES)[number]

export interface TopContentInsight {
  // Auto-derived snapshot of the top post, captured with the report so the
  // client-facing view is stable even if underlying data later changes.
  autoCaption: string | null
  autoPlatform: Platform | null
  autoMetricLabel: string | null
  autoMetricValue: number | null
  // Staff-provided enrichment.
  coverImageUrl: string
  contentType: string
  whyItWorked: string[]
  whatThisTellsUs: string
}

export interface ActionPlanSection {
  enabled: boolean
  items: string[]
  notes: string
}

export type ActionPlanKey =
  | 'professional_video'
  | 'reels'
  | 'photo_content'
  | 'design_poster'
  | 'animated_poster'
  | 'campaign_recommendation'

export const ACTION_PLAN_LABELS: Record<ActionPlanKey, string> = {
  professional_video: 'Professional video plan',
  reels: 'Reels plan',
  photo_content: 'Photo content plan',
  design_poster: 'Design poster plan',
  animated_poster: 'Animated poster plan',
  campaign_recommendation: 'Campaign recommendation',
}

export interface CalendarSelection {
  eventId: string
  title: string
  date: string | null
  use: boolean
  note: string
}

export interface StrategyData {
  version: 1
  clientDirection: string[]
  clientRequestNotes: string
  topContent: TopContentInsight
  strategyDrivers: string[]
  strategyGoingForward: string
  actionPlan: Record<ActionPlanKey, ActionPlanSection>
  clientActionsRequired: string[]
  calendarSelections: CalendarSelection[]
}

function emptySection(): ActionPlanSection {
  return { enabled: false, items: [], notes: '' }
}

export function emptyStrategyData(): StrategyData {
  return {
    version: 1,
    clientDirection: [],
    clientRequestNotes: '',
    topContent: {
      autoCaption: null,
      autoPlatform: null,
      autoMetricLabel: null,
      autoMetricValue: null,
      coverImageUrl: '',
      contentType: '',
      whyItWorked: [],
      whatThisTellsUs: '',
    },
    strategyDrivers: [],
    strategyGoingForward: '',
    actionPlan: {
      professional_video: emptySection(),
      reels: emptySection(),
      photo_content: emptySection(),
      design_poster: emptySection(),
      animated_poster: emptySection(),
      campaign_recommendation: emptySection(),
    },
    clientActionsRequired: [],
    calendarSelections: [],
  }
}

// Defensive reader: merges any persisted strategy_data over the empty shape so
// older/partial records (or null, pre-migration) always produce a valid object.
export function readStrategyData(raw: unknown): StrategyData {
  const base = emptyStrategyData()
  if (!raw || typeof raw !== 'object') return base
  const source = raw as Partial<StrategyData>
  const strArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []

  const mergedActionPlan = { ...base.actionPlan }
  if (source.actionPlan && typeof source.actionPlan === 'object') {
    ;(Object.keys(base.actionPlan) as ActionPlanKey[]).forEach(key => {
      const section = (source.actionPlan as Record<string, unknown>)[key]
      if (section && typeof section === 'object') {
        const s = section as Partial<ActionPlanSection>
        mergedActionPlan[key] = {
          enabled: Boolean(s.enabled),
          items: strArray(s.items),
          notes: typeof s.notes === 'string' ? s.notes : '',
        }
      }
    })
  }

  const topContent = source.topContent && typeof source.topContent === 'object'
    ? source.topContent as Partial<TopContentInsight>
    : {}

  return {
    version: 1,
    clientDirection: strArray(source.clientDirection),
    clientRequestNotes: typeof source.clientRequestNotes === 'string' ? source.clientRequestNotes : '',
    topContent: {
      autoCaption: typeof topContent.autoCaption === 'string' ? topContent.autoCaption : null,
      autoPlatform: (topContent.autoPlatform ?? null) as Platform | null,
      autoMetricLabel: typeof topContent.autoMetricLabel === 'string' ? topContent.autoMetricLabel : null,
      autoMetricValue: typeof topContent.autoMetricValue === 'number' ? topContent.autoMetricValue : null,
      coverImageUrl: typeof topContent.coverImageUrl === 'string' ? topContent.coverImageUrl : '',
      contentType: typeof topContent.contentType === 'string' ? topContent.contentType : '',
      whyItWorked: strArray(topContent.whyItWorked),
      whatThisTellsUs: typeof topContent.whatThisTellsUs === 'string' ? topContent.whatThisTellsUs : '',
    },
    strategyDrivers: strArray(source.strategyDrivers),
    strategyGoingForward: typeof source.strategyGoingForward === 'string' ? source.strategyGoingForward : '',
    actionPlan: mergedActionPlan,
    clientActionsRequired: strArray(source.clientActionsRequired),
    calendarSelections: Array.isArray(source.calendarSelections)
      ? source.calendarSelections
          .filter((s): s is CalendarSelection => !!s && typeof s === 'object')
          .map(s => ({
            eventId: String(s.eventId ?? ''),
            title: String(s.title ?? ''),
            date: typeof s.date === 'string' ? s.date : null,
            use: Boolean(s.use),
            note: typeof s.note === 'string' ? s.note : '',
          }))
      : [],
  }
}

export function hasStrategyContent(data: StrategyData): boolean {
  return (
    data.clientDirection.length > 0 ||
    data.clientRequestNotes.trim() !== '' ||
    data.strategyDrivers.length > 0 ||
    data.strategyGoingForward.trim() !== '' ||
    data.clientActionsRequired.length > 0 ||
    data.topContent.whyItWorked.length > 0 ||
    data.topContent.whatThisTellsUs.trim() !== '' ||
    (Object.values(data.actionPlan) as ActionPlanSection[]).some(s => s.enabled && (s.items.length > 0 || s.notes.trim() !== ''))
  )
}

// ─── completion checklist ────────────────────────────────────────────────────
//
// Guides staff through finishing a report before publishing. Never blocks
// saving — it only shows what is done and what is still missing.

export interface StrategyChecklistItem {
  key: string
  label: string
  done: boolean
  // Optional items are helpful but not required to consider a report ready.
  optional?: boolean
}

function actionPlanHasContent(data: StrategyData): boolean {
  return (Object.values(data.actionPlan) as ActionPlanSection[]).some(
    s => s.enabled && (s.items.length > 0 || s.notes.trim() !== '')
  )
}

export function strategyChecklist(data: StrategyData): StrategyChecklistItem[] {
  return [
    {
      key: 'direction',
      label: 'Client direction added',
      done: data.clientDirection.length > 0 || data.clientRequestNotes.trim() !== '',
    },
    {
      key: 'topContent',
      label: 'Top content insight reviewed',
      done:
        data.topContent.whyItWorked.length > 0 ||
        data.topContent.whatThisTellsUs.trim() !== '' ||
        data.topContent.contentType.trim() !== '',
    },
    {
      key: 'strategy',
      label: 'Strategy going forward written',
      done: data.strategyGoingForward.trim() !== '',
    },
    {
      key: 'actionPlan',
      label: 'Action plan added',
      done: actionPlanHasContent(data),
    },
    {
      key: 'clientActions',
      label: 'Client actions required completed or marked not needed',
      done: data.clientActionsRequired.length > 0,
      optional: true,
    },
  ]
}

// True once all required (non-optional) checklist items are done. Used to mark a
// completed-month draft as "Ready to publish" in the reports workflow board.
export function strategyRequiredComplete(data: StrategyData): boolean {
  return strategyChecklist(data)
    .filter(item => !item.optional)
    .every(item => item.done)
}

// ─── draft generators ────────────────────────────────────────────────────────

function lowerFirst(text: string) {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text
}

function joinList(items: string[]): string {
  const clean = items.map(i => i.trim()).filter(Boolean)
  if (clean.length === 0) return ''
  if (clean.length === 1) return clean[0]
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`
  return `${clean.slice(0, -1).join(', ')} and ${clean[clean.length - 1]}`
}

interface GenerateContext {
  clientName: string
  data: StrategyData
  selectedCalendar: CalendarSelection[]
  packageSettings: PackageSettings
}

/**
 * Draft, editable "Strategy going forward" paragraph synthesised from client
 * direction, the top content insight, why-it-worked selections and any chosen
 * calendar suggestions. Always editable afterwards.
 */
export function generateStrategyGoingForward(ctx: GenerateContext): string {
  const { data, selectedCalendar } = ctx
  const parts: string[] = []

  const drivers = joinList(data.strategyDrivers.map(lowerFirst))
  const direction = joinList(data.clientDirection.map(lowerFirst))
  const why = joinList(data.topContent.whyItWorked.map(lowerFirst))
  const dates = joinList(selectedCalendar.filter(s => s.use).map(s => s.title))

  let opening = 'Based on this period’s results'
  if (direction) opening += ` and the client’s focus on ${direction}`
  opening += ', the strategy going forward is'

  if (drivers) {
    opening += ` to ${drivers}`
  } else if (why) {
    opening += ` to build on what worked — ${why}`
  } else {
    opening += ' to build on the strongest performing content and keep momentum'
  }
  parts.push(`${opening}.`)

  if (why && drivers) {
    parts.push(`This period’s best response came from content that was ${why}, so we will lean further into that.`)
  }
  if (dates) {
    parts.push(`We will also prepare timely content around ${dates}.`)
  }

  return parts.join(' ')
}

const ACTION_DEFAULTS: Record<ActionPlanKey, string> = {
  professional_video: 'Plan and shoot the professional video deliverable(s) for the month.',
  reels: 'Produce short-form reels, prioritising the strongest performing style.',
  photo_content: 'Capture photo content that showcases the product, service or real business experience.',
  design_poster: 'Design posters that support the client’s current offer or key dates.',
  animated_poster: 'Produce animated posters for the most important announcement(s).',
  campaign_recommendation: 'No paid campaign recommended this month unless the client confirms a budget.',
}

/**
 * Draft action plan. Enables a section when the package includes that
 * deliverable, and seeds an editable default line plus the package quantity.
 * Campaign section is enabled when campaign management is included.
 */
export function generateActionPlan(
  ctx: GenerateContext
): Record<ActionPlanKey, ActionPlanSection> {
  const pkg = ctx.packageSettings
  const dateTitles = ctx.selectedCalendar.filter(s => s.use).map(s => s.title)
  const dateLine = dateTitles.length > 0 ? `Tie content to: ${joinList(dateTitles)}.` : ''

  const make = (key: ActionPlanKey, enabled: boolean, qty?: number): ActionPlanSection => {
    const items: string[] = []
    const base = ACTION_DEFAULTS[key]
    items.push(qty && qty > 0 ? `${base} (${qty} this month)` : base)
    if (dateLine && key !== 'campaign_recommendation') items.push(dateLine)
    return { enabled, items, notes: '' }
  }

  return {
    professional_video: make('professional_video', pkg.professional_videos_per_month > 0, pkg.professional_videos_per_month),
    reels: make('reels', pkg.reels_per_month > 0, pkg.reels_per_month),
    photo_content: make('photo_content', pkg.photo_posts_per_month > 0, pkg.photo_posts_per_month),
    design_poster: make('design_poster', pkg.design_posters_per_month > 0, pkg.design_posters_per_month),
    animated_poster: make('animated_poster', pkg.animated_posters_per_month > 0, pkg.animated_posters_per_month),
    campaign_recommendation: {
      enabled: pkg.campaign_management_included,
      items: [
        pkg.campaign_management_included && pkg.monthly_campaign_budget > 0
          ? `Manage the monthly campaign budget of R${pkg.monthly_campaign_budget.toLocaleString('en-ZA')}.`
          : ACTION_DEFAULTS.campaign_recommendation,
      ],
      notes: '',
    },
  }
}
