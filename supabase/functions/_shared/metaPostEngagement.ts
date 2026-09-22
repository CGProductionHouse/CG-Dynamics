export const META_POST_COUNT_MAX = 2_147_483_647

export type MetaPostPlatform = 'facebook' | 'instagram'
export type MetaPostComponentState = 'observed' | 'missing' | 'invalid'

export interface MetaPostComponentObservation {
  state: MetaPostComponentState
  value: number | null
}

export interface MetaPostEngagementEvidence {
  definition_id: 'facebook_direct_reactions_comments_shares_v1' | 'instagram_direct_likes_comments_v1'
  definition_label: string
  source: 'meta_graph_api_direct_fields'
  observed_at: string
  required_components: string[]
  components: Record<string, MetaPostComponentObservation>
  complete_total: number | null
  known_subtotal: number | null
  coverage: { observed: number; required: number }
  completeness: 'complete' | 'partial' | 'unavailable' | 'invalid'
}

export interface MetaPostEngagementProjection {
  completeTotal: number | null
  knownSubtotal: number | null
  definitionId: string | null
  definitionLabel: string | null
  source: string | null
  observedAt: string | null
  coverage: { observed: number; required: number } | null
  completeness: 'complete' | 'partial' | 'unavailable' | 'invalid'
}

const DEFINITIONS = {
  facebook: {
    id: 'facebook_direct_reactions_comments_shares_v1',
    label: 'Facebook direct reactions + comments + shares',
    components: ['reactions', 'comments', 'shares'],
  },
  instagram: {
    id: 'instagram_direct_likes_comments_v1',
    label: 'Instagram direct likes + comments',
    components: ['likes', 'comments'],
  },
} as const

export function classifyMetaPostCount(value: unknown): MetaPostComponentObservation {
  if (value === null || value === undefined) return { state: 'missing', value: null }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > META_POST_COUNT_MAX) {
    return { state: 'invalid', value: null }
  }
  return { state: 'observed', value }
}

export function buildMetaPostEngagementEvidence(
  platform: MetaPostPlatform,
  values: Record<string, unknown>,
  observedAt: string,
): MetaPostEngagementEvidence {
  const definition = DEFINITIONS[platform]
  const components = Object.fromEntries(
    definition.components.map(component => [component, classifyMetaPostCount(values[component])]),
  )
  const observations = Object.values(components)
  const observed = observations.filter(component => component.state === 'observed')
  const invalid = observations.some(component => component.state === 'invalid')
  const complete = observed.length === definition.components.length
  const knownSubtotal = observed.length > 0
    ? observed.reduce((sum, component) => sum + (component.value ?? 0), 0)
    : null

  return {
    definition_id: definition.id,
    definition_label: definition.label,
    source: 'meta_graph_api_direct_fields',
    observed_at: observedAt,
    required_components: [...definition.components],
    components,
    complete_total: complete ? knownSubtotal : null,
    known_subtotal: knownSubtotal,
    coverage: { observed: observed.length, required: definition.components.length },
    completeness: complete ? 'complete' : invalid ? 'invalid' : observed.length > 0 ? 'partial' : 'unavailable',
  }
}

export function observedMetaPostComponent(
  evidence: MetaPostEngagementEvidence,
  component: string,
): number | null {
  const observation = evidence.components[component]
  return observation?.state === 'observed' ? observation.value : null
}

export function chooseMetaPostEngagementEvidence(
  previous: MetaPostEngagementEvidence | null,
  incoming: MetaPostEngagementEvidence,
): { evidence: MetaPostEngagementEvidence; refreshAttempt: MetaPostEngagementEvidence | null } {
  if (previous?.completeness === 'complete' && incoming.completeness !== 'complete') {
    return { evidence: previous, refreshAttempt: incoming }
  }
  return { evidence: incoming, refreshAttempt: null }
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value))
}

export function projectMetaPostEngagement(
  rawValue: unknown,
  platform: string | null | undefined,
  legacyObservedAt: string | null = null,
): MetaPostEngagementProjection {
  const raw = rawValue && typeof rawValue === 'object' ? rawValue as Record<string, unknown> : {}
  const evidenceValue = raw.engagement_evidence
  if ((platform === 'facebook' || platform === 'instagram') && evidenceValue && typeof evidenceValue === 'object') {
    const evidence = evidenceValue as Record<string, unknown>
    const expected = DEFINITIONS[platform]
    const rebuilt = buildMetaPostEngagementEvidence(
      platform,
      (evidence.components && typeof evidence.components === 'object')
        ? Object.fromEntries(Object.entries(evidence.components as Record<string, unknown>).map(([key, value]) => [
            key,
            value && typeof value === 'object' && (value as Record<string, unknown>).state === 'observed'
              ? (value as Record<string, unknown>).value
              : value && typeof value === 'object' && (value as Record<string, unknown>).state === 'invalid'
                ? Number.NaN
                : null,
          ]))
        : {},
      validTimestamp(evidence.observed_at) ? evidence.observed_at : '',
    )
    const identityValid = evidence.definition_id === expected.id
      && evidence.definition_label === expected.label
      && evidence.source === 'meta_graph_api_direct_fields'
      && validTimestamp(evidence.observed_at)
    return {
      completeTotal: identityValid ? rebuilt.complete_total : null,
      knownSubtotal: identityValid ? rebuilt.known_subtotal : null,
      definitionId: identityValid ? expected.id : null,
      definitionLabel: identityValid ? expected.label : null,
      source: identityValid ? 'meta_graph_api_direct_fields' : null,
      observedAt: identityValid ? String(evidence.observed_at) : null,
      coverage: identityValid ? rebuilt.coverage : null,
      completeness: identityValid ? rebuilt.completeness : 'invalid',
    }
  }

  const hasExplicitImportIdentity = typeof raw.imported_meta_post_id === 'string'
    && raw.imported_meta_post_id.trim().length > 0
  const legacy = classifyMetaPostCount(raw.engagements)
  if (hasExplicitImportIdentity && legacy.state === 'observed'
    && (platform === 'facebook' || platform === 'instagram')) {
    return {
      completeTotal: legacy.value,
      knownSubtotal: legacy.value,
      definitionId: `${platform}_legacy_import_engagements_v1`,
      definitionLabel: `${platform === 'facebook' ? 'Facebook' : 'Instagram'} legacy imported engagements`,
      source: typeof raw.import_source === 'string' ? raw.import_source : 'meta_business_suite',
      observedAt: validTimestamp(raw.synced_at) ? raw.synced_at : legacyObservedAt,
      coverage: { observed: 1, required: 1 },
      completeness: 'complete',
    }
  }

  return {
    completeTotal: null,
    knownSubtotal: null,
    definitionId: null,
    definitionLabel: null,
    source: typeof raw.source === 'string' ? raw.source : null,
    observedAt: validTimestamp(raw.synced_at) ? raw.synced_at : legacyObservedAt,
    coverage: null,
    completeness: hasExplicitImportIdentity && legacy.state === 'invalid' ? 'invalid' : 'unavailable',
  }
}
