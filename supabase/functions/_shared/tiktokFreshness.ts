export const TIKTOK_ANALYTICS_REFRESH_JOB_TYPE = 'tiktok_analytics_refresh'
export const TIKTOK_FRESH_AFTER_HOURS = 30
export const TIKTOK_READ_SCOPES = [
  'user.info.basic',
  'user.info.profile',
  'user.info.stats',
  'video.list',
] as const

export type TiktokAccessState = 'connected' | 'reconnect_required' | 'permission_required' | 'provider_error' | 'unavailable'
export type TiktokConnectionRecoveryState = 'connected' | 'refresh_pending' | 'reconnect_required'

export function classifyTiktokConnectionRecovery(input: {
  connectionStatus: string
  missingScopes: string[]
  tokenPresent: boolean
  tokenExpired: boolean
  tokenRefreshable: boolean
}): TiktokConnectionRecoveryState {
  const terminalStatuses = ['needs_reauth', 'revoked', 'error', 'not_connected']
  if (
    terminalStatuses.includes(input.connectionStatus)
    || input.missingScopes.length > 0
    || !input.tokenPresent
    || (input.tokenExpired && !input.tokenRefreshable)
  ) {
    return 'reconnect_required'
  }

  return input.tokenExpired ? 'refresh_pending' : 'connected'
}
export type TiktokEvidenceState = 'complete' | 'partial' | 'unavailable'
export type TiktokFreshnessState = 'fresh' | 'stale' | 'never'

export interface TiktokRunEvidence {
  status: string
  health_state: string
  period_month: string | null
  started_at: string | null
  finished_at: string | null
  summary: Record<string, unknown> | null
}

export interface TiktokHealthInput {
  connectionStatus: string
  missingScopes: string[]
  tokenPresent: boolean
  tokenExpired: boolean
  tokenRefreshable: boolean
  latestAttempt: TiktokRunEvidence | null
  latestSuccessful: TiktokRunEvidence | null
  now?: Date
}

export interface TiktokHealthEvidence {
  access: TiktokAccessState
  coverage: TiktokEvidenceState
  completeness: TiktokEvidenceState
  freshness: TiktokFreshnessState
  clientState: 'available' | 'partial' | 'unavailable'
  staffDiagnostic: string
  clientMessage: string
  lastAttemptedAt: string | null
  lastSuccessfulAt: string | null
  ageHours: number | null
  staleAfterHours: number
}

function johannesburgParts(now: Date): { date: string; month: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? ''
  const year = value('year')
  const month = value('month')
  const day = value('day')
  return { date: `${year}-${month}-${day}`, month: `${year}-${month}` }
}

export function tiktokOperatingDate(now = new Date()): string {
  return johannesburgParts(now).date
}

export function currentTiktokMonth(now = new Date()): string {
  return johannesburgParts(now).month
}

export function tiktokRefreshIdempotencyKey(connectionId: string, operatingDate: string): string {
  return `tiktok-analytics-refresh:${connectionId}:${operatingDate}`
}

export function completeMetricSum<T>(rows: T[], value: (row: T) => number | null | undefined): number | null {
  let total = 0
  for (const row of rows) {
    const metric = value(row)
    if (typeof metric !== 'number' || !Number.isFinite(metric)) return null
    total += metric
  }
  return total
}

function runTime(run: TiktokRunEvidence | null): string | null {
  return run?.finished_at ?? run?.started_at ?? null
}

function ageHours(value: string | null, now: Date): number | null {
  if (!value) return null
  const parsed = new Date(value).getTime()
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, (now.getTime() - parsed) / 3_600_000)
}

