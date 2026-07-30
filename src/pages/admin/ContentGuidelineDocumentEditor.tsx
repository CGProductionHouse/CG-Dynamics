import { useEffect, useState } from 'react'
import { ActionButton } from '../../components/ui/Buttons'
import {
  addGuidelineVideo,
  guidelineScheduleCandidates,
  importGuidelineVideosFromSchedule,
  reorderGuidelineVideos,
  setGuidelinePublication,
  suggestContentVideos,
  suggestionToVideoInput,
  updateContentGuideline,
  updateGuidelineVideo,
  type ContentGuideline,
  type ContentGuidelineVideo,
  type ContentRun,
  type ContentVideoSuggestion,
} from '../../lib/contentWorkflow'
import { listMonthlyDeliverablesByMonth, type MonthlyDeliverable } from '../../lib/planner'
import { monthDisplayLabel } from '../../lib/reportPeriod'
import { humanizeStatus, INPUT_CLS, LABEL_CLS } from './contentGuidelineHelpers'

interface Props {
  guideline: ContentGuideline
  run: ContentRun
  videos: ContentGuidelineVideo[]
  currentUserId?: string | null
  onChanged: () => Promise<void> | void
}

interface VideoDraft {
  title: string
  script: string
  targetMonth: string
  deliverableId: string
}

function toMonthOption(date: string | null): string {
  return date ? date.slice(0, 7) : ''
}

function nextYearMonths(): { value: string; label: string }[] {
  const months: { value: string; label: string }[] = []
  const now = new Date()
  for (let offset = -1; offset <= 14; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = monthDisplayLabel(value)
    months.push({ value, label })
  }
  return months
}

const MONTH_OPTIONS = nextYearMonths()

const MONTH_OPTIONS_MAP = new Map(MONTH_OPTIONS.map(option => [option.value, option.label]))

function monthLabel(value: string | null): string {
  if (!value) return 'Unallocated'
  const key = value.slice(0, 7)
  return MONTH_OPTIONS_MAP.get(key) ?? key
}

