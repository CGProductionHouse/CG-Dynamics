import { supabase } from './supabase'

export interface WebsiteReport {
  version: 1
  websiteId: number
  period: { from: string; to: string }
  traffic: {
    visitors: number | null; pageviews: number | null
    topPages: { label: string; visitors: number; pageviews: number }[]
    sources: { label: string; visitors: number; pageviews: number }[]
  }
  conversions: { total: number | null; byType: { type: string; count: number }[] }
  commerce: { currency: 'ZAR'; orderCount: number; trackedRevenue: number; refunds: number; averageOrderValue: number | null; unitsSold: number } | null
  dataQuality: { gaps: string[]; trafficProvider: 'vercel' | 'unavailable' }
}

export async function getWebsitePerformance(clientId: string, from: string, to: string): Promise<WebsiteReport> {
  const { data, error } = await supabase.functions.invoke('website-performance-report', { body: { clientId, from, to } })
  if (error || !data || typeof data !== 'object' || data.report?.version !== 1 || data.clientId !== clientId) {
    throw new Error('Website performance is unavailable for this client.')
  }
  return data.report as WebsiteReport
}
