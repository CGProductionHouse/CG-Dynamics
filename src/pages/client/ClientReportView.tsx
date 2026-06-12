import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ReportWithPosts } from '../../lib/db/reports'
import type { Client } from '../../lib/db/clients'
import type { ManualPlatformMetric } from '../../lib/db/manualMetrics'
import { MANUAL_SOURCE_LABELS } from '../../lib/db/manualMetrics'
import BrandMark from '../../components/BrandMark'
import { ClientLogo } from '../../components/ClientLogo'
import type { MasterReportData, MetricMovement, PerformanceMovement, Platform, PlatformSource, PlatformView, ReportStatsPost } from '../../lib/reportStats'
import {
  PLATFORMS,
  PLATFORM_LABELS,
  buildMasterReport,
  buildPerformanceMovement,
  compareMetric,
  formatDate,
  formatNumber,
  formatPercent,
  reportPostToStatsPost,
  shortCaption,
} from '../../lib/reportStats'

type TabKey = 'overview' | Platform

const MANUAL_SOURCE_NOTE =
  'Source note: This platform uses a monthly account summary where post-level export detail was not available.'

const REPORT_DISCLAIMER =
  'Reporting note: This dashboard is compiled from exported platform data, manual summaries, and internal reporting tools. Small differences may appear because platforms process and export data at different times. Original platform dashboards and exports remain the source of record.'

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

  const statsPosts = useMemo<ReportStatsPost[]>(
    () => report.posts.map(reportPostToStatsPost),
    [report]
  )
  const master = useMemo(
    () => buildMasterReport(statsPosts, manualMetrics),
    [statsPosts, manualMetrics]
  )
  const previousStatsPosts = useMemo<ReportStatsPost[]>(
    () => previousReport?.posts.map(reportPostToStatsPost) ?? [],
    [previousReport]
  )
  const previousMaster = useMemo(
    () => previousReport || previousManualMetrics.length > 0
      ? buildMasterReport(previousStatsPosts, previousManualMetrics)
      : null,
    [previousManualMetrics, previousReport, previousStatsPosts]
  )
  const movement = useMemo(
    () => buildPerformanceMovement(master, previousMaster, manualMetrics, previousManualMetrics),
    [manualMetrics, master, previousManualMetrics, previousMaster]
  )

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    ...PLATFORMS.map(platform => ({ key: platform as TabKey, label: PLATFORM_LABELS[platform] })),
  ]

  return (
    <>
      <div className="mb-6 rounded-2xl border border-brand-muted bg-brand-surface/80 p-5 shadow-[0_0_60px_rgba(45,212,191,0.06)] lg:mb-8 lg:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-center">
            <ClientReportLogo client={client} />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.22em] text-brand-accent mb-2">Monthly master report</p>
              <h1 className="text-3xl font-semibold text-white sm:text-4xl">
                {report.report_title || 'Monthly Performance Report'}
              </h1>
              <p className="text-sm text-brand-primary mt-3">
                {formatDate(report.period_start)} to {formatDate(report.period_end)}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-brand-muted bg-brand-surface px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-brand-primary">Status</p>
            <p className="mt-1 text-sm font-semibold text-brand-accent">Published report</p>
          </div>
        </div>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto border-b border-brand-muted pb-3">
        {tabs.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === item.key
                ? 'bg-brand-accent text-brand-bg shadow-[0_0_24px_rgba(45,212,191,0.12)]'
                : 'border border-brand-muted text-brand-primary hover:text-white hover:border-white/30'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <OverviewTab
          report={report}
          master={master}
          movement={movement}
          showEmptyStrategy={showEmptyStrategy}
          usesManualData={manualMetrics.length > 0}
        />
      ) : (
        <PlatformTab
          view={master.platforms.find(item => item.platform === tab)!}
          previousView={previousMaster?.platforms.find(item => item.platform === tab) ?? null}
          previousManual={previousManualMetrics.find(metric => metric.platform === tab) ?? null}
        />
      )}

      <p className="mt-8 border-t border-brand-muted pt-5 text-xs leading-relaxed text-brand-primary/80">
        {REPORT_DISCLAIMER}
      </p>
    </>
  )
}

