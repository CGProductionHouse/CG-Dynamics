import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClientPortalShell } from '../../components/client/ClientPortalShell'
import { useAuth } from '../../contexts/AuthContext'
import { activeOrganicPlatforms, actionMonthForReport, buildClientStrategyPreview } from '../../lib/clientPortal'
import { fetchClientMonthAhead } from '../../lib/clientPortalCalendar'
import { getClient, type Client } from '../../lib/db/clients'
import { listClientPublishedReports, type ClientReport } from '../../lib/db/reports'
import { loadReportPlatformFacts } from '../../lib/db/reportingTruth'
import { loadGoogleAdsDashboard, type GoogleAdsDashboardState } from '../../lib/googleAdsDashboard'
import type { PlatformFact } from '../../lib/overviewModel'
import { getReportMonthFromPeriod, monthDisplayLabel, selectMonthlyReports } from '../../lib/reportPeriod'

type PortalData = {
  client: Client | null
  report: ClientReport | null
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
          listClientPublishedReports(),
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
        <LoadingState />
      ) : error ? (
        <ErrorState />
      ) : (
        <>
          {/* ── Hero ─────────────────────────────────────────────────────── */}
          <section className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[linear-gradient(165deg,rgba(20,45,40,0.7),rgba(5,10,9,0.95))] px-6 py-10 sm:px-10 sm:py-14">
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-report-accent/[0.07] blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-[#c37a49]/[0.05] blur-3xl" />

            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-report-accent">
                {data.client ? 'Client portal' : 'Welcome'}
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-6xl">
                {data.client?.name ?? 'Your Portal'}
              </h1>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {reportMonth && (
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-xs font-medium text-report-muted">
                    Latest report: {monthDisplayLabel(reportMonth)}
                  </span>
                )}
                {actionMonth && (
                  <span className="rounded-full border border-report-accent/20 bg-report-accent/10 px-3.5 py-1.5 text-xs font-medium text-report-accent">
                    Working month: {monthDisplayLabel(actionMonth)}
                  </span>
                )}
                {!reportMonth && (
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-xs font-medium text-report-muted">
                    Reporting setup in progress
                  </span>
                )}
              </div>

              <p className="mt-6 max-w-xl text-base leading-7 text-report-muted">
                {reportMonth
                  ? `Performance, strategy and upcoming content for ${monthDisplayLabel(reportMonth)} in one clear view.`
                  : 'Your performance data and content plan will appear here once reporting is connected.'}
              </p>
            </div>
          </section>

          {/* ── Performance at a glance ──────────────────────────────────── */}
          <section className="mt-8">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-report-accent">Performance</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-normal text-white">At a glance</h2>
              </div>
              <Link
                to="/client/performance"
                className="hidden text-sm font-medium text-report-accent transition hover:text-white sm:inline"
              >
                View full report
              </Link>
            </div>

            {activeOrganic.length > 0 || googleAdsActive ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeOrganic.length > 0 && (
                  <MetricCard
                    label="Active channels"
                    value={String(activeOrganic.length)}
                    detail={activeOrganic.join(', ')}
                  />
                )}
                {googleAdsActive && (
                  <MetricCard
                    label="Paid media"
                    value={data.googleAdsState === 'data' ? 'Active' : 'Connected'}
                    detail={data.googleAdsState === 'data' ? 'Google Ads reporting live' : 'No activity this period'}
                  />
                )}
                {reportMonth && (
                  <MetricCard
                    label="Report"
                    value={monthDisplayLabel(reportMonth)}
                    detail="Latest published report"
                  />
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-5 py-6">
                <p className="text-sm leading-6 text-report-muted">
                  Performance data will appear here once your reporting sources are connected and verified.
                </p>
              </div>
            )}

            <Link
              to="/client/performance"
              className="mt-4 inline-flex text-sm font-medium text-report-accent transition hover:text-white sm:hidden"
            >
              View full report
            </Link>
          </section>

          {/* ── Strategy + Calendar (asymmetric two-column) ──────────────── */}
          <section className="mt-10 grid gap-5 lg:grid-cols-5">
            {/* Strategy — wider column */}
            <div className="lg:col-span-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-report-accent">Strategy</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-normal text-white">Current direction</h2>
                </div>
                <Link
                  to="/client/plan"
                  className="hidden text-sm font-medium text-report-accent transition hover:text-white sm:inline"
                >
                  View plan
                </Link>
              </div>

              {strategy.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {strategy.map(item => (
                    <article
                      key={`${item.phase}-${item.label}`}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-5"
                    >
                      <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${
                        item.phase === 'review' ? 'text-report-muted' : 'text-report-accent'
                      }`}>
                        {item.label}
                      </p>
                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-report-text">{item.value}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-5 py-6">
                  <p className="text-sm leading-6 text-report-muted">
                    Your next strategy update will appear here once the current reporting review is complete.
                  </p>
                </div>
              )}
            </div>

            {/* Calendar — narrower column */}
            <div className="lg:col-span-2">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-report-accent">Content</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-normal text-white">Upcoming</h2>
                </div>
                <Link
                  to="/client/plan"
                  className="hidden text-sm font-medium text-report-accent transition hover:text-white sm:inline"
                >
                  View calendar
                </Link>
              </div>

              <div className="mt-5 rounded-lg border border-white/[0.08] bg-white/[0.035] p-5">
                {data.calendarCount !== null && data.calendarCount > 0 ? (
                  <>
                    <p className="text-3xl font-bold text-white">{data.calendarCount}</p>
                    <p className="mt-1 text-sm text-report-muted">
                      scheduled item{data.calendarCount === 1 ? '' : 's'} for the planning month
                    </p>
                  </>
                ) : (
                  <p className="text-sm leading-6 text-report-muted">
                    Content scheduling details will appear here as they become available.
                  </p>
                )}
              </div>

              <Link
                to="/client/plan"
                className="mt-4 inline-flex text-sm font-medium text-report-accent transition hover:text-white sm:hidden"
              >
                View calendar
              </Link>
            </div>
          </section>

          {/* ── Quick links ──────────────────────────────────────────────── */}
          <section className="mt-10 border-t border-white/[0.07] pt-8">
            <div className="grid gap-3 sm:grid-cols-3">
              <QuickLink to="/client/plan" label="Plan" description="Strategy, calendar and content guidelines" />
              <QuickLink to="/client/performance" label="Performance" description="Verified reporting and campaign data" />
              <QuickLink to="/client/approvals" label="Approvals" description="Content review status" />
            </div>
          </section>
        </>
      )}
    </ClientPortalShell>
  )
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-report-faint">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {detail && <p className="mt-1 text-xs text-report-faint">{detail}</p>}
    </div>
  )
}

function QuickLink({ to, label, description }: { to: string; label: string; description: string }) {
  return (
    <Link
      to={to}
      className="group rounded-lg border border-white/[0.08] bg-white/[0.03] p-4 transition hover:border-report-accent/30 hover:bg-white/[0.05]"
    >
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="mt-1 text-xs text-report-faint">{description}</p>
      <span className="mt-3 inline-block text-xs font-medium text-report-accent transition group-hover:text-white">
        Open
      </span>
    </Link>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-6 py-4 text-sm text-report-muted">
        Preparing your portal...
      </div>
    </div>
  )
}

function ErrorState() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="rounded-lg border border-[#d8a07a]/20 bg-[#d8a07a]/[0.06] px-6 py-4 text-sm text-[#d8a07a]">
        Your portal could not be loaded right now. Please try again shortly.
      </div>
    </div>
  )
}
