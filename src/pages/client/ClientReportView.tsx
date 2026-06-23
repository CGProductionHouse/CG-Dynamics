import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ReportWithPosts } from '../../lib/db/reports'
import type { Client } from '../../lib/db/clients'
import type { ManualPlatformMetric } from '../../lib/db/manualMetrics'
import BrandMark from '../../components/BrandMark'
import { ClientLogo } from '../../components/ClientLogo'
import { GuidedStrategyView } from '../../components/strategy/GuidedStrategy'
import { readStrategyData, hasStrategyContent } from '../../lib/strategyEngine'
import { getReportMonthFromPeriod, monthDisplayLabel, normalizeReportToCalendarMonth } from '../../lib/reportPeriod'
import type { MasterReportData, MetricMovement, PerformanceMovement, Platform, PlatformView, ReportStatsPost } from '../../lib/reportStats'
import {
  PLATFORM_LABELS,
  buildMasterReport,
  buildPerformanceMovement,
  compareMetric,
  displayContentType,
  formatDate,
  formatNumber,
  formatPercent,
  reportPostToStatsPost,
  shortCaption,
} from '../../lib/reportStats'

type TabKey = 'overview' | Platform

const REPORT_DISCLAIMER =
  'This report is compiled from each platform’s exported data and our internal reporting. Small differences can appear as platforms finalise their numbers; the original platform dashboards remain the source of record.'

// Warm logo frame so the client logo sits on a soft surface rather than the
// dark teal admin frame.
const LOGO_FRAME = 'border border-report-line/70 bg-report-elevated'

// ─── data helpers (unchanged behaviour) ──────────────────────────────────────

// Restrict a report's posts to its intended calendar month. Posts with no
// publish time (or an unparseable one) are kept — they belong to the report.
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

// Client-facing title: only trust a stored title when it names this client,
// otherwise show the client name so no other client's title ever leaks through.
function reportClientName(report: ReportWithPosts, client: Client | null): string {
  if (client?.name) return client.name
  const stored = report.report_title?.trim()
  return stored || 'Monthly Performance Report'
}

// ─── main report ──────────────────────────────────────────────────────────────

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
    <div className="font-sans text-report-text">
      <Hero report={report} client={client} month={month} />

      {/* Tabs only appear when there is at least one platform to drill into. */}
      {availablePlatforms.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-1.5">
          {tabs.map(item => {
            const active = tab === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                  active
                    ? 'bg-report-elevated font-medium text-report-text'
                    : 'text-report-faint hover:text-report-muted'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>
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

      <p className="mx-auto mt-14 max-w-3xl border-t border-report-line/60 pt-6 text-center text-xs leading-relaxed text-report-faint">
        {REPORT_DISCLAIMER}
      </p>
    </div>
  )
}

function Hero({ report, client, month }: { report: ReportWithPosts; client: Client | null; month: string }) {
  return (
    <section className="relative mb-10 overflow-hidden rounded-[1.75rem] bg-report-elevated px-6 py-10 shadow-[0_30px_70px_-40px_rgba(0,0,0,0.85)] sm:px-10 sm:py-14">
      {/* soft warm depth — no hard borders */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(111,179,165,0.16),transparent_55%),radial-gradient(130%_130%_at_100%_120%,rgba(216,180,138,0.12),transparent_55%)]" />
      <div className="relative flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          {client ? (
            <ClientLogo
              client={client}
              boxClassName="h-20 w-20 rounded-2xl sm:h-24 sm:w-24"
              padding="p-3"
              frameClassName={LOGO_FRAME}
              textClassName="text-2xl font-semibold text-report-accent"
            />
          ) : (
            <BrandMark subtitle="CG Production House" size="report" />
          )}
          <div className="min-w-0">
            <p className="text-[0.7rem] uppercase tracking-[0.28em] text-report-accent">Monthly Performance Report</p>
            <h1 className="mt-2 font-display text-4xl font-semibold leading-[1.05] text-report-text sm:text-5xl">
              {reportClientName(report, client)}
            </h1>
            <p className="mt-3 font-display text-lg text-report-muted">{month}</p>
          </div>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-report-surface/70 px-3.5 py-1.5 text-xs font-medium text-report-accent backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-report-accent" />
          Published
        </span>
      </div>
    </section>
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
  movement: PerformanceMovement
  showEmptyStrategy: boolean
}) {
  const strategy = readStrategyData(report.strategy_data)
  const hasStrategy = hasStrategyContent(strategy)
  const platformsWithData = master.platforms.filter(view => view.source !== 'none')

  const growthItems = [
    { label: 'Views', m: movement.views },
    { label: 'Reach', m: movement.reach },
    { label: 'Engagements', m: movement.engagements },
  ].filter(g => g.m.direction !== 'missing' && g.m.difference !== null && !g.m.notAvailable)

  return (
    <>
      <SectionHeading eyebrow="Executive summary" title="The month at a glance" />
      <section className="mb-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricStat label="Views" value={master.totalViews} />
        <MetricStat label="Reach" value={master.totalReach} />
        <MetricStat label="Engagements" value={master.totalEngagements} />
        <MetricStat label="Best platform" text={master.bestPlatform?.label ?? null} />
      </section>

      {growthItems.length > 0 && (
        <section className="mb-12">
          <SectionHeading eyebrow="Momentum" title="How we moved versus last month" />
          <div className="grid gap-3 sm:grid-cols-3">
            {growthItems.map(item => (
              <MovementChip key={item.label} label={item.label} movement={item.m} />
            ))}
          </div>
        </section>
      )}

      <TopContentSection master={master} strategy={strategy} />

      {platformsWithData.length > 0 && (
        <section className="mb-12">
          <SectionHeading eyebrow="Channels" title="How each platform performed" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {platformsWithData.map(view => (
              <PlatformSummaryCard key={view.platform} view={view} />
            ))}
          </div>
        </section>
      )}

      {hasStrategy ? (
        <section className="mb-4">
          <SectionHeading eyebrow="Looking ahead" title="Strategy & action plan" />
          <GuidedStrategyView data={strategy} hideTopContent variant="report" />
        </section>
      ) : (
        <LegacyStrategySection report={report} showEmptyStrategy={showEmptyStrategy} />
      )}
    </>
  )
}

