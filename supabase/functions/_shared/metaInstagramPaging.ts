export class InstagramMediaTimestampError extends Error {}

export interface InstagramMediaPageResult<T extends Record<string, unknown>> {
  windowItems: T[]
  oldestTimestamp: string | null
  orderingMalformed: boolean
  boundaryReached: boolean
}

export function classifyInstagramMediaPage<T extends Record<string, unknown>>(
  items: T[],
  periodStart: string,
  periodEndExclusive: string,
  previousOldestTimestamp: string | null,
  boundaryOptimizationEnabled: boolean,
  priorOrderingMalformed: boolean,
): InstagramMediaPageResult<T> {
  const startMs = Date.parse(periodStart)
  const endMs = Date.parse(periodEndExclusive)
  const previousOldestMs = previousOldestTimestamp ? Date.parse(previousOldestTimestamp) : null
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
    throw new InstagramMediaTimestampError('Invalid Instagram reporting window.')
  }

  let orderingMalformed = priorOrderingMalformed
  let previousMs: number | null = null
  let oldestMs: number | null = null
  let allBelowLowerBoundary = items.length > 0
  const windowItems: T[] = []

  for (const item of items) {
    if (typeof item.id !== 'string' || item.id.length === 0 || typeof item.timestamp !== 'string') {
      throw new InstagramMediaTimestampError('Instagram media returned an item without a stable ID and timestamp.')
    }
    const timestampMs = Date.parse(item.timestamp)
    if (!Number.isFinite(timestampMs)) {
      throw new InstagramMediaTimestampError('Instagram media returned an invalid timestamp.')
    }
    if (previousMs !== null && timestampMs > previousMs) orderingMalformed = true
    if (previousMs === null && previousOldestMs !== null && timestampMs > previousOldestMs) orderingMalformed = true
    previousMs = timestampMs
    oldestMs = oldestMs === null ? timestampMs : Math.min(oldestMs, timestampMs)

    if (timestampMs >= startMs && timestampMs < endMs) windowItems.push(item)
    if (timestampMs >= startMs) allBelowLowerBoundary = false
  }

  return {
    windowItems,
    oldestTimestamp: oldestMs === null ? previousOldestTimestamp : new Date(oldestMs).toISOString(),
    orderingMalformed,
    boundaryReached: boundaryOptimizationEnabled && !orderingMalformed && allBelowLowerBoundary,
  }
}
