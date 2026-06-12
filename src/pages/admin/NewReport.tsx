import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { listClients, type Client } from '../../lib/db/clients'
import { listImportedMetaPosts, type ImportedMetaPost } from '../../lib/db/importedMetaPosts'
import { getReportWithPosts, saveReport, type ReportStatus } from '../../lib/db/reports'
import {
  MANUAL_SOURCE_LABELS,
  listManualMetricsForClient,
  type ManualPlatformMetric,
} from '../../lib/db/manualMetrics'
import { detectReportPeriod, formatReportPeriod, previousReportMonth, reportMonth } from '../../lib/reportPeriod'
import {
  PLATFORM_LABELS,
  buildPerformanceMovement,
  buildMasterReport,
  calculateReportStats,
  formatDate,
  formatNumber,
  formatPercent,
  importedToStatsPost,
  shortCaption,
  type MetricMovement,
} from '../../lib/reportStats'

interface ReportFields {
  reportTitle: string
  previousMonthStrategy: string
  previousMonthReflection: string
  performanceComments: string
  strategyNextMonth: string
  contentDirectionNextMonth: string
  boostRecommendation: string
  generalNotes: string
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return fallback
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function monthStartInputValue() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function monthName(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return month || 'No month selected'
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${month}-01T00:00:00`))
}

function postMonth(post: ImportedMetaPost) {
  if (!post.publish_time) return null
  const time = new Date(post.publish_time)
  if (Number.isNaN(time.getTime())) return null
  return time.toISOString().slice(0, 7)
}

function buildPrompt(
  clientName: string,
  periodStart: string,
  periodEnd: string,
  fields: ReportFields,
  statsText: string
) {
  return [
    `You are helping CG Production House write a premium monthly Meta performance report for ${clientName}.`,
    '',
    `Report title: ${fields.reportTitle || `${clientName} Meta Performance Report`}`,
    `Period: ${periodStart} to ${periodEnd}`,
    '',
    'Performance stats:',
    statsText,
    '',
    'Admin notes and strategy fields:',
    `Previous month strategy: ${fields.previousMonthStrategy || 'Not provided yet.'}`,
    `Previous month reflection: ${fields.previousMonthReflection || 'Not provided yet.'}`,
    `Performance comments: ${fields.performanceComments || 'Not provided yet.'}`,
    `Strategy for next month: ${fields.strategyNextMonth || 'Not provided yet.'}`,
    `Content direction for next month: ${fields.contentDirectionNextMonth || 'Not provided yet.'}`,
    `Boosting recommendation: ${fields.boostRecommendation || 'Not provided yet.'}`,
    `General notes: ${fields.generalNotes || 'Not provided yet.'}`,
    '',
    'Please turn this into concise, client-ready strategic commentary. Keep the tone polished, clear, commercially useful, and aligned with a premium social media analytics report.',
  ].join('\n')
}

export default function NewReport() {
  const { reportId } = useParams()
  const { profile } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [periodStart, setPeriodStart] = useState(monthStartInputValue())
  const [periodEnd, setPeriodEnd] = useState(todayInputValue())
  const [periodSource, setPeriodSource] = useState<'publish_time' | 'filename' | null>(null)
  const [periodBatchId, setPeriodBatchId] = useState<string | null>(null)
  const [importedPosts, setImportedPosts] = useState<ImportedMetaPost[]>([])
  const [manualMetrics, setManualMetrics] = useState<ManualPlatformMetric[]>([])
  const [fields, setFields] = useState<ReportFields>({
    reportTitle: '',
    previousMonthStrategy: '',
    previousMonthReflection: '',
    performanceComments: '',
    strategyNextMonth: '',
    contentDirectionNextMonth: '',
    boostRecommendation: '',
    generalNotes: '',
  })
  const [savedReportId, setSavedReportId] = useState<string | null>(null)
  const [reportStatus, setReportStatus] = useState<ReportStatus>('draft')
  const [aiPrompt, setAiPrompt] = useState('')
  const [loading, setLoading] = useState(true)
  const [postsLoading, setPostsLoading] = useState(false)
  const [saving, setSaving] = useState<ReportStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    async function loadClients() {
      setLoading(true)
      setError(null)
      try {
        const { data, error } = await listClients()
        if (error) {
          setError(error.message)
        } else {
          setClients(data)
          setClientId(data[0]?.id ?? '')
        }
      } catch (error) {
        setError(errorMessage(error, 'Could not load clients.'))
      } finally {
        setLoading(false)
      }
    }

    void loadClients()
  }, [])

  useEffect(() => {
    if (!reportId) return
    const reportIdToLoad = reportId

    async function loadReportForEdit() {
      setLoading(true)
      setError(null)
      try {
        const { data, error } = await getReportWithPosts(reportIdToLoad)
        if (error || !data) {
          setError(error?.message ?? 'Could not load this report.')
          return
        }

        setSavedReportId(data.id)
        setClientId(data.client_id)
        setPeriodStart(data.period_start)
        setPeriodEnd(data.period_end)
        setPeriodSource(null)
        setPeriodBatchId(null)
        setReportStatus(data.status)
        setFields({
          reportTitle: data.report_title ?? '',
          previousMonthStrategy: data.previous_month_strategy ?? '',
          previousMonthReflection: data.previous_month_reflection ?? '',
          performanceComments: data.performance_comments ?? '',
          strategyNextMonth: data.strategy_next_month ?? '',
          contentDirectionNextMonth: data.content_direction_next_month ?? '',
          boostRecommendation: data.boost_recommendation ?? '',
          generalNotes: data.general_notes ?? '',
        })
      } catch (error) {
        setError(errorMessage(error, 'Could not load this report.'))
      } finally {
        setLoading(false)
      }
    }

    void loadReportForEdit()
  }, [reportId])

  useEffect(() => {
    if (!clientId) return

    async function loadImportedPosts() {
      setPostsLoading(true)
      setError(null)
      setSuccess(null)
      try {
        const { data, error } = await listImportedMetaPosts(clientId)
        if (error) {
          setError(error.message)
        } else {
          // Master report: combine every platform imported for this client.
          const clientPosts = [...data].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
          const latestBatchId = clientPosts[0]?.import_batch_id ?? null
          const latestBatchPosts = latestBatchId
            ? clientPosts.filter(post => post.import_batch_id === latestBatchId)
            : clientPosts
          const detectedPeriod = detectReportPeriod(
            latestBatchPosts.map(post => post.publish_time),
            latestBatchPosts[0]?.source_file_name
          )

          setImportedPosts(clientPosts)
          if (detectedPeriod) {
            setPeriodStart(detectedPeriod.start)
            setPeriodEnd(detectedPeriod.end)
            setPeriodSource(detectedPeriod.source)
            setPeriodBatchId(latestBatchId)
          } else {
            setPeriodSource(null)
            setPeriodBatchId(null)
          }
        }
      } catch (error) {
        setError(errorMessage(error, 'Could not load imported posts.'))
      } finally {
        setPostsLoading(false)
      }
    }

    void loadImportedPosts()
  }, [clientId])

  // Load every manual summary for this client (all months) so we can both
  // match the report month and show what else is available.
  useEffect(() => {
    if (!clientId) {
      setManualMetrics([])
      return
    }
    let active = true
    async function loadManual() {
      const { data } = await listManualMetricsForClient(clientId)
      if (active) setManualMetrics(data)
    }
    void loadManual()
    return () => {
      active = false
    }
  }, [clientId])

  const selectedClient = clients.find(client => client.id === clientId)
  // The report month is the calendar month of the period end date.
  const currentMonth = reportMonth(periodEnd)
  const currentMonthLabel = monthName(currentMonth)
  const previousMonth = previousReportMonth(currentMonth)
  const previousMonthLabel = previousMonth ? monthName(previousMonth) : 'Previous month'
  const monthManualMetrics = useMemo(
    () => manualMetrics.filter(metric => metric.month === currentMonth),
    [manualMetrics, currentMonth]
  )
  const previousMonthManualMetrics = useMemo(
    () => previousMonth ? manualMetrics.filter(metric => metric.month === previousMonth) : [],
    [manualMetrics, previousMonth]
  )
  // Manual summaries that exist for this client but a different month.
  const otherMonthManualMetrics = useMemo(
    () => manualMetrics.filter(metric => metric.month !== currentMonth),
    [manualMetrics, currentMonth]
  )
  // Warn about platforms whose only manual data is in a different month than
  // the one this report is currently set to.
  const manualMonthMismatch = useMemo(() => {
    const currentPlatforms = new Set(monthManualMetrics.map(metric => metric.platform))
    const seen = new Set<string>()
    const labels: string[] = []
    otherMonthManualMetrics.forEach(metric => {
      if (currentPlatforms.has(metric.platform)) return
      const key = `${metric.platform}:${metric.month}`
      if (seen.has(key)) return
      seen.add(key)
      labels.push(`${PLATFORM_LABELS[metric.platform]} ${metric.month}`)
    })
    return labels
  }, [monthManualMetrics, otherMonthManualMetrics])
  const importedMonthMismatch = useMemo(() => {
    const months = new Set<string>()
    importedPosts.forEach(post => {
      const month = postMonth(post)
      if (month && month !== currentMonth) months.add(month)
    })
    return [...months].sort().map(monthName)
  }, [currentMonth, importedPosts])
  const periodImportedPosts = useMemo(() => {
    const start = periodStart ? new Date(`${periodStart}T00:00:00`).getTime() : null
    const end = periodEnd ? new Date(`${periodEnd}T23:59:59`).getTime() : null

    return importedPosts.filter(post => {
      if (!post.publish_time) {
        return periodSource === 'filename' && periodBatchId !== null && post.import_batch_id === periodBatchId
      }
      const time = new Date(post.publish_time).getTime()
      if (Number.isNaN(time)) {
        return periodSource === 'filename' && periodBatchId !== null && post.import_batch_id === periodBatchId
      }
      if (start !== null && time < start) return false
      if (end !== null && time > end) return false
      return true
    })
  }, [importedPosts, periodBatchId, periodEnd, periodSource, periodStart])
  const statsPosts = useMemo(() => periodImportedPosts.map(importedToStatsPost), [periodImportedPosts])
  const previousMonthImportedPosts = useMemo(
    () => previousMonth
      ? importedPosts.filter(post => postMonth(post) === previousMonth).map(importedToStatsPost)
      : [],
    [importedPosts, previousMonth]
  )
  const stats = useMemo(() => calculateReportStats(statsPosts), [statsPosts])
  // Combined view: CSV posts + manual summary metrics for the report month
  // (same logic the client sees).
  const master = useMemo(() => buildMasterReport(statsPosts, monthManualMetrics), [statsPosts, monthManualMetrics])
  const previousMaster = useMemo(
    () => previousMonthImportedPosts.length > 0 || previousMonthManualMetrics.length > 0
      ? buildMasterReport(previousMonthImportedPosts, previousMonthManualMetrics)
      : null,
    [previousMonthImportedPosts, previousMonthManualMetrics]
  )
  const movement = useMemo(
    () => buildPerformanceMovement(master, previousMaster, monthManualMetrics, previousMonthManualMetrics),
    [master, monthManualMetrics, previousMaster, previousMonthManualMetrics]
  )
  const statsText = [
    `Total reach: ${formatNumber(master.totalReach)}`,
    `Views: ${formatNumber(master.totalViews)}`,
    `Engagements: ${formatNumber(master.totalEngagements)}`,
    `Post count: ${formatNumber(stats.postCount)}`,
    `Best performing post: ${stats.bestPost ? shortCaption(stats.bestPost.caption) : 'None'}`,
    `Worst performing post: ${stats.worstPost ? shortCaption(stats.worstPost.caption) : 'None'}`,
    `Top posts: ${stats.topPosts.map((post, index) => `${index + 1}. ${shortCaption(post.caption)} (${formatNumber(post.engagements)} engagements)`).join('; ') || 'None'}`,
  ].join('\n')

  function updateField(key: keyof ReportFields, value: string) {
    setFields(current => ({ ...current, [key]: value }))
  }

  function handleGeneratePrompt() {
    const prompt = buildPrompt(
      selectedClient?.name ?? 'the selected client',
      periodStart,
      periodEnd,
      fields,
      statsText
    )
    setAiPrompt(prompt)
    setSuccess('AI prompt generated. Copy it into ChatGPT or Claude, then paste the improved strategy text back into the fields.')
  }

  async function handleCopyPrompt() {
    if (!aiPrompt) return
    try {
      await navigator.clipboard.writeText(aiPrompt)
      setSuccess('AI prompt copied to your clipboard.')
    } catch (error) {
      setError(errorMessage(error, 'Could not copy the prompt. You can still select and copy it manually.'))
    }
  }

  async function handleSave(status: ReportStatus) {
    if (saving) return
    if (!clientId) {
      setError('Select a client before saving.')
      return
    }
    if (!savedReportId && periodImportedPosts.length === 0 && monthManualMetrics.length === 0) {
      setError('No imported posts or manual summary metrics were found for this client and report month.')
      return
    }
    if (!periodStart || !periodEnd) {
      setError('Select a report date range before saving.')
      return
    }

    setSaving(status)
    setError(null)
    setSuccess(null)
    try {
      const { data, error } = await saveReport({
        id: savedReportId ?? undefined,
        client_id: clientId,
        period_start: periodStart,
        period_end: periodEnd,
        status,
        report_title: fields.reportTitle || `${selectedClient?.name ?? 'Client'} Monthly Report`,
        previous_month_strategy: fields.previousMonthStrategy,
        previous_month_reflection: fields.previousMonthReflection,
        performance_comments: fields.performanceComments,
        strategy_next_month: fields.strategyNextMonth,
        content_direction_next_month: fields.contentDirectionNextMonth,
        boost_recommendation: fields.boostRecommendation,
        general_notes: fields.generalNotes,
        created_by: profile?.id ?? null,
        importedPosts: periodImportedPosts.length > 0 ? periodImportedPosts : undefined,
      })

      if (error || !data) {
        setError(error?.message ?? 'Could not save this report.')
        return
      }

      setSavedReportId(data.id)
      setReportStatus(data.status)
      setSuccess(status === 'published' ? 'Report published. The client can now view it.' : 'Draft saved.')
    } catch (error) {
      setError(errorMessage(error, 'Could not save this report.'))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 lg:mb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-brand-primary mb-2">Report builder</p>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">
            {savedReportId ? 'Edit monthly master report' : 'Create monthly master report'}
          </h1>
          <p className="text-sm text-brand-primary mt-2 max-w-2xl">
            Combine every platform imported for this client and month into one master dashboard, then add the strategy commentary manually.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => handleSave('draft')}
            disabled={!!saving}
            className="w-full border border-brand-muted text-brand-primary px-4 py-2.5 rounded-lg text-sm hover:text-white hover:border-white/30 transition disabled:opacity-60 sm:w-auto"
          >
            {saving === 'draft' ? 'Saving...' : reportStatus === 'published' ? 'Save as draft' : 'Save draft'}
          </button>
          <button
            type="button"
            onClick={() => handleSave('published')}
            disabled={!!saving}
            className="w-full bg-brand-accent text-brand-bg font-semibold px-4 py-2.5 rounded-lg text-sm hover:brightness-110 transition disabled:opacity-60 sm:w-auto"
          >
            {saving === 'published' ? 'Saving...' : reportStatus === 'published' ? 'Save published' : 'Publish'}
          </button>
        </div>
      </div>

      <section className="bg-brand-surface border border-brand-muted rounded-xl p-4 mb-6 sm:p-5">
        {periodStart && periodEnd && (
          <div className="mb-4 grid gap-3 rounded-lg border border-brand-muted bg-brand-bg/50 p-3 sm:grid-cols-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-brand-primary">Report month</p>
              <p className="mt-1 text-base font-semibold text-white">{currentMonthLabel}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-brand-primary">Date range</p>
              <p className="mt-1 text-sm text-white">
                {formatReportPeriod({ start: periodStart, end: periodEnd })}
                {periodSource && (
                  <span className="text-brand-primary"> from {periodSource === 'publish_time' ? 'Publish time' : 'CSV filename'}</span>
                )}
              </p>
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Client">
            <select
              value={clientId}
              onChange={event => {
                setClientId(event.target.value)
                setSavedReportId(null)
                setPeriodSource(null)
                setPeriodBatchId(null)
              }}
              disabled={loading}
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
            >
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Start date">
            <input
              type="date"
              value={periodStart}
              onChange={event => {
                setPeriodStart(event.target.value)
                setSavedReportId(null)
                setPeriodSource(null)
                setPeriodBatchId(null)
              }}
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
          </Field>
          <Field label="End date">
            <input
              type="date"
              value={periodEnd}
              onChange={event => {
                setPeriodEnd(event.target.value)
                setSavedReportId(null)
                setPeriodSource(null)
                setPeriodBatchId(null)
              }}
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
          </Field>
        </div>
      </section>

      {error && (
        <p className="mb-4 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {success && (
        <p className="mb-4 text-sm text-brand-accent bg-brand-accent/10 border border-brand-accent/20 rounded-lg px-3 py-2">
          {success}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Reach" value={formatNumber(master.totalReach)} />
        <StatCard label="Views" value={formatNumber(master.totalViews)} />
        <StatCard label="Engagements" value={formatNumber(master.totalEngagements)} />
        <StatCard label="Posts" value={postsLoading ? '...' : formatNumber(stats.postCount)} />
      </div>

      <section className="bg-brand-surface border border-brand-muted rounded-xl p-4 mb-6 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white mb-1">Growth comparison</h2>
            <p className="text-xs text-brand-primary">
              Comparing {currentMonthLabel} with {previousMonthLabel}.
            </p>
          </div>
          <SourcePill
            label={previousMaster ? 'Comparison available' : 'Previous month data not available'}
            tone={previousMaster ? 'posts' : 'none'}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MovementCard label="Views" movement={movement.views} />
          <MovementCard label="Reach" movement={movement.reach} />
          <MovementCard label="Engagements" movement={movement.engagements} />
          <MovementCard label="Profile visits" movement={movement.profileVisits} />
          <MovementCard label="Followers" movement={movement.followers} />
        </div>
        {!previousMaster && (
          <p className="mt-4 rounded-lg border border-brand-muted bg-brand-bg/50 px-3 py-2 text-xs text-brand-primary">
            Growth cannot be calculated yet because no imported posts or manual summary metrics were found for {previousMonthLabel}.
          </p>
        )}
      </section>

      <section className="bg-brand-surface border border-brand-muted rounded-xl p-4 mb-6 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white mb-1">Platform breakdown</h2>
            <p className="text-xs text-brand-primary">
              Matching {selectedClient?.name ?? 'client'} data for {currentMonthLabel}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SourcePill label="Meta CSV" tone="posts" />
            <SourcePill label="Manual summary" tone="manual" />
            <SourcePill label="No data" tone="none" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {master.platforms.map(view => (
            <div key={view.platform} className="border border-brand-muted rounded-lg p-3 bg-brand-bg/50">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-white">{view.label}</p>
                <SourcePill
                  label={view.source === 'posts' ? 'Meta CSV' : view.source === 'manual' ? 'Manual summary' : 'No data'}
                  tone={view.source}
                />
              </div>
              {view.source === 'none' ? (
                <p className="mt-3 text-xs leading-relaxed text-brand-primary">
                  No matching data for {currentMonthLabel}. Import a Meta CSV or add a manual summary for this month.
                </p>
              ) : (
                <dl className="mt-2 space-y-1 text-xs text-brand-primary">
                  <div className="flex justify-between"><dt>Reach</dt><dd className="text-white">{formatNumber(view.reach)}</dd></div>
                  <div className="flex justify-between"><dt>Views</dt><dd className="text-white">{formatNumber(view.views)}</dd></div>
                  <div className="flex justify-between"><dt>Engagements</dt><dd className="text-white">{formatNumber(view.engagements)}</dd></div>
                  <div className="flex justify-between">
                    <dt>Source</dt>
                    <dd className="text-white">{view.source === 'manual' ? MANUAL_SOURCE_LABELS[view.manual!.source_type] : `${formatNumber(view.postCount)} posts`}</dd>
                  </div>
                  {view.source === 'manual' && view.manual && (
                    <>
                      <div className="flex justify-between"><dt>Profile visits</dt><dd className="text-white">{formatNumber(view.manual.profile_visits)}</dd></div>
                      <div className="flex justify-between"><dt>External link taps</dt><dd className="text-white">{formatNumber(view.manual.external_link_taps)}</dd></div>
                    </>
                  )}
                </dl>
              )}
            </div>
          ))}
        </div>
      </section>

      {manualMonthMismatch.length > 0 && (
        <p className="mb-6 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
          Manual data exists for another month: {manualMonthMismatch.join(', ')}. This report is
          currently set to {currentMonthLabel}. Set the report end date to the matching month to include it.
        </p>
      )}

      {importedMonthMismatch.length > 0 && periodImportedPosts.length === 0 && (
        <p className="mb-6 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
          CSV data exists for {importedMonthMismatch.join(', ')}, but not for {currentMonthLabel}. Adjust the
          date range or import data for the selected month.
        </p>
      )}

      <section className="bg-brand-surface border border-brand-muted rounded-xl p-4 mb-6 sm:p-5">
        <h2 className="text-sm font-semibold text-white mb-1">Available manual summaries for this client</h2>
        <p className="mb-4 text-xs text-brand-primary">
          Report month is <span className="text-white">{currentMonthLabel}</span>. Rows matching this month feed into the report above.
        </p>
        {manualMetrics.length === 0 ? (
          <p className="rounded-lg border border-brand-muted bg-brand-bg/50 px-3 py-3 text-xs text-brand-primary">
            No manual summaries uploaded for this client yet. Add one when a platform only has monthly summary data.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-brand-muted text-left">
                  <th className="px-3 py-2 font-medium text-brand-primary">Month</th>
                  <th className="px-3 py-2 font-medium text-brand-primary">Platform</th>
                  <th className="px-3 py-2 font-medium text-brand-primary">Reach</th>
                  <th className="px-3 py-2 font-medium text-brand-primary">Views</th>
                  <th className="px-3 py-2 font-medium text-brand-primary">Engagements</th>
                  <th className="px-3 py-2 font-medium text-brand-primary">Source</th>
                </tr>
              </thead>
              <tbody>
                {manualMetrics.map(metric => {
                  const matches = metric.month === currentMonth
                  const previousMatches = metric.month === previousMonth
                  return (
                    <tr
                      key={metric.id}
                      className={`border-b border-brand-muted/70 last:border-0 ${matches ? 'bg-brand-accent/[0.06]' : previousMatches ? 'bg-sky-300/[0.05]' : ''}`}
                    >
                      <td className="px-3 py-2 text-white">
                        {metric.month}
                        {matches && <span className="ml-2 text-[11px] text-brand-accent">this month</span>}
                        {previousMatches && <span className="ml-2 text-[11px] text-sky-200">previous month</span>}
                      </td>
                      <td className="px-3 py-2 text-brand-primary">{PLATFORM_LABELS[metric.platform]}</td>
                      <td className="px-3 py-2 text-brand-primary">{formatNumber(metric.reach)}</td>
                      <td className="px-3 py-2 text-brand-primary">{formatNumber(metric.views)}</td>
                      <td className="px-3 py-2 text-brand-primary">{formatNumber(metric.engagements)}</td>
                      <td className="px-3 py-2 text-brand-primary">{MANUAL_SOURCE_LABELS[metric.source_type]}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-5">
          <div className="bg-brand-surface border border-brand-muted rounded-xl p-4 sm:p-5">
            <div className="mb-4">
              <p className="text-xs uppercase tracking-[0.18em] text-brand-primary">Strategy board</p>
              <h2 className="mt-2 text-base font-semibold text-white">Client-facing strategy narrative</h2>
              <p className="mt-1 text-xs text-brand-primary">
                Use these prompts to turn the report data into clear client direction.
              </p>
            </div>
            <div className="space-y-4">
              <TextInput
                label="Report title"
                value={fields.reportTitle}
                onChange={value => updateField('reportTitle', value)}
                placeholder={`${selectedClient?.name ?? 'Client'} Monthly Report`}
              />
              <div className="grid gap-4 lg:grid-cols-2">
                <StrategyTextarea
                  title="What worked this month"
                  helper="What performed best, and why?"
                  value={fields.performanceComments}
                  onChange={value => updateField('performanceComments', value)}
                  placeholder="Summarise the strongest content, platform, audience response, or campaign signal."
                />
                <StrategyTextarea
                  title="What needs attention"
                  helper="What should we improve or watch next month?"
                  value={fields.previousMonthReflection}
                  onChange={value => updateField('previousMonthReflection', value)}
                  placeholder="Note weaker content types, gaps in consistency, audience drop-offs, or conversion opportunities."
                />
                <StrategyTextarea
                  title="Next month focus"
                  helper="What should the team prioritise next?"
                  value={fields.strategyNextMonth}
                  onChange={value => updateField('strategyNextMonth', value)}
                  placeholder="Set the main strategic focus for the coming reporting period."
                />
                <StrategyTextarea
                  title="Content direction"
                  helper="What content direction should the client expect next?"
                  value={fields.contentDirectionNextMonth}
                  onChange={value => updateField('contentDirectionNextMonth', value)}
                  placeholder="Outline themes, formats, messaging angles, or campaign ideas."
                />
                <StrategyTextarea
                  title="Boosting recommendation"
                  helper="What should be boosted, paused, or tested?"
                  value={fields.boostRecommendation}
                  onChange={value => updateField('boostRecommendation', value)}
                  placeholder="Recommend paid support, testing priorities, or budget caution."
                />
                <StrategyTextarea
                  title="Notes / context"
                  helper="What background context should be remembered?"
                  value={fields.generalNotes}
                  onChange={value => updateField('generalNotes', value)}
                  placeholder="Add context around timing, campaigns, seasonal factors, or client-specific notes."
                />
                <StrategyTextarea
                  title="Previous strategy context"
                  helper="What was the previous plan or strategic baseline?"
                  value={fields.previousMonthStrategy}
                  onChange={value => updateField('previousMonthStrategy', value)}
                  placeholder="Capture what the prior strategy aimed to do, so progress can be read in context."
                />
              </div>
            </div>
          </div>

          <div className="bg-brand-surface border border-brand-muted rounded-xl p-4 sm:p-5">
            <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold text-white">Generate AI prompt</h2>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={handleGeneratePrompt}
                  className="bg-brand-accent text-brand-bg font-semibold px-3 py-2.5 rounded-lg text-sm hover:brightness-110 transition sm:text-xs"
                >
                  Generate AI prompt
                </button>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  disabled={!aiPrompt}
                  className="border border-brand-muted text-brand-primary px-3 py-2.5 rounded-lg text-sm hover:text-white hover:border-white/30 transition disabled:opacity-50 sm:text-xs"
                >
                  Copy
                </button>
              </div>
            </div>
            <textarea
              value={aiPrompt}
              onChange={event => setAiPrompt(event.target.value)}
              placeholder="Generated prompt will appear here."
              rows={10}
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
          </div>
        </section>

        <aside className="space-y-5">
          <PerformancePanel title="Best performing post" post={stats.bestPost} />
          <PerformancePanel title="Worst performing post" post={stats.worstPost} />

          <section className="bg-brand-surface border border-brand-muted rounded-xl p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Top 5 posts</h2>
            <div className="space-y-3">
              {stats.topPosts.length === 0 ? (
                <p className="text-sm text-brand-primary">No imported posts found for this range.</p>
              ) : (
                stats.topPosts.map((post, index) => (
                  <div key={post.id} className="border border-brand-muted rounded-lg p-3 bg-brand-bg/50">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-xs text-brand-accent">#{index + 1}</span>
                      <span className="text-xs text-brand-primary">{formatDate(post.publish_time)}</span>
                    </div>
                    <p className="text-sm text-white">{shortCaption(post.caption)}</p>
                    <p className="text-xs text-brand-primary mt-2">
                      {formatNumber(post.engagements)} engagements | {formatNumber(post.reach)} reach
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-brand-accent mb-1.5">{label}</span>
      {children}
    </label>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-brand-surface border border-brand-muted rounded-xl p-4 sm:p-5">
      <p className="text-xs uppercase tracking-[0.12em] text-brand-primary sm:tracking-[0.18em]">{label}</p>
      <p className="text-2xl font-semibold text-white mt-3 break-words sm:text-3xl">{value}</p>
    </div>
  )
}

function SourcePill({ label, tone }: { label: string; tone: 'posts' | 'manual' | 'none' }) {
  const classes = {
    posts: 'border-brand-accent/30 bg-brand-accent/10 text-brand-accent',
    manual: 'border-sky-300/30 bg-sky-300/10 text-sky-200',
    none: 'border-brand-muted bg-brand-muted/50 text-brand-primary',
  }[tone]

  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${classes}`}>
      {label}
    </span>
  )
}

