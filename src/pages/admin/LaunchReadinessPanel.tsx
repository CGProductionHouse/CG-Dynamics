import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getContentRunDebriefDiagnostics } from '../../lib/contentRunDebrief'
import { supabase } from '../../lib/supabase'

type ReadinessState = {
  contentRuns: number
  runsMissingClient: number
  guidelines: number
  unpublishedGuidelines: number
  videos: number
  videosMissingScript: number
  videosMissingSchedule: number
  publishedReports: number
  microsoftRunStatus: string | null
  microsoftConflicts: number
  microsoftFailures: number
  transcriptionConfigured: boolean | null
  interpretationConfigured: boolean | null
  transcriptionProviders: string[]
  interpretationProviders: string[]
  unavailableChecks: string[]
}

const TRANSCRIPTION_PROVIDERS = ['groq', 'gemini', 'openai']
const INTERPRETATION_PROVIDERS = ['openrouter', 'groq', 'gemini', 'openai']

function missingProviders(configured: string[], expected: string[]): string[] {
  const present = new Set(configured)
  return expected.filter(provider => !present.has(provider))
}

type QueueItem = {
  key: string
  title: string
  detail: string
  count?: number
  to: string
  action: string
  severity: 'blocker' | 'attention' | 'ready'
}

const INITIAL: ReadinessState = {
  contentRuns: 0,
  runsMissingClient: 0,
  guidelines: 0,
  unpublishedGuidelines: 0,
  videos: 0,
  videosMissingScript: 0,
  videosMissingSchedule: 0,
  publishedReports: 0,
  microsoftRunStatus: null,
  microsoftConflicts: 0,
  microsoftFailures: 0,
  transcriptionConfigured: null,
  interpretationConfigured: null,
  transcriptionProviders: [],
  interpretationProviders: [],
  unavailableChecks: [],
}

function message(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return 'check unavailable'
}

