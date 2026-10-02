import { resolveMicrosoftPlanMapping } from '../../../src/lib/microsoftImportMap.ts'

function isClientSchedulePlan(planName: string): boolean {
  const normalized = planName.trim().toLowerCase().replace(/\s+/g, ' ')
  return normalized.startsWith('client socials - ')
    || normalized === '2025 clients schedule'
}

export function shouldFetchPlannerTaskDetails(planName: string, percentComplete: unknown, automaticSystem = false): boolean {
  if (automaticSystem && resolveMicrosoftPlanMapping(planName).target === 'client_schedule') return false
  if (isClientSchedulePlan(planName)) return true
  return typeof percentComplete !== 'number' || percentComplete < 100
}
