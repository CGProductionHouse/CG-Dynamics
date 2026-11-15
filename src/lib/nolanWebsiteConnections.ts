import type { Client } from './db/clients'
import { cgManagedWebsiteForClient } from './cgWebsiteFleet'

// Reuse reviewed exact IDs; never infer registry membership from a company name.
export function reviewedNolanWebsites(clients: Client[]) {
  return clients.filter(client => client.active).flatMap(client => {
    const website = cgManagedWebsiteForClient(client.id)
    return website ? [{ client, website }] : []
  })
}
