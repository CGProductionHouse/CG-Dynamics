export interface MonthlyStrategyAlignmentRow {
  strategy_month: string
  strategy_data: Record<string, unknown>
  workflow_status: string
}

export const MONTHLY_STRATEGY_ALIGNMENT_WITHHELD =
  'Canonical monthly strategy alignment withheld: the exact-client strategy read failed. Content Guideline authority remains unchanged.'

export function monthlyStrategyAlignmentLines(
  rows: MonthlyStrategyAlignmentRow[] | null,
  error: { message: string } | null,
): string[] {
  if (error) return [MONTHLY_STRATEGY_ALIGNMENT_WITHHELD]
  return (rows ?? []).slice(0, 12).map(strategy => {
    const data = strategy.strategy_data ?? {}
    const direction = Array.isArray(data.clientDirection)
      ? data.clientDirection.filter(value => typeof value === 'string').slice(0, 3)
      : []
    const drivers = Array.isArray(data.strategyDrivers)
      ? data.strategyDrivers.filter(value => typeof value === 'string').slice(0, 3)
      : []
    const forward = typeof data.strategyGoingForward === 'string'
      ? data.strategyGoingForward.slice(0, 600)
      : 'none recorded'
    return `Canonical monthly strategy (${strategy.strategy_month}, ${strategy.workflow_status}): direction=${direction.join(' | ') || 'none recorded'}; drivers=${drivers.join(' | ') || 'none recorded'}; forward=${forward}`
  })
}
