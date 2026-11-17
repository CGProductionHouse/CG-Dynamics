import type { NolanTaskLane } from './nolanSourceLanes'

export type NolanLane = NolanTaskLane | 'decisions' | 'master' | 'videos' | 'packages' | 'systems'
export type NolanViewState = { lane: NolanLane; query: string; status: string; month: string }
const lanes: NolanLane[] = ['decisions', 'master', 'work', 'needs', 'ownership', 'special', 'done', 'videos', 'packages', 'systems', 'editor', 'apps']
const validMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value.slice(0, 4) !== '0000'

// View state only: URLs never grant permissions or mutate canonical records.
export function readNolanViewState(params: URLSearchParams, fallbackMonth: string): NolanViewState {
  const lane = params.get('nolan_view') as NolanLane
  const month = params.get('nolan_month') ?? ''
  return {
    lane: lanes.includes(lane) ? lane : 'work',
    query: (params.get('nolan_query') ?? '').slice(0, 300),
    status: (params.get('nolan_status') || 'All statuses').slice(0, 120),
    month: validMonth(month) ? month : fallbackMonth,
  }
}

export function updateNolanViewState(params: URLSearchParams, patch: Partial<NolanViewState>, fallbackMonth: string) {
  const next = new URLSearchParams(params)
  const state = { ...readNolanViewState(params, fallbackMonth), ...patch }
  const values = { nolan_view: state.lane, nolan_query: state.query, nolan_status: state.status === 'All statuses' ? '' : state.status, nolan_month: state.month }
  for (const [key, value] of Object.entries(values)) {
    if (value) next.set(key, value)
    else next.delete(key)
  }
  return next
}
