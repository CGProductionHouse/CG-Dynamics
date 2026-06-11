import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { listClients, type Client } from '../../lib/db/clients'
import { listImportedMetaPosts, type ImportedMetaPost } from '../../lib/db/importedMetaPosts'
import { saveReport, type ReportStatus } from '../../lib/db/reports'
import {
  calculateReportStats,
  formatDate,
  formatNumber,
  importedToStatsPost,
  shortCaption,
} from '../../lib/reportStats'

type Platform = 'facebook' | 'instagram' | 'tiktok'

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
  const { profile } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [platform, setPlatform] = useState<Platform>('facebook')
  const [periodStart, setPeriodStart] = useState(monthStartInputValue())
  const [periodEnd, setPeriodEnd] = useState(todayInputValue())
  const [importedPosts, setImportedPosts] = useState<ImportedMetaPost[]>([])
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
    if (!clientId) return

    async function loadImportedPosts() {
      setPostsLoading(true)
      setError(null)
      setSuccess(null)
      try {
        const { data, error } = await listImportedMetaPosts(clientId, periodStart, periodEnd)
        if (error) {
          setError(error.message)
        } else {
          setImportedPosts(data.filter(post => post.platform === platform))
        }
      } catch (error) {
        setError(errorMessage(error, 'Could not load imported posts.'))
      } finally {
        setPostsLoading(false)
      }
    }

    void loadImportedPosts()
  }, [clientId, periodStart, periodEnd, platform])

  const selectedClient = clients.find(client => client.id === clientId)
  const statsPosts = useMemo(() => importedPosts.map(importedToStatsPost), [importedPosts])
  const stats = useMemo(() => calculateReportStats(statsPosts), [statsPosts])
  const statsText = [
    `Total reach: ${formatNumber(stats.totalReach)}`,
    `Impressions: ${formatNumber(stats.totalImpressions)}`,
    `Engagements: ${formatNumber(stats.totalEngagements)}`,
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
    if (importedPosts.length === 0) {
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
        platform,
        period_start: periodStart,
        period_end: periodEnd,
        status,
        report_title: fields.reportTitle || `${selectedClient?.name ?? 'Client'} Meta Performance Report`,
        previous_month_strategy: fields.previousMonthStrategy,
        previous_month_reflection: fields.previousMonthReflection,
        performance_comments: fields.performanceComments,
        strategy_next_month: fields.strategyNextMonth,
        content_direction_next_month: fields.contentDirectionNextMonth,
        boost_recommendation: fields.boostRecommendation,
        general_notes: fields.generalNotes,
        created_by: profile?.id ?? null,
        importedPosts,
      })

      if (error || !data) {
        setError(error?.message ?? 'Could not save this report.')
        return
      }

      setSavedReportId(data.id)
      setSuccess(status === 'published' ? 'Report published. The client can now view it.' : 'Draft saved.')
    } catch (error) {
      setError(errorMessage(error, 'Could not save this report.'))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-brand-primary mb-2">Report builder</p>
          <h1 className="text-2xl font-semibold text-white">Create Meta performance report</h1>
          <p className="text-sm text-brand-primary mt-2 max-w-2xl">
            Build a client-ready report from imported Meta data, then add the strategy commentary manually.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleSave('draft')}
            disabled={!!saving}
            className="border border-brand-muted text-brand-primary px-4 py-2 rounded-lg text-sm hover:text-white hover:border-white/30 transition disabled:opacity-60"
          >
            {saving === 'draft' ? 'Saving...' : 'Save draft'}
          </button>
          <button
            type="button"
            onClick={() => handleSave('published')}
            disabled={!!saving}
            className="bg-brand-accent text-brand-bg font-semibold px-4 py-2 rounded-lg text-sm hover:brightness-110 transition disabled:opacity-60"
          >
            {saving === 'published' ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>

      <section className="bg-brand-surface border border-brand-muted rounded-xl p-5 mb-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Client">
            <select
              value={clientId}
              onChange={event => {
                setClientId(event.target.value)
                setSavedReportId(null)
              }}
              disabled={loading}
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
            >
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Platform">
            <select
              value={platform}
              onChange={event => {
                setPlatform(event.target.value as Platform)
                setSavedReportId(null)
              }}
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
            >
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
            </select>
          </Field>
          <Field label="Start date">
            <input
              type="date"
              value={periodStart}
              onChange={event => {
                setPeriodStart(event.target.value)
                setSavedReportId(null)
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

      <div className="grid gap-4 lg:grid-cols-4 mb-6">
        <StatCard label="Reach" value={formatNumber(stats.totalReach)} />
        <StatCard label="Impressions" value={formatNumber(stats.totalImpressions)} />
        <StatCard label="Engagements" value={formatNumber(stats.totalEngagements)} />
        <StatCard label="Posts" value={postsLoading ? '...' : formatNumber(stats.postCount)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-5">
          <div className="bg-brand-surface border border-brand-muted rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Report text</h2>
            <div className="space-y-4">
              <TextInput
                label="Report title"
                value={fields.reportTitle}
                onChange={value => updateField('reportTitle', value)}
                placeholder={`${selectedClient?.name ?? 'Client'} Meta Performance Report`}
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

          <div className="bg-brand-surface border border-brand-muted rounded-xl p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-sm font-semibold text-white">Generate AI prompt</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGeneratePrompt}
                  className="bg-brand-accent text-brand-bg font-semibold px-3 py-2 rounded-lg text-xs hover:brightness-110 transition"
                >
                  Generate AI prompt
                </button>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  disabled={!aiPrompt}
                  className="border border-brand-muted text-brand-primary px-3 py-2 rounded-lg text-xs hover:text-white hover:border-white/30 transition disabled:opacity-50"
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

          <section className="bg-brand-surface border border-brand-muted rounded-xl p-5">
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
    <div className="bg-brand-surface border border-brand-muted rounded-xl p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-brand-primary">{label}</p>
      <p className="text-3xl font-semibold text-white mt-3">{value}</p>
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
          <div className="grid grid-cols-3 gap-2 mt-4">
            <MiniMetric label="Reach" value={formatNumber(post.reach)} />
            <MiniMetric label="Impr." value={formatNumber(post.impressions)} />
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
      <p className="text-sm font-semibold text-white mt-1">{value}</p>
    </div>
  )
}
