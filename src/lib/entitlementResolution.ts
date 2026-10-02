import { readPackageAuthority } from './packageAuthority'
import { classifySocialProviderEligibility } from './socialProviderEligibility'
import { SERVICE_KEYS, type ServiceKey, type ServiceEntitlement } from './clientServicePresentation'
import type { ServiceEvidence } from './clientServiceEntitlements'

export interface ResolutionClient {
  client_id: string; client_name: string; package_settings: unknown
  entitlements: ServiceEvidence[]
  connections: Pick<ServiceEntitlement, 'service_key' | 'connection'>[]
}
export interface ResolutionRow {
  client: ResolutionClient; service: ServiceKey; evidence?: ServiceEvidence
  connection: ServiceEntitlement['connection']; reviewed: boolean; unresolved: boolean
  ready: boolean; context: 'eligible' | 'excluded' | 'unresolved'
  packageEvidence: string[]; sources: string[]; confirmedAt: string | null
}
// Accepted #389 read-only examples, not a rule that infers platform entitlements.
// Require exact client, approved receipt reference and unchanged approved wording.
const APPROVED_EXAMPLES: Partial<Record<string, { service: ServiceKey; snippet: string }>> = {
  'cdb11a82-339e-4b46-9b09-bde1a23efeaf': { service: 'instagram', snippet: 'Posters are supplied as requested. Daily specials are published to Instagram Story and as an actual Facebook post.' },
  'dfa47255-875d-43cf-8a22-cfe1a6247fb7': { service: 'instagram', snippet: 'Posters are supplied on request. Daily specials are published to Instagram Story and as an actual Facebook post.' },
  'ac4c5e0c-c5d3-4512-8472-fe59192abeca': { service: 'website_digital_experience', snippet: 'Website service only; monthly website-update quantity is not specified.' },
}
const BATCH_SOURCE = 'https://github.com/CGProductionHouse/CG-Dynamics/issues/504#issuecomment-5796095876'

export function buildResolutionRows(clients: ResolutionClient[]): ResolutionRow[] {
  return clients.flatMap(client => {
    const authority = readPackageAuthority(client.package_settings)
    const confirmed = authority.status === 'confirmed'
    const sources = confirmed ? authority.verification?.source_references ?? [] : []
    const settings = confirmed ? authority.settings : null
    const packageEvidence = settings ? Object.entries(settings).filter(([, value]) => value !== null)
      .map(([key, value]) => `${key.replaceAll('_', ' ')}: ${value}`) : []
    return SERVICE_KEYS.map(service => {
      const evidence = client.entitlements.find(row => row.service_key === service)
      const example = APPROVED_EXAMPLES[client.client_id]
      return { client, service, evidence, connection: client.connections.find(row => row.service_key === service)?.connection ?? 'unavailable',
        reviewed: !!evidence, unresolved: !evidence || evidence.state === 'unknown',
        ready: !!(example?.service === service && confirmed && sources.includes(BATCH_SOURCE)
          && settings?.other_agreed_deliverables === example.snippet),
        context: classifySocialProviderEligibility(client.package_settings).state,
        packageEvidence, sources, confirmedAt: confirmed ? authority.verification?.confirmed_at ?? null : null }
    })
  })
}
export interface ResolutionFilters { service: string; client: string; readiness: string; context: string; reviewed: string }
export function filterResolutionRows(rows: ResolutionRow[], filter: ResolutionFilters): ResolutionRow[] {
  return rows.filter(row => (!filter.service || row.service === filter.service)
    && (!filter.client || row.client.client_id === filter.client)
    && (!filter.readiness || (filter.readiness === 'ready' ? row.ready : row.unresolved && !row.ready))
    && (!filter.context || row.context === filter.context)
    && (!filter.reviewed || row.reviewed === (filter.reviewed === 'reviewed')))
}
