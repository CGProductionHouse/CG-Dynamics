// Guided strategy engine - types, defaults and draft generators.
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
  autoImageUrl: string | null
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
  goldStandard: GoldStandardStrategy
}

export interface GoldStandardStrategy {
  objective: string
  audienceAndIntent: string
  coreMessage: string
  formatsAndRationale: string
  testAndChange: string
  pillarsAndHooks: string
  mustAvoid: string
  channelIntegration: string
  successSignals: string
  nextMonthGamePlan: string
}

export const GOLD_STANDARD_FIELDS: Array<{ key: keyof GoldStandardStrategy; label: string }> = [
  { key: 'objective', label: 'Exact monthly objective' },
  { key: 'audienceAndIntent', label: 'Audience and intent' },
  { key: 'coreMessage', label: 'Core message' },
  { key: 'formatsAndRationale', label: 'Formats, topics and rationale' },
  { key: 'testAndChange', label: 'What changes or gets tested' },
  { key: 'pillarsAndHooks', label: 'Content pillars and hooks' },
  { key: 'mustAvoid', label: 'What this client must avoid' },
  { key: 'channelIntegration', label: 'Paid, organic, site and lead integration' },
  { key: 'successSignals', label: 'Success signals to watch' },
  { key: 'nextMonthGamePlan', label: 'Package-bounded next-month game plan' },
]

export function emptyGoldStandardStrategy(): GoldStandardStrategy {
  return Object.fromEntries(GOLD_STANDARD_FIELDS.map(field => [field.key, ''])) as unknown as GoldStandardStrategy
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
      autoImageUrl: null,
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
    goldStandard: emptyGoldStandardStrategy(),
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

  const goldSource = source.goldStandard && typeof source.goldStandard === 'object'
    ? source.goldStandard as Partial<GoldStandardStrategy>
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
      autoImageUrl: typeof topContent.autoImageUrl === 'string' ? topContent.autoImageUrl : null,
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
    goldStandard: Object.fromEntries(GOLD_STANDARD_FIELDS.map(field => [
      field.key,
      typeof goldSource[field.key] === 'string' ? goldSource[field.key] : '',
    ])) as unknown as GoldStandardStrategy,
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
    || GOLD_STANDARD_FIELDS.some(field => data.goldStandard[field.key].trim() !== '')
  )
}

const CLIENT_FACING_STRATEGY_FORBIDDEN: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(?:use the verified client evidence\b|canonical client:|strongest available evidence of customer\/context intent\b)/i, reason: 'Internal evidence-template instructions are not client strategy.' },
  { pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i, reason: 'Internal record identifiers must not appear in client strategy.' },
  { pattern: /\bCGProductionHouse\//i, reason: 'Repository names are internal provenance, not client strategy.' },
  { pattern: /\b(?:github|repository|repo)\b/i, reason: 'Repository references are internal provenance, not client strategy.' },
  { pattern: /\b(?:source[_ -]?reference|source[_ -]?id|evidence[_ -]?label|confidence[_ -]?level|seed[_ -]?context)\b/i, reason: 'Evidence-system jargon must not appear in client strategy.' },
  { pattern: /\b(?:verified facts?|exact-client evidence|evidence dossier|research dossier|source pack)\b/i, reason: 'Internal evidence-workflow jargon must not appear in client strategy.' },
  { pattern: /\bPublished-content record:/i, reason: 'A factual publishing receipt is not a strategy.' },
  { pattern: /\bCorrect facts are only the starting point\b/i, reason: 'Generic quality commentary is not an actionable client strategy.' },
  { pattern: /\b(?:increase engagement|build (?:brand )?awareness|post consistently|grow social media|create engaging content)\b/i, reason: 'Generic marketing filler is not an exact client strategy.' },
  { pattern: /(?:^|[\\/])(?:docs|sources|artifacts)[\\/]/i, reason: 'Internal file paths must not appear in client strategy.' },
  { pattern: /\.(?:md|pdf|json)\b/i, reason: 'Internal source filenames must not appear in client strategy.' },
]

function clientFacingStrategyText(data: StrategyData): string[] {
  return [
    ...data.clientDirection,
    data.clientRequestNotes,
    ...data.strategyDrivers,
    data.strategyGoingForward,
    ...data.clientActionsRequired,
    ...Object.values(data.actionPlan).flatMap(section => [...section.items, section.notes]),
    ...Object.values(data.goldStandard),
  ].map(value => value.trim()).filter(Boolean)
}

/**
 * Fail-closed presentation gate for client-facing strategy copy. This does not
 * mutate or approve a strategy; it prevents internal provenance and known
 * non-strategy filler from leaking into a client preview.
 */
