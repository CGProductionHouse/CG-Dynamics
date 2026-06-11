import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getLatestPublishedReportForClient, type ReportWithPosts } from '../../lib/db/reports'
import {
  calculateReportStats,
  formatDate,
  formatNumber,
  reportPostToStatsPost,
  shortCaption,
} from '../../lib/reportStats'

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return fallback
}

export default function Dashboard() {
  const { profile, signOut } = useAuth()
  const [report, setReport] = useState<ReportWithPosts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadReport() {
      if (!profile?.client_id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const { data, error } = await getLatestPublishedReportForClient(profile.client_id)
        if (error) {
          setError(error.message)
        } else {
          setReport(data)
        }
      } catch (error) {
        setError(errorMessage(error, 'Could not load your latest report.'))
      } finally {
        setLoading(false)
      }
    }

    void loadReport()
  }, [profile?.client_id])

  const statsPosts = useMemo(() => report?.posts.map(reportPostToStatsPost) ?? [], [report])
  const stats = useMemo(() => calculateReportStats(statsPosts), [statsPosts])

  if (!profile?.client_id) {
    return (
      <Shell onSignOut={signOut}>
        <EmptyState
          title="Your account is pending setup"
          message="Your client access has not been linked yet. Contact your account manager to get access."
        />
      </Shell>
    )
  }

  if (loading) {
    return (
      <Shell onSignOut={signOut}>
        <p className="text-brand-primary text-sm">Loading your report...</p>
      </Shell>
    )
  }

  if (error) {
    return (
      <Shell onSignOut={signOut}>
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
          {error}
        </p>
      </Shell>
    )
  }

  if (!report) {
    return (
      <Shell onSignOut={signOut}>
        <EmptyState
          title="No published report yet"
          message="Your latest report will appear here as soon as it is published by CG Production House."
        />
      </Shell>
    )
  }

  return (
    <Shell onSignOut={signOut}>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-brand-primary mb-2">Client report</p>
          <h1 className="text-3xl font-semibold text-white">
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

      <section className="grid gap-4 lg:grid-cols-4 mb-6">
        <StatCard label="Total reach" value={formatNumber(stats.totalReach)} />
        <StatCard label="Impressions" value={formatNumber(stats.totalImpressions)} />
        <StatCard label="Engagements" value={formatNumber(stats.totalEngagements)} />
        <StatCard label="Posts" value={formatNumber(stats.postCount)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr] mb-6">
        <div className="bg-brand-surface border border-brand-muted rounded-xl p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-brand-primary mb-3">Best performing post</p>
          {stats.bestPost ? (
            <div>
              <h2 className="text-xl font-semibold text-white leading-snug">
                {shortCaption(stats.bestPost.caption)}
              </h2>
              <p className="text-sm text-brand-primary mt-2">{formatDate(stats.bestPost.publish_time)}</p>
              <div className="grid grid-cols-3 gap-3 mt-5">
                <MiniMetric label="Reach" value={formatNumber(stats.bestPost.reach)} />
                <MiniMetric label="Impressions" value={formatNumber(stats.bestPost.impressions)} />
                <MiniMetric label="Engagements" value={formatNumber(stats.bestPost.engagements)} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-brand-primary">No post data was attached to this report.</p>
          )}
        </div>

        <div className="bg-brand-surface border border-brand-muted rounded-xl p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-brand-primary mb-3">Performance comments</p>
          <p className="text-sm text-white leading-relaxed whitespace-pre-line">
            {report.performance_comments || 'Performance commentary will appear here once added by your account manager.'}
          </p>
        </div>
      </section>

      <section className="bg-brand-surface border border-brand-muted rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Top posts</h2>
          <span className="text-xs text-brand-primary">Ranked by engagement</span>
        </div>
        <div className="grid gap-3 lg:grid-cols-5">
          {stats.topPosts.map((post, index) => (
            <article key={post.id} className="bg-brand-bg/60 border border-brand-muted rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-brand-accent text-sm font-semibold">#{index + 1}</span>
                <span className="text-[11px] text-brand-primary">{formatDate(post.publish_time)}</span>
              </div>
              <p className="text-sm text-white leading-snug">{shortCaption(post.caption, 'Post')}</p>
              <p className="text-xs text-brand-primary mt-3">
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
    </Shell>
  )
}

function Shell({
  children,
  onSignOut,
}: {
  children: ReactNode
  onSignOut: () => Promise<void>
}) {
  return (
    <div className="min-h-screen bg-brand-bg">
      <header className="border-b border-brand-muted bg-brand-surface/80">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-brand-accent font-bold text-base leading-tight">CG Dynamics</p>
            <p className="text-xs text-brand-primary mt-0.5">Client dashboard</p>
          </div>
          <button
            onClick={onSignOut}
            className="text-sm text-brand-primary hover:text-brand-accent transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="bg-brand-surface border border-brand-muted rounded-xl p-10 max-w-xl">
      <h1 className="text-2xl font-semibold text-white mb-3">{title}</h1>
      <p className="text-sm text-brand-primary leading-relaxed">{message}</p>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-brand-surface border border-brand-muted rounded-xl p-6 shadow-[0_0_40px_rgba(45,212,191,0.05)]">
      <p className="text-xs uppercase tracking-[0.18em] text-brand-primary">{label}</p>
      <p className="text-3xl font-semibold text-white mt-4">{value}</p>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-brand-bg/70 border border-brand-muted rounded-lg p-4">
      <p className="text-[10px] uppercase tracking-[0.14em] text-brand-primary">{label}</p>
      <p className="text-base font-semibold text-white mt-2">{value}</p>
    </div>
  )
}

function StrategyCard({ title, text }: { title: string; text: string | null }) {
  return (
    <article className="bg-brand-surface border border-brand-muted rounded-xl p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-brand-primary mb-3">{title}</p>
      <p className="text-sm text-white leading-relaxed whitespace-pre-line">
        {text || 'No notes added yet.'}
      </p>
    </article>
  )
}
