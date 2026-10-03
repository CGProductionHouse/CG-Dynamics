// #335 x #405: presentation model for the premium Website Performance dashboard.
//
// Composition rules (CA product correction, #335, 3 Oct 2026):
// - Traffic (visitors, page views, sources, pages) comes only from the provider snapshot.
// - Website enquiries, qualification, won and the lead pipeline come only from canonical #405
//   lead truth (website_lead_metrics). They are never taken from a provider conversion aggregate.
// - Visitor actions are a primary metric only when action tracking is actually configured
//   (conversions.total is a number); otherwise they are a compact setup note, never zero.
// - Nothing missing is turned into a zero or a large dead "Unavailable" tile; limits move to a
//   compact data-confidence strip.
import type { LeadLoad } from './db/websiteLeads'
import type { WebsiteLeadMetrics } from './websiteLeads'
import type { WebsitePerformanceResult, WebsitePerformanceState } from './websitePerformance'

export type DashboardTone = 'good' | 'info' | 'warn'

export interface DashboardKpi {
  key: 'visitors' | 'pageviews' | 'enquiries' | 'qualified' | 'won' | 'actions'
  label: string
  value: number
  hint: string | null
}

export interface RankedRow { label: string; value: number }

export interface DashboardModel {
  host: string | null
  status: { label: string; tone: DashboardTone }
  kpis: DashboardKpi[]
  actions: { tracked: true; total: number; byType: RankedRow[] } | { tracked: false; note: string } | null
  leads:
    | { state: 'loading' | 'error' | 'unavailable' | 'not_connected'; note: string }
    | {
      state: 'available'
      total: number
      qualificationRate: number | null
      pipeline: { key: 'new' | 'contacted' | 'qualified' | 'won' | 'closedLost'; label: string; value: number }[] | null
      quality: { good: number; poor: number; unreviewed: number }
    }
  traffic: { sources: RankedRow[]; pages: RankedRow[] } | null
  confidence: { summary: string; notes: string[] }
}

