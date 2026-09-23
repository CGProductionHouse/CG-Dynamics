import { createContext, useContext } from 'react'
import type { Client } from '../../lib/db/clients'

export type ClientPortalContextValue = {
  client: Client | null
}

export const ClientPortalContext = createContext<ClientPortalContextValue | null>(null)

export function useClientPortal() {
  const context = useContext(ClientPortalContext)
  if (!context) throw new Error('useClientPortal must be used inside ClientPortalLayout')
  return context
}