export function clientFacingStrategyQualityIssues(data: StrategyData): string[] {
  const text = clientFacingStrategyText(data).join('\n')
  return CLIENT_FACING_STRATEGY_FORBIDDEN
    .filter(rule => rule.pattern.test(text))
    .map(rule => rule.reason)
}

// ─── completion checklist ────────────────────────────────────────────────────
//
// Guides staff through finishing a report before publishing. Never blocks
// saving - it only shows what is done and what is still missing.

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

const GENERIC_ONLY = new Set([
  'increase engagement',
  'build awareness',
  'build brand awareness',
  'post consistently',
  'grow social media',
  'create engaging content',
])

function normaliseStatement(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

export function assessGoldStandardStrategy(
  data: StrategyData,
  packageSettings: PackageSettings | null,
  exactEvidenceAvailable: boolean,
): string[] {
  const issues: string[] = []
  if (!packageSettings) issues.push('Confirm the exact client package before approval.')
  if (!exactEvidenceAvailable) issues.push('Add exact-client intelligence or previous performance evidence.')
  for (const field of GOLD_STANDARD_FIELDS) {
    const value = data.goldStandard[field.key].trim()
    if (GENERIC_ONLY.has(normaliseStatement(value))) issues.push(`${field.label} is generic and must be tied to exact evidence and action.`)
    else if (value.length < 20) issues.push(`${field.label} needs specific client detail.`)
  }
  if (packageSettings) {
    const checks: Array<[ActionPlanKey, number | boolean | null, string]> = [
      ['professional_video', packageSettings.professional_videos_per_month, 'Professional video'],
      ['reels', packageSettings.reels_per_month, 'Reels'],
      ['photo_content', packageSettings.photo_posts_per_month, 'Photo content'],
      ['design_poster', packageSettings.design_posters_per_month, 'Design posters'],
      ['animated_poster', packageSettings.animated_posters_per_month, 'Animated posters'],
      ['campaign_recommendation', packageSettings.campaign_management_included, 'Campaign management'],
    ]
    for (const [key, allowance, label] of checks) {
      if (!data.actionPlan[key].enabled) continue
      if (allowance === null) issues.push(`${label} capacity is unknown; it cannot be approved.`)
      else if (!allowance) issues.push(`${label} exceeds the confirmed package.`)
    }
  }
  return issues
}

// ─── draft generators ────────────────────────────────────────────────────────

interface GenerateContext {
  clientName: string
  data: StrategyData
  selectedCalendar: CalendarSelection[]
  packageSettings: PackageSettings
}

/**
 * Assemble explicitly written strategy fields, not a marketing recommendation.
 * Preserve an existing staff draft. Guide snippets, calendar dates, quantity
 * and a top-post snapshot alone do not prove a business objective or causation.
 */
export function generateStrategyGoingForward(ctx: GenerateContext): string {
  const { data } = ctx
  if (data.strategyGoingForward.trim()) return data.strategyGoingForward
  const parts = [data.goldStandard.objective, data.goldStandard.coreMessage, data.goldStandard.testAndChange]
  if (parts.some(value => value.trim().length < 20) || clientFacingStrategyQualityIssues(data).length > 0) return ''
  return parts.map(value => value.trim()).join('\n\n')
}

/**
 * Package capacity is not a content concept. Open confirmed format sections,
 * retaining written concepts and notes verbatim, without invented default tasks.
 * Unknown/zero scope stays disabled; retained staff text is never discarded.
 */
export function generateActionPlan(
  ctx: GenerateContext
): Record<ActionPlanKey, ActionPlanSection> {
  const pkg = ctx.packageSettings
  const make = (key: ActionPlanKey, enabled: boolean): ActionPlanSection => {
    const existing = ctx.data.actionPlan[key]
    return { enabled, items: [...existing.items], notes: existing.notes }
  }

  return {
    professional_video: make('professional_video', typeof pkg.professional_videos_per_month === 'number' && pkg.professional_videos_per_month > 0),
    reels: make('reels', typeof pkg.reels_per_month === 'number' && pkg.reels_per_month > 0),
    photo_content: make('photo_content', typeof pkg.photo_posts_per_month === 'number' && pkg.photo_posts_per_month > 0),
    design_poster: make('design_poster', typeof pkg.design_posters_per_month === 'number' && pkg.design_posters_per_month > 0),
    animated_poster: make('animated_poster', typeof pkg.animated_posters_per_month === 'number' && pkg.animated_posters_per_month > 0),
    campaign_recommendation: make('campaign_recommendation', pkg.campaign_management_included === true),
  }
}
