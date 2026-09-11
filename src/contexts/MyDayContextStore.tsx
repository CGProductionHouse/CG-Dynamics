import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { MyDayContext } from '../lib/workforceMyDay'
import { IDLE_SHARED_MY_DAY, type SharedMyDayState } from '../lib/myDayContextShare'

// Shares the Hub's already-computed My Day context with the global assistant
// composer so the composer does not repeat the Hub's queries. The decision rules
// (reuse / wait / fetch) live in src/lib/myDayContextShare.ts.

interface MyDayShareActions {
  /** The Hub started loading this user's day; consumers should wait for it. */
  beginLoad: (profileId: string | null) => void
  /** The Hub finished; its context is now the shared one for that user. */
  publish: (profileId: string | null, context: MyDayContext) => void
  /** The Hub load failed; consumers must fetch for themselves. */
  fail: (profileId: string | null) => void
}

const SharedMyDayStateContext = createContext<SharedMyDayState<MyDayContext>>(IDLE_SHARED_MY_DAY)
const MyDayShareActionsContext = createContext<MyDayShareActions | null>(null)

export function MyDayContextStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SharedMyDayState<MyDayContext>>(IDLE_SHARED_MY_DAY)
  // Stable actions in their own context: the Hub only publishes, so it never
  // re-renders when the shared state changes. Only state readers do.
  const actions = useMemo<MyDayShareActions>(() => ({
    beginLoad: profileId => setState({ status: 'loading', profileId, context: null }),
    publish: (profileId, context) => setState({ status: 'ready', profileId, context }),
    fail: profileId => setState(current => (current.profileId === profileId ? { status: 'error', profileId, context: null } : current)),
  }), [])

  return (
    <MyDayShareActionsContext.Provider value={actions}>
      <SharedMyDayStateContext.Provider value={state}>
        {children}
      </SharedMyDayStateContext.Provider>
    </MyDayShareActionsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMyDayShareActions(): MyDayShareActions {
  const actions = useContext(MyDayShareActionsContext)
  if (!actions) throw new Error('useMyDayShareActions must be used within a MyDayContextStoreProvider')
  return actions
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSharedMyDay(): SharedMyDayState<MyDayContext> {
  return useContext(SharedMyDayStateContext)
}
