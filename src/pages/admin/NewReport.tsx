import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useLocalDraft } from '../../hooks/useLocalDraft'
import { listClients, readPackageSettings, type Client } from '../../lib/db/clients'
import { listImportedMetaPosts, type ImportedMetaPost } from '../../lib/db/importedMetaPosts'
import { getReportWithPosts, saveReport, updateReportStrategyData, type ReportPost, type ReportStatus } from '../../lib/db/reports'
import { listStrategyOptions, DEFAULT_OPTIONS, type StrategyCategory, type StrategyOption } from '../../lib/db/strategyOptions'
import { getMonthEvents } from '../../lib/contentCalendar'
import { emptyStrategyData, readStrategyData, hasStrategyContent, strategyChecklist, type StrategyData } from '../../lib/strategyEngine'
import { GuidedStrategyEditor, type StrategyContext } from '../../components/strategy/GuidedStrategy'
import {
  MANUAL_SOURCE_LABELS,
  listManualMetricsForClient,
  type ManualPlatformMetric,
} from '../../lib/db/manualMetrics'
import { detectReportPeriod, formatReportPeriod, previousReportMonth, reportMonth, calendarMonthBounds, isMonthComplete } from '../../lib/reportPeriod'
import {
  PLATFORM_LABELS,
  buildPerformanceMovement,
  buildMasterReport,
  calculateReportStats,
  displayContentType,
  formatDate,
  formatNumber,
  formatPercent,
  importedToStatsPost,
  reportPostToStatsPost,
  shortCaption,
  type MetricMovement,
} from '../../lib/reportStats'
import { buildMetaContentMetrics, buildMetaPlatformMetrics, metaEngagementLabel, metaPrimaryMetricLabel } from '../../lib/metaMetrics'
import { buildPlatformPerformance, buildReportPerformance, type PerformanceLevel } from '../../lib/reportPerformance'

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

interface ReportDraft {
  clientId: string
  fields: ReportFields
  strategyData?: StrategyData
}

// Derive the legacy text columns from the structured strategy so older client
// views (and reports opened before the strategy_data migration) still render
// meaningful content. Falls back to any existing legacy field value.
function deriveLegacyFields(strategy: StrategyData, fields: ReportFields): ReportFields {
  const join = (items: string[]) => items.filter(Boolean).join(', ')
  const campaign = strategy.actionPlan.campaign_recommendation
  const campaignText = campaign.enabled ? [join(campaign.items), campaign.notes].filter(Boolean).join('\n') : ''
  const directionText = [join(strategy.clientDirection), strategy.clientRequestNotes].filter(Boolean).join('\n')
  return {
    reportTitle: fields.reportTitle,
    previousMonthStrategy: fields.previousMonthStrategy,
    previousMonthReflection: fields.previousMonthReflection,
    performanceComments: strategy.topContent.whatThisTellsUs || join(strategy.topContent.whyItWorked) || fields.performanceComments,
    strategyNextMonth: strategy.strategyGoingForward || fields.strategyNextMonth,
    contentDirectionNextMonth: directionText || fields.contentDirectionNextMonth,
    boostRecommendation: campaignText || fields.boostRecommendation,
    generalNotes: join(strategy.clientActionsRequired) || fields.generalNotes,
  }
}