function movementText(movement: MetricMovement) {
  if (movement.direction === 'missing' || movement.difference === null) {
    return 'Previous month data not available'
  }
  const diff = `${movement.difference > 0 ? '+' : ''}${formatNumber(movement.difference)}`
  if (movement.percent === null) return `${diff} difference`
  return `${diff} (${formatPercent(movement.percent)})`
}

function MovementCard({ label, movement }: { label: string; movement: MetricMovement }) {
  const tone = {
    up: 'border-brand-accent/30 bg-brand-accent/10 text-brand-accent',
    down: 'border-red-300/25 bg-red-400/10 text-red-200',
    flat: 'border-brand-muted bg-brand-bg/50 text-brand-primary',
    missing: 'border-brand-muted bg-brand-bg/40 text-brand-primary',
  }[movement.direction]

  return (
    <article className={`rounded-lg border p-3 ${tone}`}>
      <p className="text-[11px] uppercase tracking-[0.12em] opacity-80">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{formatNumber(movement.current)}</p>
      <p className="mt-1 text-xs">{movementText(movement)}</p>
    </article>
  )
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-brand-accent mb-1.5">{label}</span>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent"
      />
    </label>
  )
}

function StrategyTextarea({
  title,
  helper,
  value,
  onChange,
  placeholder,
}: {
  title: string
  helper: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="block rounded-xl border border-brand-muted bg-brand-bg/45 p-4">
      <span className="block text-sm font-semibold text-white">{title}</span>
      <span className="mt-1 block text-xs leading-relaxed text-brand-primary">{helper}</span>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        rows={5}
        placeholder={placeholder}
        className="mt-3 w-full bg-brand-surface border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent"
      />
    </label>
  )
}

function PerformancePanel({
  title,
  post,
}: {
  title: string
  post: ReturnType<typeof calculateReportStats>['bestPost']
}) {
  return (
    <section className="bg-brand-surface border border-brand-muted rounded-xl p-5">
      <h2 className="text-sm font-semibold text-white mb-4">{title}</h2>
      {post ? (
        <div>
          <p className="text-sm text-white leading-relaxed">{shortCaption(post.caption)}</p>
          <div className="grid grid-cols-1 gap-2 mt-4 sm:grid-cols-3">
            <MiniMetric label="Reach" value={formatNumber(post.reach)} />
            <MiniMetric label="Views" value={formatNumber(post.impressions)} />
            <MiniMetric label="Eng." value={formatNumber(post.engagements)} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-brand-primary">No post data loaded yet.</p>
      )}
    </section>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-brand-bg/70 border border-brand-muted rounded-lg p-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-brand-primary">{label}</p>
      <p className="text-base font-semibold text-white mt-1 sm:text-sm">{value}</p>
    </div>
  )
}
