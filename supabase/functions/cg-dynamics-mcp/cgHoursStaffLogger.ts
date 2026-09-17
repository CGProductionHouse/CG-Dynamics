const CG_HOURS_AUDIENCE = 'cg-hours-staff-logger'
const CG_HOURS_ISSUER = 'cg-dynamics'
const CAPABILITY_LIFETIME_SECONDS = 5 * 60

export const CG_HOURS_STAFF_LOGGER_TOOLS = [
  'get_my_hours_today',
  'get_my_daily_logging_status',
  'list_my_logging_options',
  'add_my_time_entry',
  'edit_my_time_entry',
  'remove_my_draft_entry',
  'get_my_travel_today',
  'add_my_travel_km',
  'edit_my_travel_km',
] as const

export type CgHoursStaffLoggerTool = typeof CG_HOURS_STAFF_LOGGER_TOOLS[number]

export interface CgHoursStaffLoggerConfig {
  endpoint: string
  secret: string
}

/**
 * Durable BACKEND_GAP handoff (Issue #361, PR #376, 2026-09-17).
 *
 * CGProductionHouse/CG-Hours main (`56869571d3417947a90bd06c3ba4d8cf89a4350c`) exposes NO
 * existing create/read/correct authority for canonical `time_entries` that Dynamics may use.
 * The only reviewed seam is unmerged CG-Hours PR #3
 * (reviewed head `18e6122f8bce3040169c21d9cb9e4306ef07f24c`):
 *
 *   POST /api/staff-logger/invoke
 *     header  x-cg-staff-capability — Dynamics-issued short-lived single-use HS256 capability
 *     staff identity resolved server-side via `staff_logger_identity_map` (JTI spent once)
 *     restricted, draft-only nine-tool staff-logger catalogue (no submit/approve/reopen/payroll/admin)
 *
 * Until that exact endpoint ships on CG-Hours main, every Dynamics handler MUST fail closed as
 * CG_HOURS_NOT_CONFIGURED (envs must stay unset). Never claim a log/correct success without a
 * CG Hours response carrying a durable time_entries record id (`data.entry_id`/`data.record_id`).
 *
 * Smallest CA-gated change to close this gap: merge CG-Hours PR #3 unchanged and configure
 * CG_HOURS_STAFF_LOGGER_URL + CG_HOURS_STAFF_LOGGER_SECRET. No Dynamics migration, table,
 * shadow ledger or second backend is required.
 */
export const CG_HOURS_BACKEND_GAP = {
  status: 'BACKEND_GAP' as const,
  missing_authority: 'POST /api/staff-logger/invoke (capability x-cg-staff-capability) on CG Hours main',
  authority_source: 'CGProductionHouse/CG-Hours PR #3',
  authority_head: '18e6122f8bce3040169c21d9cb9e4306ef07f24c',
  cg_hours_main_checked: '56869571d3417947a90bd06c3ba4d8cf89a4350c',
  required_to_close: 'Merge CG-Hours PR #3 unchanged, then set CG_HOURS_STAFF_LOGGER_URL and CG_HOURS_STAFF_LOGGER_SECRET.',
} as const

export type CgHoursStaffLoggerResult =
  | { ok: true; message: string; data?: Record<string, unknown> }
  | {
      ok: false
      error: 'CG_HOURS_NOT_CONFIGURED' | 'CG_HOURS_UNAVAILABLE' | 'CG_HOURS_REFUSED'
      message: string
      status?: number
      code?: string
    }

interface InvocationDependencies {
  fetchImpl?: typeof fetch
  now?: () => number
  randomUUID?: () => string
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function encodeJson(value: Record<string, unknown>): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)))
}

export function validateCgHoursStaffLoggerConfig(
  endpoint: string | undefined,
  secret: string | undefined,
): CgHoursStaffLoggerConfig | null {
  if (!endpoint || !secret || secret.length < 32) return null
  try {
    const url = new URL(endpoint)
    if (url.protocol !== 'https:' || !url.pathname.endsWith('/api/staff-logger/invoke')) return null
    return { endpoint: url.toString(), secret }
  } catch {
    return null
  }
}

export async function issueCgHoursStaffCapability(
  dynamicsStaffProfileId: string,
  secret: string,
  dependencies: Pick<InvocationDependencies, 'now' | 'randomUUID'> = {},
): Promise<string> {
  const now = dependencies.now?.() ?? Math.floor(Date.now() / 1000)
  const randomUUID = dependencies.randomUUID ?? (() => crypto.randomUUID())
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' })
  const payload = encodeJson({
    iss: CG_HOURS_ISSUER,
    aud: CG_HOURS_AUDIENCE,
    sub: dynamicsStaffProfileId,
    iat: now,
    exp: now + CAPABILITY_LIFETIME_SECONDS,
    jti: randomUUID(),
  })
  const signingInput = `${header}.${payload}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput))
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`
}

function staffSafeMessage(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

/**
 * Invoke the restricted CG Hours staff logger. A network failure is retried once with a fresh
 * single-use capability. The request body is unchanged, so a mutating tool retains the exact same
 * backend idempotency key and CG Hours returns the original durable record instead of duplicating it.
 */
export async function invokeCgHoursStaffLogger(
  config: CgHoursStaffLoggerConfig | null,
  dynamicsStaffProfileId: string,
  tool: CgHoursStaffLoggerTool,
  input: Record<string, unknown>,
  dependencies: InvocationDependencies = {},
): Promise<CgHoursStaffLoggerResult> {
  if (!config) {
    return {
      ok: false,
      error: 'CG_HOURS_NOT_CONFIGURED',
      message: 'CG Hours staff logging is not configured, so nothing was read or changed.',
    }
  }

  const fetchImpl = dependencies.fetchImpl ?? fetch
  const body = JSON.stringify({ tool, input })

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const capability = await issueCgHoursStaffCapability(
        dynamicsStaffProfileId,
        config.secret,
        dependencies,
      )
      const response = await fetchImpl(config.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-cg-staff-capability': capability,
        },
        body,
      })
      const payload = await response.json().catch(() => null) as Record<string, unknown> | null

      if (!response.ok) {
        return {
          ok: false,
          error: 'CG_HOURS_REFUSED',
          message: staffSafeMessage(payload?.error, 'CG Hours refused the request, so nothing was changed.'),
          status: response.status,
          ...(typeof payload?.code === 'string' ? { code: payload.code } : {}),
        }
      }
      if (!payload || payload.ok !== true) {
        return {
          ok: false,
          error: 'CG_HOURS_REFUSED',
          message: staffSafeMessage(payload?.message, 'CG Hours did not complete the request, so nothing was changed.'),
        }
      }
      return {
        ok: true,
        message: staffSafeMessage(payload.message, 'CG Hours completed the request.'),
        ...(payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
          ? { data: payload.data as Record<string, unknown> }
          : {}),
      }
    } catch {
      if (attempt === 0) continue
      return {
        ok: false,
        error: 'CG_HOURS_UNAVAILABLE',
        message: 'CG Hours could not be reached after a safe retry, so no success is claimed.',
      }
    }
  }

  return {
    ok: false,
    error: 'CG_HOURS_UNAVAILABLE',
    message: 'CG Hours could not be reached, so no success is claimed.',
  }
}

export function durableCgHoursRecordId(result: CgHoursStaffLoggerResult): string | null {
  if (!result.ok) return null
  const value = result.data?.entry_id ?? result.data?.record_id
  return typeof value === 'string' && value.trim() ? value : null
}
