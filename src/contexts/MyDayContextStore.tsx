import { createContext, useContext, useState, type ReactNode } from 'react'
import type { MyDayContext } from '../lib/workforceMyDay'

interface MyDayContextStoreValue {
  myDayContext: MyDayContext | null
  setMyDayContext: (context: MyDayContext | null) => void
}

const MyDayContextStoreContext = createContext<MyDayContextStoreValue | null>(null)

export function MyDayContextStoreProvider({ children }: { children: ReactNode }) {
  const [myDayContext, setMyDayContext] = useState<MyDayContext | null>(null)

  return (
    <MyDayContextStoreContext.Provider value={{ myDayContext, setMyDayContext }}>
      {children}
    </MyDayContextStoreContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMyDayContextStore(): MyDayContextStoreValue {
  const context = useContext(MyDayContextStoreContext)
  if (!context) {
    throw new Error('useMyDayContextStore must be used within a MyDayContextStoreProvider')
  }
  return context
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMyDayContext(): MyDayContext | null {
  const context = useContext(MyDayContextStoreContext)
  return context?.myDayContext ?? null
}