export function classifyTiktokHealth(input: TiktokHealthInput): TiktokHealthEvidence {
  const now = input.now ?? new Date()
  const lastAttemptedAt = runTime(input.latestAttempt)
  const lastSuccessfulAt = runTime(input.latestSuccessful)
  const successAgeHours = ageHours(lastSuccessfulAt, now)
  const freshness: TiktokFreshnessState = successAgeHours == null
    ? 'never'
    : successAgeHours <= TIKTOK_FRESH_AFTER_HOURS ? 'fresh' : 'stale'

  let access: TiktokAccessState = 'connected'
  let staffDiagnostic = 'TikTok access is connected and the required read scopes are present.'
  if (!input.tokenPresent || input.connectionStatus === 'needs_reauth' || input.connectionStatus === 'revoked' || (input.tokenExpired && !input.tokenRefreshable)) {
    access = 'reconnect_required'
    staffDiagnostic = !input.tokenPresent
      ? 'Reconnect TikTok: the exact client connection has no server-side token row.'
      : input.connectionStatus === 'revoked'
        ? 'Reconnect TikTok: the provider access was revoked.'
        : 'Reconnect TikTok: the stored access token cannot be refreshed or is no longer valid.'
  } else if (input.missingScopes.length > 0) {
    access = 'permission_required'
    staffDiagnostic = `Reconnect TikTok and grant the missing read permission${input.missingScopes.length === 1 ? '' : 's'}: ${input.missingScopes.join(', ')}.`
  } else if (input.connectionStatus !== 'connected') {
    access = 'unavailable'
    staffDiagnostic = 'TikTok access is not connected for this exact client account.'
  } else if (input.latestAttempt?.status === 'failed' || input.latestAttempt?.health_state === 'sync_error') {
    access = 'provider_error'
    const errors = Array.isArray(input.latestAttempt.summary?.errors)
      ? input.latestAttempt.summary.errors.filter(error => typeof error === 'string').join('; ')
      : ''
    staffDiagnostic = `TikTok access exists, but the latest provider refresh failed${errors ? `: ${errors}` : '.'}`
  }

  const paginationComplete = input.latestSuccessful?.summary?.paginationComplete === true
  const coverage: TiktokEvidenceState = !input.latestSuccessful
    ? 'unavailable'
    : paginationComplete ? 'complete' : 'partial'
  const completeness: TiktokEvidenceState = !input.latestSuccessful
    ? 'unavailable'
    : input.latestSuccessful.status === 'success' && input.latestSuccessful.health_state === 'verified'
      ? 'complete'
      : 'partial'

  if (access === 'connected') {
    if (input.tokenExpired && input.tokenRefreshable) {
      staffDiagnostic = 'The access token expired, but an automatic refresh is available and will be attempted by the next sync.'
    } else if (!input.latestSuccessful) {
      staffDiagnostic = 'TikTok is connected, but no verified analytics refresh has completed for this exact account yet.'
    } else if (freshness === 'stale') {
      staffDiagnostic = `TikTok is connected, but the last verified analytics refresh is older than ${TIKTOK_FRESH_AFTER_HOURS} hours.`
    } else if (coverage === 'partial' || completeness === 'partial') {
      staffDiagnostic = 'TikTok is connected, but the last verified refresh returned partial coverage. The automatic worker will retry within its bounded attempt budget.'
    }
  }

  const hasPreservedFacts = input.latestSuccessful != null
  const clientState = access === 'connected' && freshness === 'fresh' && coverage === 'complete' && completeness === 'complete'
    ? 'available'
    : hasPreservedFacts ? 'partial' : 'unavailable'
  const clientMessage = clientState === 'available'
    ? 'TikTok analytics are available from the latest verified refresh.'
    : clientState === 'partial'
      ? 'TikTok analytics are partially available from the last verified refresh. Some current data is unavailable.'
      : 'TikTok analytics are currently unavailable.'

  return {
    access,
    coverage,
    completeness,
    freshness,
    clientState,
    staffDiagnostic,
    clientMessage,
    lastAttemptedAt,
    lastSuccessfulAt,
    ageHours: successAgeHours == null ? null : Math.round(successAgeHours * 10) / 10,
    staleAfterHours: TIKTOK_FRESH_AFTER_HOURS,
  }
}