function OverviewTab({
  report,
  master,
  movement,
  showEmptyStrategy,
  usesManualData,
}: {
  report: ReportWithPosts
  master: MasterReportData
  movement: PerformanceMovement
  showEmptyStrategy: boolean
  usesManualData: boolean
}) {
  return (
    <>
      <section className="grid grid-cols-2 gap-3 mb-6 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Overall reach" value={formatNumber(master.totalReach)} />
        <StatCard label="Overall views" value={formatNumber(master.totalViews)} />
        <StatCard label="Overall engagements" value={formatNumber(master.totalEngagements)} />
        <StatCard label="Best platform" value={master.bestPlatform ? master.bestPlatform.label : 'No data yet'} />
      </section>

      <ExecutiveSummary report={report} master={master} usesManualData={usesManualData} />

      <section className="bg-brand-surface border border-brand-muted rounded-xl p-5 mb-6 sm:p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-brand-primary mb-3">Best post overall</p>
        {master.bestPostOverall ? (
          <div>
            <h2 className="text-lg font-semibold text-white leading-snug sm:text-xl">
              {shortCaption(master.bestPostOverall.caption)}
            </h2>
            <p className="text-sm text-brand-primary mt-2">
              {master.bestPostOverall.platform ? `${PLATFORM_LABELS[master.bestPostOverall.platform]} - ` : ''}
              {formatDate(master.bestPostOverall.publish_time)}
            </p>
            <div className="grid grid-cols-1 gap-3 mt-5 sm:grid-cols-3">
              <MiniMetric label="Reach" value={formatNumber(master.bestPostOverall.reach)} />
              <MiniMetric label="Views" value={formatNumber(master.bestPostOverall.impressions)} />
              <MiniMetric label="Engagements" value={formatNumber(master.bestPostOverall.engagements)} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-brand-primary">No data uploaded yet.</p>
        )}
      </section>

      <PerformanceMovementSection movement={movement} />

      <section className="bg-brand-surface border border-brand-muted rounded-xl p-5 mb-6 sm:p-6">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.18em] text-brand-primary">Platform coverage</p>
          <h2 className="mt-2 text-base font-semibold text-white">Data included in this report</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {master.platforms.map(view => (
            <div key={view.platform} className="rounded-lg border border-brand-muted bg-brand-bg/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-white">{view.label}</p>
                <SourceTag source={view.source} />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-brand-primary">
                {view.source === 'posts'
                  ? `${formatNumber(view.postCount)} post-level records`
                  : view.source === 'manual'
                    ? MANUAL_SOURCE_LABELS[view.manual!.source_type]
                    : 'No data for this month'}
              </p>
            </div>
          ))}
        </div>
      </section>

      <StrategySection report={report} showEmptyStrategy={showEmptyStrategy} />
    </>
  )
}