export default function LaunchReadinessPanel() {
  const [state, setState] = useState<ReadinessState>(INITIAL)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      const unavailableChecks: string[] = []
      const next = { ...INITIAL }

      const [runs, guidelines, videos, reports, microsoft, voice] = await Promise.allSettled([
        supabase.from('content_runs').select('id, client_id').neq('status', 'cancelled'),
        supabase.from('content_guidelines').select('id, status, client_published_at').neq('status', 'archived'),
        supabase.from('content_guide_ideas').select('id, script, deliverable_id, content_guideline_id, status').neq('status', 'archived').not('content_guideline_id', 'is', null),
        supabase.from('reports').select('id, status').eq('status', 'published'),
        supabase.from('microsoft_sync_runs').select('id, status').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        getContentRunDebriefDiagnostics(),
      ])

      if (runs.status === 'fulfilled' && !runs.value.error) {
        const rows = runs.value.data ?? []
        next.contentRuns = rows.length
        next.runsMissingClient = rows.filter(row => !row.client_id).length
      } else unavailableChecks.push(`Content Runs: ${runs.status === 'rejected' ? message(runs.reason) : message(runs.value.error)}`)

      if (guidelines.status === 'fulfilled' && !guidelines.value.error) {
        const rows = guidelines.value.data ?? []
        next.guidelines = rows.length
        next.unpublishedGuidelines = rows.filter(row => row.status !== 'published' || !row.client_published_at).length
      } else unavailableChecks.push(`Content Guidelines: ${guidelines.status === 'rejected' ? message(guidelines.reason) : message(guidelines.value.error)}`)

      if (videos.status === 'fulfilled' && !videos.value.error) {
        const rows = videos.value.data ?? []
        next.videos = rows.length
        next.videosMissingScript = rows.filter(row => !row.script?.trim()).length
        next.videosMissingSchedule = rows.filter(row => !row.deliverable_id).length
      } else unavailableChecks.push(`Guideline videos: ${videos.status === 'rejected' ? message(videos.reason) : message(videos.value.error)}`)

      if (reports.status === 'fulfilled' && !reports.value.error) {
        next.publishedReports = reports.value.data?.length ?? 0
      } else unavailableChecks.push(`Published reports: ${reports.status === 'rejected' ? message(reports.reason) : message(reports.value.error)}`)

      if (microsoft.status === 'fulfilled' && !microsoft.value.error) {
        const run = microsoft.value.data
        next.microsoftRunStatus = run?.status ?? null
        if (run?.id) {
          const { data, error } = await supabase
            .from('microsoft_sync_run_items')
            .select('action, result_status')
            .eq('run_id', run.id)
          if (error) unavailableChecks.push(`Microsoft run items: ${error.message}`)
          else {
            next.microsoftConflicts = (data ?? []).filter(item => item.action === 'conflict').length
            next.microsoftFailures = (data ?? []).filter(item => item.action === 'failed' || item.result_status === 'failed').length
          }
        }
      } else unavailableChecks.push(`Microsoft Sync: ${microsoft.status === 'rejected' ? message(microsoft.reason) : message(microsoft.value.error)}`)

      if (voice.status === 'fulfilled') {
        next.transcriptionConfigured = voice.value.transcriptionConfigured
        next.interpretationConfigured = voice.value.interpretationConfigured
        next.transcriptionProviders = voice.value.transcriptionProviders
        next.interpretationProviders = voice.value.interpretationProviders
      } else unavailableChecks.push(`Voice debrief: ${message(voice.reason)}`)

      next.unavailableChecks = unavailableChecks
      if (active) {
        setState(next)
        setLoading(false)
      }
    }

    void load()
    return () => { active = false }
  }, [])

  const queue = useMemo<QueueItem[]>(() => {
    const items: QueueItem[] = []
    if (state.runsMissingClient > 0) items.push({
      key: 'run-clients', title: 'Content Runs need client matching', count: state.runsMissingClient,
      detail: 'Resolve the imported client names before these runs can appear in a client portal.',
      to: '/admin/content', action: 'Review Content Runs', severity: 'blocker',
    })
    if (state.videosMissingScript > 0) items.push({
      key: 'scripts', title: 'Guideline videos need scripts', count: state.videosMissingScript,
      detail: 'Add the real shoot script. Empty scripts are never fabricated or published to clients.',
      to: '/admin/content', action: 'Open Content', severity: 'attention',
    })
    if (state.videosMissingSchedule > 0) items.push({
      key: 'schedule', title: 'Guideline videos need schedule links', count: state.videosMissingSchedule,
      detail: 'Link each real video or reel to its canonical Client Schedule deliverable.',
      to: '/admin/client-schedule', action: 'Open Client Schedule', severity: 'attention',
    })
    if (state.unpublishedGuidelines > 0) items.push({
      key: 'guidelines', title: 'Guidelines are not client-published', count: state.unpublishedGuidelines,
      detail: 'Review the videos, order and scripts, then publish only approved guidelines.',
      to: '/admin/content', action: 'Review Guidelines', severity: 'attention',
    })
    if (state.transcriptionConfigured === false) {
      const missing = missingProviders(state.transcriptionProviders, TRANSCRIPTION_PROVIDERS)
      items.push({
        key: 'voice', title: 'Voice transcription needs a provider',
        detail: `Typed English/Afrikaans debriefs still work. Missing: ${missing.join(', ')}. Add the matching server secret (names only, no keys shown).`,
        to: '/admin/integrations', action: 'Open Integrations', severity: 'blocker',
      })
    }
    if (state.interpretationConfigured === false) {
      const missing = missingProviders(state.interpretationProviders, INTERPRETATION_PROVIDERS)
      items.push({
        key: 'voice-interpret', title: 'AI debrief interpretation needs a provider',
        detail: `Typed and voice debriefs both need one interpretation provider. Missing: ${missing.join(', ')}. Add the matching server secret.`,
        to: '/admin/integrations', action: 'Open Integrations', severity: 'blocker',
      })
    }
    if (state.microsoftFailures > 0 || state.microsoftConflicts > 0 || state.microsoftRunStatus !== 'completed') items.push({
      key: 'microsoft', title: 'Microsoft reconciliation needs review', count: state.microsoftFailures + state.microsoftConflicts,
      detail: `Latest run: ${state.microsoftRunStatus ?? 'none'}. Conflicts stay queued until a real client or staff mapping is known.`,
      to: '/admin/microsoft-import', action: 'Open Microsoft Sync', severity: state.microsoftFailures > 0 ? 'blocker' : 'attention',
    })
    if (state.unavailableChecks.length > 0) items.push({
      key: 'unavailable', title: 'Some readiness checks are unavailable', count: state.unavailableChecks.length,
      detail: state.unavailableChecks.join(' | '), to: '/admin/integrations', action: 'Review setup', severity: 'blocker',
    })
    return items
  }, [state])

  const blockers = queue.filter(item => item.severity === 'blocker').length

  return (
    <section className="mb-6 rounded-xl border border-brand-teal/20 bg-gradient-to-br from-brand-teal/[0.08] via-white/[0.025] to-brand-accent/[0.04] p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-teal">Production readiness</p>
          <h2 className="mt-1 text-xl font-black text-white">Launch action queue</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/55">Real data gaps stay visible here until an admin resolves or publishes them.</p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${blockers > 0 ? 'bg-red-400/10 text-red-200' : queue.length > 0 ? 'bg-amber-400/10 text-amber-200' : 'bg-brand-teal/10 text-brand-teal'}`}>
          {loading ? 'Checking' : blockers > 0 ? `${blockers} blocker${blockers === 1 ? '' : 's'}` : queue.length > 0 ? `${queue.length} action${queue.length === 1 ? '' : 's'}` : 'Ready'}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ReadinessMetric label="Content Runs" value={state.contentRuns} />
        <ReadinessMetric label="Guidelines" value={state.guidelines} />
        <ReadinessMetric label="Guideline videos" value={state.videos} />
        <ReadinessMetric label="Published reports" value={state.publishedReports} />
      </div>

      {!loading && (
        <div className="mt-4 space-y-2">
          {queue.length === 0 ? (
            <div className="rounded-lg border border-brand-teal/20 bg-brand-teal/[0.06] px-3 py-3 text-sm text-brand-teal">
              All automated launch checks passed. Client content still requires human approval before publishing.
            </div>
          ) : queue.map(item => (
            <div key={item.key} className={`flex flex-col gap-3 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:justify-between ${item.severity === 'blocker' ? 'border-red-400/20 bg-red-400/[0.05]' : 'border-amber-400/20 bg-amber-400/[0.05]'}`}>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">{item.title}{item.count !== undefined ? ` (${item.count})` : ''}</p>
                <p className="mt-1 break-words text-xs leading-relaxed text-white/55">{item.detail}</p>
              </div>
              <Link to={item.to} className="shrink-0 text-sm font-bold text-brand-teal hover:text-white">{item.action}</Link>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function ReadinessMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value.toLocaleString()}</p>
    </div>
  )
}
