// Bounded discovery only. Never follow provider-supplied URLs with credentials;
// replay a safe cursor against the original endpoint and original fields.
export interface MetaAssetCollection<T> {
  data: T[]
  complete: boolean
  pagesFetched: number
  error: string | null
  failedResponse?: Response
}

export async function collectMetaAssets<T extends { id: string }>(
  initialUrl: string,
  fetchPage: (url: string, timeoutMs: number) => Promise<Response>,
  options: { maxPages?: number; deadline?: number } = {},
): Promise<MetaAssetCollection<T>> {
  const initial = new URL(initialUrl)
  const maxPages = Math.min(20, Math.max(1, options.maxPages ?? 10))
  const deadline = options.deadline ?? Date.now() + 15_000
  const records = new Map<string, T>()
  const cursors = new Set<string>()
  let cursor: string | null = null
  let pagesFetched = 0
  const result = (error: string | null, failedResponse?: Response): MetaAssetCollection<T> => ({
    data: [...records.values()], complete: error === null, pagesFetched, error,
    ...(failedResponse ? { failedResponse } : {}),
  })

  while (pagesFetched < maxPages) {
    const remaining = deadline - Date.now()
    if (remaining < 1_000) return result('Asset discovery timed out before all pages were read.')
    const url = new URL(initial)
    if (cursor) url.searchParams.set('after', cursor)
    let response: Response
    try {
      pagesFetched++
      response = await fetchPage(url.toString(), Math.min(3_000, Math.floor(remaining / 3)))
    } catch {
      return result('Asset discovery could not finish the provider request.')
    }
    if (!response.ok) return result('Asset discovery provider request failed.', response)
    let page: { data?: T[]; paging?: { next?: unknown; cursors?: { after?: unknown } } }
    try { page = await response.json() } catch { return result('Asset discovery returned invalid JSON.') }
    if (!page || !Array.isArray(page.data)
      || page.data.some(row => !row || typeof row.id !== 'string' || !row.id.trim())) {
      return result('Asset discovery returned a malformed collection.')
    }
    for (const row of page.data) if (!records.has(row.id)) records.set(row.id, row)
    const next = page.paging?.next
    if (next == null) return result(null)
    if (typeof next !== 'string' || !next) return result('Asset discovery returned invalid pagination.')
    let nextUrl: URL
    try { nextUrl = new URL(next) } catch { return result('Asset discovery returned invalid pagination.') }
    if (nextUrl.origin !== initial.origin || nextUrl.pathname !== initial.pathname
      || nextUrl.username || nextUrl.password) return result('Asset discovery returned an unsafe paging endpoint.')
    const after = page.paging?.cursors?.after ?? nextUrl.searchParams.get('after')
    if (typeof after !== 'string' || !after || after.length > 4096
      || [...after].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
      || cursors.has(after)) return result('Asset discovery returned an unsafe or repeated paging cursor.')
    cursors.add(after)
    cursor = after
  }
  return result('Asset discovery reached its page limit before completion.')
}