function ExecutiveSummary({
  report,
  master,
  usesManualData,
}: {
  report: ReportWithPosts
  master: MasterReportData
  usesManualData: boolean
}) {
  const takeaway =
    report.performance_comments ||
    report.strategy_next_month ||
    report.content_direction_next_month ||
    report.general_notes

  return (
    <section className="bg-brand-surface border border-brand-muted rounded-xl p-5 mb-6 shadow-[0_0_50px_rgba(45,212,191,0.05)] sm:p-6">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-[0.18em] text-brand-primary">Executive summary</p>
        <h2 className="mt-2 text-lg font-semibold text-white">Month at a glance</h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3 text-sm leading-relaxed text-brand-primary">
          <p>
            The strongest platform this month was{' '}
            <span className="font-semibold text-white">{master.bestPlatform?.label ?? 'not available yet'}</span>,
            with {formatNumber(master.totalViews)} views, {formatNumber(master.totalReach)} reach and{' '}
            {formatNumber(master.totalEngagements)} engagements across the report.
          </p>
          {master.bestPostOverall && (
            <p>
              Best post: <span className="text-white">{shortCaption(master.bestPostOverall.caption)}</span>
            </p>
          )}
          {takeaway && <p className="text-white">{takeaway}</p>}
          {usesManualData && (
            <p className="text-xs text-brand-primary/80">
              Some platform totals include monthly summary data where post-level export detail was not available.
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <MiniMetric label="Views" value={formatNumber(master.totalViews)} />
          <MiniMetric label="Reach" value={formatNumber(master.totalReach)} />
          <MiniMetric label="Eng." value={formatNumber(master.totalEngagements)} />
        </div>
      </div>
    </section>
  )
}

function StrategySection({
  report,
  showEmptyStrategy,
}: {
  report: ReportWithPosts
  showEmptyStrategy: boolean
}) {
  const cards = [
    {
      title: 'Key takeaways',
      text: report.general_notes,
    },
    {
      title: 'What worked',
      text: report.performance_comments,
    },
    {
      title: 'Opportunities',
      text: report.previous_month_reflection,
    },
    {
      title: 'Next month focus',
      text: report.strategy_next_month,
    },
    {
      title: 'Recommended actions',
      text: [report.content_direction_next_month, report.boost_recommendation].filter(Boolean).join('\n\n') || null,
    },
  ]
  const visibleCards = showEmptyStrategy ? cards : cards.filter(card => card.text)

  if (visibleCards.length === 0) return null

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {visibleCards.map(card => (
        <StrategyCard key={card.title} title={card.title} text={card.text} showEmpty={showEmptyStrategy} />
      ))}
    </section>
  )
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
  if (view.source === 'none') {
    return (
      <div className="bg-brand-surface border border-brand-muted rounded-xl p-6 sm:p-10">
        <h2 className="text-lg font-semibold text-white mb-2">{view.label}</h2>
        <p className="text-sm text-brand-primary">No platform data is available for this month yet.</p>
      </div>
    )
  }

  if (view.source === 'manual') {
    return <ManualPlatformTab view={view} previousManual={previousManual} />
  }

  return <PostsPlatformTab view={view} previousView={previousView} />
}

function PostsPlatformTab({ view, previousView }: { view: PlatformView; previousView: PlatformView | null }) {
  return (
    <>
      <section className="grid grid-cols-2 gap-3 mb-6 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Reach" value={formatNumber(view.reach)} />
        <StatCard label="Views" value={formatNumber(view.views)} />
        <StatCard label="Engagements" value={formatNumber(view.engagements)} />
        <StatCard label="Posts" value={formatNumber(view.postCount)} />
      </section>

      <section className="grid gap-3 mb-6 sm:grid-cols-3">
        <MovementCard label="Views growth" movement={compareMetric(view.views, previousView?.views)} />
        <MovementCard label="Reach growth" movement={compareMetric(view.reach, previousView?.reach)} />
        <MovementCard label="Engagement growth" movement={compareMetric(view.engagements, previousView?.engagements)} />
      </section>

      <section className="bg-brand-surface border border-brand-muted rounded-xl p-5 mb-6 sm:p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-brand-primary mb-3">Best {view.label} post</p>
        {view.bestPost ? (
          <div>
            <h2 className="text-lg font-semibold text-white leading-snug sm:text-xl">
              {shortCaption(view.bestPost.caption)}
            </h2>
            <p className="text-sm text-brand-primary mt-2">{formatDate(view.bestPost.publish_time)}</p>
            <div className="grid grid-cols-1 gap-3 mt-5 sm:grid-cols-3">
              <MiniMetric label="Reach" value={formatNumber(view.bestPost.reach)} />
              <MiniMetric label="Views" value={formatNumber(view.bestPost.impressions)} />
              <MiniMetric label="Engagements" value={formatNumber(view.bestPost.engagements)} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-brand-primary">No data uploaded yet.</p>
        )}
      </section>

      <section className="bg-brand-surface border border-brand-muted rounded-xl p-5 sm:p-6">
        <div className="flex flex-col gap-1 mb-5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-white">Top {view.label} posts</h2>
          <span className="text-sm text-brand-primary sm:text-xs">Ranked by engagement</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {view.topPosts.map((post, index) => (
            <article key={post.id} className="bg-brand-bg/60 border border-brand-muted rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-brand-accent text-sm font-semibold">#{index + 1}</span>
                <span className="text-[11px] text-brand-primary">{formatDate(post.publish_time)}</span>
              </div>
              <p className="text-sm text-white leading-snug">{shortCaption(post.caption, 'Post')}</p>
              <p className="text-sm text-brand-primary mt-3">
                {formatNumber(post.engagements)} engagements
              </p>
            </article>
          ))}
        </div>
      </section>
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
  const followerGrowth = compareMetric(manual.followers, previousManual?.followers)
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-brand-muted px-2.5 py-1 text-xs font-medium text-brand-primary">
          {MANUAL_SOURCE_LABELS[manual.source_type]}
        </span>
      </div>

      <section className="grid grid-cols-2 gap-3 mb-6 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Reach" value={formatNumber(view.reach)} />
        <StatCard label="Views" value={formatNumber(view.views)} />
        <StatCard label="Engagements" value={formatNumber(view.engagements)} />
        <StatCard label="Followers" value={formatNumber(manual.followers)} />
      </section>

      <section className="grid grid-cols-2 gap-3 mb-6 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Accounts engaged" value={formatNumber(manual.accounts_engaged)} />
        <StatCard label="Profile visits" value={formatNumber(manual.profile_visits)} />
        <StatCard label="External link taps" value={formatNumber(manual.external_link_taps)} />
      </section>

      <section className="grid gap-3 mb-6 sm:grid-cols-2 lg:grid-cols-5">
        <MovementCard label="Views growth" movement={compareMetric(view.views, previousManual?.views)} />
        <MovementCard label="Reach growth" movement={compareMetric(view.reach, previousManual?.reach)} />
        <MovementCard label="Engagement growth" movement={compareMetric(view.engagements, previousManual?.engagements)} />
        <MovementCard label="Profile visit growth" movement={compareMetric(manual.profile_visits, previousManual?.profile_visits)} />
        <MovementCard label="Follower growth" movement={followerGrowth} />
      </section>

      <section className="grid gap-4 mb-6 lg:grid-cols-3">
        <InsightCard title="Traffic" text={`${formatNumber(manual.profile_visits)} profile visits and ${formatNumber(manual.external_link_taps)} external link taps.`} />
        <InsightCard title="Followers" text={followerGrowth.direction === 'missing' ? 'Previous follower count not available.' : movementText(followerGrowth)} />
        <InsightCard title="Source" text={MANUAL_SOURCE_LABELS[manual.source_type]} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <StrategyCard title="Top content" text={manual.top_content_notes} />
        <StrategyCard title="Content type split" text={manual.content_type_split_notes} />
        <StrategyCard title="General notes" text={manual.general_notes} />
      </section>

      <p className="mt-6 rounded-lg border border-brand-muted bg-brand-bg/40 px-4 py-3 text-xs leading-relaxed text-brand-primary/80">
        {MANUAL_SOURCE_NOTE}
      </p>
    </>
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
    <div className="min-h-screen bg-brand-bg bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.08),transparent_28rem)]">
      <header className="border-b border-brand-muted bg-brand-surface/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-3 sm:px-6">
          {client ? (
            <div className="flex items-center gap-3">
              <ClientLogo client={client} boxClassName="h-14 w-14 rounded-xl" padding="p-1.5" />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold leading-tight text-white">{client.name}</p>
                <p className="mt-0.5 truncate text-xs text-brand-primary">Client dashboard</p>
              </div>
            </div>
          ) : (
            <BrandMark subtitle="Client dashboard" size="report" />
          )}
          {action}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  )
}

export function EmptyReportState({ title, message }: { title: string; message: string }) {
  return (
    <div className="bg-brand-surface border border-brand-muted rounded-xl p-6 max-w-xl shadow-[0_0_50px_rgba(45,212,191,0.06)] sm:p-10">
      <h1 className="text-2xl font-semibold text-white mb-3">{title}</h1>
      <p className="text-base text-brand-primary leading-relaxed sm:text-sm">{message}</p>
    </div>
  )
}

function ClientReportLogo({ client }: { client?: Client | null }) {
  if (!client) return <BrandMark subtitle="CG Production House" size="report" />

  return (
    <ClientLogo
      client={client}
      boxClassName="h-24 w-24 rounded-2xl sm:h-28 sm:w-28"
      padding="p-2.5"
      textClassName="text-2xl font-semibold text-brand-primary"
    />
  )
}

function PerformanceMovementSection({ movement }: { movement: PerformanceMovement }) {
  return (
    <section className="bg-brand-surface border border-brand-muted rounded-xl p-5 mb-6 shadow-[0_0_50px_rgba(45,212,191,0.04)] sm:p-6">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.18em] text-brand-primary">Growth vs previous month</p>
        <h2 className="mt-2 text-lg font-semibold text-white">Performance movement</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MovementCard label="Views growth" movement={movement.views} />
        <MovementCard label="Reach growth" movement={movement.reach} />
        <MovementCard label="Engagement growth" movement={movement.engagements} />
        <MovementCard label="Profile visit growth" movement={movement.profileVisits} />
        <MovementCard label="Follower growth" movement={movement.followers} />
      </div>
    </section>
  )
}

