import { useEffect, useMemo, useState } from 'react'
import { ClientPortalLink as Link } from '../../components/client/ClientPortalLink'
import { ClientLogo } from '../../components/ClientLogo'
import { useClientPortal } from '../../components/client/ClientPortalContext'
import { ClientPortalErrorState, ClientPortalLoadingState } from '../../components/client/ClientPortalStates'
import { useAuth } from '../../contexts/AuthContext'
import { activeOrganicPlatforms, buildPublishedMonthlyStrategyPreview, summarizeCrossChannelViews, type PublishedMonthlyStrategy } from '../../lib/clientPortal'
import { businessMonthKey } from '../../lib/businessTime'
import { getClientPublishedMonthlyStrategy } from '../../lib/monthlyStrategy'
import { fetchClientMonthAhead } from '../../lib/clientPortalCalendar'
import { summarizeClientOverviewSchedule, type ClientOverviewSchedule } from '../../lib/clientOverviewSchedule'
import { listClientPublishedReports, type ClientReport } from '../../lib/db/reports'
import { loadReportPlatformFacts } from '../../lib/db/reportingTruth'
import { loadGoogleAdsDashboard, type GoogleAdsDashboardState } from '../../lib/googleAdsDashboard'
import type { PlatformFact } from '../../lib/overviewModel'
import { getReportMonthFromPeriod, monthDisplayLabel, selectMonthlyReports } from '../../lib/reportPeriod'
import { getPreviewStrategy, listPreviewReports } from '../../lib/clientPortalPreview'

type PortalData = {
  report: ClientReport | null
  facts: PlatformFact[]
  factsUnavailable: boolean
  googleAdsState: GoogleAdsDashboardState
  schedule: ClientOverviewSchedule
  monthlyStrategy: PublishedMonthlyStrategy | null
}

const EMPTY_DATA: PortalData = {
  report: null,
  facts: [],
  factsUnavailable: false,
  googleAdsState: 'no-activity',
  schedule: summarizeClientOverviewSchedule(null),
  monthlyStrategy: null,
}

