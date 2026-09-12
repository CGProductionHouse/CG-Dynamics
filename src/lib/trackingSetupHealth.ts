// trackingSetupHealth.ts — read-only Ads↔GA4 setup health for one exact client (#335).
//
// Loads only what is genuinely observable and degrades honestly when it is not. The mapping tables
// arrive with a CA-gated migration, so before that migration is applied this reports "not yet
// available" rather than failing or implying the client is misconfigured.
//
// Nothing here mutates Google Ads or GA4.

import { supabase } from './supabase'
import {
  assessTrackingReadiness,
  type AdsCampaignType,
  type TrackingReport,
} from './googleAdsTrackingContract'

/** PostgREST codes meaning the relation is not in the schema cache (migration not applied yet). */
const MISSING_TABLE_CODES = new Set(['PGRST205', 'PGRST202', '42P01'])

export interface TrackingSetupObservation {
  ga4PropertyMapped: boolean
  ga4PropertyId: string | null
  websiteDomain: string | null
  ctaDefinitionCount: number | null
  /** True when the mapping tables are not yet in the database. */
  mappingSchemaAvailable: boolean
}

export interface TrackingSetupHealth {
  observation: TrackingSetupObservation
  report: TrackingReport
  /** Set when the underlying mapping schema is not deployed yet. */
  schemaNote: string | null
}

const UNAVAILABLE_OBSERVATION: TrackingSetupObservation = {
  ga4PropertyMapped: false,
  ga4PropertyId: null,
  websiteDomain: null,
  ctaDefinitionCount: null,
  mappingSchemaAvailable: false,
}

/**
 * Read the current setup posture for one exact client.
 *
 * Auto-tagging state and the live Final URL suffix are NOT read here: both require a Google Ads API
 * call, and this function deliberately performs no provider call at all. They are passed through as
 * unknown so the report says so rather than assuming they are configured.
 */
export async function loadTrackingSetupHealth(
  clientId: string,
  campaignType: AdsCampaignType = 'UNKNOWN',
): Promise<TrackingSetupHealth> {
  if (!clientId) {
    return {
      observation: UNAVAILABLE_OBSERVATION,
      report: assessTrackingReadiness({
        autoTaggingEnabled: null, finalUrlSuffix: null, campaignType, ga4PropertyMapped: false,
      }),
      schemaNote: null,
    }
  }

  const [propertyResult, domainResult, ctaResult] = await Promise.all([
    supabase.from('client_ga4_properties').select('property_id')
      .eq('client_id', clientId).eq('is_active', true).maybeSingle(),
    supabase.from('client_website_domains').select('domain')
      .eq('client_id', clientId).eq('is_active', true).eq('is_primary', true).maybeSingle(),
    supabase.from('client_cta_event_definitions').select('cta_key')
      .eq('client_id', clientId).eq('is_active', true),
  ])

  const schemaMissing = [propertyResult, domainResult, ctaResult].some(
    result => result.error && MISSING_TABLE_CODES.has(String(result.error.code)),
  )

  const observation: TrackingSetupObservation = schemaMissing
    ? UNAVAILABLE_OBSERVATION
    : {
      ga4PropertyMapped: Boolean(propertyResult.data?.property_id),
      ga4PropertyId: propertyResult.data?.property_id ?? null,
      websiteDomain: domainResult.data?.domain ?? null,
      ctaDefinitionCount: ctaResult.error ? null : (ctaResult.data ?? []).length,
      mappingSchemaAvailable: true,
    }

  return {
    observation,
    report: assessTrackingReadiness({
      autoTaggingEnabled: null,
      finalUrlSuffix: null,
      campaignType,
      ga4PropertyMapped: observation.ga4PropertyMapped,
    }),
    schemaNote: schemaMissing
      ? 'The GA4 mapping tables are not deployed yet, so setup state cannot be read for any client.'
      : null,
  }
}
