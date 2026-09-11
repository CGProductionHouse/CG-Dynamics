// Where the global assistant composer gets the signed-in user's My Day context.
//
// The Hub already loads tasks, clients, deliverables and events and builds the My
// Day context from them. The composer used to rebuild it with its own queries two
// seconds after mounting — on a slow phone, while the Hub was still loading, so
// the same data was fetched twice. The Hub now shares its result.
//
// Decision rules (pure; unit-tested in tests/myDayContextShare.test.mjs):
//   shared  the Hub has published THIS user's context → reuse it, no queries.
//   wait    the Hub is loading THIS user's context → do not start a duplicate
//           fetch; fall back only if it has not arrived within the wait limit.
//   fetch   no Hub load for this user (direct navigation, the Hub failed, or the
//           shared context belongs to someone else) → fetch as before.

export type SharedMyDayStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface SharedMyDayState<T> {
  status: SharedMyDayStatus
  profileId: string | null
  context: T | null
}

export type WorkContextSource = 'shared' | 'wait' | 'fetch'

/** How long the composer defers to an in-flight Hub load before fetching itself. */
export const HUB_CONTEXT_WAIT_LIMIT_MS = 15_000

/** The composer's original deferral when it has to fetch on its own. */
export const COMPOSER_FETCH_DELAY_MS = 2_000

export const IDLE_SHARED_MY_DAY: SharedMyDayState<never> = { status: 'idle', profileId: null, context: null }

export function resolveWorkContextSource<T>(state: SharedMyDayState<T>, profileId: string | null): WorkContextSource {
  // Never reuse a context that was built for a different user.
  if (!profileId || state.profileId !== profileId) return 'fetch'
  if (state.status === 'ready' && state.context !== null) return 'shared'
  if (state.status === 'loading') return 'wait'
  return 'fetch'
}

export function workContextDelay(source: WorkContextSource): number {
  if (source === 'shared') return 0
  if (source === 'wait') return HUB_CONTEXT_WAIT_LIMIT_MS
  return COMPOSER_FETCH_DELAY_MS
}
