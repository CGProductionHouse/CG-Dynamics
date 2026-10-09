import type { ClientReport, Report } from './db/reports'
import type { PlatformFact } from './overviewModel'
import { hasRenderableFact } from './overviewModel'
import { getReportMonthFromPeriod } from './reportPeriod'
import { clientFacingStrategyQualityIssues, readStrategyData, type StrategyData } from './strategyEngine'

export interface ClientStrategyPreview {
  label: string
  value: string
  phase: 'review' | 'action'
}

export type PublishedMonthlyStrategy = {
  strategy_month: string
  strategy_data: unknown
  published_at: string | null
}

/** Only the canonical client RPC's published exact-month projection is current direction. */
export function buildPublishedMonthlyStrategyPreview(row: PublishedMonthlyStrategy | null, month: string): ClientStrategyPreview[] {
  if (!row || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || row.strategy_month !== `${month}-01`
    || !row.published_at || !Number.isFinite(Date.parse(row.published_at))) return []
  const data = readStrategyData(row.strategy_data)
  if (clientFacingStrategyQualityIssues(data).length) return []
  return [
    { label: 'Monthly objective', value: data.goldStandard.objective, phase: 'action' as const },
    { label: 'Strategy going forward', value: data.strategyGoingForward, phase: 'action' as const },
    { label: 'Client direction', value: data.clientDirection.join('\n'), phase: 'action' as const },
    { label: 'What we need from you', value: data.clientActionsRequired.join('\n'), phase: 'action' as const },
  ].filter(item => item.value.trim()).slice(0, 3)
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function nextMonth(month: string): string | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return null
  return new Date(Date.UTC(Number(match[1]), Number(match[2]), 1))
    .toISOString()
    .slice(0, 7)
}

export function actionMonthForReport(report: Report | ClientReport | null): string | null {
  return report ? nextMonth(getReportMonthFromPeriod(report)) : null
}

export function activeOrganicPlatforms(facts: PlatformFact[]): string[] {
  const supported = new Map([
    ['facebook', 'Facebook'],
    ['instagram', 'Instagram'],
    ['tiktok', 'TikTok'],
  ])

  return [...supported.entries()]
    .filter(([platform]) => facts.some(fact => fact.platform === platform && hasRenderableFact(fact)))
    .map(([, label]) => label)
}

export interface CrossChannelViews {
  value: number
  platforms: string[]
  periodStart: string
  periodEnd: string
  excludedChannels: number
}

/** Add recorded view events, never unique audiences, incomplete facts or mixed windows. */
export function summarizeCrossChannelViews(facts: PlatformFact[]): CrossChannelViews | null {
  const viewKey = (fact: PlatformFact) => fact.platform === 'tiktok' ? 'views' : 'brand_views'
  const viewFacts = facts.filter(fact =>
    ['facebook', 'instagram', 'tiktok'].includes(fact.platform) && fact.metricKey === viewKey(fact))
  const candidates = viewFacts.filter(fact => ['complete', 'valid_zero'].includes(fact.availability)
    && fact.aggregation === 'sum' && Number.isSafeInteger(fact.value) && (fact.value as number) >= 0)
  if (!candidates.length || new Set(candidates.map(fact => fact.platform)).size !== candidates.length) return null
  const windowStart = candidates[0].periodStart
  const windowEnd = candidates[0].periodEnd
  if (!windowStart || !windowEnd || !/^\d{4}-\d{2}-\d{2}$/.test(windowStart)
    || !/^\d{4}-\d{2}-\d{2}$/.test(windowEnd) || windowEnd < windowStart) return null
  if (candidates.some(fact => fact.periodStart !== windowStart || fact.periodEnd !== windowEnd)) return null
  const value = candidates.reduce((sum, fact) => sum + (fact.value as number), 0)
  if (!Number.isSafeInteger(value)) return null
  const labels: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok' }
  return { value, platforms: candidates.map(fact => labels[fact.platform]), periodStart: windowStart, periodEnd: windowEnd,
    excludedChannels: new Set(viewFacts.map(fact => fact.platform)).size - candidates.length }
}

function campaignRecValue(strategy: StrategyData): string | null {
  const cr = strategy.actionPlan.campaign_recommendation
  if (!cr.enabled) return null
  const parts = [...cr.items, clean(cr.notes)].filter(Boolean)
  return parts.length > 0 ? parts.join('\n') : null
}

export function buildClientStrategyPreview(report: Report | ClientReport | null): ClientStrategyPreview[] {
  if (!report || report.status !== 'published') return []

  const strategy = readStrategyData(report.strategy_data)
  const candidates: Array<ClientStrategyPreview | null> = [
    clean(strategy.strategyGoingForward)
      ? {
          label: 'Strategy going forward',
          value: clean(strategy.strategyGoingForward)!,
          phase: 'action',
        }
      : null,
    clean(strategy.topContent.whatThisTellsUs)
      ? {
          label: 'What it means',
          value: clean(strategy.topContent.whatThisTellsUs)!,
          phase: 'review',
        }
      : null,
    strategy.clientDirection.length > 0
      ? {
          label: 'Client direction',
          value: strategy.clientDirection.map(d => `• ${d}`).join('\n'),
          phase: 'action',
        }
      : null,
    campaignRecValue(strategy)
      ? {
          label: 'Campaign direction',
          value: campaignRecValue(strategy)!,
          phase: 'action',
        }
      : null,
    strategy.clientActionsRequired.length > 0
      ? {
          label: 'What we need from you',
          value: strategy.clientActionsRequired.map(a => `• ${a}`).join('\n'),
          phase: 'action',
        }
      : null,
  ]

  return candidates.filter((item): item is ClientStrategyPreview => item !== null).slice(0, 6)
}
