import type { WebsiteReport } from './websitePerformance'

function calendarDate(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null
}

export function websiteReportPresentation(report: WebsiteReport) {
  const start = calendarDate(report.period.from)
  const end = calendarDate(report.period.to)
  const validPeriod = start !== null && end !== null && end > start
  const coverage = report.period.coverageFrom ? calendarDate(report.period.coverageFrom) : null
  const validCoverage = validPeriod && coverage !== null && coverage >= start! && coverage < end!
  const observed = report.dataQuality.sourceReadAt ? Date.parse(report.dataQuality.sourceReadAt) : NaN
  let observedDay: number | null = null
  if (Number.isFinite(observed)) {
    try {
      const parts = new Intl.DateTimeFormat('en', { timeZone: report.period.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(observed)
      const part = (type: string) => parts.find(item => item.type === type)?.value
      observedDay = calendarDate(`${part('year')}-${part('month')}-${part('day')}`)
    } catch { /* Unknown timezone cannot establish freshness. */ }
  }
  const stale = !validPeriod || observedDay === null || observedDay < end!
  const partial = report.dataQuality.state === 'partial' || (validCoverage && coverage! > start!)
  const enquiry = report.conversions.byType.find(row => row.type === 'enquiry_submit')?.count
  return {
    periodEnd: validPeriod ? new Date(end! - 86400000).toISOString().slice(0, 10) : null,
    coverageFrom: validCoverage ? report.period.coverageFrom : null,
    stale,
    partial,
    stateLabel: partial ? (stale ? 'Partial coverage · older snapshot' : 'Partial coverage')
      : stale ? 'Older snapshot' : report.dataQuality.state === 'available' ? 'Verified snapshot' : 'Measurement incomplete',
    enquiries: typeof enquiry === 'number' && Number.isSafeInteger(enquiry) && enquiry >= 0 ? enquiry : null,
    sourceLabel: report.dataQuality.trafficProvider === 'vercel' ? 'Source: published website snapshot · Vercel traffic analytics.' : 'Source: published website snapshot · traffic provider unavailable.',
  }
}
