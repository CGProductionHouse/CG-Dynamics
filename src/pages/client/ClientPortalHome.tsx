import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClientLogo } from '../../components/ClientLogo'
import { useClientPortal } from '../../components/client/ClientPortalContext'
import { ClientPortalErrorState, ClientPortalLoadingState } from '../../components/client/ClientPortalStates'
import { useAuth } from '../../contexts/AuthContext'
import { activeOrganicPlatforms, actionMonthForReport, buildClientStrategyPreview } from '../../lib/clientPortal'
import { fetchClientMonthAhead } from '../../lib/clientPortalCalendar'
import { listClientPublishedReports, type ClientReport } from '../../lib/db/reports'
import { loadReportPlatformFacts } from '../../lib/db/reportingTruth'
import { loadGoogleAdsDashboard, type GoogleAdsDashboardState } from '../../lib/googleAdsDashboard'
import type { PlatformFact } from '../../lib/overviewModel'
import { getReportMonthFromPeriod, monthDisplayLabel, selectMonthlyReports } from '../../lib/reportPeriod'

type PortalData = {
  report: ClientReport | null
  facts: PlatformFact[]
  googleAdsState: GoogleAdsDashboardState
  calendarCount: number | null
}

const EMPTY_DATA: PortalData = {
  report: null,
  facts: [],
  googleAdsState: 'no-activity',
  calendarCount: null,
}

