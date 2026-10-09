import { businessMonthKey } from './businessTime.ts'

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

export function clientStrategyMonths(now: Date = new Date()): readonly [string, string] {
  const current = businessMonthKey(now)
  const [year, month] = current.split('-').map(Number)
  const next = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7)
  return [current, next]
}

export function selectClientStrategyMonth(requested: string | null | undefined, now: Date = new Date()): string {
  const [current, next] = clientStrategyMonths(now)
  return requested && MONTH_PATTERN.test(requested) && (requested === current || requested === next)
    ? requested
    : current
}
