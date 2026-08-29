export const DEFAULT_META_WORKER_LANES = 4
export const MAX_META_WORKER_LANES = 6

export function normalizeMetaWorkerLanes(input: {
  workerLane?: unknown
  workerLanes?: unknown
  startLanes?: unknown
}): { workerLane: number; workerLanes: number; startsLaneSet: boolean } {
  if (input.workerLane !== undefined && !Number.isInteger(input.workerLane)) {
    throw new RangeError('workerLane must be an integer when provided.')
  }
  if (input.workerLanes !== undefined && !Number.isInteger(input.workerLanes)) {
    throw new RangeError('workerLanes must be an integer when provided.')
  }
  if (input.startLanes === true && input.workerLane !== undefined) {
    throw new RangeError('A child lane cannot start another lane set.')
  }
  const requested = input.workerLanes === undefined ? DEFAULT_META_WORKER_LANES : input.workerLanes as number
  const workerLanes = Math.max(1, Math.min(requested, MAX_META_WORKER_LANES))
  const workerLane = input.workerLane === undefined
    ? 0
    : Math.max(0, Math.min(input.workerLane as number, workerLanes - 1))
  return { workerLane, workerLanes, startsLaneSet: input.startLanes === true && workerLanes > 1 }
}