// ─── shared presentation pieces ───────────────────────────────────────────────

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-5">
      <p className="text-[0.7rem] uppercase tracking-[0.22em] text-report-accent">{eyebrow}</p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-report-text sm:text-[1.7rem]">{title}</h2>
    </div>
  )
}

// One premium metric. `value` is a raw number (a genuine 0 reads as no useful
// figure, so it shows softly); `text` is for label-style values like a platform.
function MetricStat({ label, value, text }: { label: string; value?: number; text?: string | null }) {
  const hasNumber = typeof value === 'number' && value > 0
  const display = text != null ? text : hasNumber ? formatNumber(value as number) : null

  return (
    <div className="relative overflow-hidden rounded-2xl bg-report-surface px-5 py-6 shadow-[0_24px_50px_-36px_rgba(0,0,0,0.9)] sm:px-6 sm:py-7">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-report-accent/40 to-transparent" />
      <p className="text-[0.7rem] uppercase tracking-[0.16em] text-report-faint">{label}</p>
      {display ? (
        <p className="mt-3 font-display text-3xl font-semibold leading-none text-report-text sm:text-4xl">{display}</p>
      ) : (
        <p className="mt-3 text-sm font-medium text-report-faint">Data unavailable</p>
      )}
    </div>
  )
}

function MovementChip({ label, movement }: { label: string; movement: MetricMovement }) {
  const up = (movement.difference ?? 0) > 0
  const down = (movement.difference ?? 0) < 0
  const arrow = up ? '↑' : down ? '↓' : '→'
  const tone = up ? 'text-report-accent' : down ? 'text-[#d8a07a]' : 'text-report-faint'
  const detail =
    movement.percent !== null
      ? `${arrow} ${formatPercent(movement.percent)} vs last month`
      : `${arrow} ${movement.difference! > 0 ? '+' : ''}${formatNumber(movement.difference!)} vs last month`

  return (
    <div className="rounded-2xl bg-report-surface px-5 py-5 shadow-[0_24px_50px_-36px_rgba(0,0,0,0.9)]">
      <p className="text-[0.7rem] uppercase tracking-[0.16em] text-report-faint">{label}</p>
      <p className="mt-2.5 font-display text-2xl font-semibold leading-none text-report-text">{formatNumber(movement.current)}</p>
      <p className={`mt-2 text-xs font-medium ${tone}`}>{detail}</p>
    </div>
  )
}

