import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ReportWithPosts } from '../../lib/db/reports'
import type { PlatformBreakdown, Platform, ReportStats, ReportStatsPost } from '../../lib/reportStats'
import {
  PLATFORMS,
  PLATFORM_LABELS,
  bestPlatform,
  calculatePlatformBreakdowns,
  calculateReportStats,
  formatDate,
  formatNumber,
  reportPostToStatsPost,
  shortCaption,
} from '../../lib/reportStats'

type TabKey = 'overview' | Platform

export function ClientReportView({ report }: { report: ReportWithPosts }) {
  const [tab, setTab] = useState<TabKey>('overview')

  const statsPosts = useMemo<ReportStatsPost[]>(
    () => report.posts.map(reportPostToStatsPost),
    [report]
  )
  const overall = useMemo(() => calculateReportStats(statsPosts), [statsPosts])
  const breakdowns = useMemo(() => calculatePlatformBreakdowns(statsPosts), [statsPosts])
  const topPlatform = useMemo(() => bestPlatform(breakdowns), [breakdowns])

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
        <OverviewTab report={report} overall={overall} topPlatform={topPlatform} />
      ) : (
        <PlatformTab breakdown={breakdowns.find(item => item.platform === tab)!} />
      )}
    </>
  )
}

function OverviewTab({
  report,
  overall,
  topPlatform,
}: {
  report: ReportWithPosts
  overall: ReportStats
  topPlatform: PlatformBreakdown | null
}) {
  return (
    <>
      <section className="grid grid-cols-2 gap-3 mb-6 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Overall reach" value={formatNumber(overall.totalReach)} />
        <StatCard label="Overall views" value={formatNumber(overall.totalImpressions)} />
        <StatCard label="Overall engagements" value={formatNumber(overall.totalEngagements)} />
        <StatCard label="Best platform" value={topPlatform ? topPlatform.label : 'No data yet'} />
      </section>

      <section className="bg-brand-surface border border-brand-muted rounded-xl p-5 mb-6 sm:p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-brand-primary mb-3">Best post overall</p>
        {overall.bestPost ? (
          <div>
            <h2 className="text-lg font-semibold text-white leading-snug sm:text-xl">
              {shortCaption(overall.bestPost.caption)}
            </h2>
            <p className="text-sm text-brand-primary mt-2">
              {overall.bestPost.platform ? `${PLATFORM_LABELS[overall.bestPost.platform]} · ` : ''}
              {formatDate(overall.bestPost.publish_time)}
            </p>
            <div className="grid grid-cols-1 gap-3 mt-5 sm:grid-cols-3">
              <MiniMetric label="Reach" value={formatNumber(overall.bestPost.reach)} />
              <MiniMetric label="Views" value={formatNumber(overall.bestPost.impressions)} />
              <MiniMetric label="Engagements" value={formatNumber(overall.bestPost.engagements)} />
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

function PlatformTab({ breakdown }: { breakdown: PlatformBreakdown }) {
  if (!breakdown.hasData) {
    return (
      <div className="bg-brand-surface border border-brand-muted rounded-xl p-6 sm:p-10">
        <h2 className="text-lg font-semibold text-white mb-2">{breakdown.label}</h2>
        <p className="text-sm text-brand-primary">No data uploaded yet.</p>
      </div>
    )
  }

  const { stats } = breakdown

  return (
    <>
      <section className="grid grid-cols-2 gap-3 mb-6 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Reach" value={formatNumber(stats.totalReach)} />
        <StatCard label="Views" value={formatNumber(stats.totalImpressions)} />
        <StatCard label="Engagements" value={formatNumber(stats.totalEngagements)} />
        <StatCard label="Posts" value={formatNumber(stats.postCount)} />
      </section>

      <section className="bg-brand-surface border border-brand-muted rounded-xl p-5 mb-6 sm:p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-brand-primary mb-3">
          Best {breakdown.label} post
        </p>
        {stats.bestPost ? (
          <div>
            <h2 className="text-lg font-semibold text-white leading-snug sm:text-xl">
              {shortCaption(stats.bestPost.caption)}
            </h2>
            <p className="text-sm text-brand-primary mt-2">{formatDate(stats.bestPost.publish_time)}</p>
            <div className="grid grid-cols-1 gap-3 mt-5 sm:grid-cols-3">
              <MiniMetric label="Reach" value={formatNumber(stats.bestPost.reach)} />
              <MiniMetric label="Views" value={formatNumber(stats.bestPost.impressions)} />
              <MiniMetric label="Engagements" value={formatNumber(stats.bestPost.engagements)} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-brand-primary">No data uploaded yet.</p>
        )}
      </section>

      <section className="bg-brand-surface border border-brand-muted rounded-xl p-5 sm:p-6">
        <div className="flex flex-col gap-1 mb-5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-white">Top {breakdown.label} posts</h2>
          <span className="text-sm text-brand-primary sm:text-xs">Ranked by engagement</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {stats.topPosts.map((post, index) => (
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
