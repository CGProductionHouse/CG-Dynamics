import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ReportWithPosts } from '../../lib/db/reports'
import type { Client } from '../../lib/db/clients'
import type { ManualPlatformMetric } from '../../lib/db/manualMetrics'
import BrandMark from '../../components/BrandMark'
import { ClientLogo } from '../../components/ClientLogo'
import { readStrategyData } from '../../lib/strategyEngine'
import { getReportMonthFromPeriod, monthDisplayLabel, normalizeReportToCalendarMonth } from '../../lib/reportPeriod'
import type { MasterReportData, MetricMovement, Platform, PlatformView, ReportStatsPost } from '../../lib/reportStats'
import {
  PLATFORM_LABELS,
  buildMasterReport,
  buildPerformanceMovement,
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
  metaEngagementLabel,
  metaPrimaryMetricLabel,
} from '../../lib/metaMetrics'

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

  const movement = useMemo(
    () => buildPerformanceMovement(master, previousMaster, manualMetrics, previousManualMetrics),
    [manualMetrics, master, previousManualMetrics, previousMaster]
  )

  const availablePlatforms = master.platforms.filter(view => view.source !== 'none')
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    ...availablePlatforms.map(view => ({ key: view.platform as TabKey, label: view.label })),
  ]

  const month = monthDisplayLabel(getReportMonthFromPeriod(report))

  return (
    <div className="relative overflow-hidden font-sans text-slate-50">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[#030706]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_0%,rgba(45,212,191,0.20),transparent_32%),radial-gradient(circle_at_90%_16%,rgba(249,115,22,0.16),transparent_26%),linear-gradient(180deg,#06110f_0%,#030706_100%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18] bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <ReportHero report={report} client={client} month={month} master={master} />

      {availablePlatforms.length > 0 && (
        <ReportTabs tabs={tabs} active={tab} onChange={setTab} />
      )}

      {tab === 'overview' ? (
        <OverviewTab report={report} master={master} movement={movement} showEmptyStrategy={showEmptyStrategy} />
      ) : (
        <PlatformTab
          view={master.platforms.find(item => item.platform === tab)!}
          previousView={previousMaster?.platforms.find(item => item.platform === tab) ?? null}
          previousManual={previousManualMetrics.find(metric => metric.platform === tab) ?? null}
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
              A clear view of what performed, what mattered, and what comes next.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <HeroMiniCard label="Status" value={report.status.charAt(0).toUpperCase() + report.status.slice(1)} accent="teal" />
          <HeroMiniCard label="Report month" value={month} accent="amber" />
          <HeroMiniCard label="Best platform" value={master.bestPlatform?.label ?? '—'} accent="teal" />
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
  movement,
  showEmptyStrategy,
}: {
  report: ReportWithPosts
  master: MasterReportData
  movement: ReturnType<typeof buildPerformanceMovement>
  showEmptyStrategy: boolean
}) {
  const strategy = readStrategyData(report.strategy_data)
  const platformsWithData = master.platforms.filter(view => view.source !== 'none')

  const growthItems = [
    { label: 'Views', m: movement.views },
    { label: 'Reach', m: movement.reach },
    { label: 'Content interactions', m: movement.engagements },
  ].filter(g => g.m.direction !== 'missing' && g.m.difference !== null && !g.m.notAvailable)

  return (
    <>
      <SectionHeading eyebrow="Executive summary" title="The month at a glance" />
      <section className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {master.totalViews !== null && <MetricTile label="Views" value={formatNumber(master.totalViews)} accent="teal" />}
        {master.totalReach !== null && <MetricTile label="Reach" value={formatNumber(master.totalReach)} accent="teal" />}
        {master.totalEngagements > 0 && <MetricTile label="Content interactions" value={formatNumber(master.totalEngagements)} accent="teal" />}
        {master.bestPlatform && <MetricTile label="Best platform" value={master.bestPlatform.label} accent="amber" />}
      </section>
      {master.platforms.filter(p => p.source !== 'none').length === 0 && master.totalEngagements === 0 && (
        <p className="mb-12 rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-3 text-sm text-slate-400">No synced data available yet.</p>
      )}

      {growthItems.length > 0 && (
        <section className="mb-12">
          <SectionHeading eyebrow="Momentum" title="How the numbers moved" />
          <div className="grid gap-4 sm:grid-cols-3">
            {growthItems.map(item => (
              <MovementCard key={item.label} label={item.label} movement={item.m} />
            ))}
          </div>
        </section>
      )}

      <FeaturedContent master={master} strategy={strategy} />

      {platformsWithData.length > 0 && (
        <section className="mb-12">
          <SectionHeading eyebrow="Platform performance" title="How each channel performed" />
          <div className="grid gap-4 lg:grid-cols-3">
            {platformsWithData.map(view => (
              <PlatformSummaryCard key={view.platform} view={view} />
            ))}
          </div>
        </section>
      )}

      <StrategyBlocks report={report} strategy={strategy} showEmptyStrategy={showEmptyStrategy} />
    </>
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

function MetricTile({ label, value, accent }: { label: string; value: string; accent: 'teal' | 'amber' }) {
  const accentClass = accent === 'amber' ? 'from-[#f97316] to-[#f59e0b]' : 'from-[#2dd4bf] to-[#14b8a6]'
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.045] p-5 shadow-[0_24px_60px_-38px_rgba(0,0,0,0.95)] backdrop-blur sm:p-6">
      <div className={`mb-5 h-1 w-12 rounded-full bg-gradient-to-r ${accentClass}`} />
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black leading-none tracking-[-0.04em] text-white sm:text-4xl">{value}</p>
      <div className="pointer-events-none absolute -bottom-14 -right-14 h-32 w-32 rounded-full bg-[#2dd4bf]/0 blur-3xl transition group-hover:bg-[#2dd4bf]/10" />
    </div>
  )
}

function MovementCard({ label, movement }: { label: string; movement: MetricMovement }) {
  const difference = movement.difference ?? 0
  const up = difference > 0
  const down = difference < 0
  const tone = up ? 'text-[#2dd4bf]' : down ? 'text-[#f97316]' : 'text-slate-400'
  const prefix = up ? '+' : ''
  const detail =
    movement.percent !== null
      ? `${up ? '+' : ''}${formatPercent(movement.percent)} vs last month`
      : `${prefix}${formatNumber(difference)} vs last month`

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-[#0b1715]/90 p-5 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.95)]">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-[-0.04em] text-white">{formatNumber(movement.current)}</p>
      <p className={`mt-2 text-sm font-bold ${tone}`}>{detail}</p>
    </div>
  )
}

function FeaturedContent({
  master,
  strategy,
}: {
  master: MasterReportData
  strategy: ReturnType<typeof readStrategyData>
}) {
  const tc = strategy.topContent
  const best = master.bestPostOverall

  const caption = (tc.autoCaption && tc.autoCaption.trim()) || (best ? shortCaption(best.caption) : null)
  const coverImage = (tc.coverImageUrl?.trim() || tc.autoImageUrl?.trim() || best?.imageUrl || '').trim()
  const contentType = tc.contentType.trim() || (best?.post_type ? displayContentType(best.post_type) : null)
  const platformLabel =
    (best?.platform && PLATFORM_LABELS[best.platform]) ||
    (tc.autoPlatform && PLATFORM_LABELS[tc.autoPlatform]) ||
    null
  const metricValue = best ? best.engagements : typeof tc.autoMetricValue === 'number' ? tc.autoMetricValue : null

  const hasAnything = Boolean(caption || coverImage || tc.whyItWorked.length > 0 || tc.whatThisTellsUs.trim())
  if (!hasAnything) return null

  return (
    <section className="mb-12">
      <SectionHeading eyebrow="Featured content" title="What performed best" />

      <div className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#071311] shadow-[0_35px_90px_-48px_rgba(0,0,0,0.95)]">
        <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative min-h-[18rem] overflow-hidden bg-[#030706]">
            {coverImage ? (
              <img
                src={coverImage}
                alt="Top content"
                className="h-full max-h-[28rem] w-full object-cover"
                onError={e => {
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <DesignedPlaceholder contentType={contentType ?? 'Top content'} />
            )}
          </div>

          <div className="relative overflow-hidden p-7 sm:p-9">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.10),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(45,212,191,0.12),transparent_36%)]" />
            <div className="relative">
              <div className="flex flex-wrap gap-2">
                {contentType && <Pill tone="teal">{contentType}</Pill>}
                {platformLabel && <Pill>{platformLabel}</Pill>}
              </div>

              {caption && (
                <h3 className="mt-5 text-2xl font-black leading-tight tracking-[-0.035em] text-white sm:text-3xl">
                  {caption}
                </h3>
              )}

              {metricValue != null && metricValue > 0 && (
                <div className="mt-7 inline-flex items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4">
                  <span className="text-4xl font-black leading-none tracking-[-0.04em] text-white">
                    {formatNumber(metricValue)}
                  </span>
                  <span className="pb-1 text-sm font-bold text-slate-400">engagements</span>
                </div>
              )}

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

              {tc.whatThisTellsUs.trim() && (
                <p className="mt-7 whitespace-pre-line text-[0.95rem] leading-relaxed text-slate-300">
                  {tc.whatThisTellsUs}
                </p>
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

function PlatformSummaryCard({ view }: { view: PlatformView }) {
  return (
    <article className="group rounded-3xl border border-white/[0.08] bg-white/[0.045] p-6 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.95)] transition hover:border-[#2dd4bf]/25 hover:bg-white/[0.06]">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-xl font-black tracking-[-0.03em] text-white">{view.label}</h3>
        <span className="h-2.5 w-2.5 rounded-full bg-[#2dd4bf] shadow-[0_0_20px_rgba(45,212,191,0.7)]" />
      </div>

      <dl className="space-y-0">
        {buildMetaPlatformMetrics(view).map(item => (
          <PlatformRow key={item.key} label={item.label} value={formatNumber(item.value)} />
        ))}
      </dl>

      {view.bestPost?.caption && (
        <p className="mt-5 line-clamp-2 text-sm leading-relaxed text-slate-400">
          <span className="font-bold text-slate-200">Top: </span>
          {shortCaption(view.bestPost.caption, 'Post')}
        </p>
      )}
    </article>
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
}: {
  report: ReportWithPosts
  strategy: ReturnType<typeof readStrategyData>
  showEmptyStrategy: boolean
}) {
  const cards = buildStrategyCards(report, strategy)

  if (cards.length === 0) {
    if (!showEmptyStrategy) return null

    return (
      <section className="mb-4">
        <SectionHeading eyebrow="Strategy" title="Strategy will appear here" />
        <p className="rounded-3xl border border-white/[0.08] bg-white/[0.045] p-6 text-sm text-slate-400">
          Add strategy in the report editor to complete the client-facing story.
        </p>
      </section>
    )
  }

  return (
    <section className="mb-4">
      <SectionHeading eyebrow="Strategy" title="What we do next" />
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
}: {
  view: PlatformView
  previousView: PlatformView | null
  previousManual: ManualPlatformMetric | null
}) {
  if (view.source === 'none') return null
  if (view.source === 'manual') return <ManualPlatformTab view={view} previousManual={previousManual} />
  return <PostsPlatformTab view={view} previousView={previousView} />
}

function PostsPlatformTab({ view, previousView }: { view: PlatformView; previousView: PlatformView | null }) {
  const growth = [
    { label: 'Views', m: compareNullable(view.views, previousView?.views) },
    { label: metaPrimaryMetricLabel(), m: compareNullable(view.reach, previousView?.reach) },
    { label: metaEngagementLabel(), m: compareNullable(view.engagements, previousView?.engagements) },
  ].filter(g => g.m.direction !== 'missing' && g.m.difference !== null)

  return (
    <>
      <SectionHeading eyebrow={view.label} title={`${view.label} performance`} />
      <section className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {buildMetaPlatformMetrics(view).slice(0, 4).map(item => (
          <MetricTile key={item.key} label={item.label} value={formatNumber(item.value)} accent={item.key === 'posts' ? 'amber' : 'teal'} />
        ))}
      </section>

      {growth.length > 0 && (
        <section className="mb-12">
          <SectionHeading eyebrow="Momentum" title="Versus last month" />
          <div className="grid gap-4 sm:grid-cols-3">
            {growth.map(g => (
              <MovementCard key={g.label} label={g.label} movement={g.m} />
            ))}
          </div>
        </section>
      )}

      {view.bestPost && (
        <section className="mb-12">
          <SectionHeading eyebrow="Top post" title={`Best ${view.label} content`} />
          <div className="rounded-[2rem] border border-white/[0.08] bg-[#071311] p-7 shadow-[0_35px_90px_-48px_rgba(0,0,0,0.95)] sm:p-9">
            <div className="flex flex-wrap gap-2">
              {view.bestPost.post_type && (
                <Pill tone="teal">{displayContentType(view.bestPost.post_type) ?? view.bestPost.post_type}</Pill>
              )}
              <Pill>{formatDate(view.bestPost.publish_time)}</Pill>
            </div>

            <h3 className="mt-5 text-2xl font-black leading-tight tracking-[-0.035em] text-white sm:text-3xl">
              {shortCaption(view.bestPost.caption)}
            </h3>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {buildMetaContentMetrics(view.bestPost).map(item => (
                <MiniMetric key={item.key} label={item.label} value={formatNumber(item.value)} />
              ))}
            </div>
          </div>
        </section>
      )}

      {view.topPosts.length > 0 && (
        <section className="mb-4">
          <SectionHeading eyebrow="Top 3" title={`Top ${view.label} posts`} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {view.topPosts.map((post, index) => (
              <article
                key={post.id}
                className="rounded-3xl border border-white/[0.08] bg-white/[0.045] p-5 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.95)]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black text-[#2dd4bf]">#{index + 1}</span>
                  <span className="text-xs text-slate-500">{formatDate(post.publish_time)}</span>
                </div>
                <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-white">
                  {shortCaption(post.caption, 'Post')}
                </p>
                {post.post_type && (
                  <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    {displayContentType(post.post_type) ?? post.post_type}
                  </p>
                )}
                <p className="mt-4 text-sm font-bold text-slate-300">{formatNumber(post.engagements)} content interactions</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

function ManualPlatformTab({
  view,
  previousManual,
}: {
  view: PlatformView
  previousManual: ManualPlatformMetric | null
}) {
  const manual = view.manual!
  const notes = [
    { title: 'Top content', text: manual.top_content_notes },
    { title: 'Content mix', text: manual.content_type_split_notes },
    { title: 'Notes', text: manual.general_notes },
  ].filter(note => note.text && note.text.trim())

  const growth = [
    { label: 'Views', m: compareNullable(view.views, previousManual?.views) },
    { label: 'Reach', m: compareNullable(view.reach, previousManual?.reach) },
    { label: 'Content interactions', m: compareNullable(view.engagements, previousManual?.engagements) },
    { label: 'Current followers', m: compareNullable(manual.followers, previousManual?.followers) },
  ].filter(g => g.m.direction !== 'missing' && g.m.difference !== null)

  return (
    <>
      <SectionHeading eyebrow={view.label} title={`${view.label} performance`} />
      <section className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {view.views !== null && <MetricTile label="Views" value={formatNumber(view.views)} accent="teal" />}
        {view.reach !== null && <MetricTile label="Reach" value={formatNumber(view.reach)} accent="teal" />}
        {view.engagements > 0 && <MetricTile label="Content interactions" value={formatNumber(view.engagements)} accent="teal" />}
        {manual.followers > 0 && <MetricTile label="Current followers" value={formatNumber(manual.followers)} accent="amber" />}
      </section>

      {growth.length > 0 && (
        <section className="mb-12">
          <SectionHeading eyebrow="Momentum" title="Versus last month" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {growth.map(g => (
              <MovementCard key={g.label} label={g.label} movement={g.m} />
            ))}
          </div>
        </section>
      )}

      {notes.length > 0 && (
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
      )}
    </>
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