export default function NewReport() {
  const { reportId } = useParams()
  const { profile } = useAuth()
  const { getInitialDraft: getReportDraft, saveDraft: saveReportDraft, clearDraft: clearReportDraft, hasDraft: hasReportDraft } =
    useLocalDraft<ReportDraft>(`cg_report_${profile?.id ?? 'anon'}`)

  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [periodStart, setPeriodStart] = useState(monthStartInputValue())
  const [periodEnd, setPeriodEnd] = useState(todayInputValue())
  const [periodSource, setPeriodSource] = useState<'publish_time' | 'filename' | null>(null)
  const [periodBatchId, setPeriodBatchId] = useState<string | null>(null)
  const [importedPosts, setImportedPosts] = useState<ImportedMetaPost[]>([])
  const [reportPosts, setReportPosts] = useState<ReportPost[]>([])
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
  const [strategyData, setStrategyData] = useState<StrategyData>(() => emptyStrategyData())
  const [optionsByCategory, setOptionsByCategory] = useState<Record<StrategyCategory, StrategyOption[]>>(DEFAULT_OPTIONS)
  const [usingDefaults, setUsingDefaults] = useState(true)
  const [strategyNotice, setStrategyNotice] = useState<string | null>(null)
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
        const { data, error } = await listClients('active')
        if (error) {
          setError(error.message)
        } else {
          setClients(data)
          if (!reportId) {
            const draft = getReportDraft()
            const validClientId =
              draft?.clientId && data.some(c => c.id === draft.clientId)
                ? draft.clientId
                : data[0]?.id ?? ''
            setClientId(validClientId)
            if (draft?.fields) setFields(draft.fields)
            if (draft?.strategyData) setStrategyData(readStrategyData(draft.strategyData))
          } else {
            setClientId(data[0]?.id ?? '')
          }
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
        setReportPosts(data.posts ?? [])
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
        // Restore structured strategy (backward compatible: older reports have
        // no strategy_data and resolve to an empty, valid structure).
        setStrategyData(readStrategyData(data.strategy_data))
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

  // Load the editable strategy option library (falls back to built-in defaults
  // if the strategy_options table is empty or not yet created).
  useEffect(() => {
    let active = true
    async function loadOptions() {
      const { byCategory, usingDefaults: defaults } = await listStrategyOptions()
      if (!active) return
      setOptionsByCategory(byCategory)
      setUsingDefaults(defaults)
    }
    void loadOptions()
    return () => {
      active = false
    }
  }, [])

  async function reloadOptions() {
    const { byCategory, usingDefaults: defaults } = await listStrategyOptions()
    setOptionsByCategory(byCategory)
    setUsingDefaults(defaults)
  }

  // Auto-save strategy fields and client selection for new reports.
  // Only active when not editing an existing report (reportId is set).
  // Only saves when at least one field has content so we don't immediately
  // show "draft saved" on an untouched blank form.
  useEffect(() => {
    if (reportId || !clientId) return
    const hasFieldContent = Object.values(fields).some(v => v.trim())
    if (!hasFieldContent && !hasStrategyContent(strategyData)) return
    saveReportDraft({ clientId, fields, strategyData })
  }, [clientId, fields, strategyData, reportId, saveReportDraft])

  const selectedClient = clients.find(client => client.id === clientId)
  // The report month is the calendar month of the period START date. Using the
  // start keeps legacy partial ranges (e.g. 21 May - 10 June) resolving to their
  // intended month (May), matching the client-facing resolution.
  const currentMonth = reportMonth(periodStart)
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
  // Posts feeding the report are always clamped to the intended calendar month
  // so the admin preview matches the published client view exactly (and a
  // partial range never bleeds the next month's posts into the stats).
  const periodImportedPosts = useMemo(() => {
    const bounds = calendarMonthBounds(currentMonth)
    const start = new Date(`${bounds.start}T00:00:00`).getTime()
    const end = new Date(`${bounds.end}T23:59:59`).getTime()

    return importedPosts.filter(post => {
      if (!post.publish_time) {
        return periodSource === 'filename' && periodBatchId !== null && post.import_batch_id === periodBatchId
      }
      const time = new Date(post.publish_time).getTime()
      if (Number.isNaN(time)) {
        return periodSource === 'filename' && periodBatchId !== null && post.import_batch_id === periodBatchId
      }
      if (time < start) return false
      if (time > end) return false
      return true
    })
  }, [importedPosts, periodBatchId, periodSource, currentMonth])
  const statsPosts = useMemo(() => {
    const fromImported = periodImportedPosts.map(importedToStatsPost)
    const fromReport = savedReportId
      ? reportPosts
          .filter(post => {
            if (!post.publish_time) return true
            const time = new Date(post.publish_time).getTime()
            if (Number.isNaN(time)) return true
            const { start, end } = calendarMonthBounds(currentMonth)
            const startTime = new Date(`${start}T00:00:00`).getTime()
            const endTime = new Date(`${end}T23:59:59`).getTime()
            return time >= startTime && time <= endTime
          })
          .map(reportPostToStatsPost)
      : []
    return [...fromImported, ...fromReport]
  }, [periodImportedPosts, reportPosts, savedReportId, currentMonth])
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
  // Client-safe performance story (same model the published report renders).
  // Shown here so staff can preview exactly what the client will see.
  const performance = useMemo(
    () => buildReportPerformance({
      master,
      previousMaster,
      currentManual: monthManualMetrics,
      previousManual: previousMonthManualMetrics,
      monthLabel: monthName(currentMonth),
      previousMonthLabel: previousMonth ? monthName(previousMonth) : null,
    }),
    [master, previousMaster, monthManualMetrics, previousMonthManualMetrics, currentMonth, previousMonth]
  )
  // Admin-only: how each platform tab is built (card sources, ranking metric,
  // content-tone reason, skipped follower growth). Never shown to the client.
  const platformDiagnostics = useMemo(
    () => master.platforms
      .filter(view => view.source !== 'none')
      .map(view => buildPlatformPerformance({
        view,
        previousView: previousMaster?.platforms.find(p => p.platform === view.platform) ?? null,
        previousManual: previousMonthManualMetrics.find(m => m.platform === view.platform) ?? null,
        monthLabel: monthName(currentMonth),
        previousMonthLabel: previousMonth ? monthName(previousMonth) : null,
      })),
    [master, previousMaster, previousMonthManualMetrics, currentMonth, previousMonth]
  )
  const calendarEvents = useMemo(() => getMonthEvents(currentMonth), [currentMonth])
  const topPostContext = useMemo(() => {
    const post = master.bestPostOverall
    if (!post) return null
    return {
      caption: shortCaption(post.caption),
      platform: post.platform,
      metricLabel: 'engagements',
      metricValue: post.engagements,
      postType: post.post_type,
      imageUrl: post.imageUrl,
    }
  }, [master])
  const strategyContext: StrategyContext = {
    clientName: selectedClient?.name ?? 'Client',
    packageSettings: readPackageSettings(selectedClient?.package_settings),
    calendarEvents,
    topPost: topPostContext,
  }

  function updateField(key: keyof ReportFields, value: string) {
    setFields(current => ({ ...current, [key]: value }))
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
    if (status === 'published' && !isMonthComplete(currentMonth)) {
      setError('This report period is incomplete. Client reports are only available for completed calendar months.')
      return
    }

    setSaving(status)
    setError(null)
    setSuccess(null)
    setStrategyNotice(null)
    try {
      // Always store the full calendar month as the report period so all
      // reports have clean, comparable month boundaries.
      const { start: monthStart, end: monthEnd } = calendarMonthBounds(currentMonth)

      // Snapshot the auto-derived top content into the strategy data so the
      // saved/published report stays stable even if underlying data changes.
      const strategyToSave: StrategyData = {
        ...strategyData,
        topContent: {
          ...strategyData.topContent,
          autoCaption: topPostContext?.caption ?? strategyData.topContent.autoCaption,
          autoPlatform: topPostContext?.platform ?? strategyData.topContent.autoPlatform,
          autoMetricLabel: topPostContext?.metricLabel ?? strategyData.topContent.autoMetricLabel,
          autoMetricValue: topPostContext?.metricValue ?? strategyData.topContent.autoMetricValue,
          autoImageUrl: topPostContext?.imageUrl ?? strategyData.topContent.autoImageUrl,
        },
      }
      const legacy = deriveLegacyFields(strategyToSave, fields)

      const { data, error } = await saveReport({
        id: savedReportId ?? undefined,
        client_id: clientId,
        period_start: monthStart,
        period_end: monthEnd,
        status,
        report_title: fields.reportTitle || `${selectedClient?.name ?? 'Client'} Monthly Report`,
        previous_month_strategy: legacy.previousMonthStrategy,
        previous_month_reflection: legacy.previousMonthReflection,
        performance_comments: legacy.performanceComments,
        strategy_next_month: legacy.strategyNextMonth,
        content_direction_next_month: legacy.contentDirectionNextMonth,
        boost_recommendation: legacy.boostRecommendation,
        general_notes: legacy.generalNotes,
        created_by: profile?.id ?? null,
        importedPosts: periodImportedPosts.length > 0 ? periodImportedPosts : undefined,
      })

      if (error || !data) {
        setError(error?.message ?? 'Could not save this report.')
        return
      }

      // Persist the structured strategy (best-effort: never blocks the save).
      const strategyResult = await updateReportStrategyData(data.id, strategyToSave)
      if (strategyResult.migrationNeeded) {
        setStrategyNotice('Saved. The guided strategy is shown via the report text fields, but the structured version needs the phase-3j migration (reports.strategy_data) to be stored fully.')
      }
      setStrategyData(strategyToSave)

      setSavedReportId(data.id)
      setReportStatus(data.status)
      clearReportDraft()
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
        {savedReportId && reportStatus !== 'published' && !hasStrategyContent(strategyData) && (
          <p className="mt-2 text-xs text-amber-300 text-right">
            Add CG action plan before publishing.
          </p>
        )}
      </div>

      <section className="bg-brand-surface border border-brand-muted rounded-xl p-4 mb-6 sm:p-5">
        {periodStart && periodEnd && (
          <div className="mb-4 grid gap-3 rounded-lg border border-brand-muted bg-brand-bg/50 p-3 sm:grid-cols-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-brand-primary">Report month</p>
              <p className="mt-1 text-base font-semibold text-white">{currentMonthLabel}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-brand-primary">Report period</p>
              <p className="mt-1 text-sm text-white">
                {formatReportPeriod(calendarMonthBounds(currentMonth))}
              </p>
              {!isMonthComplete(currentMonth) && (
                <p className="mt-1 text-xs text-amber-300">
                  Incomplete month — not available for client view yet.
                </p>
              )}
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
        {master.totalViews !== null && (
          <StatCard label="Views" value={formatNumber(master.totalViews)} />
        )}
        {master.totalReach !== null && (
          <StatCard label="Reach" value={formatNumber(master.totalReach)} />
        )}
        {master.totalEngagements > 0 && (
          <StatCard label="Content interactions" value={formatNumber(master.totalEngagements)} />
        )}
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
            label={previousMaster ? 'Comparison available' : 'Baseline not synced yet'}
            tone={previousMaster ? 'posts' : 'none'}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {!movement.views.notAvailable && <MovementCard label="Views" movement={movement.views} />}
          {!movement.reach.notAvailable && <MovementCard label="Reach" movement={movement.reach} />}
          {movement.engagements.current > 0 && <MovementCard label="Content interactions" movement={movement.engagements} />}
          {!movement.profileVisits.notAvailable && <MovementCard label="Profile visits" movement={movement.profileVisits} />}
          {!movement.followers.notAvailable && <MovementCard label="Current followers" movement={movement.followers} />}
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
            <h2 className="text-sm font-semibold text-white mb-1">Performance story preview</h2>
            <p className="text-xs text-brand-primary">
              Exactly what {selectedClient?.name ?? 'the client'} sees in the published report — no technical labels.
            </p>
          </div>
          <PerfBadge level={performance.performanceLevel} />
        </div>

        <p className="text-sm leading-relaxed text-white">{performance.performanceHeadline}</p>

        {!performance.hasComparison && (
          <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            Previous month baseline not synced yet — month-over-month growth will appear once {previousMonthLabel} is synced.
            The client report hides growth sections until then (it never shows "data not available").
          </p>
        )}

        {performance.metrics.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {performance.metrics.map(metric => (
              <div key={metric.key} className="rounded-lg border border-brand-muted bg-brand-bg/50 p-3">
                <p className="text-[11px] uppercase tracking-[0.12em] text-brand-primary">{metric.label}</p>
                <p className="mt-2 text-xl font-semibold text-white">{formatNumber(metric.current)}</p>
                {metric.direction && metric.comparisonLabel ? (
                  <p className={`mt-1 text-xs ${
                    metric.trend === 'positive' ? 'text-brand-accent' : metric.trend === 'negative' ? 'text-amber-300' : 'text-brand-primary'
                  }`}>
                    {metric.direction === 'up' ? '↑' : metric.direction === 'down' ? '↓' : '→'}{' '}
                    {metric.percent !== null
                      ? formatPercent(metric.percent)
                      : `${metric.change !== null && metric.change > 0 ? '+' : ''}${formatNumber(metric.change ?? 0)}`}{' '}
                    <span className="text-brand-primary">{metric.comparisonLabel}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-brand-primary/70">No comparison yet</p>
                )}
              </div>
            ))}
          </div>
        )}

        {performance.recommendations.length > 0 && (
          <div className="mt-4 rounded-lg border border-brand-muted bg-brand-bg/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-primary">Recommendations the client will see</p>
            <ol className="mt-2 space-y-1.5">
              {performance.recommendations.map((rec, index) => (
                <li key={index} className="flex gap-2 text-sm text-white">
                  <span className="text-brand-accent">{index + 1}.</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ol>
            {!hasStrategyContent(strategyData) && (
              <div className="mt-3 rounded-lg border border-brand-accent/30 bg-brand-accent/5 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-accent">Use these as the CG action plan</p>
                <p className="mt-1 text-xs text-brand-primary">
                  Copy the recommendations above into the strategy board to give the client a clear action plan. A complete CG action plan makes the report feel finished.
                </p>
              </div>
            )}
          </div>
        )}

        {performance.adminMissingMetrics.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200">Admin-only: metrics not synced (hidden from client)</p>
            <ul className="mt-1.5 space-y-0.5">
              {performance.adminMissingMetrics.map(item => (
                <li key={item} className="text-xs text-amber-200/90">• {item}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-3 text-[11px] text-brand-primary/70">
          Metric sources — Meta synced totals: account monthly total &amp; current snapshot; imported posts: post aggregation &amp; media insight; CSV rows: manual fallback. The client report shows none of these labels.
        </p>
      </section>

      {platformDiagnostics.length > 0 && (
        <section className="bg-brand-surface border border-brand-muted rounded-xl p-4 mb-6 sm:p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-white mb-1">Platform story diagnostics</h2>
            <p className="text-xs text-brand-primary">
              Admin-only: how each platform tab is built — which metric feeds each card, what ranked the top content,
              why content was labelled, and whether follower growth was skipped. The client never sees this.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {platformDiagnostics.map(p => (
              <div key={p.platform} className="rounded-lg border border-brand-muted bg-brand-bg/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{p.label}</p>
                  {p.rankingMetricLabel && (
                    <span className="rounded-full border border-brand-accent/30 bg-brand-accent/10 px-2 py-0.5 text-[11px] font-medium text-brand-accent">
                      Top content by {p.rankingMetricLabel}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-primary">Card metrics &amp; sources</p>
                {p.cardSources.length > 0 ? (
                  <ul className="mt-1 space-y-0.5">
                    {p.cardSources.map(card => (
                      <li key={card.label} className="flex justify-between gap-3 text-xs text-brand-primary">
                        <span>{card.label}</span>
                        <span className="text-white">{card.source}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-brand-primary/70">No usable metrics for this platform yet.</p>
                )}

                {p.audienceBase !== null && (
                  <p className="mt-2 text-xs text-brand-primary">
                    <span className="text-brand-primary/70">Audience base: </span>
                    <span className="text-white">{formatNumber(p.audienceBase)} followers (snapshot)</span>
                  </p>
                )}

                {p.contentToneReason && (
                  <p className="mt-2 text-xs text-brand-primary">
                    <span className="text-brand-primary/70">Content label: </span>{p.contentToneReason}
                  </p>
                )}

                {p.followerGrowthSkippedReason && (
                  <p className="mt-2 rounded border border-amber-400/20 bg-amber-400/5 px-2 py-1 text-[11px] text-amber-200/90">
                    Follower growth skipped: {p.followerGrowthSkippedReason}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-brand-surface border border-brand-muted rounded-xl p-4 mb-6 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white mb-1">Platform breakdown</h2>
            <p className="text-xs text-brand-primary">
              Meta-style platform metrics for {selectedClient?.name ?? 'client'} in {currentMonthLabel}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SourcePill label="Meta synced" tone="posts" />
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
                  label={view.source === 'posts' ? 'Meta synced' : view.source === 'manual' ? 'Manual summary' : 'No data'}
                  tone={view.source}
                />
              </div>
              {view.source === 'none' ? (
                <p className="mt-3 text-xs leading-relaxed text-brand-primary">
                  No matching Meta sync or manual fallback data for {currentMonthLabel}.
                </p>
              ) : (
                <dl className="mt-2 space-y-1 text-xs text-brand-primary">
                  {buildMetaPlatformMetrics(view).map(item => (
                    <div key={item.key} className="flex justify-between gap-3">
                      <dt>{item.label}</dt>
                      <dd className="text-right text-white">{formatNumber(item.value)}</dd>
                    </div>
                  ))}
                  {buildMetaPlatformMetrics(view).length === 0 && (
                    <p className="text-xs text-brand-primary/60">No synced metrics for this period.</p>
                  )}
                  <div className="flex justify-between">
                    <dt>Source</dt>
                    <dd className="text-white">{view.source === 'manual' ? MANUAL_SOURCE_LABELS[view.manual!.source_type] : `${formatNumber(view.postCount)} posts`}</dd>
                  </div>
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
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-brand-primary">Strategy board</p>
                <h2 className="mt-2 text-base font-semibold text-white">Client-facing strategy narrative</h2>
                <p className="mt-1 text-xs text-brand-primary">
                  Use these prompts to turn the report data into clear client direction.
                </p>
              </div>
              {hasReportDraft && !reportId && (
                <div className="shrink-0 text-right">
                  <p className="text-xs text-brand-primary">Draft saved on this device.</p>
                  <button
                    type="button"
                    onClick={clearReportDraft}
                    className="mt-0.5 text-xs text-brand-accent hover:brightness-110 transition"
                  >
                    Clear draft
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <TextInput
                label="Report title"
                value={fields.reportTitle}
                onChange={value => updateField('reportTitle', value)}
                placeholder={`${selectedClient?.name ?? 'Client'} Monthly Report`}
              />
              {strategyNotice && (
                <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
                  {strategyNotice}
                </p>
              )}
              <StrategyChecklist data={strategyData} />
              <GuidedStrategyEditor
                data={strategyData}
                onChange={setStrategyData}
                context={strategyContext}
                optionsByCategory={optionsByCategory}
                usingDefaults={usingDefaults}
                isAdmin={profile?.role === 'admin'}
                onReloadOptions={() => void reloadOptions()}
              />
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <PerformancePanel title="Best performing post" post={stats.bestPost} />

          <section className="bg-brand-surface border border-brand-muted rounded-xl p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Top 3 posts</h2>
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
                    <p className="text-xs text-brand-primary mt-1">
                      {post.post_type ? displayContentType(post.post_type) ?? post.post_type : 'Content type not set'}
                    </p>
                    <p className="text-xs text-brand-primary mt-2">
                      {formatNumber(post.engagements)} {metaEngagementLabel().toLowerCase()}{post.reach !== null ? ` | ${formatNumber(post.reach)} ${metaPrimaryMetricLabel().toLowerCase()}` : ''}
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

// Non-blocking completion guide. Shows staff what is done and what is still
// missing before publishing — saving a draft is always allowed.
function StrategyChecklist({ data }: { data: StrategyData }) {
  const items = strategyChecklist(data)
  const required = items.filter(item => !item.optional)
  const doneCount = required.filter(item => item.done).length
  const allDone = doneCount === required.length

  return (
    <div className="rounded-lg border border-brand-muted bg-brand-bg/50 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-primary">Before you publish</p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${allDone ? 'bg-brand-accent/20 text-brand-accent' : 'bg-brand-muted text-brand-primary'}`}>
          {doneCount}/{required.length} ready
        </span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {items.map(item => (
          <li key={item.key} className="flex items-start gap-2 text-sm">
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                item.done ? 'border-brand-accent bg-brand-accent/15 text-brand-accent' : 'border-brand-muted text-transparent'
              }`}
            >
              ✓
            </span>
            <span className={item.done ? 'text-white' : 'text-brand-primary'}>
              {item.label}
              {item.optional && !item.done ? ' (optional)' : ''}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-brand-primary">This is a guide — you can save a draft at any time.</p>
    </div>
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

const PERF_LEVEL_META: Record<PerformanceLevel, { label: string; classes: string }> = {
  strong: { label: 'Strong month', classes: 'border-brand-accent/30 bg-brand-accent/10 text-brand-accent' },
  improving: { label: 'Improving', classes: 'border-brand-accent/30 bg-brand-accent/10 text-brand-accent' },
  steady: { label: 'Steady', classes: 'border-sky-300/30 bg-sky-300/10 text-sky-200' },
  needs_attention: { label: 'Needs attention', classes: 'border-amber-400/30 bg-amber-400/10 text-amber-200' },
  baseline_only: { label: 'Baseline month', classes: 'border-brand-muted bg-brand-muted/50 text-brand-primary' },
}

function PerfBadge({ level }: { level: PerformanceLevel }) {
  const meta = PERF_LEVEL_META[level]
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${meta.classes}`}>
      {meta.label}
    </span>
  )
}

function movementText(movement: MetricMovement) {
  if (movement.direction === 'missing' || movement.difference === null) {
    return 'Baseline not yet available'
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
          <p className="mt-1 text-xs text-brand-primary">
            {post.post_type
              ? `Content type: ${displayContentType(post.post_type) ?? post.post_type}`
              : 'Content type not set'}
          </p>
          <div className="grid grid-cols-1 gap-2 mt-4 sm:grid-cols-3">
            {buildMetaContentMetrics(post).map(item => (
              <MiniMetric
                key={item.key}
                label={item.label}
                value={formatNumber(item.value)}
              />
            ))}
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
