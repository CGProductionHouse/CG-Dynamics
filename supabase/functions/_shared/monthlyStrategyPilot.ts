// A short-lived, exact-client production pilot grant. The daily scheduler does
// not read this grant and the normal fleet generation flag remains separate.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_GRANT_MS = 2 * 60 * 60 * 1000
const MAX_PILOT_ZAR_MICROS = 100_000_000

export interface MonthlyStrategyPilotGrant {
  clientId: string
  maxZarMicros: number
  expiresAt: string
}

export function readMonthlyStrategyPilotGrant(
  clientId: string,
  maxZar: string,
  expiresAt: string,
  now = new Date(),
): MonthlyStrategyPilotGrant | null {
  if (!UUID_RE.test(clientId) || !/^(?:\d{1,4})(?:\.\d{1,2})?$/.test(maxZar)) return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(expiresAt)) return null
  const maxZarMicros = Math.round(Number(maxZar) * 1_000_000)
  const remainingMs = Date.parse(expiresAt) - now.getTime()
  if (!Number.isSafeInteger(maxZarMicros) || maxZarMicros <= 0 || maxZarMicros > MAX_PILOT_ZAR_MICROS ||
      !Number.isFinite(remainingMs) || remainingMs <= 0 || remainingMs > MAX_GRANT_MS) return null
  return { clientId: clientId.toLowerCase(), maxZarMicros, expiresAt }
}

export function authorizesMonthlyStrategyPilot(
  grant: MonthlyStrategyPilotGrant | null,
  requestedClientId: string,
  fleetGenerationEnabled: boolean,
): grant is MonthlyStrategyPilotGrant {
  return !fleetGenerationEnabled && grant !== null &&
    UUID_RE.test(requestedClientId) && grant.clientId === requestedClientId.toLowerCase()
}
