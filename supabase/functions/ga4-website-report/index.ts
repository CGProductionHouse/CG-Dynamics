// ga4-website-report — GA4 Data API read path for the website-after-the-click view (#335).
//
// READ ONLY. This function never writes to Google, never writes client analytics data, and never
// changes Ads tracking, auto-tagging or Ads↔GA4 linking. It reads one exact client's GA4 property
// for one exact Google Ads campaign and date range.
//
// EXACT MAPPING ONLY. The property is resolved from client_ga4_properties by client_id, and the
// campaign is verified to belong to that same client via google_ads_campaign_links before anything
// is requested. There is no property-name search anywhere in this path.
//
// Every failure returns a truthful `available: false` with a reason. Nothing here returns 0 to
// stand in for "unknown".

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { requireClientOwnerOrManager } from '../_shared/auth.ts'
import {
  evaluateCtas,
  resolveGa4JoinStrategy,
  validateGa4Selection,
  type CtaDefinition,
} from '../_shared/ga4-contract.ts'
import {
  buildGa4ReportRequest,
  ga4MetadataUrl,
  ga4RunReportUrl,
  normalizeGa4PropertyId,
  parseGa4Metadata,
  parseGa4PropertyTimeZone,
  parseGa4ReportRows,
  singleRowGa4Metric,
  sumGa4Metric,
  validGa4Date,
} from '../_shared/ga4-data-api.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'

function unavailable(reason: string, propertyId: string | null = null) {
  return {
    ok: true,
    payload: {
      available: false,
      unavailableReason: reason,
      propertyId,
      propertyTimeZone: null,
      dataThroughDate: null,
      fetchedAt: new Date().toISOString(),
      joinStrategy: 'unavailable',
      sessions: null, activeUsers: null, engagedSessions: null, engagementRate: null, keyEvents: null,
      landingPages: [], observedEventNames: [], eventCounts: {}, unsupportedFields: [],
    },
  }
}

/**
 * GA4 credentials are deliberately separate env vars. Creating or changing them is a CA gate, so an
 * unset value returns not-configured rather than silently reusing an unrelated credential.
 */
function ga4Config(): { clientId: string; clientSecret: string; refreshToken: string } | null {
  const clientId = Deno.env.get('GOOGLE_ANALYTICS_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_ANALYTICS_CLIENT_SECRET')
  const refreshToken = Deno.env.get('GOOGLE_ANALYTICS_REFRESH_TOKEN')
  if (!clientId || !clientSecret || !refreshToken) return null
  return { clientId, clientSecret, refreshToken }
}

async function accessToken(): Promise<string | null> {
  const config = ga4Config()
  if (!config) return null
  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) return null
  const body = await response.json().catch(() => null)
  const token = (body ?? {})?.access_token
  return typeof token === 'string' && token.length > 0 ? token : null
}

async function ga4Get(url: string, token: string): Promise<unknown | null> {
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
  if (!response.ok) return null
  return await response.json().catch(() => null)
}

