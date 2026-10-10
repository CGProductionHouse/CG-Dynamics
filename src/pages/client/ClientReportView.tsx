import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ClientReportWithPosts, ReportWithPosts } from '../../lib/db/reports'
import type { Client } from '../../lib/db/clients'
import type { ReportManualMetric } from '../../lib/db/manualMetrics'
import BrandMark from '../../components/BrandMark'
import { ClientLogo } from '../../components/ClientLogo'
import { clientFacingStrategyQualityIssues, readStrategyData, type StrategyData } from '../../lib/strategyEngine'
import { GuidedStrategyView } from '../../components/strategy/GuidedStrategy'
import { getReportMonthFromPeriod, isPublishedMonthToDateReport, monthDisplayLabel, normalizeReportToCalendarMonth, previousReportMonth, reportPeriodDisclosure } from '../../lib/reportPeriod'
import { isWithinMetaProviderPeriod } from '../../../supabase/functions/_shared/metaPeriod'
import type { MasterReportData, MetricMovement, Platform, PlatformView, ReportStatsPost } from '../../lib/reportStats'
import {
  PLATFORM_LABELS,
  buildMasterReport,
  compareNullable,
  displayContentType,
  formatDate,
  formatNumber,
  formatPercent,
  isMetaSyncedManualMetric,
  reportPostToStatsPost,
  contentEvidenceKey,
  shortCaption,
} from '../../lib/reportStats'
import {
  buildMetaContentMetrics,
  buildMetaPlatformMetrics,
} from '../../lib/metaMetrics'
import {
  WEAK_CONTENT_THRESHOLD,
  buildPlatformPerformance,
  buildReportPerformance,
  type GrowthSeriesItem,
  type PerformanceMetric,
  type PlatformPerformance,
  type ReportPerformance,
  type TopContent,
} from '../../lib/reportPerformance'
import {
  GoogleAdsResults,
} from '../../components/client/GoogleAdsResults'
import {
  buildOverviewSections,
  platformFactWindowLabel,
  type OverviewSection as VerifiedSection,
  type OverviewLine as VerifiedLine,
  type PlatformFact,
} from '../../lib/overviewModel'
import type { ReportContentExclusion, ReportFactHealth } from '../../lib/db/reportingTruth'
import type { GoogleAdsDashboardData, GoogleAdsDashboardState } from '../../lib/googleAdsDashboard'
import {
  PerformanceProviderIcon,
  type PerformanceProviderIconKey,
} from '../../components/client/PerformanceProviderIcon'
import { cgManagedWebsiteForClient, hasCgWebsiteMaintenance, type CgManagedWebsite } from '../../lib/cgWebsiteFleet'
import { websiteReportPresentation } from '../../lib/websiteReportPresentation'
import { PerformanceServiceStory } from '../../components/client/PerformanceServiceStory'
import { PERFORMANCE_SERVICE_TABS } from '../../lib/performanceServiceCatalog'
import { reportSourceAttribution } from '../../lib/reportSourceAttribution'

export type ReportTabKey = 'overview' | 'facebook' | 'instagram' | 'google' | 'tiktok' | 'linkedin' | 'web' | 'email'
export interface MonthlyStrategyPresentation {
  month: string
  status: 'draft' | 'approved' | 'published'
  strategyData: StrategyData
}

const LOGO_FRAME = 'border border-white/10 bg-[#06110f] shadow-[0_18px_35px_-24px_rgba(45,212,191,0.7)]'

type RenderableReport = ReportWithPosts | ClientReportWithPosts

function postsForReportMonth(report: RenderableReport): ReportStatsPost[] {
  const bounds = normalizeReportToCalendarMonth(report)
  const partial = isPublishedMonthToDateReport(report)
  // A published MTD report's disclosed cutoff remains authoritative even if
  // later ingestion attaches more posts to the same monthly report identity.
  const { start } = bounds
  const end = partial ? report.period_end : bounds.end
  const startTime = new Date(`${start}T00:00:00Z`).getTime()
  const endTime = new Date(`${end}T23:59:59.999Z`).getTime()

  return report.posts
    .filter(post => {
      if (!post.publish_time) return !partial
      if (post.platform === 'facebook' || post.platform === 'instagram') {
        return isWithinMetaProviderPeriod(post.publish_time, start, end)
      }
      const time = new Date(post.publish_time).getTime()
      return (Number.isNaN(time) && !partial) || (time >= startTime && time <= endTime)
    })
    .map(reportPostToStatsPost)
}

function reportClientName(report: RenderableReport, client: Client | null): string {
  if (client?.name) return client.name
  const stored = report.report_title?.trim()
  return stored || 'Monthly Performance Report'
}

