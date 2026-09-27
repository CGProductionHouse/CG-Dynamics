export interface CgManagedWebsite {
  clientId: string
  canonicalHost: string
}

// Reviewed production presentation identities only. Dynamics UUIDs come from
// exact active client rows. Reporting still requires the guarded Builder/Edge
// identity contract and a published immutable snapshot.
const ACTIVE_DYNAMICS_WEBSITES: readonly CgManagedWebsite[] = [
  { clientId: 'ed7aa1ae-de21-4151-a8f9-54796b234c1f', canonicalHost: 'www.piekgroup.co.za' },
  { clientId: 'd53d8e62-9e6a-4bb9-be3f-554f40942d45', canonicalHost: 'emmanuelfunerals.com' },
  { clientId: 'cdb11a82-339e-4b46-9b09-bde1a23efeaf', canonicalHost: 'www.redoakgroup.co.za' },
  { clientId: 'fd16ebae-a50b-4920-afe0-94c2631f8f06', canonicalHost: 'www.allaroundpvc.co.za' },
]

export function cgManagedWebsiteForClient(clientId: string | null | undefined): CgManagedWebsite | null {
  if (!clientId) return null
  return ACTIVE_DYNAMICS_WEBSITES.find(website => website.clientId === clientId) ?? null
}
