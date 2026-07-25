function isClientSchedulePlan(planName: string): boolean {
  const normalized = planName.trim().toLowerCase().replace(/\s+/g, ' ')
  return normalized.startsWith('client socials - ')
    || normalized === '2025 clients schedule'
}

export function shouldFetchPlannerTaskDetails(planName: string, percentComplete: unknown): boolean {
  if (isClientSchedulePlan(planName)) return true
  return typeof percentComplete !== 'number' || percentComplete < 100
}
