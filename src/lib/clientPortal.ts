import type { Report } from './db/reports'
import type { PlatformFact } from './overviewModel'
import { hasRenderableFact } from './overviewModel'
import { getReportMonthFromPeriod } from './reportPeriod'
import { readStrategyData, type StrategyData } from './strategyEngine'

export interface ClientStrategyPreview {
  label: string
  value: string
  phase: 'review' | 'action'
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

export function actionMonthForReport(report: Report | null): string | null {
  return report ? nextMonth(getReportMonthFromPeriod(report)) : null
}

export function activeOrganicPlatforms(facts: PlatformFact[]): string[] {
  const supported = new Map([
    ['facebook', 'Facebook'],
    ['instagram', 'Instagram'],
  ])

  return [...supported.entries()]
    .filter(([platform]) => facts.some(fact => fact.platform === platform && hasRenderableFact(fact)))
    .map(([, label]) => label)
}

function campaignRecValue(strategy: StrategyData): string | null {
  const cr = strategy.actionPlan.campaign_recommendation
  if (!cr.enabled) return null
  const parts = [...cr.items, clean(cr.notes)].filter(Boolean)
  return parts.length > 0 ? parts.join('\n') : null
}

export function buildClientStrategyPreview(report: Report | null): ClientStrategyPreview[] {
  if (!report || report.status !== 'published') return []

  const strategy = readStrategyData(report.strategy_data)
  const candidates: Array<ClientStrategyPreview | null> = [
    clean(strategy.strategyGoingForward || report.previous_month_reflection || report.performance_comments)
      ? {
          label: 'Strategy going forward',
          value: clean(strategy.strategyGoingForward || report.previous_month_reflection || report.performance_comments)!,
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
    clean(report.content_direction_next_month)
      ? {
          label: 'Upcoming content direction',
          value: clean(report.content_direction_next_month)!,
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