function movementText(movement: MetricMovement) {
  if (movement.direction === 'missing' || movement.difference === null) {
    return 'Previous month data not available.'
  }
  const diff = `${movement.difference > 0 ? '+' : ''}${formatNumber(movement.difference)}`
  if (movement.percent === null) return `${diff} vs previous month`
  return `${diff} (${formatPercent(movement.percent)}) vs previous month`
}

function MovementCard({ label, movement }: { label: string; movement: MetricMovement }) {
  const tone = {
    up: 'border-brand-accent/30 bg-brand-accent/10 text-brand-accent',
    down: 'border-red-300/25 bg-red-400/10 text-red-200',
    flat: 'border-brand-muted bg-brand-bg/50 text-brand-primary',
    missing: 'border-brand-muted bg-brand-bg/40 text-brand-primary',
  }[movement.direction]

  const currentText = formatNumber(movement.current)
  const detail = movement.direction === 'missing'
    ? (label.toLowerCase().includes('follower') ? 'Previous follower count not available' : 'Previous month data not available')
    : movementText(movement)

  return (
    <article className={`rounded-xl border p-4 ${tone}`}>
      <p className="text-[11px] uppercase tracking-[0.12em] opacity-80">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{currentText}</p>
      <p className="mt-2 text-xs leading-relaxed">{detail}</p>
    </article>
  )
}