export default function ContentGuidelineDocumentEditor({
  guideline,
  run,
  videos,
  currentUserId,
  onChanged,
}: Props) {
  const [documentTitle, setDocumentTitle] = useState(guideline.title)
  const [coverageStart, setCoverageStart] = useState(toMonthOption(guideline.coverage_start ?? guideline.month))
  const [coverageEnd, setCoverageEnd] = useState(toMonthOption(guideline.coverage_end ?? guideline.coverage_start ?? guideline.month))
  const [drafts, setDrafts] = useState<Record<string, VideoDraft>>({})
  const [newTitle, setNewTitle] = useState('')
  const [newScript, setNewScript] = useState('')
  const [newTargetMonth, setNewTargetMonth] = useState('')
  const [newDeliverableId, setNewDeliverableId] = useState('')
  const [scheduleDeliverables, setScheduleDeliverables] = useState<MonthlyDeliverable[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  // AI suggestions
  const [suggestions, setSuggestions] = useState<ContentVideoSuggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null)
  const [suggestionsContext, setSuggestionsContext] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDocumentTitle(guideline.title)
      setCoverageStart(toMonthOption(guideline.coverage_start ?? guideline.month))
      setCoverageEnd(toMonthOption(guideline.coverage_end ?? guideline.coverage_start ?? guideline.month))
      setDrafts(Object.fromEntries(videos.map(video => [video.id, {
        title: video.title,
        script: video.script ?? '',
        targetMonth: video.month?.slice(0, 7) ?? '',
        deliverableId: video.deliverable_id ?? '',
      }])))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [guideline.id, guideline.title, guideline.coverage_start, guideline.coverage_end, guideline.month, videos])

  // Fetch schedule deliverables across coverage window months
  useEffect(() => {
    let current = true
    if (!guideline.client_id) {
      setScheduleDeliverables([])
      setScheduleError(null)
      return
    }

    const monthsToFetch = new Set<string>()
    if (coverageStart) monthsToFetch.add(coverageStart)
    if (coverageEnd && coverageEnd !== coverageStart) {
      const startParts = coverageStart.split('-').map(Number)
      const endParts = coverageEnd.split('-').map(Number)
      const cursor = new Date(startParts[0], startParts[1] - 1, 1)
      const end = new Date(endParts[0], endParts[1] - 1, 1)
      while (cursor <= end) {
        monthsToFetch.add(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`)
        cursor.setMonth(cursor.getMonth() + 1)
      }
    }

    void Promise.all(
      Array.from(monthsToFetch).map(month =>
        listMonthlyDeliverablesByMonth(month, { clientId: guideline.client_id }),
      ),
    ).then(results => {
      if (!current) return
      const allDeliverables: MonthlyDeliverable[] = []
      let firstError: string | null = null
      for (const result of results) {
        if (result.error && !firstError) firstError = result.error.message
        if (result.data) allDeliverables.push(...(result.data as MonthlyDeliverable[]))
      }
      setScheduleDeliverables(
        allDeliverables.filter(item =>
          item.deliverable_type === 'video' || item.deliverable_type === 'reel',
        ),
      )
      setScheduleError(firstError)
    })

    return () => { current = false }
  }, [guideline.client_id, coverageStart, coverageEnd])

  async function saveCoverage() {
    if (!coverageStart || !coverageEnd) return
    setBusy('coverage')
    setError(null)
    const result = await updateContentGuideline(guideline.id, {
      coverage_start: `${coverageStart}-01`,
      coverage_end: `${coverageEnd}-01`,
    })
    setBusy(null)
    if (result.error) { setError(result.error); return }
    await onChanged()
  }

  function deliverableLabel(deliverable: MonthlyDeliverable) {
    const date = deliverable.scheduled_date ?? deliverable.due_date ?? 'Unscheduled'
    const code = deliverable.code.endsWith(String(deliverable.instance_number))
      ? deliverable.code
      : `${deliverable.code} ${deliverable.instance_number}`
    return `${code} | ${deliverable.title} | ${date} [${monthLabel(deliverable.month)}]`
  }

  const scheduleCandidates = guidelineScheduleCandidates(guideline, scheduleDeliverables, videos)
  const candidatesWithScript = scheduleCandidates.filter(candidate => Boolean(candidate.script)).length
  const candidatesMissingScript = scheduleCandidates.length - candidatesWithScript

  async function importScheduleVideos() {
    if (scheduleCandidates.length === 0) return
    setBusy('import')
    setError(null)
    setImportMessage(null)
    const result = await importGuidelineVideosFromSchedule(
      guideline,
      scheduleDeliverables,
      videos,
      currentUserId ?? null,
    )
    setBusy(null)
    if (result.error) { setError(result.error); return }
    const importedWithScript = result.data.filter(video => Boolean(video.script?.trim())).length
    const importedWithoutScript = result.data.length - importedWithScript
    setImportMessage(
      importedWithoutScript > 0
        ? `Imported ${result.data.length} schedule video${result.data.length === 1 ? '' : 's'}. ${importedWithoutScript} still need${importedWithoutScript === 1 ? '' : 's'} a complete script.`
        : `Imported ${result.data.length} schedule video${result.data.length === 1 ? '' : 's'} with ${importedWithScript} script${importedWithScript === 1 ? '' : 's'}.`,
    )
    await onChanged()
  }

  async function saveDocumentTitle() {
    const title = documentTitle.trim()
    if (!title || title === guideline.title) return
    setBusy('document')
    setError(null)
    const result = await updateContentGuideline(guideline.id, { title })
    setBusy(null)
    if (result.error) { setError(result.error); return }
    await onChanged()
  }

  async function addVideo(month?: string) {
    const title = (month ? newTitle : newTitle).trim()
    const script = (month ? newScript : newScript).trim()
    if (!title || !script) {
      setError('Enter a video name and complete script before adding the video.')
      return
    }
    const targetMonth = month ?? (newTargetMonth || null)
    setBusy('add')
    setError(null)
    const result = await addGuidelineVideo(guideline, {
      title,
      script,
      month: targetMonth,
      position: videos.length + 1,
      created_by: currentUserId ?? null,
      deliverable_id: newDeliverableId || null,
    })
    setBusy(null)
    if (result.error) { setError(result.error); return }
    setNewTitle('')
    setNewScript('')
    setNewTargetMonth('')
    setNewDeliverableId('')
    await onChanged()
  }

  async function saveVideo(video: ContentGuidelineVideo) {
    const draft = drafts[video.id]
    if (!draft?.title.trim() || !draft.script.trim()) {
      setError('Every video needs a name and complete script.')
      return
    }
    setBusy(video.id)
    setError(null)
    const result = await updateGuidelineVideo(video.id, {
      title: draft.title.trim(),
      script: draft.script.trim(),
      month: draft.targetMonth || null,
      deliverable_id: draft.deliverableId || null,
    })
    setBusy(null)
    if (result.error) { setError(result.error); return }
    await onChanged()
  }

  async function moveVideo(index: number, direction: -1 | 1) {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= videos.length) return
    const nextIds = videos.map(video => video.id)
    ;[nextIds[index], nextIds[nextIndex]] = [nextIds[nextIndex], nextIds[index]]
    setBusy('reorder')
    setError(null)
    const result = await reorderGuidelineVideos(guideline.id, nextIds)
    setBusy(null)
    if (result.error) { setError(result.error); return }
    await onChanged()
  }

  async function togglePublication() {
    const publish = !guideline.client_published_at
    setBusy('publish')
    setError(null)
    const result = await setGuidelinePublication(guideline.id, publish)
    setBusy(null)
    if (result.error) { setError(result.error); return }
    await onChanged()
  }

  // AI suggestions
  async function loadSuggestions() {
    if (!guideline.client_id || !coverageStart || !coverageEnd) {
      setSuggestionsError('Set the coverage window first.')
      return
    }
    setSuggestionsLoading(true)
    setSuggestionsError(null)
    setSuggestions([])
    const result = await suggestContentVideos(
      guideline.client_id,
      `${coverageStart}-01`,
      `${coverageEnd}-01`,
      videos.length,
    )
    setSuggestionsLoading(false)
    if (result.error) { setSuggestionsError(result.error); return }
    setSuggestions(result.data.suggestions)
    setSuggestionsContext(
      `${result.data.context.clientName} · ${result.data.context.coverageMonths.length} month${result.data.context.coverageMonths.length === 1 ? '' : 's'} · ${result.data.context.totalDeliverableSlots} available deliverable${result.data.context.totalDeliverableSlots === 1 ? '' : 's'}`,
    )
    setShowSuggestions(true)
  }

  async function acceptSuggestion(suggestion: ContentVideoSuggestion) {
    setBusy(`accept-${suggestion.id}`)
    setError(null)
    const input = suggestionToVideoInput(suggestion, videos.length + 1, currentUserId ?? null)
    const result = await addGuidelineVideo(guideline, {
      ...input,
      script: input.script || 'Script pending — draft from AI suggestion.',
    })
    setBusy(null)
    if (result.error) { setError(result.error); return }
    setSuggestions(current => current.filter(s => s.id !== suggestion.id))
    await onChanged()
  }

  function rejectSuggestion(id: string) {
    setSuggestions(current => current.filter(s => s.id !== id))
  }

  const coverageChanged = coverageStart !== toMonthOption(guideline.coverage_start ?? guideline.month)
    || coverageEnd !== toMonthOption(guideline.coverage_end ?? guideline.coverage_start ?? guideline.month)

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-teal/20 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.10),transparent_42%),rgba(255,255,255,0.025)]">
      <div className="border-b border-white/10 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-teal">Content Guideline</p>
            <div className="mt-2 flex gap-2">
              <input
                className={`${INPUT_CLS} text-base font-black sm:text-lg`}
                value={documentTitle}
                onChange={event => setDocumentTitle(event.target.value)}
                onBlur={() => void saveDocumentTitle()}
                aria-label="Content Guideline title"
              />
            </div>
            <p className="mt-2 text-xs text-white/50">
              {run.name}{run.run_date ? ` | Filming ${run.run_date}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${guideline.client_published_at ? 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-200' : 'border-white/10 text-white/45'}`}>
              {guideline.client_published_at ? 'Published' : 'Draft'}
            </span>
            <ActionButton
              size="sm"
              variant={guideline.client_published_at ? 'secondary' : 'primary'}
              loading={busy === 'publish'}
              onClick={() => void togglePublication()}
            >
              {guideline.client_published_at ? 'Unpublish document' : 'Publish full guideline'}
            </ActionButton>
          </div>
        </div>
        {/* Coverage window */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className={LABEL_CLS}>Coverage start month</span>
            <select className={INPUT_CLS} value={coverageStart} onChange={event => setCoverageStart(event.target.value)}>
              <option value="">Select start month</option>
              {MONTH_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <span className="block text-[10px] text-white/40">First month this shoot plans content for.</span>
          </label>
          <label className="block space-y-1">
            <span className={LABEL_CLS}>Coverage end month</span>
            <select className={INPUT_CLS} value={coverageEnd} onChange={event => setCoverageEnd(event.target.value)}>
              <option value="">Select end month</option>
              {MONTH_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <span className="block text-[10px] text-white/40">Last month this shoot plans content for.</span>
          </label>
        </div>
        {coverageChanged && (
          <div className="mt-3">
            <ActionButton size="sm" loading={busy === 'coverage'} onClick={() => void saveCoverage()}>
              Save coverage window
            </ActionButton>
          </div>
        )}
        {guideline.month && !guideline.coverage_start && (
          <p className="mt-2 text-xs text-amber-200/70">
            This guideline uses a legacy single-month ({monthDisplayLabel(guideline.month.slice(0, 7))}). Set the coverage window above to plan across multiple months.
          </p>
        )}
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {error && <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
        {importMessage && <p className="rounded-lg border border-emerald-300/25 bg-emerald-300/[0.07] px-3 py-2 text-sm text-emerald-100">{importMessage}</p>}

        {scheduleCandidates.length > 0 && (
          <div className="flex flex-col gap-3 rounded-xl border border-brand-teal/25 bg-brand-teal/[0.045] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-white">Client Schedule videos are ready to import</p>
              <p className="mt-1 text-xs leading-relaxed text-white/50">
                {scheduleCandidates.length} unlinked video{scheduleCandidates.length === 1 ? '' : 's'} across the coverage window.
                {' '}{candidatesWithScript} include{candidatesWithScript === 1 ? 's' : ''} a Teams script
                {candidatesMissingScript > 0 ? `; ${candidatesMissingScript} will need a script before publishing.` : '.'}
              </p>
            </div>
            <ActionButton size="sm" loading={busy === 'import'} onClick={() => void importScheduleVideos()}>
              Import {scheduleCandidates.length} from Client Schedule
            </ActionButton>
          </div>
        )}

        {/* AI suggestions */}
        <div className="rounded-xl border border-violet-300/20 bg-violet-300/[0.04] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-white">AI content suggestions</p>
              <p className="mt-1 text-xs text-white/50">
                Get contextual research-driven video ideas for the coverage window.
              </p>
            </div>
            <ActionButton size="sm" variant="secondary" loading={suggestionsLoading} onClick={() => void loadSuggestions()}>
              {suggestions.length > 0 ? 'Refresh suggestions' : 'Research content ideas'}
            </ActionButton>
          </div>
          {suggestionsContext && (
            <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-violet-200/60">{suggestionsContext}</p>
          )}
          {suggestionsError && <p className="mt-2 text-xs text-red-300">{suggestionsError}</p>}
          {showSuggestions && suggestions.length === 0 && !suggestionsLoading && !suggestionsError && (
            <p className="mt-3 text-xs text-white/40">No new suggestions available. Try adjusting the coverage window or add manual videos.</p>
          )}
          {suggestions.length > 0 && (
            <ul className="mt-3 space-y-2">
              {suggestions.map(suggestion => (
                <li key={suggestion.id} className="rounded-lg border border-violet-300/15 bg-black/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white">{suggestion.title}</p>
                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-200/60">
                        {monthLabel(suggestion.targetMonth)}
                      </p>
                      <p className="mt-1 text-xs text-white/55">{suggestion.reasoning}</p>
                      <p className="mt-1 text-xs italic text-white/40">{suggestion.objective}</p>
                      {suggestion.suggestedScriptPreview && (
                        <pre className="mt-2 whitespace-pre-wrap rounded bg-black/40 px-2 py-1.5 text-[11px] leading-relaxed text-white/50">
                          {suggestion.suggestedScriptPreview}
                        </pre>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <ActionButton size="sm" loading={busy === `accept-${suggestion.id}`} onClick={() => void acceptSuggestion(suggestion)}>Accept</ActionButton>
                      <ActionButton size="sm" variant="ghost" onClick={() => rejectSuggestion(suggestion.id)}>Skip</ActionButton>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {videos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 px-4 py-5 text-center text-sm text-white/45">
            No videos yet. Add the first video below, or import from Client Schedule, or use AI suggestions above.
          </p>
        ) : (
          <ol className="space-y-4">
            {videos.map((video, index) => {
              const draft = drafts[video.id] ?? {
                title: video.title,
                script: video.script ?? '',
                targetMonth: video.month?.slice(0, 7) ?? '',
                deliverableId: video.deliverable_id ?? '',
              }
              const changed = draft.title !== video.title
                || draft.script !== (video.script ?? '')
                || draft.targetMonth !== (video.month?.slice(0, 7) ?? '')
                || draft.deliverableId !== (video.deliverable_id ?? '')
              return (
                <li key={video.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-teal">Video {index + 1}</p>
                    <div className="flex items-center gap-1">
                      <button type="button" title="Move video up" disabled={index === 0 || busy === 'reorder'} onClick={() => void moveVideo(index, -1)} className="h-8 w-8 rounded-lg border border-white/10 text-white/55 hover:text-white disabled:opacity-25">&#8593;</button>
                      <button type="button" title="Move video down" disabled={index === videos.length - 1 || busy === 'reorder'} onClick={() => void moveVideo(index, 1)} className="h-8 w-8 rounded-lg border border-white/10 text-white/55 hover:text-white disabled:opacity-25">&#8595;</button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-start gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${draft.targetMonth ? 'border-brand-teal/20 text-brand-teal' : 'border-amber-300/25 text-amber-200'}`}>
                      {draft.targetMonth ? monthLabel(draft.targetMonth) : 'Unallocated'}
                    </span>
                    {video.deliverable_id && (
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold text-white/50">Linked to Schedule</span>
                    )}
                  </div>
                  <label className="mt-3 block space-y-1.5">
                    <span className={LABEL_CLS}>Video name</span>
                    <input
                      className={INPUT_CLS}
                      value={draft.title}
                      onChange={event => setDrafts(current => ({ ...current, [video.id]: { ...draft, title: event.target.value } }))}
                      placeholder="The Paint Shake Test"
                    />
                  </label>
                  <label className="mt-3 block space-y-1.5">
                    <span className={LABEL_CLS}>Target month</span>
                    <select
                      className={INPUT_CLS}
                      value={draft.targetMonth}
                      onChange={event => setDrafts(current => ({ ...current, [video.id]: { ...draft, targetMonth: event.target.value } }))}
                    >
                      <option value="">Unallocated — planned content</option>
                      {MONTH_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <span className="block text-[10px] text-white/40">The publication month this video targets. Leave unallocated while scheduling is confirmed.</span>
                  </label>
                  <label className="mt-3 block space-y-1.5">
                    <span className={LABEL_CLS}>Complete script</span>
                    <textarea
                      className={`${INPUT_CLS} min-h-40 resize-y leading-relaxed`}
                      value={draft.script}
                      onChange={event => setDrafts(current => ({ ...current, [video.id]: { ...draft, script: event.target.value } }))}
                      placeholder="Enter the complete spoken and on-screen script..."
                    />
                  </label>
                  <label className="mt-3 block space-y-1.5">
                    <span className={LABEL_CLS}>Client Schedule video</span>
                    <select
                      className={INPUT_CLS}
                      value={draft.deliverableId}
                      onChange={event => setDrafts(current => ({
                        ...current,
                        [video.id]: { ...draft, deliverableId: event.target.value },
                      }))}
                    >
                      <option value="">Not linked yet</option>
                      {scheduleDeliverables.map(deliverable => (
                        <option
                          key={deliverable.id}
                          value={deliverable.id}
                          disabled={videos.some(item => item.id !== video.id && item.deliverable_id === deliverable.id)}
                        >
                          {deliverableLabel(deliverable)}
                        </option>
                      ))}
                    </select>
                    <span className="block text-[11px] text-white/40">
                      When a matching Client Schedule deliverable exists, link it here.
                    </span>
                  </label>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">Production: {humanizeStatus(video.production_status)}</span>
                    <ActionButton size="sm" variant="secondary" disabled={!changed} loading={busy === video.id} onClick={() => void saveVideo(video)}>Save video</ActionButton>
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        <div className="rounded-xl border border-dashed border-brand-teal/25 bg-brand-teal/[0.035] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-teal">Add Video {videos.length + 1}</p>
          <label className="mt-3 block space-y-1.5">
            <span className={LABEL_CLS}>Video name</span>
            <input className={INPUT_CLS} value={newTitle} onChange={event => setNewTitle(event.target.value)} placeholder="Video title" />
          </label>
          <label className="mt-3 block space-y-1.5">
            <span className={LABEL_CLS}>Target month</span>
            <select className={INPUT_CLS} value={newTargetMonth} onChange={event => setNewTargetMonth(event.target.value)}>
              <option value="">Unallocated — planned content</option>
              {MONTH_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="mt-3 block space-y-1.5">
            <span className={LABEL_CLS}>Complete script</span>
            <textarea className={`${INPUT_CLS} min-h-40 resize-y leading-relaxed`} value={newScript} onChange={event => setNewScript(event.target.value)} placeholder="Enter the complete script before adding this video..." />
          </label>
          <label className="mt-3 block space-y-1.5">
            <span className={LABEL_CLS}>Client Schedule video</span>
            <select className={INPUT_CLS} value={newDeliverableId} onChange={event => setNewDeliverableId(event.target.value)}>
              <option value="">Not linked yet</option>
              {scheduleDeliverables.map(deliverable => (
                <option key={deliverable.id} value={deliverable.id} disabled={videos.some(video => video.deliverable_id === deliverable.id)}>
                  {deliverableLabel(deliverable)}
                </option>
              ))}
            </select>
            {scheduleDeliverables.length === 0 && !scheduleError && (
              <span className="block text-[11px] text-amber-200/70">
                No video or reel deliverables available in the coverage window.
              </span>
            )}
            {scheduleError && <span className="block text-[11px] text-red-300">{scheduleError}</span>}
          </label>
          <div className="mt-3 flex justify-end">
            <ActionButton size="sm" loading={busy === 'add'} onClick={() => void addVideo()}>Add Video {videos.length + 1}</ActionButton>
          </div>
        </div>
      </div>
    </section>
  )
}