export default function ClientPortalHome() {
  const { profile } = useAuth()
  const { client } = useClientPortal()
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
        const reportsResult = await listClientPublishedReports()
        if (!active) return
        if (reportsResult.error) throw new Error('Portal data unavailable')

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
  const hasPerformanceSummary = activeOrganic.length > 0 || reportMonth !== null
  const performanceStatus = activeOrganic.length > 0
    ? `${activeOrganic.length} verified channel${activeOrganic.length === 1 ? '' : 's'}`
    : 'Awaiting verified data'
  const paidMediaStatus = googleAdsStatusLabel(data.googleAdsState)
  const contentStatus = data.calendarCount === null
    ? 'Schedule unavailable'
    : data.calendarCount === 0
      ? 'No items scheduled'
      : `${data.calendarCount} item${data.calendarCount === 1 ? '' : 's'} scheduled`

  return (
    <>
      {loading ? (
        <ClientPortalLoadingState />
      ) : error ? (
        <ClientPortalErrorState title="Your overview could not be loaded" />
      ) : (
        <>
          <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#071311] shadow-[0_35px_90px_-45px_rgba(0,0,0,0.95)]">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(45,212,191,0.28),transparent_35%),radial-gradient(circle_at_95%_12%,rgba(249,115,22,0.19),transparent_27%),linear-gradient(135deg,rgba(255,255,255,0.065),transparent_46%)]" />
            <div aria-hidden className="absolute right-6 top-2 hidden text-[10rem] font-black leading-none tracking-[-0.12em] text-white/[0.035] lg:block">CG</div>
            <div aria-hidden className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#2dd4bf] via-[#14b8a6] to-[#f97316]" />

            <div className="relative grid gap-8 p-6 sm:p-9 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:p-12">
              <div className="min-w-0">
                <div className="flex items-center gap-4 sm:gap-5">
                  {client && (
                    <ClientLogo
                      client={client}
                      boxClassName="h-16 w-16 rounded-2xl sm:h-20 sm:w-20"
                      padding="p-2.5"
                      frameClassName="border border-white/10 bg-white/[0.07] shadow-2xl"
                      textClassName="text-xl font-black text-[#2dd4bf]"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.28em] text-[#2dd4bf]">Your CG command view</p>
                    <p className="mt-2 text-sm font-bold text-slate-400">
                      {actionMonth ? `Working month · ${monthDisplayLabel(actionMonth)}` : 'Client experience'}
                    </p>
                  </div>
                </div>

                <h1 className="mt-8 max-w-4xl text-5xl font-black leading-[0.92] tracking-[-0.055em] text-white sm:text-7xl lg:text-[5.5rem]">
                  {client?.name ?? 'Your portal'}
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
                  {reportMonth
                    ? `The clearest view of your ${monthDisplayLabel(reportMonth)} performance, current direction and what CG is moving forward next.`
                    : 'Your strategy, performance and upcoming content will come together here as verified work is published.'}
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link to="/client/performance" className="inline-flex min-h-11 items-center rounded-full bg-white px-5 py-2.5 text-sm font-black text-[#06110f] shadow-lg transition hover:bg-[#dffcf6]">
                    Open performance <span aria-hidden className="ml-2">↗</span>
                  </Link>
                  <Link to="/client/plan" className="inline-flex min-h-11 items-center rounded-full border border-white/15 bg-white/[0.05] px-5 py-2.5 text-sm font-bold text-white transition hover:border-[#2dd4bf]/40 hover:bg-white/[0.08]">
                    View the plan
                  </Link>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <HeroSignal label="Performance" value={performanceStatus} tone="teal" />
                <HeroSignal label="Latest report" value={reportMonth ? monthDisplayLabel(reportMonth) : 'Not published yet'} tone="warm" />
                <HeroSignal label="Coming up" value={contentStatus} tone="teal" />
              </div>
            </div>
          </section>

          <section className="mt-14">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.26em] text-[#2dd4bf]">Performance pulse</p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">What the latest report tells us</h2>
              </div>
              <Link
                to="/client/performance"
                className="hidden text-sm font-bold text-[#2dd4bf] transition hover:text-white sm:inline"
              >
                Explore the full report <span aria-hidden>↗</span>
              </Link>
            </div>

            {hasPerformanceSummary ? (
              <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeOrganic.length > 0 && (
                  <MetricCard
                    label="Verified channels"
                    value={String(activeOrganic.length)}
                    detail={activeOrganic.join(', ')}
                    tone="teal"
                  />
                )}
                <MetricCard
                  label="Paid media"
                  value={paidMediaStatus.value}
                  detail={paidMediaStatus.detail}
                  tone="warm"
                />
                {reportMonth && (
                  <MetricCard
                    label="Published review"
                    value={monthDisplayLabel(reportMonth)}
                    detail="Latest client-safe report"
                    tone="teal"
                  />
                )}
                {!reportMonth && activeOrganic.length === 0 && (
                  <MetricCard
                    label="Published review"
                    value="Pending"
                    detail="No published report yet"
                    tone="teal"
                  />
                )}
              </div>
            ) : (
              <div className="relative mt-7 overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.04] px-6 py-8 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.95)] sm:px-8">
                <div aria-hidden className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#2dd4bf]/10 blur-3xl" />
                <p className="relative max-w-2xl text-sm leading-6 text-slate-400">
                  Performance data will appear here once your reporting sources are connected and verified.
                </p>
              </div>
            )}

            <Link
              to="/client/performance"
              className="mt-5 inline-flex text-sm font-bold text-[#2dd4bf] transition hover:text-white sm:hidden"
            >
              Explore the full report <span aria-hidden className="ml-1">↗</span>
            </Link>
          </section>

          <section className="mt-14 grid gap-5 lg:grid-cols-5">
            <article className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#0b1715]/85 p-6 shadow-[0_30px_80px_-48px_rgba(0,0,0,0.95)] sm:p-8 lg:col-span-3">
              <div aria-hidden className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#2dd4bf]/10 blur-3xl" />
              <div className="relative flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.26em] text-[#2dd4bf]">Current direction</p>
                  <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white">The thinking behind the month</h2>
                </div>
                <Link
                  to="/client/plan"
                  className="hidden shrink-0 text-sm font-bold text-[#2dd4bf] transition hover:text-white sm:inline"
                >
                  Open plan <span aria-hidden>↗</span>
                </Link>
              </div>

              {strategy.length > 0 ? (
                <div className="relative mt-7 space-y-3">
                  {strategy.map(item => (
                    <article
                      key={`${item.phase}-${item.label}`}
                      className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-5 backdrop-blur"
                    >
                      <p className={`text-[0.68rem] font-black uppercase tracking-[0.2em] ${
                        item.phase === 'review' ? 'text-slate-500' : 'text-[#2dd4bf]'
                      }`}>
                        {item.label}
                      </p>
                      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-300">{item.value}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="relative mt-7 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-5 py-6">
                  <p className="text-sm leading-6 text-slate-400">
                    Your next strategy update will appear here once the current reporting review is complete.
                  </p>
                </div>
              )}
              <Link to="/client/plan" className="relative mt-5 inline-flex text-sm font-bold text-[#2dd4bf] transition hover:text-white sm:hidden">
                Open plan <span aria-hidden className="ml-1">↗</span>
              </Link>
            </article>

            <article className="relative overflow-hidden rounded-[2rem] border border-[#f97316]/15 bg-[linear-gradient(155deg,rgba(249,115,22,0.12),rgba(255,255,255,0.035)_58%,rgba(45,212,191,0.055))] p-6 shadow-[0_30px_80px_-48px_rgba(0,0,0,0.95)] sm:p-8 lg:col-span-2">
              <div aria-hidden className="absolute -bottom-20 -right-16 h-52 w-52 rounded-full bg-[#f97316]/10 blur-3xl" />
              <div className="relative flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.26em] text-[#f59e0b]">Coming up</p>
                  <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white">Content in motion</h2>
                </div>
                <Link
                  to="/client/plan"
                  className="hidden shrink-0 text-sm font-bold text-[#f6a15f] transition hover:text-white sm:inline"
                >
                  Calendar <span aria-hidden>↗</span>
                </Link>
              </div>

              <div className="relative mt-8 border-l-2 border-[#f97316]/60 pl-5">
                {data.calendarCount !== null && data.calendarCount > 0 ? (
                  <>
                    <p className="text-6xl font-black leading-none tracking-[-0.06em] text-white">{data.calendarCount}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      scheduled item{data.calendarCount === 1 ? '' : 's'} for the planning month
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xl font-black text-white">{data.calendarCount === 0 ? 'A clear canvas' : 'Schedule pending'}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      {data.calendarCount === 0
                        ? 'No client-visible content is scheduled for this planning month yet.'
                        : 'Content scheduling details will appear here as they become available.'}
                    </p>
                  </>
                )}
              </div>

              <Link
                to="/client/plan"
                className="relative mt-8 inline-flex text-sm font-bold text-[#f6a15f] transition hover:text-white sm:hidden"
              >
                Open calendar <span aria-hidden className="ml-1">↗</span>
              </Link>
            </article>
          </section>

          <section className="mt-5 overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.035] shadow-[0_24px_60px_-42px_rgba(0,0,0,0.95)]">
            <div className="grid sm:grid-cols-3">
              <JourneyLink to="/client/plan" index="01" label="Plan" description="Strategy, calendar and content guidelines" />
              <JourneyLink to="/client/performance" index="02" label="Performance" description="Verified reporting and campaign data" />
              <JourneyLink to="/client/approvals" index="03" label="Approvals" description="Review status and next actions" />
            </div>
          </section>
        </>
      )}
    </>
  )
}

function HeroSignal({ label, value, tone }: { label: string; value: string; tone: 'teal' | 'warm' }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${tone === 'warm' ? 'bg-[#f97316]' : 'bg-[#2dd4bf]'}`} />
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      </div>
      <p className="mt-2 text-base font-black text-white">{value}</p>
    </div>
  )
}

function MetricCard({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone: 'teal' | 'warm' }) {
  const accent = tone === 'warm' ? 'from-[#f97316] to-[#f59e0b]' : 'from-[#2dd4bf] to-[#14b8a6]'
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.045] p-5 shadow-[0_24px_60px_-38px_rgba(0,0,0,0.95)] backdrop-blur sm:p-6">
      <div className={`mb-5 h-1 w-12 rounded-full bg-gradient-to-r ${accent}`} />
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black leading-none tracking-[-0.04em] text-white sm:text-4xl">{value}</p>
      {detail && <p className="mt-3 text-xs font-medium text-slate-500">{detail}</p>}
      <div className="pointer-events-none absolute -bottom-14 -right-14 h-32 w-32 rounded-full bg-[#2dd4bf]/0 blur-3xl transition group-hover:bg-[#2dd4bf]/10" />
    </div>
  )
}

function JourneyLink({ to, index, label, description }: { to: string; index: string; label: string; description: string }) {
  return (
    <Link
      to={to}
      className="group relative min-h-40 border-b border-white/[0.08] p-6 transition hover:bg-white/[0.04] sm:border-b-0 sm:border-r sm:last:border-r-0"
    >
      <p className="text-[0.65rem] font-black tracking-[0.24em] text-slate-600">{index}</p>
      <p className="mt-4 text-lg font-black text-white">{label}</p>
      <p className="mt-2 max-w-xs text-xs leading-5 text-slate-500">{description}</p>
      <span className="absolute bottom-6 right-6 text-lg text-[#2dd4bf] transition group-hover:translate-x-1" aria-hidden>→</span>
    </Link>
  )
}

function googleAdsStatusLabel(state: GoogleAdsDashboardState): { value: string; detail: string } {
  if (state === 'data') return { value: 'Active', detail: 'Verified Google Ads reporting' }
  if (state === 'no-activity') return { value: 'No activity', detail: 'Connected, with no activity this period' }
  if (state === 'error') return { value: 'Unavailable', detail: 'Reporting could not be verified' }
  return { value: 'Not connected', detail: 'No verified campaign source for this period' }
}
