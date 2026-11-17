import type { Client } from './db/clients'
import { cgManagedWebsiteForClient } from './cgWebsiteFleet'

// Reuse reviewed exact IDs; never infer registry membership from a company name.
export function reviewedNolanWebsites(clients: Client[]) {
  return clients.filter(client => client.active).flatMap(client => {
    const website = cgManagedWebsiteForClient(client.id)
    return website ? [{ client, website }] : []
  })
}

/** Count accessible client identity coverage, never the number of websites.
 * No match means no reviewed reporting mapping, not a missing/down website. */
export function nolanWebsiteMappingCoverage(clients: Client[]) {
  const activeIds = new Set(clients.filter(client => client.active).map(client => client.id))
  const mappedIds = new Set(reviewedNolanWebsites(clients).map(({client}) => client.id))
  return {
    activeClientIdentitiesRead: activeIds.size,
    reviewedMappingsMatched: mappedIds.size,
    clientIdentitiesWithoutReviewedMapping: [...activeIds].filter(id => !mappedIds.has(id)).length,
  }
}
