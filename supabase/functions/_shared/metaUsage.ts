// Only numeric provider usage metadata is retained; never arbitrary headers.
export interface MetaUsage {
  retryAfterSeconds: number | null
  app: Record<string, number> | null
  page: Record<string, number> | null
  business: Record<string, Array<Record<string, number>>> | null
}

export function readMetaUsage(headers: Headers, now = Date.now()): MetaUsage {
  const read = (name: string): unknown => {
    try { return JSON.parse(headers.get(name) ?? 'null') } catch { return null }
  }
  const numericFields = (value: unknown): Record<string, number> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const allowed = ['call_count', 'total_cputime', 'total_time', 'estimated_time_to_regain_access']
    const entries = Object.entries(value).filter(([key, n]) => allowed.includes(key) && typeof n === 'number' && Number.isFinite(n) && n >= 0)
    return entries.length ? Object.fromEntries(entries) : null
  }
  const retry = headers.get('retry-after')
  const seconds = retry === null ? NaN : /^\d+(\.\d+)?$/.test(retry) ? Number(retry) : (Date.parse(retry) - now) / 1000
  const businessRaw = read('x-business-use-case-usage')
  const business: NonNullable<MetaUsage['business']> = {}
  if (businessRaw && typeof businessRaw === 'object' && !Array.isArray(businessRaw)) {
    for (const [id, rows] of Object.entries(businessRaw)) {
      if (!/^\d+$/.test(id) || !Array.isArray(rows)) continue
      const safe = rows.map(numericFields).filter((row): row is Record<string, number> => row !== null)
      if (safe.length) business[id] = safe
    }
  }
  return {
    retryAfterSeconds: Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : null,
    app: numericFields(read('x-app-usage')),
    page: numericFields(read('x-page-usage')),
    business: Object.keys(business).length ? business : null,
  }
}
