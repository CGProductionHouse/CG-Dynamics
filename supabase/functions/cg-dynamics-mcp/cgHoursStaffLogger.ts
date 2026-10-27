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

/** Preserve exact whole minutes expressed as decimal hours; never round real partial minutes. */
export function cgHoursDurationMinutes(hours: unknown): number | null {
  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0 || hours > 24) return null
  const minutes = hours * 60
  const wholeMinutes = Math.round(minutes)
  if (wholeMinutes < 1 || Math.abs(minutes - wholeMinutes) > 1e-9) return null
  return wholeMinutes
}

/** Shared daily workflow, not a reminder scheduler or authority to fabricate time. */
export function buildCgHoursLoggingPolicy(contextKind: string) {
  if (contextKind !== 'staff') return null
  return {
    version: '2026.10.27-own-draft-hours-1',
    source_of_truth: 'CG Hours',
    workflow: [
      'Help the staff member capture work as they describe it during the day; do not leave confirmed work only in chat. Use only this exact resolved staff Project context.',
      'Read read_my_recent_entries for the work date before logging or reconciling a recap. Use the same from_date/to_date and the canonical CG Hours client_id/task_template_id in logging_options; Dynamics client IDs are different.',
      'Use only the work, client, date and duration the person actually supplied or confirmed. Resolve today/yesterday in Africa/Johannesburg. Never invent hours from scheduled tasks, calendar slots, due dates, task completion or an assumed working day.',
      'If a required detail is missing or ambiguous, ask one short combined question. Keep a stated estimate labelled as an estimate and ask for confirmation before saving it. Do not add a mandatory form or repeated approval when exact work and duration were already explicitly given for logging.',
      'Convert an explicitly supplied duration to decimal hours (minutes / 60); whole-minute entries from 1 minute to 24 hours are supported. Do not confuse 1h30 with 1.30 hours or include unstated breaks/travel.',
      'Use log_ordinary_hours once per distinct confirmed work segment. Retain the same idempotency key and identical input on retries of that segment. A new key is not a safe retry.',
      'At end of day reconcile the recap against already logged records; a recap is not additional time. Ask whether matching work is a correction or a separate segment if unclear. Use correct_my_entry with the exact owned draft entry_id for corrections, not a second log.',
      'Only say saved after a durable CG Hours receipt, then read back the day to verify client, task and duration. If a response is lost or a read fails, report unverified status; never claim no write occurred or retry with a fresh key.',
      'Attach only explicitly supplied kilometres to an existing owned draft time entry with log_kilometre_entry. Do not invent a travel duration, reimbursement, fuel amount or a zero-hour time entry to attach kilometres.',
      'During the existing morning briefing and end-of-day recap, check the relevant day and help close missing details without blaming staff or inventing a shortfall. Do not create or change reminder schedules from this policy.',
      'These tools save drafts only. Staff review and submit the week manually in CG Hours. Never submit, approve, reopen a week, alter payroll or act as another staff member.',
    ],
  }
}

/**
 * Canonical CG Hours backend authority for Issue #361 (verified 2026-09-23).
 *
 * Repository: CGProductionHouse/CG-Hours main
 * SHA:        b301e13967862e348da96b1483303739b66f273d  (CG-Hours PR #29 squash-merged)
 * Endpoint:   https://cg-hours.vercel.app/api/staff-logger/invoke
 * Contract:   POST + x-cg-staff-capability (HS256, iss=cg-dynamics, aud=cg-hours-staff-logger,
 *             sub=<exact Dynamics staff profile UUID>, short exp, unique single-use jti)
 * Identity:   CG Hours resolves its own staff user via staff_logger_identity_map.
 * Lifecycle:  restricted draft-only nine-tool staff-logger catalogue
 *             (no submit/approve/reopen/payroll/admin).
 *
 * The backend authority exists in production. Dynamics fails closed as CG_HOURS_NOT_CONFIGURED
 * only when the runtime CG_HOURS_STAFF_LOGGER_URL or CG_HOURS_STAFF_LOGGER_SECRET is missing or
 * invalid. Never claim a log/correct success without a CG Hours response carrying a durable
 * time_entries record id (`data.entry_id`/`data.record_id`).
 */
export const CG_HOURS_BACKEND_AUTHORITY = {
  status: 'CONFIG_REQUIRED' as const,
  repository: 'CGProductionHouse/CG-Hours',
  main_sha: 'b301e13967862e348da96b1483303739b66f273d',
  endpoint: 'https://cg-hours.vercel.app/api/staff-logger/invoke',
  capability_header: 'x-cg-staff-capability',
  required_configuration: ['CG_HOURS_STAFF_LOGGER_URL', 'CG_HOURS_STAFF_LOGGER_SECRET'],
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
          message: staffSafeMessage(payload?.error, 'CG Hours refused the request. No success is claimed; check the day before retrying with the same idempotency key.'),
          status: response.status,
          ...(typeof payload?.code === 'string' ? { code: payload.code } : {}),
        }
      }
      if (!payload || payload.ok !== true) {
        return {
          ok: false,
          error: 'CG_HOURS_REFUSED',
          message: staffSafeMessage(payload?.message, 'CG Hours did not return a valid completion response. No success is claimed; check the day before retrying with the same idempotency key.'),
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
