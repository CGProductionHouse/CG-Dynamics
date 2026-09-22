import { contentAutopilotOperatingDate } from './contentAutopilotSchedule.ts'

export const MONTHLY_STRATEGY_AUTOPILOT_JOB_TYPE = 'monthly_strategy_autopilot'

export function monthlyStrategyAutopilotOperatingDate(now = new Date()): string {
  return contentAutopilotOperatingDate(now)
}

export function monthlyStrategyAutopilotIdempotencyKey(operatingDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(operatingDate)) {
    throw new Error('Invalid monthly strategy autopilot operating date')
  }
  return `monthly-strategy-autopilot:${operatingDate}`
}

export function monthlyStrategyReadyForContent(jobStatus: unknown): boolean {
  return jobStatus === 'succeeded'
}