const STATUS: Record<WebsitePerformanceState, { label: string; tone: DashboardTone; summary: string }> = {
  available: { label: 'Verified data', tone: 'good', summary: 'Traffic data is verified for this exact website and month.' },
  collecting: { label: 'Month in progress', tone: 'info', summary: 'This month is still collecting; figures will grow until the month closes.' },
  partial: { label: 'Partial coverage', tone: 'info', summary: 'Traffic covers only part of this month.' },
  not_tracked: { label: 'Before tracking began', tone: 'warn', summary: 'This month predates verified traffic collection.' },
  not_connected: { label: 'Analytics not connected', tone: 'warn', summary: 'No verified website analytics connection for this client yet.' },
  permission_required: { label: 'Permission needed', tone: 'warn', summary: 'The analytics provider needs reviewed permission before traffic is available.' },
  provider_error: { label: 'Provider error', tone: 'warn', summary: 'The analytics provider did not return data; nothing is shown as zero.' },
  unavailable: { label: 'Reporting unavailable', tone: 'warn', summary: 'Website reporting is temporarily unavailable; nothing is shown as zero.' },
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const pct = (rate: number) => `${Math.round(rate * 1000) / 10}%`
const enquiries = (count: number) => `${count} ${count === 1 ? 'enquiry' : 'enquiries'}`

const ranked = (rows: { label: string; value: number }[]) =>
  rows.filter((row) => row.label && isCount(row.value)).sort((a, b) => b.value - a.value)

export function websitePerformanceDashboardModel(input: {
  performance: WebsitePerformanceResult | null
  performanceFailed: boolean
  leads: LeadLoad<WebsiteLeadMetrics> | null
}): DashboardModel {
  const state: WebsitePerformanceState = input.performanceFailed ? 'unavailable' : (input.performance?.state ?? 'unavailable')
  const report = input.performanceFailed ? null : input.performance?.report ?? null
  const status = STATUS[state] ?? STATUS.unavailable
  const notes: string[] = []
  const kpis: DashboardKpi[] = []

  // Traffic (provider snapshot only).
  if (report) {
    if (isCount(report.traffic.visitors)) kpis.push({ key: 'visitors', label: 'Visitors', value: report.traffic.visitors, hint: null })
    else notes.push('Visitors are not available in this snapshot (not zero).')
    if (isCount(report.traffic.pageviews)) kpis.push({ key: 'pageviews', label: 'Page views', value: report.traffic.pageviews, hint: null })
    else notes.push('Page views are not available in this snapshot (not zero).')
  }

  // Canonical #405 enquiries and lead outcomes.
  let leads: DashboardModel['leads']
  if (!input.leads) leads = { state: 'loading', note: 'Loading website enquiries…' }
  else if (input.leads.state === 'error') leads = { state: 'error', note: input.leads.message }
  else if (input.leads.state === 'unavailable') leads = { state: 'unavailable', note: 'Website lead tracking is not activated yet.' }
  else if (input.leads.data.state === 'not_connected') leads = { state: 'not_connected', note: 'No website enquiry form is connected for this client yet.' }
  else {
    const m = input.leads.data
    const counts = [m.total, m.new, m.contacted, m.qualified, m.won, m.closedLost, m.lost, m.good, m.poor, m.unreviewed]
    if (!counts.every(isCount)) {
      leads = { state: 'error', note: 'Lead figures were not in the expected shape.' }
    } else {
      // Good leads still open = qualified (Good) minus those already Won or Lost.
      const qualifiedOpen = m.qualified - m.won - m.lost
      const consistent = qualifiedOpen >= 0 && m.new + m.contacted + qualifiedOpen + m.won + m.closedLost === m.total
      const rate = m.total > 0 && typeof m.qualificationRate === 'number' && m.qualificationRate >= 0 && m.qualificationRate <= 1 ? m.qualificationRate : null
      leads = {
        state: 'available',
        total: m.total,
        qualificationRate: rate,
        pipeline: consistent ? [
          { key: 'new', label: 'New', value: m.new },
          { key: 'contacted', label: 'Contacted', value: m.contacted },
          { key: 'qualified', label: 'Qualified', value: qualifiedOpen },
          { key: 'won', label: 'Won', value: m.won },
          { key: 'closedLost', label: 'Closed / Lost', value: m.closedLost },
        ] : null,
        quality: { good: m.good, poor: m.poor, unreviewed: m.unreviewed },
      }
      kpis.push({ key: 'enquiries', label: 'Website enquiries', value: m.total, hint: m.total === 0 ? 'None received yet this month' : 'From your website form' })
      if (m.total > 0) {
        kpis.push({ key: 'qualified', label: 'Qualified leads', value: m.qualified, hint: rate === null ? null : `${pct(rate)} qualification rate` })
        kpis.push({ key: 'won', label: 'Won', value: m.won, hint: m.won > 0 ? 'Marked won by the business' : null })
      }
      if (m.unreviewed > 0) notes.push(`${enquiries(m.unreviewed)} not yet marked Good or Poor.`)
      if (!consistent) notes.push('The lead pipeline could not be broken down consistently; totals are shown.')
    }
  }
  if (leads.state !== 'available' && leads.state !== 'loading') notes.push(leads.note)

  // Visitor actions: primary only when tracking is configured.
  let actions: DashboardModel['actions'] = null
  if (report) {
    if (isCount(report.conversions.total)) {
      actions = { tracked: true, total: report.conversions.total, byType: ranked(report.conversions.byType.map((row) => ({ label: row.type.replaceAll('_', ' '), value: row.count }))) }
      kpis.push({ key: 'actions', label: 'Visitor actions', value: report.conversions.total, hint: 'Calls, WhatsApp and other tracked clicks' })
    } else {
      actions = { tracked: false, note: 'Action tracking (calls, WhatsApp, button clicks) is not configured yet, so it is not counted.' }
    }
  }

  const traffic = report ? {
    sources: ranked(report.traffic.sources.map((row) => ({ label: row.label, value: row.visitors }))),
    pages: ranked(report.traffic.topPages.map((row) => ({ label: row.label, value: row.pageviews }))),
  } : null

  return {
    host: report?.identity.canonicalHost ?? null,
    status: { label: status.label, tone: status.tone },
    kpis,
    actions,
    leads,
    traffic,
    confidence: { summary: status.summary, notes: [...notes, ...(report?.dataQuality.gaps ?? [])] },
  }
}
