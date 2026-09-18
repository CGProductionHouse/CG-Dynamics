import { supabase } from './supabase'

export interface WebsiteReport {
  version: 1
  websiteId: number
  generatedAt: string
  identity: { dynamicsClientId?: string; canonicalHost: string; environment: 'production' | 'preview' }
  period: { from: string; to: string; timezone: string; coverageFrom: string | null }
  traffic: {
    visitors: number | null; pageviews: number | null
    topPages: { label: string; visitors: number; pageviews: number }[]
    sources: { label: string; visitors: number; pageviews: number }[]
  }
  conversions: { total: number | null; byType: { type: string; count: number }[] }
  commerce: { currency: 'ZAR'; orderCount: number; trackedRevenue: number; refunds: number; averageOrderValue: number | null; unitsSold: number } | null
  dataQuality: {
    state: 'not_connected' | 'not_tracked' | 'collecting' | 'partial' | 'available' | 'permission_required' | 'provider_error'
    gaps: string[]
    trafficProvider: 'vercel' | 'unavailable'
    sourceReadAt: string | null
  }
}

export type WebsitePerformanceState = WebsiteReport['dataQuality']['state'] | 'unavailable'

export interface WebsitePerformanceResult {
  clientId: string
  state: WebsitePerformanceState
  report: WebsiteReport | null
  saved?: { reportId: string; snapshotId: string; revision: number }
}

async function invokeWebsitePerformance(clientId: string, from: string, to: string, action: 'preview' | 'save_draft') {
  const { data, error } = await supabase.functions.invoke('website-performance-report', { body: { clientId, from, to, action } })
  if (error || !data || typeof data !== 'object' || data.clientId !== clientId || typeof data.state !== 'string') {
    throw new Error('Website performance is unavailable for this client.')
  }
  if (data.report && (data.report.version !== 1 || data.report.identity?.dynamicsClientId !== clientId)) {
    throw new Error('Website reporting identity mismatch.')
  }
  return data as WebsitePerformanceResult
}

export const getWebsitePerformance = (clientId: string, from: string, to: string) =>
  invokeWebsitePerformance(clientId, from, to, 'preview')

export const saveWebsitePerformanceDraft = (clientId: string, from: string, to: string) =>
  invokeWebsitePerformance(clientId, from, to, 'save_draft')