export function ClientReportView({
  report,
  client = null,
  manualMetrics = [],
  googleAds,
  googleAdsState,
  googleAdsError,
  showEmptyStrategy = false,
  showAdminDiagnostics = false,
  facts = [],
  previousFacts = [],
  normalizedFactsAttempted = false,
  dataHealth = [],
  contentExclusions = [],
  onSetContentExcluded,
  curationBusyId = null,
  monthlyStrategy = null,
  strategyReadUnavailable = false,
  initialTab = 'overview',
  onTabChange,
}: {
  report: RenderableReport
  client?: Client | null
  manualMetrics?: ReportManualMetric[]
  previousReport?: RenderableReport | null
  previousManualMetrics?: ReportManualMetric[]
  googleAds: GoogleAdsDashboardData | null
  googleAdsState: GoogleAdsDashboardState
  googleAdsError: string | null
  showEmptyStrategy?: boolean
  /** Staff-only: renders the data-health panel. Never enable on client routes. */
  showAdminDiagnostics?: boolean
  /** Normalized verified facts for the report month (server-mediated / RLS-scoped). */
  facts?: PlatformFact[]
  /** Normalized verified facts for the previous month (comparability gate input). */
  previousFacts?: PlatformFact[]
  /** True once normalized syncing was attempted, even if persistence returned no rows. */
  normalizedFactsAttempted?: boolean
  /** Staff-only connector health rows. Never rendered on client routes. */
  dataHealth?: ReportFactHealth[]
  /** Report-bound safe exclusion flags. They affect highlights, never totals. */
  contentExclusions?: ReportContentExclusion[]
  /** Staff-only explicit curation action. Omitted on client routes. */
  onSetContentExcluded?: (post: ReportStatsPost, excluded: boolean) => void | Promise<void>
  curationBusyId?: string | null
  /** Canonical monthly strategy. Client routes may pass published projection only. */
  monthlyStrategy?: MonthlyStrategyPresentation | null
  /** A failed canonical strategy read is not evidence that no strategy exists. */
  strategyReadUnavailable?: boolean
  initialTab?: ReportTabKey
  onTabChange?: (tab: ReportTabKey) => void
}) {
  const [localTab, setLocalTab] = useState<ReportTabKey>('overview')
  const tab = onTabChange ? initialTab : localTab

  // Verified, availability-aware Overview sections built ONLY from normalized
  // facts. Per-platform (no cross-platform unique summing); the comparability
  // gate inside buildOverviewSections suppresses invalid month-on-month movement.
  const verifiedSections = useMemo(() => buildOverviewSections(facts, previousFacts), [facts, previousFacts])

  const normalizedFactsActive = normalizedFactsAttempted || facts.length > 0
  const statsPosts = useMemo<ReportStatsPost[]>(() => postsForReportMonth(report), [report])
  const excludedContentKeys = useMemo(() => {
    const keys = contentExclusions
      .filter(item => item.excluded)
      .map(item => `${item.platform}:${item.meta_object_id}`)
    report.posts.forEach(post => {
      if ('excluded' in post && post.excluded) {
        keys.push(contentEvidenceKey(reportPostToStatsPost(post)))
      }
    })
    return new Set(keys)
  }, [contentExclusions, report.posts])
  const master = useMemo(
    () => buildMasterReport(statsPosts, manualMetrics, excludedContentKeys),
    [excludedContentKeys, manualMetrics, statsPosts],
  )

  const availablePlatforms = master.platforms.filter(view => view.source !== 'none')
  const reportPlatforms = Array.from(new Set<Platform>([
    ...availablePlatforms.map(view => view.platform),
    ...facts
      .map(fact => fact.platform)
      .filter((platform): platform is Platform => platform === 'facebook' || platform === 'instagram' || platform === 'tiktok'),
  ]))
  const hasMeta = availablePlatforms.some(view => view.platform === 'facebook' || view.platform === 'instagram')
    || facts.some(fact => fact.platform === 'facebook' || fact.platform === 'instagram')
  const hasGoogleAds = googleAds !== null || ['data', 'not-synced', 'error', 'no-activity'].includes(googleAdsState)
  const exactWebsiteClientId = client?.id ?? ('client_id' in report ? report.client_id : null)
  const managedWebsite = cgManagedWebsiteForClient(exactWebsiteClientId)
  const knownWebsiteMaintenance = hasCgWebsiteMaintenance(exactWebsiteClientId)
  const hasGoogleAdsSource = googleAds !== null && ['data', 'no-activity'].includes(googleAdsState)
  const tabs = [...PERFORMANCE_SERVICE_TABS]
  const activeTab = tabs.some(item => item.key === tab) ? tab : 'overview'
  const sourceAttribution = reportSourceAttribution(activeTab, {
    meta: hasMeta && (activeTab === 'overview' || reportPlatforms.includes(activeTab as Platform)),
    tiktok: reportPlatforms.includes('tiktok'),
    googleAds: hasGoogleAdsSource,
  })
  const selectTab = (nextTab: ReportTabKey) => {
    if (onTabChange) onTabChange(nextTab)
    else setLocalTab(nextTab)
  }

  const month = monthDisplayLabel(getReportMonthFromPeriod(report))
  const periodDisclosure = reportPeriodDisclosure(report)
  const previousMonthLabel = useMemo(() => {
    const prev = previousReportMonth(getReportMonthFromPeriod(report))
    return prev ? monthDisplayLabel(prev) : null
  }, [report])

  const performance = useMemo(
    () =>
      buildReportPerformance({
        master,
        previousMaster: null,
        currentManual: manualMetrics,
        previousManual: [],
        monthLabel: month,
        previousMonthLabel,
      }),
    [master, manualMetrics, month, previousMonthLabel]
  )

  return (
    <div className="relative overflow-hidden font-sans text-slate-50">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[#030706]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_0%,rgba(45,212,191,0.20),transparent_32%),radial-gradient(circle_at_90%_16%,rgba(249,115,22,0.16),transparent_26%),linear-gradient(180deg,#06110f_0%,#030706_100%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18] bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <ReportHero report={report} client={client} month={month} master={master} />

      <p className="mb-6 text-center text-xs text-slate-500">
        Report content coverage: {report.period_start ? formatDate(report.period_start) : '-'} to {report.period_end ? formatDate(report.period_end) : '-'}
      </p>

      {periodDisclosure && (
        <p className="mb-6 px-4 text-center text-xs leading-6 text-slate-400">
          {periodDisclosure}. Partial content reporting period.
        </p>
      )}

      {verifiedSections.some(section => section.lines.some(line => line.hasValue)) && (
        <p className="mb-6 px-4 text-center text-xs leading-6 text-slate-400">
          Platform figures have their own recorded windows, shown with each figure. They may differ from the content coverage above; account snapshots are not monthly growth.
        </p>
      )}

      {tabs.length > 1 && (
        <ReportTabs tabs={tabs} active={activeTab} onChange={selectTab} />
      )}

      {activeTab === 'overview' ? (
        <OverviewTab
          report={report}
          master={master}
          performance={performance}
          showEmptyStrategy={showEmptyStrategy}
          showAdminDiagnostics={showAdminDiagnostics}
          googleAds={googleAds}
          googleAdsState={googleAdsState}
          googleAdsError={googleAdsError}
          verifiedSections={verifiedSections}
          normalizedFactsActive={normalizedFactsActive}
          dataHealth={dataHealth}
          contentExclusions={contentExclusions}
          statsPosts={statsPosts}
          onSetContentExcluded={onSetContentExcluded}
          curationBusyId={curationBusyId}
          monthlyStrategy={monthlyStrategy}
          strategyReadUnavailable={strategyReadUnavailable}
        />
      ) : activeTab === 'google' ? (
        <GooglePerformanceTab
          month={month}
          googleAds={googleAds}
          state={googleAdsState}
          error={googleAdsError}
          hasGoogleAds={hasGoogleAds}
          clientName={client?.name}
        />
      ) : activeTab === 'web' ? (
        report.website_report || managedWebsite || knownWebsiteMaintenance
          ? <PublishedWebsitePerformance report={report.website_report ?? null} managedWebsite={managedWebsite} maintenanceIncluded={knownWebsiteMaintenance} />
          : <PerformanceServiceStory service="web" clientName={client?.name} />
      ) : reportPlatforms.includes(activeTab as Platform) ? (
        <PlatformTab
          view={master.platforms.find(item => item.platform === activeTab)!}
          previousView={null}
          previousManual={null}
          previousMonthLabel={previousMonthLabel}
          monthLabel={month}
          facts={facts.filter(fact => fact.platform === activeTab)}
          previousFacts={previousFacts.filter(fact => fact.platform === activeTab)}
          normalizedFactsActive={normalizedFactsActive}
        />
      ) : (
        <PerformanceServiceStory service={activeTab} clientName={client?.name} />
      )}

      {sourceAttribution && (
        <p className="mx-auto mt-16 max-w-3xl border-t border-white/10 pt-6 text-center text-xs leading-relaxed text-slate-500">
          {sourceAttribution}
        </p>
      )}
      <MethodologyDisclaimer />
    </div>
  )
}

function PublishedWebsitePerformance({ report, managedWebsite, maintenanceIncluded }: { report: RenderableReport['website_report']; managedWebsite: CgManagedWebsite | null; maintenanceIncluded: boolean }) {
  if (!report) {
    return <ProviderAvailabilityPanel
      eyebrow="Digital experience"
      title="Website Performance"
      status="Unavailable"
      description={managedWebsite
        ? `CG manages ${managedWebsite.canonicalHost}, but no approved website snapshot was published with this monthly report. Reporting setup or review is still in progress; no figures are inferred or shown as zero.`
        : maintenanceIncluded
          ? 'Your CG-built website is maintained by CG. Verified website reporting is not yet available for this month. No figures are inferred or shown as zero.'
          : 'No approved website snapshot was published with this monthly report. No figures are inferred or shown as zero.'}
    />
  }

  const presentation = websiteReportPresentation(report)

  return (
    <section aria-label="Published website performance">
      <SectionHeading eyebrow="Digital experience" title="Website Performance" />
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.045] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="break-all text-lg font-bold text-white">{report.identity.canonicalHost}</p>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-300">{presentation.stateLabel}</span>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Report window: {formatDate(report.period.from)} to {presentation.periodEnd ? formatDate(presentation.periodEnd) : 'Unavailable'} · {report.period.timezone}
        </p>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          {presentation.coverageFrom ? `Tracked traffic starts ${formatDate(presentation.coverageFrom)}. ` : 'The start of measurement coverage is unavailable. '}
          {presentation.partial ? 'These figures cover only part of the report window, not the whole month.' : 'Figures below come from the published snapshot, not a live traffic feed.'}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <WebsiteMetric title="Visitors" value={report.traffic.visitors} />
        <WebsiteMetric title="Page views" value={report.traffic.pageviews} />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">Visitors measures your website audience; page views counts the pages they viewed. These are separate measures, not numbers to add together.</p>
      <div className="mt-6 rounded-2xl border border-white/10 bg-[#071311] p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">From visits to enquiries</p>
        <h3 className="mt-2 text-xl font-bold text-white">Contact journey</h3>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div><p className="text-sm text-slate-300">Tracked contact actions</p><p className="mt-1 font-bold text-white">{report.conversions.total === null ? 'Measurement unavailable' : formatNumber(report.conversions.total)}</p></div>
          <div><p className="text-sm text-slate-300">Submitted enquiries</p><p className="mt-1 font-bold text-white">{presentation.enquiries === null ? 'Measurement unavailable' : formatNumber(presentation.enquiries)}</p></div>
        </div>
        {(report.conversions.total === null || presentation.enquiries === null) && <p className="mt-4 text-sm leading-relaxed text-slate-400">This snapshot cannot establish the missing contact or enquiry figures. Unavailable means unknown—not that nobody contacted your business.</p>}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <WebsiteBreakdown title="Top pages" rows={report.traffic.topPages.map(item => [item.label, item.pageviews])} />
        <WebsiteBreakdown title="Traffic sources" rows={report.traffic.sources.map(item => [item.label, item.visitors])} />
      </div>
      {report.dataQuality.gaps.length > 0 && (
        <details className="mt-7 rounded-2xl border border-white/10 p-5 text-sm text-slate-400">
          <summary className="cursor-pointer font-semibold text-teal-300">Measurement details and limitations</summary>
          <ul className="mt-4 space-y-3 leading-relaxed">{report.dataQuality.gaps.map((gap, index) => <li key={index}>{gap}</li>)}</ul>
        </details>
      )}
      <p className="mt-6 text-xs leading-relaxed text-slate-400">{presentation.sourceLabel}</p>
    </section>
  )
}

function WebsiteMetric({ title, value }: { title: string; value: number | null }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{title}</p>
    <p className="mt-3 break-words text-3xl font-black text-white">{value === null ? 'Unavailable' : formatNumber(value)}</p>
    {value === null && <p className="mt-2 text-xs text-slate-400">Unavailable in this snapshot; not zero.</p>}
  </div>
}

function WebsiteBreakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  const maximum = Math.max(0, ...rows.map(([, value]) => value))
  return <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
    <h3 className="text-sm font-bold text-white">{title}</h3>
    {rows.length ? <ul className="mt-3 space-y-2 text-sm text-slate-300">
      {rows.slice(0, 8).map(([name, value]) => <li key={name}>
        <div className="flex justify-between gap-4"><span className="min-w-0 break-words">{name}</span><span className="shrink-0 font-semibold text-white">{formatNumber(value)}</span></div>
        <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-teal-400/80" style={{ width: `${maximum > 0 ? Math.max(0, value) / maximum * 100 : 0}%` }} /></div>
      </li>)}
    </ul> : <p className="mt-3 text-sm text-slate-400">This breakdown is unavailable in the published snapshot.</p>}
  </div>
}

