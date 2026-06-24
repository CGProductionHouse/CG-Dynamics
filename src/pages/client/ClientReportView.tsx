import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ReportWithPosts } from '../../lib/db/reports'
import type { Client } from '../../lib/db/clients'
import type { ManualPlatformMetric } from '../../lib/db/manualMetrics'
import BrandMark from '../../components/BrandMark'
import { ClientLogo } from '../../components/ClientLogo'
import { readStrategyData } from '../../lib/strategyEngine'
import { getReportMonthFromPeriod, monthDisplayLabel, normalizeReportToCalendarMonth, previousReportMonth } from '../../lib/reportPeriod'
import type { MasterReportData, MetricMovement, Platform, PlatformView, ReportStatsPost } from '../../lib/reportStats'
import {
  PLATFORM_LABELS,
  buildMasterReport,
  compareNullable,
  displayContentType,
  formatDate,
  formatNumber,
  formatPercent,
  reportPostToStatsPost,
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
  type NextStep,
  type PerformanceMetric,
  type PlatformPerformance,
  type ReportPerformance,
  type TopContent,
} from '../../lib/reportPerformance'

type TabKey = 'overview' | Platform

const LOGO_FRAME = 'border border-white/10 bg-[#06110f] shadow-[0_18px_35px_-24px_rgba(45,212,191,0.7)]'

function postsForReportMonth(report: ReportWithPosts): ReportStatsPost[] {
  const { start, end } = normalizeReportToCalendarMonth(report)
  const startTime = new Date(`${start}T00:00:00Z`).getTime()
  const endTime = new Date(`${end}T23:59:59Z`).getTime()

  return report.posts
    .filter(post => {
      if (!post.publish_time) return true
      const time = new Date(post.publish_time).getTime()
      if (Number.isNaN(time)) return true
      return time >= startTime && time <= endTime
    })
    .map(reportPostToStatsPost)
}

function reportClientName(report: ReportWithPosts, client: Client | null): string {
  if (client?.name) return client.name
  const stored = report.report_title?.trim()
  return stored || 'Monthly Performance Report'
}

export function ClientReportView({
  report,
  client = null,
  manualMetrics = [],
  previousReport = null,
  previousManualMetrics = [],
  showEmptyStrategy = false,
}: {
  report: ReportWithPosts
  client?: Client | null
  manualMetrics?: ManualPlatformMetric[]
  previousReport?: ReportWithPosts | null
  previousManualMetrics?: ManualPlatformMetric[]
  showEmptyStrategy?: boolean
}) {
  const [tab, setTab] = useState<TabKey>('overview')

  const statsPosts = useMemo<ReportStatsPost[]>(() => postsForReportMonth(report), [report])
  const master = useMemo(() => buildMasterReport(statsPosts, manualMetrics), [statsPosts, manualMetrics])

  const previousStatsPosts = useMemo<ReportStatsPost[]>(
    () => (previousReport ? postsForReportMonth(previousReport) : []),
    [previousReport]
  )

  const previousMaster = useMemo(
    () =>
      previousReport || previousManualMetrics.length > 0
        ? buildMasterReport(previousStatsPosts, previousManualMetrics)
        : null,
    [previousManualMetrics, previousReport, previousStatsPosts]
  )

  const availablePlatforms = master.platforms.filter(view => view.source !== 'none')
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    ...availablePlatforms.map(view => ({ key: view.platform as TabKey, label: view.label })),
  ]

  const month = monthDisplayLabel(getReportMonthFromPeriod(report))
  const previousMonthLabel = useMemo(() => {
    const prev = previousReportMonth(getReportMonthFromPeriod(report))
    return prev ? monthDisplayLabel(prev) : null
  }, [report])

  const performance = useMemo(
    () =>
      buildReportPerformance({
        master,
        previousMaster,
        currentManual: manualMetrics,
        previousManual: previousManualMetrics,
        monthLabel: month,
        previousMonthLabel,
      }),
    [master, previousMaster, manualMetrics, previousManualMetrics, month, previousMonthLabel]
  )

  return (
    <div className="relative overflow-hidden font-sans text-slate-50">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[#030706]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_0%,rgba(45,212,191,0.20),transparent_32%),radial-gradient(circle_at_90%_16%,rgba(249,115,22,0.16),transparent_26%),linear-gradient(180deg,#06110f_0%,#030706_100%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18] bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <ReportHero report={report} client={client} month={month} master={master} />

      <p className="mb-6 text-center text-xs text-slate-500">
        Reporting period: {report.period_start ? formatDate(report.period_start) : '-'} to {report.period_end ? formatDate(report.period_end) : '-'}
      </p>

      {availablePlatforms.length > 0 && (
        <ReportTabs tabs={tabs} active={tab} onChange={setTab} />
      )}

      {tab === 'overview' ? (
        <OverviewTab
          report={report}
          master={master}
          previousMaster={previousMaster}
          performance={performance}
          showEmptyStrategy={showEmptyStrategy}
          nextSteps={performance.nextSteps}
        />
      ) : (
        <PlatformTab
          view={master.platforms.find(item => item.platform === tab)!}
          previousView={previousMaster?.platforms.find(item => item.platform === tab) ?? null}
          previousManual={previousManualMetrics.find(metric => metric.platform === tab) ?? null}
          previousMonthLabel={previousMonthLabel}
          monthLabel={month}
        />
      )}

      <p className="mx-auto mt-16 max-w-3xl border-t border-white/10 pt-6 text-center text-xs leading-relaxed text-slate-500">
        Source: Meta Business Sync. Platform dashboards remain the official record.
      </p>
    </div>
  )
}

