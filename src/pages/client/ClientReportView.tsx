import type { ReactNode } from 'react'
import type { ReportWithPosts } from '../../lib/db/reports'
import type { ReportStats } from '../../lib/reportStats'
import { formatDate, formatNumber, shortCaption } from '../../lib/reportStats'

export function ClientReportView({
  report,
  stats,
}: {
  report: ReportWithPosts
  stats: ReportStats
}) {
  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:mb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-brand-primary mb-2">Client report</p>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">
            {report.report_title || 'Meta Performance Report'}
          </h1>
          <p className="text-sm text-brand-primary mt-2">
            {formatDate(report.period_start)} to {formatDate(report.period_end)}
          </p>
        </div>
        <div className="border border-brand-accent/30 bg-brand-accent/10 text-brand-accent rounded-lg px-3 py-2 text-xs font-semibold">
          Published report
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 mb-6 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total reach" value={formatNumber(stats.totalReach)} />
        <StatCard label="Views" value={formatNumber(stats.totalImpressions)} />
        <StatCard label="Engagements" value={formatNumber(stats.totalEngagements)} />
        <StatCard label="Posts" value={formatNumber(stats.postCount)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr] mb-6">
        <div className="bg-brand-surface border border-brand-muted rounded-xl p-5 sm:p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-brand-primary mb-3">Best performing post</p>
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
            <p className="text-sm text-brand-primary">No post data was attached to this report.</p>
          )}
        </div>

        <div className="bg-brand-surface border border-brand-muted rounded-xl p-5 sm:p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-brand-primary mb-3">Performance comments</p>
          <p className="text-sm text-white leading-relaxed whitespace-pre-line">
            {report.performance_comments || 'Performance commentary will appear here once added by your account manager.'}
          </p>
        </div>
      </section>

      <section className="bg-brand-surface border border-brand-muted rounded-xl p-5 mb-6 sm:p-6">
        <div className="flex flex-col gap-1 mb-5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-white">Top posts</h2>
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