function ReportHero({
  report,
  client,
  month,
  master,
}: {
  report: RenderableReport
  client: Client | null
  month: string
  master: MasterReportData
}) {
  return (
    <section className="relative mb-8 overflow-hidden rounded-[2rem] border border-white/10 bg-[#071311]/95 shadow-[0_35px_90px_-45px_rgba(0,0,0,0.95)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(45,212,191,0.28),transparent_34%),radial-gradient(circle_at_95%_15%,rgba(249,115,22,0.18),transparent_26%),linear-gradient(135deg,rgba(255,255,255,0.06),transparent_45%)]" />
      <div className="absolute right-6 top-4 hidden text-[8rem] font-black leading-none tracking-[-0.1em] text-white/[0.035] lg:block">
        CG
      </div>
      <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#2dd4bf] via-[#14b8a6] to-[#f97316]" />

      <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:p-10">
        <div className="flex min-w-0 items-center gap-5 sm:gap-6">
          {client ? (
            <ClientLogo
              client={client}
              boxClassName="h-20 w-20 rounded-2xl sm:h-24 sm:w-24"
              padding="p-3"
              frameClassName={LOGO_FRAME}
              textClassName="text-2xl font-black text-[#2dd4bf]"
            />
          ) : (
            <BrandMark subtitle="CG Production House" size="report" />
          )}

          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#2dd4bf]">
              Monthly Performance Report
            </p>
            <h1 className="mt-3 text-4xl font-black leading-[0.95] tracking-[-0.04em] text-white sm:text-6xl">
              {reportClientName(report, client)}
            </h1>
            <p className="mt-3 text-lg font-semibold text-slate-300">{month}</p>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-400">
              A clear view of performance, growth, and next steps.
            </p>
          </div>
        </div>

        <div className={`grid gap-3 ${master.bestPlatform ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} lg:grid-cols-1`}>
          <HeroMiniCard label="Status" value={report.status.charAt(0).toUpperCase() + report.status.slice(1)} accent="teal" />
          <HeroMiniCard label="Report month" value={month} accent="amber" />
          {master.bestPlatform && <HeroMiniCard label="Best platform" value={master.bestPlatform.label} accent="teal" />}
        </div>
      </div>
    </section>
  )
}

function HeroMiniCard({ label, value, accent }: { label: string; value: string; accent: 'teal' | 'amber' }) {
  const dot = accent === 'amber' ? 'bg-[#f97316]' : 'bg-[#2dd4bf]'

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      </div>
      <p className="mt-2 text-base font-black text-white">{value}</p>
    </div>
  )
}

function ReportTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: ReportTabKey; label: string; icon: PerformanceProviderIconKey }[]
  active: ReportTabKey
  onChange: (tab: ReportTabKey) => void
}) {
  return (
    <div role="tablist" aria-label="Performance services" className="mx-auto mb-10 flex w-fit max-w-full flex-wrap justify-center gap-1.5 rounded-[1.5rem] border border-white/10 bg-black/20 p-1.5 shadow-[0_24px_60px_-42px_rgba(0,0,0,0.95)] backdrop-blur">
      {tabs.map(item => {
        const isActive = active === item.key
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={item.label}
            title={item.label}
            onClick={() => onChange(item.key)}
            className={`group relative flex min-h-14 min-w-[4.25rem] flex-col items-center justify-center gap-1 rounded-2xl border px-1 transition sm:h-12 sm:min-h-0 sm:w-12 sm:min-w-0 sm:flex-row sm:gap-0 sm:px-0 ${
              isActive
                ? 'border-[#2dd4bf]/55 bg-[linear-gradient(145deg,rgba(45,212,191,0.22),rgba(255,255,255,0.12))] text-white shadow-[0_14px_30px_-16px_rgba(45,212,191,0.9)]'
                : 'border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            <PerformanceProviderIcon provider={item.icon} />
            <span className="text-center text-[0.62rem] font-bold leading-none sm:hidden">{item.key === 'web' ? 'Website' : item.key === 'email' ? 'Email' : item.label}</span>
            <span className="pointer-events-none absolute left-1/2 top-[calc(100%+0.45rem)] z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-[#07110f] px-2.5 py-1.5 text-[0.68rem] font-bold text-white shadow-xl sm:group-hover:block sm:group-focus-visible:block">
              {item.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function OverviewTab({
  report,
  master,
  performance,
  showEmptyStrategy,
  showAdminDiagnostics,
  googleAds,
  googleAdsState,
  googleAdsError,
  verifiedSections,
  normalizedFactsActive,
  dataHealth,
  contentExclusions,
  statsPosts,
  onSetContentExcluded,
  curationBusyId,
  monthlyStrategy,
  strategyReadUnavailable,
}: {
  report: RenderableReport
  master: MasterReportData
  performance: ReportPerformance
  showEmptyStrategy: boolean
  showAdminDiagnostics: boolean
  googleAds: GoogleAdsDashboardData | null
  googleAdsState: GoogleAdsDashboardState
  googleAdsError: string | null
  verifiedSections: VerifiedSection[]
  normalizedFactsActive: boolean
  dataHealth: ReportFactHealth[]
  contentExclusions: ReportContentExclusion[]
  statsPosts: ReportStatsPost[]
  onSetContentExcluded?: (post: ReportStatsPost, excluded: boolean) => void | Promise<void>
  curationBusyId: string | null
  monthlyStrategy: MonthlyStrategyPresentation | null
  strategyReadUnavailable: boolean
}) {
  const strategy = readStrategyData(report.strategy_data)
  const platformsWithData = master.platforms.filter(view => view.source !== 'none')
  const hasGoogleAdsSection = googleAds !== null && ['data', 'no-activity'].includes(googleAdsState)
  const hasVerified = verifiedSections.some(section => section.lines.some(line => line.hasValue))
  const hasData = hasVerified || (!normalizedFactsActive && (platformsWithData.length > 0 || performance.metrics.length > 0))
    || hasGoogleAdsSection || monthlyStrategy !== null || strategyReadUnavailable || performance.topContent !== null

  if (!hasData && !showAdminDiagnostics) {
    return (
      <div className="rounded-[2rem] border border-white/[0.08] bg-white/[0.045] p-8 text-center sm:p-10">
        <p className="text-base font-semibold text-white">No verified performance figures for this period</p>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          This report does not currently contain verified performance figures. Unavailable values are not shown as zero.
        </p>
      </div>
    )
  }

  return (
    <>
      {normalizedFactsActive ? (
        /* Verified, availability-aware Overview — per-platform, never combined,
           invalid month-on-month movement suppressed by the comparability gate. */
        hasVerified
          ? <VerifiedOverview sections={verifiedSections} />
          : showAdminDiagnostics ? <VerifiedFactsUnavailable /> : null
      ) : (
        <>
          {/* Legacy fallback for reports synced before normalized facts exist.
              No combined views/reach headline (those totals are null now). */}
          <CombinedHero master={master} performance={performance} />
          {platformsWithData.length > 0 && (
            <section className="mb-14">
              <SectionHeading eyebrow="Performance overview" title="The month at a glance" />
              <p className="-mt-2 mb-6 max-w-2xl text-base leading-relaxed text-slate-300">
                {performance.performanceHeadline}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {performance.metrics.map(metric => (
                  <PerformanceCard key={metric.key} metric={metric} />
                ))}
              </div>
            </section>
          )}
          {performance.growthSeries.length > 0 && performance.previousMonthLabel && (
            <section className="mb-14">
              <SectionHeading
                eyebrow="Growth trend"
                title={`${shortMonth(performance.previousMonthLabel)} → ${shortMonth(performance.monthLabel)}`}
              />
              <GrowthChart
                series={performance.growthSeries}
                currentLabel={shortMonth(performance.monthLabel)}
                previousLabel={shortMonth(performance.previousMonthLabel)}
              />
            </section>
          )}
          {platformsWithData.length > 0 && (
            <section className="mb-14">
              <SectionHeading eyebrow="Channel performance" title="How each channel performed" />
              <div className="grid gap-4 lg:grid-cols-3">
                {platformsWithData.map(view => (
                  <ChannelCard
                    key={view.platform}
                    view={view}
                    previousView={null}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {hasGoogleAdsSection && (
        <GoogleAdsOverview
          googleAds={googleAds}
          state={googleAdsState}
          error={googleAdsError}
        />
      )}

      {/* Content */}
      <ContentSection
        topContent={performance.topContent}
        strategy={strategy}
        exclusions={contentExclusions}
        statsPosts={statsPosts}
        onSetContentExcluded={onSetContentExcluded}
        curationBusyId={curationBusyId}
      />

      {/* Recommendations */}
      {/* The canonical monthly strategy below owns client recommendations.
          Legacy metric heuristics do not know package scope or business intent. */}

      {/* CG action plan */}
      <StrategyBlocks
        monthlyStrategy={monthlyStrategy}
        strategyReadUnavailable={strategyReadUnavailable}
        showEmptyStrategy={showEmptyStrategy}
        staffPreview={showAdminDiagnostics}
      />

      {/* Staff-only connector data health (never rendered on client routes) */}
      {showAdminDiagnostics && <AdminDataHealth master={master} performance={performance} />}
      {showAdminDiagnostics && dataHealth.length > 0 && <ConnectorDataHealth rows={dataHealth} />}

    </>
  )
}

function VerifiedFactsUnavailable() {
  return (
    <section className="mb-14 rounded-3xl border border-white/[0.08] bg-white/[0.045] p-6">
      <p className="font-semibold text-white">Verified platform figures are unavailable for this month</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        Missing or permission-blocked platform values are not shown as zero. CG will review the connection before using them in comparisons or recommendations.
      </p>
    </section>
  )
}

// ── Verified Overview (facts-driven, per-platform, comparability-gated) ───────
function VerifiedOverview({ sections }: { sections: VerifiedSection[] }) {
  // The report surface stays client-presentable even in staff preview. Missing
  // facts remain available in the staff-only connector-health table below.
  const lines = sections.flatMap(section => section.lines).filter(line => line.hasValue)
  const platforms = [...new Set(lines.map(line => line.platform))]
  return (
    <div className="mb-14 space-y-10">
      {platforms.map(platform => (
        <section key={platform}>
          <SectionHeading eyebrow="Verified platform insights" title={PLATFORM_LABELS[platform as Platform] ?? platform} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {lines.filter(line => line.platform === platform).map(line => (
              <VerifiedMetricCard key={`${line.platform}:${line.metricKey}`} line={line} />
            ))}
          </div>
        </section>
      ))}
      <p className="text-xs leading-relaxed text-slate-500">
        Figures here are shown per platform. Overview may sum verified recorded view events from
        the same reporting window; that is not a count of unique people. Viewers and reach are
        never added across platforms. A month-on-month change appears only when both months
        measured the same thing the same way.
      </p>
    </div>
  )
}

function VerifiedMetricCard({ line }: { line: VerifiedLine }) {
  const showMovement = line.comparable && typeof line.changePercent === 'number'
  const unavailableMessage = line.availability === 'unavailable'
    ? 'Unavailable from the connected Meta source'
    : line.availability === 'permission_blocked'
      ? 'Unavailable with the current Meta permissions'
      : line.availability === 'error' || line.availability === 'stale'
        ? 'Not currently verified from Meta'
        : null
  const up = (line.changePercent ?? 0) > 0
  const down = (line.changePercent ?? 0) < 0
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.045] p-5">
      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">{line.label}</p>
      {line.platform === 'instagram' && line.metricKey === 'website_clicks' && (
        <p className="mt-1 text-xs leading-relaxed text-slate-500">Taps on the website link from the Instagram profile.</p>
      )}
      <p className="mt-2 text-3xl font-semibold text-white">
        {line.hasValue && typeof line.value === 'number' ? formatNumber(line.value) : '—'}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        {platformFactWindowLabel(line.periodStart, line.periodEnd)}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {line.reconstructed && (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-slate-300">Estimated from posts</span>
        )}
        {line.availability === 'partial' && !line.reconstructed && (
          <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-amber-200">Partial platform coverage</span>
        )}
        {unavailableMessage ? (
          <span className="text-slate-500">{unavailableMessage}</span>
        ) : line.isSnapshot ? (
          <span className="text-slate-500">Account snapshot for this report · not monthly growth</span>
        ) : showMovement ? (
          <span className={up ? 'text-emerald-300' : down ? 'text-amber-300' : 'text-slate-400'}>
            {formatPercent(line.changePercent as number)} vs last month
          </span>
        ) : (
          <span className="text-slate-500">{clientComparisonMessage(line.comparisonReason)}</span>
        )}
      </div>
    </div>
  )
}

function clientComparisonMessage(reason: string | null): string {
  if (!reason) return 'No comparable prior month'
  if (/source|aggregation|paid and organic/i.test(reason)) return 'Comparison unavailable because the reporting definition changed'
  if (/incomplete|verified|numeric/i.test(reason)) return 'Comparison unavailable because both months are not complete'
  if (/snapshot/i.test(reason)) return 'Current snapshot only'
  return 'No comparable prior month'
}

// ── Reporting methodology & disclaimer ───────────────────────────────────────
function MethodologyDisclaimer() {
  const [open, setOpen] = useState(false)
  return (
    <div className="mx-auto mt-14 max-w-3xl border-t border-white/10 pt-6 text-center">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="text-xs font-medium text-slate-400 underline decoration-dotted underline-offset-4 hover:text-slate-200"
      >
        Reporting methodology &amp; disclaimer
      </button>
      {open && (
        <div className="mx-auto mt-4 max-w-2xl space-y-2 text-left text-xs leading-relaxed text-slate-500">
          <p>Platform data may be delayed, incomplete or later revised by the platform.</p>
          <p>Figures come from connected first-party sources (e.g. Meta, Google Ads). Different platforms may define similar-sounding metrics differently, so they are shown separately.</p>
          <p>Unique audiences such as reach and viewers are not added together across platforms.</p>
          <p>Featured content prioritises CG-created or CG-managed work; client-created posts may remain in totals while being excluded from CG creative analysis.</p>
          <p>AI may assist with analysis. CG reviews all client-facing strategy. Recommendations do not guarantee sales.</p>
        </div>
      )}
    </div>
  )
}

// ── Staff-only connector data health (never on client routes) ────────────────
function ConnectorDataHealth({ rows }: { rows: ReportFactHealth[] }) {
  return (
    <section className="mb-6 mt-10 rounded-3xl border border-amber-400/20 bg-amber-400/[0.04] p-5">
      <p className="text-[0.7rem] uppercase tracking-[0.2em] text-amber-300/80">Staff only · connector health</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-xs text-slate-300">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 pr-3">Platform</th>
              <th className="py-1 pr-3">Month</th>
              <th className="py-1 pr-3">Metric / source</th>
              <th className="py-1 pr-3">Availability</th>
              <th className="py-1 pr-3">Last attempted</th>
              <th className="py-1 pr-3">Last successful</th>
              <th className="py-1 pr-3">API</th>
              <th className="py-1 pr-3">Connector</th>
              <th className="py-1 pr-3">Comparison</th>
              <th className="py-1 pr-3">Readiness</th>
              <th className="py-1 pr-3">Reference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.period_month}-${r.platform}-${r.metric_key ?? 'run'}-${i}`} className="border-t border-white/5 align-top">
                <td className="py-1 pr-3">{PLATFORM_LABELS[r.platform as Platform] ?? r.platform}</td>
                <td className="py-1 pr-3">{r.period_month}</td>
                <td className="py-1 pr-3">{r.metric_key ?? 'Connector run'}{r.source_metric ? <span className="block text-slate-500">{r.source_metric}</span> : null}</td>
                <td className="py-1 pr-3">
                  {r.fact_availability ?? r.latest_health_state ?? r.latest_run_status ?? 'Not attempted'}
                  {r.permission_blocked ? <span className="block text-amber-300">Permission blocked</span> : null}
                  {r.partial_error_or_stale ? (
                    <span className="block text-amber-300">
                      Platform run: {formatHealthState(r.latest_run_status, r.latest_health_state)}
                    </span>
                  ) : null}
                </td>
                <td className="py-1 pr-3">{formatHealthTimestamp(r.latest_attempted_at)}</td>
                <td className="py-1 pr-3">{formatHealthTimestamp(r.last_successful_at)}</td>
                <td className="py-1 pr-3">{r.api_version ?? '—'}</td>
                <td className="py-1 pr-3">{r.connector_version ?? '—'}</td>
                <td className="py-1 pr-3">{r.metric_key ? (r.comparison_eligible ? 'Eligible' : 'Not eligible') : '—'}</td>
                <td className={`py-1 pr-3 ${r.ready_for_client_reporting ? 'text-emerald-300' : 'text-amber-300'}`}>{r.ready_for_client_reporting ? 'Ready' : 'Review required'}</td>
                <td className="py-1 pr-3 font-mono text-slate-500">{r.safe_reference ? r.safe_reference.slice(0, 8) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function formatHealthTimestamp(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

function formatHealthState(runStatus: string | null, healthState: string | null): string {
  const humanize = (value: string) => value.replaceAll('_', ' ')
  if (runStatus && healthState && runStatus !== healthState) {
    return `${humanize(runStatus)} · ${humanize(healthState)}`
  }
  return humanize(runStatus ?? healthState ?? 'needs review')
}

// A. The "all your channels together" moment. Cross-platform post engagement
// definitions and unique-audience visibility are not summed. When no genuinely
// comparable combined metric exists, headline one explicitly-labelled platform.
function CombinedHero({ master, performance }: { master: MasterReportData; performance: ReportPerformance }) {
  const withData = master.platforms.filter(view => view.source !== 'none')
  if (withData.length === 0) return null

  let value: number | null = null
  let line: string | null = null
  if (typeof master.totalViews === 'number' && master.totalViews > 0) {
    value = master.totalViews
    line = `times your content was seen across your channels in ${performance.monthLabel}`
  } else if (typeof master.totalEngagements === 'number' && master.totalEngagements > 0) {
    value = master.totalEngagements
    line = `interactions with your content across your channels in ${performance.monthLabel}`
  } else {
    const strongest = withData
      .filter(view => typeof view.reach === 'number' && view.reach > 0)
      .sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))[0]
    if (strongest) {
      value = strongest.reach as number
      line = `accounts reached on ${strongest.label} in ${performance.monthLabel}`
    }
  }
  if (value === null || !line) return null

  const chips = withData
    .map(view => {
      const metric =
        typeof view.views === 'number' && view.views > 0
          ? `${formatCompact(view.views)} views`
          : typeof view.reach === 'number' && view.reach > 0
            ? `${formatCompact(view.reach)} reach`
            : typeof view.engagements === 'number'
              ? `${formatCompact(view.engagements)} interactions`
              : null
      return metric ? { label: view.label, metric } : null
    })
    .filter((chip): chip is { label: string; metric: string } => chip !== null)

  return (
    <section className="relative mb-14 overflow-hidden rounded-[2rem] border border-white/10 bg-[#071311] p-8 shadow-[0_35px_90px_-45px_rgba(0,0,0,0.95)] sm:p-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(45,212,191,0.22),transparent_38%),radial-gradient(circle_at_0%_100%,rgba(249,115,22,0.14),transparent_30%)]" />
      <div className="relative">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[#2dd4bf]">All channels together</p>
        <p className="mt-5 text-6xl font-black leading-none tracking-[-0.05em] text-white sm:text-8xl">
          {formatNumber(value)}
        </p>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">{line}.</p>
        {chips.length > 1 && (
          <div className="mt-7 flex flex-wrap gap-2">
            {chips.map(chip => (
              <span
                key={chip.label}
                className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-sm font-bold text-slate-200"
              >
                {chip.label} <span className="ml-1 font-medium text-slate-400">{chip.metric}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// H. Staff-only transparency panel: where every number came from and what the
// sync could not fetch. Surfaces diagnostics the performance model already
// computes so staff can trust (or fix) the data before a client ever sees it.
function AdminDataHealth({ master, performance }: { master: MasterReportData; performance: ReportPerformance }) {
  const sources = master.platforms
    .filter(view => view.source !== 'none')
    .map(view => ({
      label: view.label,
      source:
        view.manual && isMetaSyncedManualMetric(view.manual)
          ? `Meta account totals${view.postCount > 0 ? ` + ${view.postCount} synced posts` : ''}`
          : view.source === 'manual'
            ? 'Manual summary'
            : `Post-level data (${view.postCount} posts)`,
    }))

  return (
    <section className="mt-14 rounded-3xl border border-dashed border-[#f59e0b]/30 bg-[#f59e0b]/[0.04] p-6 sm:p-7">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f59e0b]">
        Data health — internal only, not visible to clients
      </p>
      <div className="mt-4 grid gap-6 text-sm sm:grid-cols-2">
        <div>
          <p className="font-bold text-slate-300">Metric sources</p>
          <ul className="mt-2 space-y-1 text-slate-400">
            {sources.map(item => (
              <li key={item.label}>
                <span className="font-semibold text-slate-300">{item.label}:</span> {item.source}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-bold text-slate-300">Not synced this month</p>
          {performance.adminMissingMetrics.length > 0 ? (
            <ul className="mt-2 space-y-1 text-slate-400">
              {performance.adminMissingMetrics.map(item => <li key={item}>{item}</li>)}
            </ul>
          ) : (
            <p className="mt-2 text-slate-400">All account-level metrics synced.</p>
          )}
          {performance.topContent?.toneReason && (
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              Content framing: {performance.topContent.toneReason}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

function shortMonth(label: string): string {
  // "May 2026" → "May"
  return label.split(' ')[0]
}

// ── B: a metric card with inline growth vs previous month ────────────────────
function PerformanceCard({ metric }: { metric: PerformanceMetric }) {
  const accentClass =
    metric.key === 'posts' || metric.key === 'current_followers'
      ? 'from-[#f97316] to-[#f59e0b]'
      : 'from-[#2dd4bf] to-[#14b8a6]'

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.045] p-5 shadow-[0_24px_60px_-38px_rgba(0,0,0,0.95)] backdrop-blur sm:p-6">
      <div className={`mb-5 h-1 w-12 rounded-full bg-gradient-to-r ${accentClass}`} />
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{metric.label}</p>
      <p className="mt-3 text-3xl font-black leading-none tracking-[-0.04em] text-white sm:text-4xl">
        {formatNumber(metric.current)}
      </p>
      {metric.direction && metric.comparisonLabel ? (
        <GrowthBadge metric={metric} />
      ) : (
        <p className="mt-3 text-xs font-medium text-slate-500">
          {metric.key === 'current_followers' ? 'Audience base' : 'This month'}
        </p>
      )}
      <div className="pointer-events-none absolute -bottom-14 -right-14 h-32 w-32 rounded-full bg-[#2dd4bf]/0 blur-3xl transition group-hover:bg-[#2dd4bf]/10" />
    </div>
  )
}

function GrowthBadge({ metric }: { metric: PerformanceMetric }) {
  const up = metric.direction === 'up'
  const down = metric.direction === 'down'
  const tone = up ? 'text-[#2dd4bf]' : down ? 'text-[#f59e0b]' : 'text-slate-400'
  const arrow = up ? '↑' : down ? '↓' : '→'
  const value =
    metric.percent !== null
      ? formatPercent(metric.percent)
      : `${(metric.change ?? 0) > 0 ? '+' : ''}${formatNumber(metric.change ?? 0)}`

  return (
    <p className="mt-3 flex flex-wrap items-baseline gap-x-2 text-sm font-bold">
      <span className={tone}>
        {arrow} {value}
      </span>
      <span className="text-xs font-medium text-slate-500">{metric.comparisonLabel}</span>
    </p>
  )
}

// ── C: CG-styled paired bar growth chart (no external libraries) ─────────────
function GrowthChart({
  series,
  currentLabel,
  previousLabel,
}: {
  series: GrowthSeriesItem[]
  currentLabel: string
  previousLabel: string
}) {
  return (
    <div className="rounded-[2rem] border border-white/[0.08] bg-[#0b1715]/80 p-6 shadow-[0_30px_80px_-48px_rgba(0,0,0,0.95)] sm:p-8">
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-bold">
        <span className="flex items-center gap-2 text-slate-400">
          <span className="h-2.5 w-2.5 rounded-sm bg-white/25" /> {previousLabel}
        </span>
        <span className="flex items-center gap-2 text-[#2dd4bf]">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#2dd4bf]" /> {currentLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-8 lg:grid-cols-4 lg:gap-x-4">
        {series.map(item => {
          const pairMax = Math.max(item.previous, item.current, 1)
          const prevH = Math.max((item.previous / pairMax) * 100, item.previous > 0 ? 6 : 2)
          const curH = Math.max((item.current / pairMax) * 100, item.current > 0 ? 6 : 2)
          const up = item.direction === 'up'
          const down = item.direction === 'down'
          const badgeTone = up ? 'text-[#2dd4bf]' : down ? 'text-[#f59e0b]' : 'text-slate-400'
          const badge =
            item.percent !== null
              ? `${up ? '↑' : down ? '↓' : '→'} ${formatPercent(item.percent)}`
              : up
                ? '↑'
                : down
                  ? '↓'
                  : '→'

          return (
            <div key={item.key} className="flex flex-col items-center">
              <div className="flex h-36 w-full items-end justify-center gap-3 sm:gap-4">
                <Bar heightPct={prevH} value={item.previous} tone="muted" />
                <Bar heightPct={curH} value={item.current} tone="teal" />
              </div>
              <p className="mt-3 text-center text-[0.7rem] font-black uppercase tracking-[0.14em] text-slate-400">
                {item.label}
              </p>
              <p className={`mt-1 text-xs font-bold ${badgeTone}`}>{badge}</p>
              <div className="mt-2 flex w-full max-w-[10rem] items-center justify-center gap-4 text-[0.65rem] text-slate-500">
                <span>{formatCompact(item.previous)}</span>
                <span className="text-slate-600">vs</span>
                <span className="text-slate-300">{formatCompact(item.current)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return formatNumber(value)
}

function Bar({ heightPct, value, tone }: { heightPct: number; value: number; tone: 'muted' | 'teal' }) {
  const fill =
    tone === 'teal'
      ? 'bg-gradient-to-t from-[#14b8a6] to-[#2dd4bf] shadow-[0_0_24px_-4px_rgba(45,212,191,0.6)]'
      : 'bg-white/20'
  return (
    <div className="flex h-full w-9 flex-col items-center justify-end sm:w-12">
      <span className="mb-1 text-[0.65rem] font-bold text-slate-400">{formatNumber(value)}</span>
      <div className={`w-full rounded-t-lg ${fill}`} style={{ height: `${heightPct}%` }} />
    </div>
  )
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-black uppercase tracking-[0.26em] text-[#2dd4bf]">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white sm:text-4xl">{title}</h2>
    </div>
  )
}

// E - Content section. Adapts wording to the real strength of the top content
// so weak content is framed as learning, never celebrated as a win.
function ContentSection({
  topContent,
  strategy,
  exclusions,
  statsPosts,
  onSetContentExcluded,
  curationBusyId,
}: {
  topContent: TopContent | null
  strategy: ReturnType<typeof readStrategyData>
  exclusions: ReportContentExclusion[]
  statsPosts: ReportStatsPost[]
  onSetContentExcluded?: (post: ReportStatsPost, excluded: boolean) => void | Promise<void>
  curationBusyId: string | null
}) {
  const [reviewSkipped, setReviewSkipped] = useState(false)
  const tc = strategy.topContent
  const best = topContent?.post ?? null
  const skippedPosts = exclusions
    .filter(item => item.excluded)
    .map(item => statsPosts.find(post => contentEvidenceKey(post) === `${item.platform}:${item.meta_object_id}`) ?? null)
    .filter((post): post is ReportStatsPost => post !== null)
  const strategyMatchesBest = Boolean(best) && (!tc.autoCaption || tc.autoCaption.trim() === (best?.caption ?? '').trim())

  const caption = best ? shortCaption(best.caption) : null
  const coverImage = (best?.imageUrl || (strategyMatchesBest ? tc.coverImageUrl?.trim() || tc.autoImageUrl?.trim() : '') || '').trim()
  const contentType = (best?.post_type ? displayContentType(best.post_type) : null) || (strategyMatchesBest ? tc.contentType.trim() : null)
  const platformLabel = topContent?.platformLabel ?? null

  const tone = topContent?.tone ?? 'baseline'
  const bestPost = topContent?.post ?? null
  const rankingMetric = topContent?.rankingMetricLabel ?? null

  // Pick the strongest metric to showcase (views > reach > interactions).
  const heroMetric: { value: number; label: string } | null =
    rankingMetric === 'views' && typeof bestPost?.impressions === 'number'
      ? { value: bestPost.impressions, label: 'views' }
      : rankingMetric === 'reach' && typeof bestPost?.reach === 'number'
        ? { value: bestPost.reach, label: 'reach' }
        : typeof topContent?.interactions === 'number'
          ? { value: topContent.interactions, label: bestPost?.engagementDefinitionLabel ?? 'defined interactions' }
          : null

  const allMetrics: { label: string; value: string }[] = []
  if (typeof bestPost?.impressions === 'number') allMetrics.push({ label: 'views', value: formatNumber(bestPost.impressions) })
  if (typeof bestPost?.reach === 'number') allMetrics.push({ label: 'reach', value: formatNumber(bestPost.reach) })
  if (bestPost && typeof bestPost.engagements === 'number') allMetrics.push({ label: bestPost.engagementDefinitionLabel ?? 'defined interactions', value: formatNumber(bestPost.engagements) })
  const metricRow = allMetrics.map(m => `${m.value} ${m.label}`).join(' · ')

  const cgInsight = strategyMatchesBest ? tc.whatThisTellsUs.trim() : ''
  const whyItWorked = strategyMatchesBest ? tc.whyItWorked : []
  const hasCG = whyItWorked.length > 0 || cgInsight.length > 0

  if (!caption && !coverImage && !hasCG && (!onSetContentExcluded || skippedPosts.length === 0)) return null

  const heading =
    tone === 'top'
      ? { eyebrow: 'Top content', title: 'Top performing content' }
      : tone === 'learning'
        ? { eyebrow: 'Content', title: 'Content learning' }
        : { eyebrow: 'Content', title: 'Content baseline' }

  const insight = cgInsight

  return (
    <section className="mb-14">
      <SectionHeading eyebrow={heading.eyebrow} title={heading.title} />

      {onSetContentExcluded && skippedPosts.length > 0 && (
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <button type="button" className="text-sm font-semibold text-slate-200 underline underline-offset-4" onClick={() => setReviewSkipped(value => !value)}>
            Review skipped posts ({skippedPosts.length})
          </button>
          {reviewSkipped && <div className="mt-3 space-y-2">{skippedPosts.map(post => (
            <div key={contentEvidenceKey(post)} className="flex flex-col gap-2 rounded-xl border border-white/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="line-clamp-1 text-sm text-slate-400">{shortCaption(post.caption)}</span>
              <button type="button" disabled={curationBusyId === post.metaObjectId} onClick={() => void onSetContentExcluded(post, false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-50">Undo skip</button>
            </div>
          ))}</div>}
        </div>
      )}

      {best && (

      <div className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#071311] shadow-[0_35px_90px_-48px_rgba(0,0,0,0.95)]">
        <div className={`grid ${tone === 'top' ? 'lg:grid-cols-[0.95fr_1.05fr]' : 'lg:grid-cols-[0.55fr_1.45fr]'}`}>
          <div className={`relative overflow-hidden bg-[#030706] ${tone === 'top' ? 'min-h-[18rem]' : 'min-h-[12rem]'}`}>
            {coverImage ? (
              <img
                src={coverImage}
                alt="Highest activity content"
                className="h-full max-h-[28rem] w-full object-cover"
                onError={e => {
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <DesignedPlaceholder contentType={contentType ?? heading.title} />
            )}
          </div>

          <div className="relative overflow-hidden p-7 sm:p-9">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.10),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(45,212,191,0.12),transparent_36%)]" />
            <div className="relative">
              <div className="flex flex-wrap gap-2">
                {contentType && <Pill tone="teal">{contentType}</Pill>}
                {platformLabel && <Pill>{platformLabel}</Pill>}
                {rankingMetric && tone === 'top' && <Pill tone="teal">Top content by {rankingMetric}</Pill>}
                {tone === 'top' && <Pill tone="teal">Top overall performer</Pill>}
                {tone === 'learning' && <Pill tone="amber">Highest activity post this month</Pill>}
                {tone === 'baseline' && <Pill tone="neutral">Content baseline</Pill>}
              </div>

              {caption && (
                <h3
                  className={`mt-5 font-black leading-tight tracking-[-0.035em] text-white ${
                    tone === 'top' ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'
                  }`}
                >
                  {caption}
                </h3>
              )}

              {heroMetric ? (
                <div className="mt-7">
                  <div className="inline-flex items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4">
                    <span className="text-4xl font-black leading-none tracking-[-0.04em] text-white">
                      {formatNumber(heroMetric.value)}
                    </span>
                    <span className="pb-1 text-sm font-bold text-slate-400">{heroMetric.label}</span>
                  </div>
                  {metricRow && (
                    <p className="mt-3 text-sm text-slate-400">{metricRow}</p>
                  )}
                </div>
              ) : null}

              {whyItWorked.length > 0 && (
                <div className="mt-7">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Why it worked</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {whyItWorked.map((item, index) => (
                      <Pill key={index} tone="amber">
                        {item}
                      </Pill>
                    ))}
                  </div>
                </div>
              )}

              {insight && (
                <p className="mt-7 whitespace-pre-line text-[0.95rem] leading-relaxed text-slate-300">{insight}</p>
              )}
              {onSetContentExcluded && best.metaObjectId && (
                <button type="button" disabled={curationBusyId === best.metaObjectId} onClick={() => void onSetContentExcluded(best, true)} className="mt-7 rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-200 disabled:opacity-50">
                  Skip from report
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      )}
    </section>
  )
}

function DesignedPlaceholder({ contentType }: { contentType: string }) {
  return (
    <div className="relative flex h-full min-h-[18rem] items-center justify-center overflow-hidden p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(45,212,191,0.38),transparent_36%),radial-gradient(circle_at_80%_90%,rgba(249,115,22,0.32),transparent_34%),linear-gradient(135deg,#06110f,#030706)]" />
      <div className="absolute -left-8 top-8 h-40 w-40 rounded-full border border-white/10" />
      <div className="absolute bottom-6 right-6 text-7xl font-black tracking-[-0.08em] text-white/[0.05]">
        CG
      </div>
      <div className="relative text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.06] text-[#2dd4bf] shadow-2xl">
          <svg className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 17h16M7 4v16M17 4v16" />
          </svg>
        </div>
        <p className="mt-4 text-xs font-black uppercase tracking-[0.26em] text-slate-400">{contentType}</p>
      </div>
    </div>
  )
}

function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'teal' | 'amber' }) {
  const classes =
    tone === 'teal'
      ? 'border-[#2dd4bf]/20 bg-[#2dd4bf]/10 text-[#2dd4bf]'
      : tone === 'amber'
        ? 'border-[#f97316]/20 bg-[#f97316]/10 text-[#fbbf24]'
        : 'border-white/10 bg-white/[0.06] text-slate-300'

  return <span className={`rounded-full border px-3 py-1 text-xs font-bold ${classes}`}>{children}</span>
}

function ChannelCard({ view, previousView }: { view: PlatformView; previousView: PlatformView | null }) {
  const metrics = buildMetaPlatformMetrics(view)
  const growths = [
    { label: 'Reach', m: compareNullable(view.reach, previousView?.reach) },
    { label: 'Interactions', m: compareNullable(view.engagements, previousView?.engagements) },
  ].filter(g => g.m.direction !== 'missing' && g.m.difference !== null && !g.m.notAvailable)

  const best = view.bestPost
  const learningLabel = typeof best?.engagements !== 'number'
    ? 'Content highlight'
    : best.engagements >= WEAK_CONTENT_THRESHOLD ? 'Top content' : 'Content learning'

  return (
    <article className="group rounded-3xl border border-white/[0.08] bg-white/[0.045] p-6 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.95)] transition hover:border-[#2dd4bf]/25 hover:bg-white/[0.06]">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-xl font-black tracking-[-0.03em] text-white">{view.label}</h3>
        <span className="h-2.5 w-2.5 rounded-full bg-[#2dd4bf] shadow-[0_0_20px_rgba(45,212,191,0.7)]" />
      </div>

      <dl className="space-y-0">
        {metrics.map(item => (
          <PlatformRow key={item.key} label={item.label} value={formatNumber(item.value)} />
        ))}
      </dl>

      {growths.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {growths.map(g => (
            <ChannelGrowthPill key={g.label} label={g.label} movement={g.m} />
          ))}
        </div>
      )}

      {best?.caption && (
        <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-500">{learningLabel}</p>
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-300">
            {shortCaption(best.caption, 'Post')}
          </p>
        </div>
      )}
    </article>
  )
}

function ChannelGrowthPill({ label, movement }: { label: string; movement: MetricMovement }) {
  const up = (movement.difference ?? 0) > 0
  const down = (movement.difference ?? 0) < 0
  const tone = up
    ? 'border-[#2dd4bf]/25 bg-[#2dd4bf]/10 text-[#2dd4bf]'
    : down
      ? 'border-[#f59e0b]/25 bg-[#f59e0b]/10 text-[#f59e0b]'
      : 'border-white/10 bg-white/[0.05] text-slate-400'
  const arrow = up ? '↑' : down ? '↓' : '→'
  const value =
    movement.percent !== null
      ? formatPercent(movement.percent)
      : `${(movement.difference ?? 0) > 0 ? '+' : ''}${formatNumber(movement.difference ?? 0)}`
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[0.7rem] font-bold ${tone}`}>
      {label} {arrow} {value}
    </span>
  )
}

function PlatformRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.07] py-2.5 last:border-0">
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd className="text-sm font-black text-white">{value}</dd>
    </div>
  )
}

function GoogleAdsOverview({
  googleAds,
  state,
  error,
}: {
  googleAds: GoogleAdsDashboardData | null
  state: GoogleAdsDashboardState
  error: string | null
}) {
  return (
    <section className="mb-14 rounded-[2rem] border border-[#f59e0b]/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.10),rgba(255,255,255,0.025))] p-6 sm:p-8">
      <SectionHeading eyebrow="Paid media" title="Google Ads performance" />
      <p className="-mt-2 mb-6 max-w-2xl text-sm leading-relaxed text-slate-400">
        Paid campaign performance is shown separately from organic social results.
      </p>
      {googleAds ? (
        <GoogleAdsResults dashboard={googleAds} compact />
      ) : (
        <GoogleAdsEmptyState state={state} hasError={state === 'error' && Boolean(error)} compact />
      )}
    </section>
  )
}

function ProviderAvailabilityPanel({
  eyebrow,
  title,
  status,
  description,
}: {
  eyebrow: string
  title: string
  status: 'Unavailable'
  description: string
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#071311]/95 p-7 shadow-[0_35px_90px_-45px_rgba(0,0,0,0.95)] sm:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(45,212,191,0.16),transparent_38%),radial-gradient(circle_at_92%_8%,rgba(249,115,22,0.10),transparent_34%)]" />
      <div className="relative max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[#2dd4bf]">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl">{title}</h2>
        <span className="mt-6 inline-flex rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-slate-300">
          {status}
        </span>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{description}</p>
      </div>
    </section>
  )
}

function GooglePerformanceTab({
  month,
  googleAds,
  state,
  error,
  hasGoogleAds,
  clientName,
}: {
  month: string
  googleAds: GoogleAdsDashboardData | null
  state: GoogleAdsDashboardState
  error: string | null
  hasGoogleAds: boolean
  clientName?: string
}) {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#071311]/95 p-6 shadow-[0_35px_90px_-45px_rgba(0,0,0,0.95)] sm:p-9">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(45,212,191,0.18),transparent_38%),radial-gradient(circle_at_92%_8%,rgba(249,115,22,0.14),transparent_34%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#2dd4bf]">Search &amp; local presence</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl">Google Performance</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Verified Google results and the reviewed direction CG is using to improve the next move.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-slate-500">Published reporting month</p>
            <p className="mt-2 text-xl font-black text-white">{month}</p>
          </div>
        </div>
      </section>
      {hasGoogleAds ? (
        <section className="rounded-[2rem] border border-[#f59e0b]/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.10),rgba(255,255,255,0.025))] p-6 sm:p-8">
          <div className="mb-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f59e0b]">Configured source</p>
              <h3 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">Google Ads</h3>
            </div>
          </div>
          {googleAds ? (
            <GoogleAdsResults dashboard={googleAds} compact />
          ) : (
            <GoogleAdsEmptyState state={state} hasError={state === 'error' && Boolean(error)} compact />
          )}
        </section>
      ) : null}
      <PerformanceServiceStory service="google" clientName={clientName} />

      {googleAds && <aside className="rounded-[1.75rem] border border-[#2dd4bf]/15 bg-[#2dd4bf]/[0.045] p-6 sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#2dd4bf]">Campaign feedback</p>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">
          Tell CG whether the campaign leads were valuable and relevant to your business. That real-world feedback helps refine targeting, messaging and campaign direction.
        </p>
      </aside>}
    </div>
  )
}

function GoogleAdsEmptyState({
  state,
  hasError,
  compact = false,
}: {
  state: GoogleAdsDashboardState
  hasError: boolean
  compact?: boolean
}) {
  const copy: Record<GoogleAdsDashboardState, { title: string; message: string }> = {
    disconnected: {
      title: 'Google Ads is not connected',
      message: 'Paid campaign reporting is not available for this dashboard yet.',
    },
    unmapped: {
      title: 'No paid campaigns are linked',
      message: 'No Google Ads campaigns are assigned to this client.',
    },
    'not-synced': {
      title: 'Google Ads is not synced for this month',
      message: 'Paid campaign data has not been imported for this reporting period.',
    },
    'no-activity': {
      title: 'No Google Ads activity this month',
      message: 'The month was synced, but no campaign activity was recorded.',
    },
    data: {
      title: 'Google Ads data is available',
      message: 'Paid campaign results are included in this dashboard.',
    },
    error: {
      title: 'Google Ads performance is unavailable',
      message: 'Campaign results could not be loaded right now. Please check back later.',
    },
  }
  const selected = hasError ? copy.error : copy[state]

  return (
    <div className={`rounded-3xl border border-white/[0.08] bg-white/[0.035] text-center ${compact ? 'p-6' : 'p-8 sm:p-10'}`}>
      <p className="font-bold text-white">{selected.title}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{selected.message}</p>
    </div>
  )
}

function StrategyBlocks({
  monthlyStrategy,
  strategyReadUnavailable,
  showEmptyStrategy,
  staffPreview,
}: {
  monthlyStrategy: MonthlyStrategyPresentation | null
  strategyReadUnavailable: boolean
  showEmptyStrategy: boolean
  staffPreview: boolean
}) {
  if (strategyReadUnavailable) {
    return (
      <section className="mb-4">
        <SectionHeading eyebrow="CG action plan" title="What we do next" />
        <p className="rounded-3xl border border-white/[0.08] bg-white/[0.045] p-6 text-sm text-slate-400">
          Monthly strategy is temporarily unavailable. Please try again shortly.
        </p>
      </section>
    )
  }
  if (!monthlyStrategy) {
    if (!showEmptyStrategy) return null
    return (
      <section className="mb-4">
        <SectionHeading eyebrow="CG action plan" title="What we do next" />
        <p className="rounded-3xl border border-white/[0.08] bg-white/[0.045] p-6 text-sm text-slate-400">
          The monthly strategy is still under review. Nothing is inferred from report notes or performance data.
        </p>
      </section>
    )
  }

  // Readers enforce publication server-side; this presentation boundary must
  // also reject accidental draft/approved working-copy props on client views.
  if (!staffPreview && monthlyStrategy.status !== 'published') return null

  const qualityIssues = clientFacingStrategyQualityIssues(monthlyStrategy.strategyData)
  if (qualityIssues.length > 0) {
    if (!staffPreview) return null
    return (
      <section className="mb-4 rounded-3xl border border-amber-300/25 bg-amber-300/[0.06] p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">Strategy preview held</p>
        <p className="mt-3 text-sm leading-6 text-amber-50">This canonical strategy contains internal or non-actionable copy and is not presentation-ready.</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-100/80">
          {qualityIssues.map(issue => <li key={issue}>{issue}</li>)}
        </ul>
      </section>
    )
  }

  return (
    <section className="mb-4">
      <SectionHeading eyebrow="CG action plan" title="What we do next" />
      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 font-semibold text-slate-200">
          {monthDisplayLabel(monthlyStrategy.month.slice(0, 7))} strategy
        </span>
        {staffPreview && (
          <span className={`rounded-full px-3 py-1 font-bold uppercase tracking-[0.12em] ${monthlyStrategy.status === 'draft' ? 'bg-amber-300/10 text-amber-200' : 'bg-emerald-300/10 text-emerald-200'}`}>
            {monthlyStrategy.status === 'draft' ? 'Draft — not visible to client' : monthlyStrategy.status}
          </span>
        )}
      </div>
      <GuidedStrategyView data={monthlyStrategy.strategyData} hideTopContent variant="report" />
    </section>
  )
}

function PlatformTab({
  view,
  previousView,
  previousManual,
  previousMonthLabel,
  monthLabel,
  facts,
  previousFacts,
  normalizedFactsActive,
}: {
  view: PlatformView
  previousView: PlatformView | null
  previousManual: ReportManualMetric | null
  previousMonthLabel: string | null
  monthLabel: string
  facts: PlatformFact[]
  previousFacts: PlatformFact[]
  normalizedFactsActive: boolean
}) {
  if (view.source === 'none' && facts.length === 0 && !normalizedFactsActive) return null

  const performance = buildPlatformPerformance({
    view,
    previousView,
    previousManual,
    monthLabel,
    previousMonthLabel,
  })

  if (normalizedFactsActive) {
    const sections = buildOverviewSections(facts, previousFacts)
    return (
      <>
        <SectionHeading eyebrow={performance.label} title={`${performance.label} performance`} />
        {sections.length > 0 ? <VerifiedOverview sections={sections} /> : <VerifiedFactsUnavailable />}
        <PlatformContent performance={performance} view={view} />
        <PlatformNotes view={view} />
      </>
    )
  }

  return <PlatformPerformanceView performance={performance} view={view} />
}

// Unified Meta-style platform dashboard: header + headline, performance cards,
// audience base, momentum (period metrics only), and adaptive content.
// Client recommendations belong to the canonical monthly strategy, not metrics.
function PlatformPerformanceView({ performance, view }: { performance: PlatformPerformance; view: PlatformView }) {
  return (
    <>
      {/* A - Platform performance header */}
      <SectionHeading eyebrow={performance.label} title={`${performance.label} performance`} />
      <p className="-mt-2 mb-6 max-w-2xl text-base leading-relaxed text-slate-300">
        {performance.performanceHeadline}
      </p>

      {/* B - Performance cards (period metrics only - never current followers) */}
      {performance.cards.length > 0 && (
        <section className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {performance.cards.map(metric => (
            <PerformanceCard key={metric.key} metric={metric} />
          ))}
        </section>
      )}

      {/* C - Audience base (follower snapshot, never shown as growth) */}
      {performance.audienceBase !== null && (
        <section className="mb-12">
          <AudienceBaseCard followers={performance.audienceBase} />
        </section>
      )}

      {/* D - Momentum (true period metrics vs last month) */}
      {performance.momentum.length > 0 && (
        <section className="mb-12">
          <SectionHeading eyebrow="Momentum" title="Versus last month" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {performance.momentum.map(metric => (
              <MomentumCard key={metric.key} metric={metric} />
            ))}
          </div>
        </section>
      )}

      {/* E - Content overview (adaptive wording) */}
      <PlatformContent performance={performance} view={view} />

      {/* Manual summary notes (when this platform is summary-only) */}
      <PlatformNotes view={view} />
    </>
  )
}

function AudienceBaseCard({ followers }: { followers: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(249,115,22,0.10),rgba(255,255,255,0.03))] p-6 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.95)] sm:p-7">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f59e0b]">Audience base</p>
        <p className="mt-2 text-sm text-slate-400">Total followers at the time of sync</p>
      </div>
      <p className="text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">{formatNumber(followers)}</p>
    </div>
  )
}

function MomentumCard({ metric }: { metric: PerformanceMetric }) {
  const up = metric.direction === 'up'
  const down = metric.direction === 'down'
  const tone = up ? 'text-[#2dd4bf]' : down ? 'text-[#f59e0b]' : 'text-slate-400'
  const arrow = up ? '↑' : down ? '↓' : '→'
  const value =
    metric.percent !== null
      ? formatPercent(metric.percent)
      : `${(metric.change ?? 0) > 0 ? '+' : ''}${formatNumber(metric.change ?? 0)}`

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-[#0b1715]/90 p-5 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.95)]">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{metric.label}</p>
      <p className="mt-3 text-3xl font-black tracking-[-0.04em] text-white">{formatNumber(metric.current)}</p>
      <p className={`mt-2 text-sm font-bold ${tone}`}>
        {arrow} {value} <span className="font-medium text-slate-500">{metric.comparisonLabel}</span>
      </p>
    </div>
  )
}

function PlatformContent({ performance, view }: { performance: PlatformPerformance; view: PlatformView }) {
  const tc = performance.topContent
  if (!tc) return null

  const best = tc.post
  const tone = tc.tone
  const heading =
    tone === 'top'
      ? { eyebrow: 'Top content', title: 'Top performing content' }
      : tone === 'learning'
        ? { eyebrow: 'Content', title: 'Content learning' }
        : { eyebrow: 'Content', title: 'Content baseline' }

  const metrics = buildMetaContentMetrics(best)
  // Hero metric: first available from views → reach → interactions
  const heroMetric = metrics.length > 0 ? metrics[0] : null
  const metricRowStr = metrics.map(m => `${formatNumber(m.value)} ${m.label.toLowerCase()}`).join(' · ')

  return (
    <section className="mb-12">
      <SectionHeading eyebrow={heading.eyebrow} title={heading.title} />
      <div className="rounded-[2rem] border border-white/[0.08] bg-[#071311] p-7 shadow-[0_35px_90px_-48px_rgba(0,0,0,0.95)] sm:p-9">
        <div className="flex flex-wrap gap-2">
          {best.post_type && <Pill tone="teal">{displayContentType(best.post_type) ?? best.post_type}</Pill>}
          <Pill>{formatDate(best.publish_time)}</Pill>
          {tone !== 'top' && <Pill tone="amber">Highest activity post</Pill>}
        </div>

        <h3 className="mt-5 text-2xl font-black leading-tight tracking-[-0.035em] text-white sm:text-3xl">
          {shortCaption(best.caption)}
        </h3>

        {heroMetric ? (
          <div className="mt-7">
            <div className="inline-flex items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4">
              <span className="text-4xl font-black leading-none tracking-[-0.04em] text-white">
                {formatNumber(heroMetric.value)}
              </span>
              <span className="pb-1 text-sm font-bold text-slate-400">{heroMetric.label.toLowerCase()}</span>
            </div>
            {metricRowStr && (
              <p className="mt-3 text-sm text-slate-400">{metricRowStr}</p>
            )}
          </div>
        ) : null}

        {metrics.length > 0 && !heroMetric && (
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {metrics.map(item => (
              <MiniMetric key={item.key} label={item.label} value={formatNumber(item.value)} />
            ))}
          </div>
        )}

      </div>

      {view.topPosts.length > 0 && (
        <div className="mt-6">
          <p className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-slate-500">
            {tone === 'top' ? `Top ${performance.label} posts` : `Recent ${performance.label} content`}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {view.topPosts.map((post, index) => (
              <PlatformPostCard key={post.id} post={post} index={index} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function rankingReason(post: ReportStatsPost, index: number): string {
  if (typeof post.impressions === 'number' && post.impressions > 0) return `#${index + 1} by views`
  if (typeof post.reach === 'number' && post.reach > 0) return `#${index + 1} by reach`
  return `#${index + 1} by interactions`
}

function PlatformPostCard({ post, index }: { post: ReportStatsPost; index: number }) {
  const parts: string[] = []
  if (typeof post.impressions === 'number') parts.push(`${formatNumber(post.impressions)} views`)
  if (typeof post.reach === 'number') parts.push(`${formatNumber(post.reach)} reach`)
  if (typeof post.engagements === 'number') {
    parts.push(`${formatNumber(post.engagements)} ${post.engagementDefinitionLabel?.toLowerCase() ?? 'defined interactions'}`)
  } else if (post.engagementKnownSubtotal !== null) {
    parts.push(`${formatNumber(post.engagementKnownSubtotal)} known subtotal (${post.engagementCoverage?.observed ?? 0}/${post.engagementCoverage?.required ?? 0} fields)`)
  } else {
    parts.push('Interaction data unavailable')
  }

  return (
    <article className="rounded-3xl border border-white/[0.08] bg-white/[0.045] p-5 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.95)]">
      <div className="flex items-center justify-between">
        <span className="text-2xl font-black text-[#2dd4bf]">{rankingReason(post, index)}</span>
        <span className="text-xs text-slate-500">{formatDate(post.publish_time)}</span>
      </div>
      <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-white">{shortCaption(post.caption, 'Post')}</p>
      {post.post_type && (
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          {displayContentType(post.post_type) ?? post.post_type}
        </p>
      )}
      <p className="mt-4 text-sm font-bold text-slate-300">{parts.join(' · ')}</p>
    </article>
  )
}

function PlatformNotes({ view }: { view: PlatformView }) {
  if (view.source !== 'manual' || !view.manual) return null
  const manual = view.manual
  const notes = [
    { title: 'Top content', text: manual.top_content_notes },
    { title: 'Content mix', text: manual.content_type_split_notes },
    { title: 'Notes', text: manual.general_notes },
  ].filter(note => {
    const text = note.text?.trim()
    // Hide the internal Meta-sync marker that lives in general_notes.
    return text && !text.startsWith('Meta sync account totals')
  })

  if (notes.length === 0) return null

  return (
    <section className="mb-4 grid gap-4 lg:grid-cols-2">
      {notes.map(note => (
        <article
          key={note.title}
          className="rounded-3xl border border-white/[0.08] bg-white/[0.045] p-6 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.95)]"
        >
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2dd4bf]">{note.title}</p>
          <p className="mt-4 whitespace-pre-line text-[0.95rem] leading-relaxed text-slate-300">{note.text}</p>
        </article>
      ))}
    </section>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.05] p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
    </div>
  )
}

export function ClientDashboardShell({
  children,
  action,
  client = null,
}: {
  children: ReactNode
  action: ReactNode
  client?: Client | null
}) {
  return (
    <div className="min-h-screen bg-[#030706] font-sans text-slate-50">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.12),transparent_30%)]" />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#030706]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          {client ? (
            <div className="flex items-center gap-3">
              <ClientLogo
                client={client}
                boxClassName="h-11 w-11 rounded-xl"
                padding="p-1.5"
                frameClassName={LOGO_FRAME}
                textClassName="text-sm font-black text-[#2dd4bf]"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-black leading-tight text-white">{client.name}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">Client portal</p>
              </div>
            </div>
          ) : (
            <BrandMark subtitle="Client portal" size="report" />
          )}

          {action}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {children}
      </main>
    </div>
  )
}

export function EmptyReportState({ title, message }: { title: string; message: string }) {
  return (
    <div className="max-w-xl rounded-[2rem] border border-white/[0.08] bg-white/[0.045] p-8 shadow-[0_35px_90px_-48px_rgba(0,0,0,0.95)] sm:p-10">
      <h1 className="text-3xl font-black tracking-[-0.04em] text-white">{title}</h1>
      <p className="mt-4 text-[0.95rem] leading-relaxed text-slate-400">{message}</p>
    </div>
  )
}