function TopContentSection({
  master,
  strategy,
}: {
  master: MasterReportData
  strategy: ReturnType<typeof readStrategyData>
}) {
  const tc = strategy.topContent
  const best = master.bestPostOverall

  const caption = (tc.autoCaption && tc.autoCaption.trim()) || (best ? shortCaption(best.caption) : null)
  const coverImage = tc.coverImageUrl.trim()
  const hasAnything = Boolean(caption || coverImage || tc.whyItWorked.length > 0 || tc.whatThisTellsUs.trim())
  if (!hasAnything) return null

  const contentType = tc.contentType.trim() || (best?.post_type ? displayContentType(best.post_type) : null)
  const platformLabel =
    (best?.platform && PLATFORM_LABELS[best.platform]) ||
    (tc.autoPlatform && PLATFORM_LABELS[tc.autoPlatform]) ||
    null
  const metricValue = best ? best.engagements : typeof tc.autoMetricValue === 'number' ? tc.autoMetricValue : null

  return (
    <section className="mb-12">
      <SectionHeading eyebrow="Top content" title="The standout this month" />
      <div className="overflow-hidden rounded-3xl bg-report-surface shadow-[0_30px_60px_-44px_rgba(0,0,0,0.9)]">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative min-h-[14rem] bg-[radial-gradient(120%_120%_at_20%_10%,rgba(111,179,165,0.28),transparent_60%),radial-gradient(120%_120%_at_100%_100%,rgba(216,180,138,0.2),transparent_55%)]">
            {coverImage ? (
              <img
                src={coverImage}
                alt="Top content"
                className="h-full max-h-80 w-full object-cover"
                onError={e => {
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <div className="flex h-full min-h-[14rem] flex-col items-center justify-center gap-3 p-8 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-report-elevated/80 text-report-accent">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16l5-5 4 4 3-3 6 6M4 6h16v12H4z" />
                  </svg>
                </span>
                <p className="text-sm font-medium text-report-muted">{contentType ?? 'Featured content'}</p>
              </div>
            )}
          </div>
          <div className="p-7 sm:p-9">
            <div className="flex flex-wrap gap-2">
              {contentType && <SoftPill tone="accent">{contentType}</SoftPill>}
              {platformLabel && <SoftPill>{platformLabel}</SoftPill>}
            </div>
            {caption && (
              <h3 className="mt-4 font-display text-xl font-semibold leading-snug text-report-text sm:text-2xl">{caption}</h3>
            )}
            {metricValue != null && metricValue > 0 && (
              <p className="mt-5 flex items-baseline gap-2">
                <span className="font-display text-3xl font-semibold text-report-text">{formatNumber(metricValue)}</span>
                <span className="text-sm text-report-muted">engagements</span>
              </p>
            )}
            {tc.whyItWorked.length > 0 && (
              <div className="mt-6">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-report-faint">Why it worked</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {tc.whyItWorked.map((item, index) => (
                    <SoftPill key={index}>{item}</SoftPill>
                  ))}
                </div>
              </div>
            )}
            {tc.whatThisTellsUs.trim() && (
              <p className="mt-6 text-[0.95rem] leading-relaxed text-report-muted whitespace-pre-line">{tc.whatThisTellsUs}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function SoftPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' }) {
  const classes =
    tone === 'accent'
      ? 'bg-report-accent/15 text-report-accent'
      : 'bg-report-elevated text-report-muted'
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${classes}`}>{children}</span>
}

function PlatformSummaryCard({ view }: { view: PlatformView }) {
  return (
    <article className="rounded-2xl bg-report-surface p-5 shadow-[0_24px_50px_-38px_rgba(0,0,0,0.9)] sm:p-6">
      <p className="font-display text-lg font-semibold text-report-text">{view.label}</p>
      <dl className="mt-4 space-y-0">
        <PlatformRow label="Reach" value={formatNumber(view.reach)} />
        <PlatformRow label="Views" value={formatNumber(view.views)} />
        <PlatformRow label="Engagements" value={formatNumber(view.engagements)} />
        {view.source === 'posts' && <PlatformRow label="Posts" value={formatNumber(view.postCount)} />}
      </dl>
      {view.bestPost?.caption && (
        <p className="mt-4 line-clamp-2 text-xs leading-relaxed text-report-faint">
          <span className="text-report-muted">Top post · </span>
          {shortCaption(view.bestPost.caption, 'Post')}
        </p>
      )}
    </article>
  )
}

function PlatformRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-report-line/50 py-2 last:border-0">
      <dt className="text-sm text-report-muted">{label}</dt>
      <dd className="text-sm font-semibold text-report-text">{value}</dd>
    </div>
  )
}

// ─── platform drill-down tabs ─────────────────────────────────────────────────

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
      <div className="rounded-2xl bg-report-surface p-8 sm:p-10">
        <h2 className="font-display text-xl font-semibold text-report-text">{view.label}</h2>
        <p className="mt-2 text-sm text-report-muted">No data for this platform this month.</p>
      </div>
    )
  }
  if (view.source === 'manual') return <ManualPlatformTab view={view} previousManual={previousManual} />
  return <PostsPlatformTab view={view} previousView={previousView} />
}

function PostsPlatformTab({ view, previousView }: { view: PlatformView; previousView: PlatformView | null }) {
  const growth = [
    { label: 'Views', m: compareMetric(view.views, previousView?.views) },
    { label: 'Reach', m: compareMetric(view.reach, previousView?.reach) },
    { label: 'Engagements', m: compareMetric(view.engagements, previousView?.engagements) },
  ].filter(g => g.m.direction !== 'missing' && g.m.difference !== null)

  return (
    <>
      <SectionHeading eyebrow={view.label} title={`${view.label} at a glance`} />
      <section className="mb-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricStat label="Reach" value={view.reach} />
        <MetricStat label="Views" value={view.views} />
        <MetricStat label="Engagements" value={view.engagements} />
        <MetricStat label="Posts" value={view.postCount} />
      </section>

      {growth.length > 0 && (
        <section className="mb-12">
          <SectionHeading eyebrow="Momentum" title="Versus last month" />
          <div className="grid gap-3 sm:grid-cols-3">
            {growth.map(g => (
              <MovementChip key={g.label} label={g.label} movement={g.m} />
            ))}
          </div>
        </section>
      )}

      {view.bestPost && (
        <section className="mb-12">
          <SectionHeading eyebrow="Top content" title={`Best ${view.label} post`} />
          <div className="rounded-3xl bg-report-surface p-7 shadow-[0_30px_60px_-44px_rgba(0,0,0,0.9)] sm:p-9">
            <div className="flex flex-wrap gap-2">
              {view.bestPost.post_type && (
                <SoftPill tone="accent">{displayContentType(view.bestPost.post_type) ?? view.bestPost.post_type}</SoftPill>
              )}
              <SoftPill>{formatDate(view.bestPost.publish_time)}</SoftPill>
            </div>
            <h3 className="mt-4 font-display text-xl font-semibold leading-snug text-report-text sm:text-2xl">
              {shortCaption(view.bestPost.caption)}
            </h3>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <MiniMetric label="Reach" value={formatNumber(view.bestPost.reach)} />
              <MiniMetric label="Views" value={formatNumber(view.bestPost.impressions)} />
              <MiniMetric label="Engagements" value={formatNumber(view.bestPost.engagements)} />
            </div>
          </div>
        </section>
      )}

      {view.topPosts.length > 0 && (
        <section className="mb-4">
          <SectionHeading eyebrow="Highlights" title={`Top ${view.label} posts`} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {view.topPosts.map((post, index) => (
              <article key={post.id} className="rounded-2xl bg-report-surface p-5 shadow-[0_24px_50px_-38px_rgba(0,0,0,0.9)]">
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg font-semibold text-report-accent">#{index + 1}</span>
                  <span className="text-[11px] text-report-faint">{formatDate(post.publish_time)}</span>
                </div>
                <p className="mt-3 text-sm leading-snug text-report-text">{shortCaption(post.caption, 'Post')}</p>
                {post.post_type && (
                  <p className="mt-2 text-xs text-report-faint">{displayContentType(post.post_type) ?? post.post_type}</p>
                )}
                <p className="mt-3 text-sm text-report-muted">{formatNumber(post.engagements)} engagements</p>
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
    { label: 'Views', m: compareMetric(view.views, previousManual?.views) },
    { label: 'Reach', m: compareMetric(view.reach, previousManual?.reach) },
    { label: 'Engagements', m: compareMetric(view.engagements, previousManual?.engagements) },
    { label: 'Followers', m: compareMetric(manual.followers, previousManual?.followers) },
  ].filter(g => g.m.direction !== 'missing' && g.m.difference !== null)

  return (
    <>
      <SectionHeading eyebrow={view.label} title={`${view.label} at a glance`} />
      <section className="mb-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricStat label="Reach" value={view.reach} />
        <MetricStat label="Views" value={view.views} />
        <MetricStat label="Engagements" value={view.engagements} />
        <MetricStat label="Followers" value={manual.followers} />
      </section>

      {growth.length > 0 && (
        <section className="mb-12">
          <SectionHeading eyebrow="Momentum" title="Versus last month" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {growth.map(g => (
              <MovementChip key={g.label} label={g.label} movement={g.m} />
            ))}
          </div>
        </section>
      )}

      {notes.length > 0 && (
        <section className="mb-4 grid gap-4 lg:grid-cols-2">
          {notes.map(note => (
            <article key={note.title} className="rounded-2xl bg-report-surface p-6 shadow-[0_24px_50px_-38px_rgba(0,0,0,0.9)]">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-report-faint">{note.title}</p>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-report-text whitespace-pre-line">{note.text}</p>
            </article>
          ))}
        </section>
      )}
    </>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-report-elevated/70 p-4">
      <p className="text-[0.65rem] uppercase tracking-[0.14em] text-report-faint">{label}</p>
      <p className="mt-1.5 font-display text-lg font-semibold text-report-text">{value}</p>
    </div>
  )
}

// Legacy reports (pre guided-strategy) — render only the cards that have text.
// Never shows an empty "no notes" block on the client view.
function LegacyStrategySection({
  report,
  showEmptyStrategy,
}: {
  report: ReportWithPosts
  showEmptyStrategy: boolean
}) {
  const cards = [
    { title: 'Key takeaways', text: report.general_notes },
    { title: 'What worked', text: report.performance_comments },
    { title: 'Opportunities', text: report.previous_month_reflection },
    { title: 'Next month focus', text: report.strategy_next_month },
    {
      title: 'Recommended actions',
      text: [report.content_direction_next_month, report.boost_recommendation].filter(Boolean).join('\n\n') || null,
    },
  ].filter(card => card.text && card.text.trim())

  if (cards.length === 0) {
    // Admin preview gets a gentle hint; the real client view shows nothing.
    if (!showEmptyStrategy) return null
    return (
      <p className="rounded-2xl bg-report-surface p-6 text-sm text-report-faint">
        Strategy for this month will appear here once it is added in the editor.
      </p>
    )
  }

  return (
    <section className="mb-4">
      <SectionHeading eyebrow="Looking ahead" title="Strategy & next steps" />
      <div className="grid gap-4 lg:grid-cols-2">
        {cards.map(card => (
          <article key={card.title} className="rounded-2xl bg-report-surface p-6 shadow-[0_24px_50px_-38px_rgba(0,0,0,0.9)]">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-report-faint">{card.title}</p>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-report-text whitespace-pre-line">{card.text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

// ─── client shell + states ────────────────────────────────────────────────────

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
    <div className="min-h-screen bg-report-bg font-sans text-report-text bg-[radial-gradient(110%_90%_at_50%_-10%,rgba(111,179,165,0.08),transparent_60%)]">
      <header className="sticky top-0 z-30 border-b border-report-line/50 bg-report-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          {client ? (
            <div className="flex items-center gap-3">
              <ClientLogo
                client={client}
                boxClassName="h-11 w-11 rounded-xl"
                padding="p-1.5"
                frameClassName={LOGO_FRAME}
                textClassName="text-sm font-semibold text-report-accent"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight text-report-text">{client.name}</p>
                <p className="mt-0.5 truncate text-xs text-report-faint">Client portal</p>
              </div>
            </div>
          ) : (
            <BrandMark subtitle="Client portal" size="report" />
          )}
          {action}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  )
}

export function EmptyReportState({ title, message }: { title: string; message: string }) {
  return (
    <div className="max-w-xl rounded-3xl bg-report-surface p-8 shadow-[0_30px_60px_-44px_rgba(0,0,0,0.9)] sm:p-10">
      <h1 className="font-display text-2xl font-semibold text-report-text">{title}</h1>
      <p className="mt-3 text-[0.95rem] leading-relaxed text-report-muted">{message}</p>
    </div>
  )
}