function ReportHero({
  report,
  client,
  month,
  master,
}: {
  report: ReportWithPosts
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

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <HeroMiniCard label="Status" value={report.status.charAt(0).toUpperCase() + report.status.slice(1)} accent="teal" />
          <HeroMiniCard label="Report month" value={month} accent="amber" />
          <HeroMiniCard label="Best platform" value={master.bestPlatform?.label ?? '-'} accent="teal" />
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
  tabs: { key: TabKey; label: string }[]
  active: TabKey
  onChange: (tab: TabKey) => void
}) {
  return (
    <div className="mb-10 flex w-fit flex-wrap gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
      {tabs.map(item => {
        const isActive = active === item.key
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`rounded-full px-5 py-2 text-sm font-bold transition ${
              isActive
                ? 'bg-white text-[#06110f] shadow-lg'
                : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

function OverviewTab({
  report,
  master,
  previousMaster,
  performance,
  showEmptyStrategy,
  nextSteps,
}: {
  report: ReportWithPosts
  master: MasterReportData
  previousMaster: MasterReportData | null
  performance: ReportPerformance
  showEmptyStrategy: boolean
  nextSteps: NextStep[]
}) {
  const strategy = readStrategyData(report.strategy_data)
  const platformsWithData = master.platforms.filter(view => view.source !== 'none')
  const hasData = platformsWithData.length > 0 || performance.metrics.length > 0

  if (!hasData) {
    return (
      <div className="rounded-[2rem] border border-white/[0.08] bg-white/[0.045] p-8 text-center sm:p-10">
        <p className="text-base font-semibold text-white">No report data yet</p>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Performance data will appear here once the month is synced and the report is published.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* B - Performance overview */}
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

      {/* C - Growth trend */}
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

      {/* D - Channel performance */}
      {platformsWithData.length > 0 && (
        <section className="mb-14">
          <SectionHeading eyebrow="Channel performance" title="How each channel performed" />
          <div className="grid gap-4 lg:grid-cols-3">
            {platformsWithData.map(view => (
              <ChannelCard
                key={view.platform}
                view={view}
                previousView={previousMaster?.platforms.find(p => p.platform === view.platform) ?? null}
              />
            ))}
          </div>
        </section>
      )}

      {/* E - Content */}
      <ContentSection topContent={performance.topContent} strategy={strategy} />

      {/* F - Recommendations */}
      {performance.recommendations.length > 0 && (
        <RecommendationsSection recommendations={performance.recommendations} />
      )}

      {/* G - CG action plan */}
      <StrategyBlocks report={report} strategy={strategy} showEmptyStrategy={showEmptyStrategy} nextSteps={nextSteps} recommendations={performance.recommendations} />
    </>
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
        <p className="mt-3 text-xs font-medium text-slate-500">This month</p>
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

// ── F: auto recommendations ──────────────────────────────────────────────────
function RecommendationsSection({ recommendations }: { recommendations: string[] }) {
  return (
    <section className="mb-14">
      <SectionHeading eyebrow="Recommendations" title="Where to focus next" />
      <RecommendationList recommendations={recommendations} />
    </section>
  )
}

function RecommendationList({ recommendations }: { recommendations: string[] }) {
  return (
    <div className="rounded-[2rem] border border-white/[0.08] bg-white/[0.04] p-6 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.95)] sm:p-8">
      <ul className="space-y-4">
        {recommendations.map((rec, index) => (
          <li key={index} className="flex items-start gap-4">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2dd4bf]/15 text-sm font-black text-[#2dd4bf]">
              {index + 1}
            </span>
            <p className="text-[0.95rem] leading-relaxed text-slate-200">{rec}</p>
          </li>
        ))}
      </ul>
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

const LEARNING_COPY =
  'This post created the highest activity for the month, but engagement is still building. Next month’s focus is stronger hooks, clearer product value, and more interactive captions.'
const BASELINE_COPY =
  'This sets a clear content baseline for the month. Next month we build on it with sharper formats and a consistent posting rhythm.'

// E - Content section. Adapts wording to the real strength of the top content
// so weak content is framed as learning, never celebrated as a win.
function ContentSection({
  topContent,
  strategy,
}: {
  topContent: TopContent | null
  strategy: ReturnType<typeof readStrategyData>
}) {
  const tc = strategy.topContent
  const best = topContent?.post ?? null

  const caption = (tc.autoCaption && tc.autoCaption.trim()) || (best ? shortCaption(best.caption) : null)
  const coverImage = (tc.coverImageUrl?.trim() || tc.autoImageUrl?.trim() || best?.imageUrl || '').trim()
  const contentType = tc.contentType.trim() || (best?.post_type ? displayContentType(best.post_type) : null)
  const platformLabel = topContent?.platformLabel || (tc.autoPlatform ? PLATFORM_LABELS[tc.autoPlatform] : null)

  const tone = topContent?.tone ?? 'baseline'
  const bestPost = topContent?.post ?? null
  const rankingMetric = topContent?.rankingMetricLabel ?? null

  // Pick the strongest metric to showcase (views > reach > interactions).
  const heroMetric: { value: number; label: string } | null =
    rankingMetric === 'views' && typeof bestPost?.impressions === 'number'
      ? { value: bestPost.impressions, label: 'views' }
      : rankingMetric === 'reach' && typeof bestPost?.reach === 'number'
        ? { value: bestPost.reach, label: 'reach' }
        : (topContent?.interactions ?? 0) > 0
          ? { value: topContent!.interactions, label: 'content interactions' }
          : null

  const allMetrics: { label: string; value: string }[] = []
  if (typeof bestPost?.impressions === 'number') allMetrics.push({ label: 'views', value: formatNumber(bestPost.impressions) })
  if (typeof bestPost?.reach === 'number') allMetrics.push({ label: 'reach', value: formatNumber(bestPost.reach) })
  if (bestPost && bestPost.engagements > 0) allMetrics.push({ label: 'content interactions', value: formatNumber(bestPost.engagements) })
  const metricRow = allMetrics.map(m => `${m.value} ${m.label}`).join(' · ')

  const cgInsight = tc.whatThisTellsUs.trim()
  const hasCG = tc.whyItWorked.length > 0 || cgInsight.length > 0

  if (!caption && !coverImage && !hasCG) return null

  const heading =
    tone === 'top'
      ? { eyebrow: 'Top content', title: 'Top performing content' }
      : tone === 'learning'
        ? { eyebrow: 'Content', title: 'Content learning' }
        : { eyebrow: 'Content', title: 'Content baseline' }

  const insight = cgInsight || (tone === 'learning' ? LEARNING_COPY : tone === 'baseline' ? BASELINE_COPY : '')

  return (
    <section className="mb-14">
      <SectionHeading eyebrow={heading.eyebrow} title={heading.title} />

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

              {tc.whyItWorked.length > 0 && (
                <div className="mt-7">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Why it worked</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tc.whyItWorked.map((item, index) => (
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
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function DesignedPlaceholder({ contentType }: { contentType: string }) {
  return (
    <div className="relative flex h-full min-h-[18rem] items-center justify-center overflow-hidden p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(45,212,191,0.38),transparent_36%),radial-gradient(circle_at_80%_90%,rgba(249,115,22,0.32),transparent_34%),linear-gradient(135deg,#06110f,#030706)]" />
      <div className="absolute -left-8 top-8 h-40 w-40 rounded-full border border-white/10" />
      <div className="absolute bottom-6 right-6 text-7xl font-black tracking-[-0.08em] text-white/[0.05]">
        TOP
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
  const learningLabel = (best?.engagements ?? 0) >= WEAK_CONTENT_THRESHOLD ? 'Top content' : 'Content learning'

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

function StrategyBlocks({
  report,
  strategy,
  showEmptyStrategy,
  nextSteps,
  recommendations,
}: {
  report: ReportWithPosts
  strategy: ReturnType<typeof readStrategyData>
  showEmptyStrategy: boolean
  nextSteps: NextStep[]
  recommendations: string[]
}) {
  const cards = buildStrategyCards(report, strategy)
  const isPublished = report.status === 'published'

  if (cards.length === 0 && isPublished && nextSteps.length > 0) {
    // Published report without strategy - show next steps as a fallback action plan.
    return (
      <section className="mb-4">
        <SectionHeading eyebrow="CG action plan" title="What we do next" />
        <div className="grid gap-4 lg:grid-cols-2">
          {nextSteps.slice(0, 4).map(step => (
            <article
              key={step.priority}
              className="rounded-3xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.035))] p-6 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.95)] sm:p-7"
            >
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2dd4bf]">Next step</p>
              <h3 className="mt-3 text-xl font-black tracking-[-0.03em] text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.why}</p>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-slate-300">{step.action}</p>
            </article>
          ))}
        </div>
      </section>
    )
  }

  if (cards.length === 0 && isPublished) {
    // Published with no strategy and no generated next steps - safe placeholder.
    return (
      <section className="mb-4">
        <SectionHeading eyebrow="CG action plan" title="What we do next" />
        <div className="grid gap-4 lg:grid-cols-2">
          {recommendations.slice(0, 4).map((rec, index) => (
            <article
              key={index}
              className="rounded-3xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.035))] p-6 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.95)] sm:p-7"
            >
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2dd4bf]">Recommended focus</p>
              <p className="mt-4 text-[0.95rem] leading-relaxed text-slate-300">{rec}</p>
            </article>
          ))}
        </div>
      </section>
    )
  }

  if (cards.length === 0 && isPublished) {
    return null
  }

  if (cards.length === 0) {
    if (!showEmptyStrategy) return null

    return (
      <section className="mb-4">
        <SectionHeading eyebrow="CG action plan" title="What we do next" />
        <p className="rounded-3xl border border-white/[0.08] bg-white/[0.045] p-6 text-sm text-slate-400">
          CG action plan will be added before final publishing.
        </p>
      </section>
    )
  }

  return (
    <section className="mb-4">
      <SectionHeading eyebrow="CG action plan" title="What we do next" />
      <div className="grid gap-4 lg:grid-cols-2">
        {cards.map(card => (
          <article
            key={card.title}
            className="rounded-3xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.035))] p-6 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.95)] sm:p-7"
          >
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2dd4bf]">{card.label}</p>
            <h3 className="mt-3 text-xl font-black tracking-[-0.03em] text-white">{card.title}</h3>
            <p className="mt-4 whitespace-pre-line text-[0.95rem] leading-relaxed text-slate-300">{card.text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function buildStrategyCards(report: ReportWithPosts, strategy: ReturnType<typeof readStrategyData>) {
  const record = strategy as unknown as Record<string, unknown>

  const guidedCards = [
    {
      label: 'Direction',
      title: 'Client direction',
      text: textFromKeys(record, ['clientDirection', 'direction', 'monthlyDirection']),
    },
    {
      label: 'Focus',
      title: 'Strategy going forward',
      text: textFromKeys(record, ['strategyGoingForward', 'strategyNextMonth', 'strategy', 'nextMonthFocus']),
    },
    {
      label: 'Execution',
      title: 'Action plan',
      text: textFromKeys(record, ['actionPlan', 'recommendedActions', 'actions', 'contentPlan']),
    },
    {
      label: 'Client input',
      title: 'Client actions required',
      text: textFromKeys(record, ['clientActionsRequired', 'clientActions', 'clientNeeds', 'requirements']),
    },
    {
      label: 'Campaigns',
      title: 'Campaign recommendation',
      text: textFromKeys(record, ['campaignRecommendation', 'boostRecommendation', 'paidMediaRecommendation', 'campaign']),
    },
  ]

  const legacyCards = [
    { label: 'Insight', title: 'Key takeaways', text: report.general_notes },
    { label: 'Performance', title: 'What worked', text: report.performance_comments },
    { label: 'Opportunity', title: 'Opportunities', text: report.previous_month_reflection },
    { label: 'Focus', title: 'Next month focus', text: report.strategy_next_month },
    {
      label: 'Action',
      title: 'Recommended actions',
      text: [report.content_direction_next_month, report.boost_recommendation].filter(Boolean).join('\n\n') || null,
    },
  ]

  return [...guidedCards, ...legacyCards]
    .map(card => ({ ...card, text: cleanText(card.text) }))
    .filter(card => card.text)
}

function textFromKeys(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    const formatted = formatStrategyValue(value)
    if (formatted) return formatted
  }
  return null
}

function formatStrategyValue(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null

  if (Array.isArray(value)) {
    const parts = value.map(item => formatStrategyValue(item)).filter(Boolean)
    return parts.length > 0 ? parts.join('\n') : null
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const formatted = formatStrategyValue(item)
        if (!formatted) return null
        return `${humanLabel(key)}: ${formatted}`
      })
      .filter(Boolean)

    return entries.length > 0 ? entries.join('\n') : null
  }

  return null
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function humanLabel(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, char => char.toUpperCase())
}

function PlatformTab({
  view,
  previousView,
  previousManual,
  previousMonthLabel,
  monthLabel,
}: {
  view: PlatformView
  previousView: PlatformView | null
  previousManual: ManualPlatformMetric | null
  previousMonthLabel: string | null
  monthLabel: string
}) {
  if (view.source === 'none') return null

  const performance = buildPlatformPerformance({
    view,
    previousView,
    previousManual,
    monthLabel,
    previousMonthLabel,
  })

  return <PlatformPerformanceView performance={performance} view={view} />
}

// Unified Meta-style platform dashboard: header + headline, performance cards,
// audience base, momentum (period metrics only), adaptive content, and
// platform-specific recommendations.
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

      {/* F - Platform recommendations */}
      {performance.recommendations.length > 0 && (
        <section className="mb-12">
          <SectionHeading eyebrow="Recommendations" title={`Next steps for ${performance.label}`} />
          <RecommendationList recommendations={performance.recommendations} />
        </section>
      )}

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

const PLATFORM_LEARNING_COPY =
  'This post created the highest activity for the month, but engagement is still building. Next month’s focus is stronger hooks, clearer product value, and more interactive content.'
const PLATFORM_BASELINE_COPY =
  'This sets a clear content baseline for the month. Next month we build on it with sharper formats and a consistent posting rhythm.'

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
  const copy = tone === 'learning' ? PLATFORM_LEARNING_COPY : tone === 'baseline' ? PLATFORM_BASELINE_COPY : null

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

        {copy && <p className="mt-7 text-[0.95rem] leading-relaxed text-slate-300">{copy}</p>}
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
  parts.push(`${formatNumber(post.engagements)} content interactions`)

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