async function ga4Post(url: string, token: string, body: unknown): Promise<unknown | null> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) return null
  return await response.json().catch(() => null)
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)

  const input = await request.json().catch(() => null) as Record<string, unknown> | null
  const clientId = typeof input?.clientId === 'string' ? input.clientId.trim() : ''
  const campaignId = typeof input?.campaignId === 'string' ? input.campaignId.trim() : ''
  const startDate = input?.startDate
  const endDate = input?.endDate

  if (!UUID.test(clientId)) return jsonResponse({ ok: false, error: 'A valid clientId is required.' }, 400)
  if (!/^\d{1,20}$/.test(campaignId)) return jsonResponse({ ok: false, error: 'A valid campaignId is required.' }, 400)
  if (!validGa4Date(startDate) || !validGa4Date(endDate) || endDate < startDate) {
    return jsonResponse({ ok: false, error: 'A valid startDate and endDate are required (YYYY-MM-DD).' }, 400)
  }

  const auth = await requireClientOwnerOrManager(request, clientId)
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status)

  const supabase = auth.value.supabase

  // The campaign must belong to THIS client. Prevents one client's report pulling another's campaign.
  const campaignLink = await supabase
    .from('google_ads_campaign_links')
    .select('campaign_id')
    .eq('client_id', clientId).eq('campaign_id', campaignId).eq('is_active', true)
    .maybeSingle()
  if (campaignLink.error) return jsonResponse({ ok: false, error: 'Campaign mapping lookup failed.' }, 500)
  if (!campaignLink.data) {
    return jsonResponse(unavailable('That campaign is not mapped to this client.'))
  }

  // Exact client → exact GA4 property. No name matching, no sibling fallback.
  const mapping = await supabase
    .from('client_ga4_properties')
    .select('property_id, time_zone')
    .eq('client_id', clientId).eq('is_active', true)
    .maybeSingle()
  if (mapping.error) {
    return jsonResponse(unavailable('Google Analytics mapping is not available right now.'))
  }
  const propertyId = normalizeGa4PropertyId(mapping.data?.property_id)
  if (!propertyId) {
    return jsonResponse(unavailable('No Google Analytics property is connected for this client yet.'))
  }

  const token = await accessToken()
  if (!token) {
    return jsonResponse(unavailable('Google Analytics reporting is not configured yet.', propertyId))
  }

  // Ask the property what it actually supports before requesting anything.
  const metadataPayload = await ga4Get(ga4MetadataUrl(propertyId), token)
  if (!metadataPayload) {
    return jsonResponse(unavailable('Google Analytics did not return this property\'s reporting schema.', propertyId))
  }
  const metadata = parseGa4Metadata(metadataPayload)
  const propertyTimeZone = parseGa4PropertyTimeZone(metadataPayload) ?? mapping.data?.time_zone ?? null

  const join = resolveGa4JoinStrategy(metadata)
  if (join.strategy === 'unavailable') {
    return jsonResponse(unavailable(`Website sessions cannot be attributed to this campaign. ${join.reason}`, propertyId))
  }

  const wantedMetrics = ['sessions', 'activeUsers', 'engagedSessions', 'engagementRate', 'keyEvents']
  const metricSelection = validateGa4Selection(wantedMetrics, metadata.metrics)
  if (metricSelection.supported.length === 0) {
    return jsonResponse(unavailable('This Google Analytics property supports none of the required measurements.', propertyId))
  }
  const landingSelection = validateGa4Selection(['landingPage'], metadata.dimensions)
  const eventSelection = validateGa4Selection(['eventName'], metadata.dimensions)

  const range = { startDate, endDate }
  const summaryRequest = buildGa4ReportRequest({
    range, join, campaignId, dimensions: [], metrics: metricSelection.supported, limit: 1,
  })
  if (!summaryRequest) {
    return jsonResponse(unavailable('The Google Analytics request could not be built for this period.', propertyId))
  }

  const reportUrl = ga4RunReportUrl(propertyId)
  const [summaryPayload, landingPayload, eventPayload] = await Promise.all([
    ga4Post(reportUrl, token, summaryRequest),
    landingSelection.supported.length > 0
      ? ga4Post(reportUrl, token, buildGa4ReportRequest({
        range, join, campaignId,
        dimensions: landingSelection.supported,
        metrics: metricSelection.supported.filter(m => m === 'sessions' || m === 'engagedSessions'),
        limit: 25,
      }))
      : Promise.resolve(null),
    eventSelection.supported.length > 0
      ? ga4Post(reportUrl, token, buildGa4ReportRequest({
        range, join, campaignId,
        dimensions: eventSelection.supported,
        metrics: validateGa4Selection(['eventCount'], metadata.metrics).supported,
        limit: 200,
      }))
      : Promise.resolve(null),
  ])

  if (!summaryPayload) {
    return jsonResponse(unavailable('Google Analytics did not return website data for this period.', propertyId))
  }

  const summaryRows = parseGa4ReportRows(summaryPayload)
  const landingRows = landingPayload ? parseGa4ReportRows(landingPayload) : []
  const eventRows = eventPayload ? parseGa4ReportRows(eventPayload) : []

  const eventCounts: Record<string, number> = {}
  const observedEventNames: string[] = []
  for (const row of eventRows) {
    const name = row.dimensions.eventName
    if (!name) continue
    observedEventNames.push(name)
    const count = row.metrics.eventCount
    if (count !== null) eventCounts[name] = count
  }

  // CTA definitions are the client's configured taxonomy; absent config means nothing is claimed.
  const ctaRows = await supabase
    .from('client_cta_event_definitions')
    .select('cta_key, label, ga4_event_names, expected')
    .eq('client_id', clientId).eq('is_active', true)
  const definitions: CtaDefinition[] = (ctaRows.data ?? []).map(row => ({
    key: String(row.cta_key),
    label: String(row.label),
    eventNames: Array.isArray(row.ga4_event_names) ? row.ga4_event_names.map(String) : [],
    expected: row.expected !== false,
  }))

  return jsonResponse({
    ok: true,
    payload: {
      available: true,
      unavailableReason: null,
      propertyId,
      propertyTimeZone,
      dataThroughDate: endDate,
      fetchedAt: new Date().toISOString(),
      joinStrategy: join.strategy,
      sessions: sumGa4Metric(summaryRows, 'sessions'),
      activeUsers: sumGa4Metric(summaryRows, 'activeUsers'),
      engagedSessions: sumGa4Metric(summaryRows, 'engagedSessions'),
      // A rate must not be summed across rows; the summary request is limited to one row.
      engagementRate: singleRowGa4Metric(summaryRows, 'engagementRate'),
      keyEvents: sumGa4Metric(summaryRows, 'keyEvents'),
      landingPages: landingRows.map(row => ({
        path: row.dimensions.landingPage ?? '',
        sessions: row.metrics.sessions ?? null,
        engagedSessions: row.metrics.engagedSessions ?? null,
      })).filter(page => page.path !== ''),
      observedEventNames,
      eventCounts,
      ctas: evaluateCtas({ definitions, observedEventNames, eventCounts, ga4Reachable: true }),
      unsupportedFields: [...metricSelection.unsupported, ...landingSelection.unsupported],
    },
  })
})
