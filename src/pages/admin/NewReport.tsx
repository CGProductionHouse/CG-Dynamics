import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { listClients, type Client } from '../../lib/db/clients'
import { listImportedMetaPosts, type ImportedMetaPost } from '../../lib/db/importedMetaPosts'
import { getReportWithPosts, saveReport, type ReportStatus } from '../../lib/db/reports'
import {
  listManualMetricsForClientMonth,
  type ManualPlatformMetric,
} from '../../lib/db/manualMetrics'
import { detectReportPeriod, formatReportPeriod, reportMonth } from '../../lib/reportPeriod'
import {
  buildMasterReport,
  calculateReportStats,
  formatDate,
  formatNumber,
  importedToStatsPost,
  shortCaption,
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

  // Manual summary metrics for the selected client and report month. Matched
  // to the month of the report END date so a period like 30 Apr - 31 May
  // picks up May (2026-05) manual metrics.
  useEffect(() => {
    if (!clientId || !periodEnd) {
      setManualMetrics([])
      return
    }
    let active = true
    async function loadManual() {
      const { data } = await listManualMetricsForClientMonth(clientId, reportMonth(periodEnd))
      if (active) setManualMetrics(data)
    }
    void loadManual()
    return () => {
      active = false
    }
  }, [clientId, periodEnd])

  const selectedClient = clients.find(client => client.id === clientId)
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
  const stats = useMemo(() => calculateReportStats(statsPosts), [statsPosts])
  // Combined view: CSV posts + manual summary metrics (same logic the client sees).
  const master = useMemo(() => buildMasterReport(statsPosts, manualMetrics), [statsPosts, manualMetrics])
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
    if (!savedReportId && periodImportedPosts.length === 0) {
      setError('No imported posts were found for this client and date range.')
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
          <p className="mb-4 text-sm text-brand-primary">
            Detected period:{' '}
            <span className="text-white">{formatReportPeriod({ start: periodStart, end: periodEnd })}</span>
            {periodSource && (
              <span> from {periodSource === 'publish_time' ? 'Publish time' : 'CSV filename'}</span>
            )}
          </p>
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
        <h2 className="text-sm font-semibold text-white mb-1">Platform breakdown</h2>
        <p className="mb-4 text-xs text-brand-primary">CSV imports and manual summary metrics combined.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {master.platforms.map(view => (
            <div key={view.platform} className="border border-brand-muted rounded-lg p-3 bg-brand-bg/50">
              <p className="text-sm font-semibold text-white">{view.label}</p>
              {view.source === 'none' ? (
                <p className="mt-2 text-xs text-brand-primary">No data uploaded yet.</p>
              ) : (
                <dl className="mt-2 space-y-1 text-xs text-brand-primary">
                  <div className="flex justify-between"><dt>Reach</dt><dd className="text-white">{formatNumber(view.reach)}</dd></div>
                  <div className="flex justify-between"><dt>Views</dt><dd className="text-white">{formatNumber(view.views)}</dd></div>
                  <div className="flex justify-between"><dt>Engagements</dt><dd className="text-white">{formatNumber(view.engagements)}</dd></div>
                  <div className="flex justify-between">
                    <dt>Source</dt>
                    <dd className="text-white">{view.source === 'manual' ? 'Manual summary' : `${formatNumber(view.postCount)} posts`}</dd>
                  </div>
                </dl>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-5">
          <div className="bg-brand-surface border border-brand-muted rounded-xl p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Report text</h2>
            <div className="space-y-4">
              <TextInput
                label="Report title"
                value={fields.reportTitle}
                onChange={value => updateField('reportTitle', value)}
                placeholder={`${selectedClient?.name ?? 'Client'} Monthly Report`}
              />
              <TextArea label="Previous month strategy" value={fields.previousMonthStrategy} onChange={value => updateField('previousMonthStrategy', value)} />
              <TextArea label="Previous month reflection" value={fields.previousMonthReflection} onChange={value => updateField('previousMonthReflection', value)} />
              <TextArea label="Performance comments" value={fields.performanceComments} onChange={value => updateField('performanceComments', value)} />
              <TextArea label="Strategy for next month" value={fields.strategyNextMonth} onChange={value => updateField('strategyNextMonth', value)} />
              <TextArea label="Content direction for next month" value={fields.contentDirectionNextMonth} onChange={value => updateField('contentDirectionNextMonth', value)} />
              <TextArea label="Boosting recommendation" value={fields.boostRecommendation} onChange={value => updateField('boostRecommendation', value)} />
              <TextArea label="General notes" value={fields.generalNotes} onChange={value => updateField('generalNotes', value)} />
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

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-brand-accent mb-1.5">{label}</span>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        rows={4}
        className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent"
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
