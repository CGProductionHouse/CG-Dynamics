import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ReportWithPosts } from '../../lib/db/reports'
import type { ManualPlatformMetric } from '../../lib/db/manualMetrics'
import { MANUAL_SOURCE_LABELS } from '../../lib/db/manualMetrics'
import type { MasterReportData, Platform, PlatformView, ReportStatsPost } from '../../lib/reportStats'
import {
  PLATFORMS,
  PLATFORM_LABELS,
  buildMasterReport,
  formatDate,
  formatNumber,
  reportPostToStatsPost,
  shortCaption,
} from '../../lib/reportStats'

type TabKey = 'overview' | Platform

export function ClientReportView({
  report,
  manualMetrics = [],
}: {
  report: ReportWithPosts
  manualMetrics?: ManualPlatformMetric[]
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

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    ...PLATFORMS.map(platform => ({ key: platform as TabKey, label: PLATFORM_LABELS[platform] })),
  ]

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:mb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-brand-primary mb-2">Monthly master report</p>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">
            {report.report_title || 'Monthly Performance Report'}
          </h1>
          <p className="text-sm text-brand-primary mt-2">
            {formatDate(report.period_start)} to {formatDate(report.period_end)}
          </p>
        </div>
        <div className="border border-brand-accent/30 bg-brand-accent/10 text-brand-accent rounded-lg px-3 py-2 text-xs font-semibold">
          Published report
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-brand-muted pb-3">
        {tabs.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === item.key
                ? 'bg-brand-accent text-brand-bg'
                : 'border border-brand-muted text-brand-primary hover:text-white hover:border-white/30'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <OverviewTab report={report} master={master} />
      ) : (
        <PlatformTab view={master.platforms.find(item => item.platform === tab)!} />
      )}
    </>
  )
}

function OverviewTab({ report, master }: { report: ReportWithPosts; master: MasterReportData }) {
  return (
    <>
      <section className="grid grid-cols-2 gap-3 mb-6 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Overall reach" value={formatNumber(master.totalReach)} />
        <StatCard label="Overall views" value={formatNumber(master.totalViews)} />
        <StatCard label="Overall engagements" value={formatNumber(master.totalEngagements)} />
        <StatCard label="Best platform" value={master.bestPlatform ? master.bestPlatform.label : 'No data yet'} />
      </section>

      <section className="bg-brand-surface border border-brand-muted rounded-xl p-5 mb-6 sm:p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-brand-primary mb-3">Best post overall</p>
        {master.bestPostOverall ? (
          <div>
            <h2 className="text-lg font-semibold text-white leading-snug sm:text-xl">
              {shortCaption(master.bestPostOverall.caption)}
            </h2>
            <p className="text-sm text-brand-primary mt-2">
              {master.bestPostOverall.platform ? `${PLATFORM_LABELS[master.bestPostOverall.platform]} · ` : ''}
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

      <section className="grid gap-4 lg:grid-cols-2">
        <StrategyCard title="Previous month strategy" text={report.previous_month_strategy} />
        <StrategyCard title="Previous month reflection" text={report.previous_month_reflection} />
        <StrategyCard title="Strategy for next month" text={report.strategy_next_month} />
        <StrategyCard title="Content direction" text={report.content_direction_next_month} />
        <StrategyCard title="Boosting recommendation" text={report.boost_recommendation} />
        <StrategyCard title="General notes" text={report.general_notes} />
      </section>
    </>
  )
}

function PlatformTab({ view }: { view: PlatformView }) {
  if (view.source === 'none') {
    return (
      <div className="bg-brand-surface border border-brand-muted rounded-xl p-6 sm:p-10">
        <h2 className="text-lg font-semibold text-white mb-2">{view.label}</h2>
        <p className="text-sm text-brand-primary">No data uploaded yet.</p>
      </div>
    )
  }

  if (view.source === 'manual') {
    return <ManualPlatformTab view={view} />
  }

  return <PostsPlatformTab view={view} />
}

function PostsPlatformTab({ view }: { view: PlatformView }) {
  return (
    <>
      <section className="grid grid-cols-2 gap-3 mb-6 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Reach" value={formatNumber(view.reach)} />
        <StatCard label="Views" value={formatNumber(view.views)} />
        <StatCard label="Engagements" value={formatNumber(view.engagements)} />
        <StatCard label="Posts" value={formatNumber(view.postCount)} />
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

function ManualPlatformTab({ view }: { view: PlatformView }) {
  const manual = view.manual!
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

      <section className="grid gap-4 lg:grid-cols-2">
        <StrategyCard title="Top content" text={manual.top_content_notes} />
        <StrategyCard title="Content type split" text={manual.content_type_split_notes} />
        <StrategyCard title="General notes" text={manual.general_notes} />
      </section>
    </>
  )
}

export function ClientDashboardShell({
  children,
  action,
}: {
  children: ReactNode
  action: ReactNode
}) {
  return (
    <div className="min-h-screen bg-brand-bg">
      <header className="border-b border-brand-muted bg-brand-surface/80">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-3 sm:px-6">
          <div>
            <p className="text-brand-accent font-bold text-base leading-tight">CG Dynamics</p>
            <p className="text-xs text-brand-primary mt-0.5">Client dashboard</p>
          </div>
          {action}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  )
}

export function EmptyReportState({ title, message }: { title: string; message: string }) {
  return (
    <div className="bg-brand-surface border border-brand-muted rounded-xl p-6 max-w-xl sm:p-10">
      <h1 className="text-2xl font-semibold text-white mb-3">{title}</h1>
      <p className="text-base text-brand-primary leading-relaxed sm:text-sm">{message}</p>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-brand-surface border border-brand-muted rounded-xl p-5 shadow-[0_0_40px_rgba(45,212,191,0.05)] sm:p-6">
      <p className="text-xs uppercase tracking-[0.12em] text-brand-primary sm:tracking-[0.18em]">{label}</p>
      <p className="text-2xl font-semibold text-white mt-4 break-words sm:text-3xl">{value}</p>
    </div>
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

function StrategyCard({ title, text }: { title: string; text: string | null }) {
  return (
    <article className="bg-brand-surface border border-brand-muted rounded-xl p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-brand-primary mb-3">{title}</p>
      <p className="text-base text-white leading-relaxed whitespace-pre-line sm:text-sm">
        {text || 'No notes added yet.'}
      </p>
    </article>
  )
}
