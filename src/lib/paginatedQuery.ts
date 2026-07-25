export interface PagedQueryError {
  code?: string
  message: string
}

export interface PagedQueryResult<T> {
  data: T[]
  error: PagedQueryError | null
}

interface PagedResponse<T> {
  data: T[] | null
  error: PagedQueryError | null
}

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PagedResponse<T>>,
  pageSize = 1000,
): Promise<PagedQueryResult<T>> {
  const rows: T[] = []

  for (let from = 0; from < pageSize * 100; from += pageSize) {
    const result = await fetchPage(from, from + pageSize - 1)
    if (result.error) return { data: [], error: result.error }

    const page = result.data ?? []
    rows.push(...page)
    if (page.length < pageSize) return { data: rows, error: null }
  }

  return {
    data: [],
    error: { message: 'Paged query exceeded the 100,000 row safety limit.' },
  }
}