export default function ClientPortalHome() {
  const { profile } = useAuth()
  const { client, previewClientId } = useClientPortal()
  const clientId = previewClientId ?? profile?.client_id
  const [workingMonth] = useState(() => businessMonthKey())
  const [data, setData] = useState<PortalData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true

    async function load() {
      if (!clientId) {
        setLoading(false)
        return
      }

      setLoading(true)
      setData(EMPTY_DATA)
      setError(false)
      try {
        const reportsResult = await (previewClientId ? listPreviewReports(previewClientId) : listClientPublishedReports())
        if (!active) return
        if (reportsResult.error) throw new Error('Portal data unavailable')

        const report = selectMonthlyReports(reportsResult.data)[0] ?? null
        const reportMonth = report ? getReportMonthFromPeriod(report) : null
        const [factsResult, googleAdsResult, calendarResult, strategyResult] = await Promise.all([
          report && reportMonth
            ? loadReportPlatformFacts(report.id, reportMonth, null)
            : Promise.resolve({ facts: [], previousFacts: [], normalizedAttempted: false, error: null }),
          report && reportMonth
            ? loadGoogleAdsDashboard(report.id, reportMonth)
            : Promise.resolve({ data: null, state: 'no-activity' as const, error: null }),
          fetchClientMonthAhead(clientId, workingMonth).catch(() => null),
          (previewClientId ? getPreviewStrategy(previewClientId, workingMonth) : getClientPublishedMonthlyStrategy(workingMonth)).catch(() => ({ data: null, error: { message: 'Unavailable' } })),
        ])
        if (!active) return

        setData({
          report,
          facts: factsResult.error ? [] : factsResult.facts,
          factsUnavailable: Boolean(factsResult.error),
          googleAdsState: googleAdsResult.state,
          schedule: summarizeClientOverviewSchedule(calendarResult),
          monthlyStrategy: strategyResult.error ? null : strategyResult.data,
        })
      } catch {
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => { active = false }
  }, [clientId, previewClientId, workingMonth])

  const strategy = useMemo(() => buildPublishedMonthlyStrategyPreview(data.monthlyStrategy, workingMonth), [data.monthlyStrategy, workingMonth])
  const activeOrganic = useMemo(() => activeOrganicPlatforms(data.facts), [data.facts])
  const crossChannelViews = useMemo(() => summarizeCrossChannelViews(data.facts), [data.facts])
  const reportMonth = data.report ? getReportMonthFromPeriod(data.report) : null
  const actionMonth = workingMonth
  const hasPerformanceSummary = activeOrganic.length > 0 || reportMonth !== null
  const hasDirectionHighlight = strategy.length > 0
  const hasScheduleHighlight = data.schedule.state === 'scheduled' || data.schedule.state === 'planning'
  const performanceStatus = `${activeOrganic.length} verified channel${activeOrganic.length === 1 ? '' : 's'}`
  const paidMediaStatus = googleAdsStatusLabel(data.googleAdsState)
  const contentStatus = data.schedule.state === 'planning'
    ? 'Content in planning'
    : `${data.schedule.scheduledCount} item${data.schedule.scheduledCount === 1 ? '' : 's'} scheduled`

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

            <div className="relative grid gap-6 p-5 sm:gap-8 sm:p-9 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:p-12">
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

                <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[0.98] tracking-[-0.055em] text-white sm:mt-8 sm:text-7xl lg:text-[5.5rem]">
                  {client?.name ?? 'Your portal'}
                </h1>
                {reportMonth && <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:mt-6 sm:text-lg">
                  {`${monthDisplayLabel(reportMonth)} performance at a glance.`}
                </p>}

                <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
                  {hasPerformanceSummary && <Link to="/client/performance" className="inline-flex min-h-11 items-center rounded-full bg-white px-5 py-2.5 text-sm font-black text-[#06110f] shadow-lg transition hover:bg-[#dffcf6]">
                    Open performance <span aria-hidden className="ml-2">↗</span>
                  </Link>}
                  <Link to="/client/plan" className="inline-flex min-h-11 items-center rounded-full border border-white/15 bg-white/[0.05] px-5 py-2.5 text-sm font-bold text-white transition hover:border-[#2dd4bf]/40 hover:bg-white/[0.08]">
                    View the plan
                  </Link>
                </div>
              </div>

              {(hasPerformanceSummary || hasScheduleHighlight) && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-1">
                {activeOrganic.length > 0 && !data.factsUnavailable && <HeroSignal label="Performance" value={performanceStatus} tone="teal" />}
                {reportMonth && <HeroSignal label="Latest report" value={monthDisplayLabel(reportMonth)} tone="warm" />}
                {hasScheduleHighlight && <HeroSignal label="Coming up" value={contentStatus} tone="teal" />}
              </div>}
            </div>
          </section>

          {hasPerformanceSummary && <section className="mt-14">
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

              <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {crossChannelViews && !data.factsUnavailable && <MetricCard
                  label="Recorded views"
                  value={crossChannelViews.value.toLocaleString('en-ZA')}
                  detail={`${crossChannelViews.platforms.join(' + ')} · ${crossChannelViews.periodStart} to ${crossChannelViews.periodEnd}. Views, not unique people.${crossChannelViews.excludedChannels ? ` ${crossChannelViews.excludedChannels} channel${crossChannelViews.excludedChannels === 1 ? '' : 's'} without verified views excluded.` : ''}`}
                  tone="teal"
                />}
                {activeOrganic.length > 0 && (
                  <MetricCard
                    label="Verified channels"
                    value={String(activeOrganic.length)}
                    detail={activeOrganic.join(', ')}
                    tone="teal"
                  />
                )}
                {data.factsUnavailable && (
                  <MetricCard
                    label="Verified channels"
                    value="Unavailable"
                    detail="Verified channel facts could not be loaded right now"
                    tone="teal"
                  />
                )}
                {data.googleAdsState === 'data' && <MetricCard
                  label="Paid media"
                  value={paidMediaStatus.value}
                  detail={paidMediaStatus.detail}
                  tone="warm"
                />}
                {reportMonth && (
                  <MetricCard
                    label="Published review"
                    value={monthDisplayLabel(reportMonth)}
                    detail="Latest client-safe report"
                    tone="teal"
                  />
                )}
              </div>

            <Link
              to="/client/performance"
              className="mt-5 inline-flex text-sm font-bold text-[#2dd4bf] transition hover:text-white sm:hidden"
            >
              Explore the full report <span aria-hidden className="ml-1">↗</span>
            </Link>
          </section>}

          {(hasDirectionHighlight || hasScheduleHighlight) && <section className="mt-14 grid gap-5 lg:grid-cols-5">
            {hasDirectionHighlight && <article className={`relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#0b1715]/85 p-6 shadow-[0_30px_80px_-48px_rgba(0,0,0,0.95)] sm:p-8 ${hasScheduleHighlight ? 'lg:col-span-3' : 'lg:col-span-5'}`}>
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
              <Link to="/client/plan" className="relative mt-5 inline-flex text-sm font-bold text-[#2dd4bf] transition hover:text-white sm:hidden">
                Open plan <span aria-hidden className="ml-1">↗</span>
              </Link>
            </article>}

            {hasScheduleHighlight && <article className={`relative overflow-hidden rounded-[2rem] border border-[#f97316]/15 bg-[linear-gradient(155deg,rgba(249,115,22,0.12),rgba(255,255,255,0.035)_58%,rgba(45,212,191,0.055))] p-6 shadow-[0_30px_80px_-48px_rgba(0,0,0,0.95)] sm:p-8 ${hasDirectionHighlight ? 'lg:col-span-2' : 'lg:col-span-5'}`}>
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
                {data.schedule.state === 'scheduled' ? (
                  <>
                    <p className="text-6xl font-black leading-none tracking-[-0.06em] text-white">{data.schedule.scheduledCount}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      scheduled item{data.schedule.scheduledCount === 1 ? '' : 's'} for the planning month
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xl font-black text-white">Plan in progress</p>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      {data.schedule.unscheduledCount} content item{data.schedule.unscheduledCount === 1 ? '' : 's'} in planning; no dates confirmed yet.
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
            </article>}
          </section>}

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