function InsightCard({ title, text }: { title: string; text: string | null }) {
  return (
    <article className="rounded-xl border border-brand-muted bg-brand-surface p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-brand-primary mb-3">{title}</p>
      <p className="text-sm leading-relaxed text-white">{text || 'No notes added yet.'}</p>
    </article>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-brand-surface border border-brand-muted rounded-xl p-5 shadow-[0_0_40px_rgba(45,212,191,0.07)] sm:p-6">
      <p className="text-xs uppercase tracking-[0.12em] text-brand-primary sm:tracking-[0.18em]">{label}</p>
      <p className="text-2xl font-semibold text-white mt-4 break-words sm:text-3xl">{value}</p>
    </div>
  )
}

function SourceTag({ source }: { source: PlatformSource }) {
  const label = source === 'posts' ? 'Meta CSV' : source === 'manual' ? 'Summary' : 'No data'
  const classes = {
    posts: 'border-brand-accent/30 bg-brand-accent/10 text-brand-accent',
    manual: 'border-sky-300/30 bg-sky-300/10 text-sky-200',
    none: 'border-brand-muted bg-brand-muted/50 text-brand-primary',
  }[source]

  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${classes}`}>
      {label}
    </span>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-brand-bg/70 border border-brand-muted rounded-lg p-4">
      <p className="text-[10px] uppercase tracking-[0.14em] text-brand-primary">{label}</p>
      <p className="text-lg font-semibold text-white mt-2 sm:text-base">{value}</p>
    </div>
  )
}

function StrategyCard({
  title,
  text,
  showEmpty = true,
}: {
  title: string
  text: string | null
  showEmpty?: boolean
}) {
  if (!text && !showEmpty) return null

  return (
    <article className="bg-brand-surface border border-brand-muted rounded-xl p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-brand-primary mb-3">{title}</p>
      <p className={`text-base leading-relaxed whitespace-pre-line sm:text-sm ${text ? 'text-white' : 'text-brand-primary'}`}>
        {text || 'No notes added yet.'}
      </p>
    </article>
  )
}
