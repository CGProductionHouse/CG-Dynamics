import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClientPortalShell } from '../../components/client/ClientPortalShell'
import { useAuth } from '../../contexts/AuthContext'
import { activeOrganicPlatforms, actionMonthForReport, buildClientStrategyPreview } from '../../lib/clientPortal'
import { fetchClientMonthAhead } from '../../lib/clientPortalCalendar'
import { getClient, type Client } from '../../lib/db/clients'
import { listPublishedReportsForClient, type Report } from '../../lib/db/reports'
import { loadReportPlatformFacts } from '../../lib/db/reportingTruth'
import { loadGoogleAdsDashboard, type GoogleAdsDashboardState } from '../../lib/googleAdsDashboard'
import type { PlatformFact } from '../../lib/overviewModel'
import { getReportMonthFromPeriod, monthDisplayLabel, selectMonthlyReports } from '../../lib/reportPeriod'

type PortalData = {
  client: Client | null
  report: Report | null
  facts: PlatformFact[]
  googleAdsState: GoogleAdsDashboardState
  calendarCount: number | null
}

const EMPTY_DATA: PortalData = {
  client: null,
  report: null,
  facts: [],
  googleAdsState: 'no-activity',
  calendarCount: null,
}

export default function ClientPortalHome() {
  const { profile } = useAuth()
  const [data, setData] = useState<PortalData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true

    async function load() {
      if (!profile?.client_id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(false)
      try {
        const [clientResult, reportsResult] = await Promise.all([
          getClient(profile.client_id),
          listPublishedReportsForClient(profile.client_id),
        ])
        if (!active) return
        if (clientResult.error || reportsResult.error) throw new Error('Portal data unavailable')

        const report = selectMonthlyReports(reportsResult.data)[0] ?? null
        const reportMonth = report ? getReportMonthFromPeriod(report) : null
        const actionMonth = actionMonthForReport(report)
        const [factsResult, googleAdsResult, calendarResult] = await Promise.all([
          report && reportMonth
            ? loadReportPlatformFacts(report.id, reportMonth, null)
            : Promise.resolve({ facts: [], previousFacts: [], normalizedAttempted: false, error: null }),
          report && reportMonth
            ? loadGoogleAdsDashboard(report.id, reportMonth)
            : Promise.resolve({ data: null, state: 'no-activity' as const, error: null }),
          actionMonth
            ? fetchClientMonthAhead(profile.client_id, actionMonth)
            : Promise.resolve(null),
        ])
        if (!active) return

        setData({
          client: clientResult.data,
          report,
          facts: factsResult.error ? [] : factsResult.facts,
          googleAdsState: googleAdsResult.state,
          calendarCount: calendarResult && !calendarResult.loadFailed
            ? calendarResult.posts.length
            : null,
        })
      } catch {
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => { active = false }
  }, [profile?.client_id])

  const strategy = useMemo(() => buildClientStrategyPreview(data.report), [data.report])
  const activeOrganic = useMemo(() => activeOrganicPlatforms(data.facts), [data.facts])
  const reportMonth = data.report ? getReportMonthFromPeriod(data.report) : null
  const actionMonth = actionMonthForReport(data.report)
  const googleAdsActive = data.googleAdsState === 'data' || data.googleAdsState === 'no-activity'

  return (
    <ClientPortalShell client={data.client}>
      {loading ? (
        <PortalStatus message="Preparing your client portal..." />
      ) : error ? (
        <PortalStatus message="Your portal could not be loaded right now. Please try again shortly." tone="error" />
      ) : (
        <>
          <section className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-report-accent">Client overview</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-5xl">
              Welcome{data.client ? `, ${data.client.name}` : ''}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-report-muted">
              Your performance, campaign activity and upcoming content in one clear place.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <PortalBadge
                label={reportMonth ? `Latest report: ${monthDisplayLabel(reportMonth)}` : 'No published report yet'}
              />
              {actionMonth && <PortalBadge label={`Planning month: ${monthDisplayLabel(actionMonth)}`} accent />}
            </div>
          </section>

          <section className="mt-10 grid gap-4 lg:grid-cols-3">
            <PortalCard
              to="/client/performance"
              eyebrow="Verified reporting"
              title="Performance Dashboard"
              description="Review published organic and profile performance with clear source and availability context."
              detail={
                activeOrganic.length > 0
                  ? `Active reporting: ${activeOrganic.join(', ')}`
                  : 'No verified organic source is available in the latest published report.'
              }
            />
            <PortalCard
              to="/client/campaigns"
              eyebrow="Paid media"
              title="Campaigns"
              description="See verified paid campaign reporting and the optimisation direction behind it."
              detail={
                googleAdsActive
                  ? data.googleAdsState === 'data'
                    ? 'Google Ads reporting is active.'
                    : 'Google Ads is connected with no activity recorded for this report month.'
                  : 'Campaign reporting is not active for this report month.'
              }
            />
            <PortalCard
              to="/client/content-calendar"
              eyebrow="Planning"
              title="Content Calendar"
              description="View upcoming scheduled deliverables. Client-visible concepts, guidelines and scripts will appear when approved and available."
              detail={
                data.calendarCount === null
                  ? 'Schedule details will appear as they become available.'
                  : `${data.calendarCount} scheduled item${data.calendarCount === 1 ? '' : 's'} currently visible for the planning month.`
              }
            />
          </section>

          <section className="mt-12 border-t border-white/[0.07] pt-10">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-report-accent">Current game plan</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-normal text-white">From insight to action</h2>
              </div>
              {reportMonth && <p className="text-sm text-report-faint">From the {monthDisplayLabel(reportMonth)} review</p>}
            </div>

            {strategy.length > 0 ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {strategy.map(item => (
                  <article
                    key={`${item.phase}-${item.label}`}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-5 shadow-[0_18px_55px_rgba(0,0,0,0.2)]"
                  >
                    <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${
                      item.phase === 'review' ? 'text-report-muted' : 'text-report-accent'
                    }`}>
                      {item.label}
                    </p>
                    <p className="mt-3 whitespace-pre-line text-sm leading-6 text-report-text">{item.value}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-white/[0.08] bg-white/[0.03] px-5 py-6">
                <p className="text-sm leading-6 text-report-muted">
                  Your next strategy update will appear here once the current reporting review is complete.
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </ClientPortalShell>
  )
}

function PortalCard({
  to,
  eyebrow,
  title,
  description,
  detail,
}: {
  to: string
  eyebrow: string
  title: string
  description: string
  detail: string
}) {
  return (
    <Link
      to={to}
      className="group flex min-h-64 flex-col rounded-lg border border-white/[0.09] bg-[linear-gradient(145deg,rgba(20,45,40,0.62),rgba(10,15,14,0.92))] p-6 shadow-[0_22px_70px_rgba(0,0,0,0.3)] transition hover:-translate-y-0.5 hover:border-report-accent/35"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-report-accent">{eyebrow}</p>
      <h2 className="mt-4 text-xl font-semibold tracking-normal text-white">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-report-muted">{description}</p>
      <p className="mt-auto border-t border-white/[0.07] pt-5 text-xs leading-5 text-report-faint">{detail}</p>
      <span className="mt-4 text-sm font-medium text-report-accent transition group-hover:text-white">Open {title}</span>
    </Link>
  )
}

function PortalBadge({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <span className={`rounded-full border px-3 py-1.5 text-xs ${
      accent
        ? 'border-report-accent/25 bg-report-accent/10 text-report-accent'
        : 'border-white/10 bg-white/[0.03] text-report-muted'
    }`}>
      {label}
    </span>
  )
}

function PortalStatus({ message, tone = 'normal' }: { message: string; tone?: 'normal' | 'error' }) {
  return (
    <div className={`rounded-lg border px-5 py-6 text-sm ${
      tone === 'error'
        ? 'border-[#d8a07a]/20 bg-[#d8a07a]/[0.06] text-[#d8a07a]'
        : 'border-white/[0.08] bg-white/[0.03] text-report-muted'
    }`}>
      {message}
    </div>
  )
}
