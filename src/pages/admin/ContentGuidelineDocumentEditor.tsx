import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { ActionButton } from '../../components/ui/Buttons'
import {
  addGuidelineVideo,
  developGuidelineVideos,
  guidelineScheduleCandidates,
  ideaToVideoInput,
  importGuidelineVideosFromSchedule,
  planGuidelineVideoIdeas,
  reorderGuidelineVideos,
  runGuideAction,
  setGuidelinePublication,
  updateContentGuideline,
  updateGuidelineVideo,
  type ContentGuideline,
  type ContentGuidelineVideo,
  type ContentRun,
  type GuidelineVideoDevelopment,
  type GuidelineVideoIdea,
} from '../../lib/contentWorkflow'
import { guidelineVideoName, guidelineVideoNumber } from '../../lib/contentGuidelineNaming'
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
  shotBreakdown: string
  requirements: string
  visualNotes: string
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
  const navigate = useNavigate()
  const { profile } = useAuth()
  const monthOptions = [...new Set([
    ...MONTH_OPTIONS.map(option => option.value),
    guideline.month?.slice(0, 7), guideline.coverage_start?.slice(0, 7), guideline.coverage_end?.slice(0, 7),
    ...videos.map(video => video.month?.slice(0, 7)),
  ].filter((value): value is string => Boolean(value)))].sort().map(value => ({ value, label: monthDisplayLabel(value) }))
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
  // AI Content Director — step 1 plans ideas, step 2 develops the saved videos.
  const [ideas, setIdeas] = useState<Array<GuidelineVideoIdea & { _localId: string }>>([])
  const [ideasLoading, setIdeasLoading] = useState(false)
  const [ideasError, setIdeasError] = useState<string | null>(null)
  const [ideasContext, setIdeasContext] = useState<string | null>(null)
  const [researchNote, setResearchNote] = useState<string | null>(null)
  const [plannedOnce, setPlannedOnce] = useState(false)
  const [developments, setDevelopments] = useState<GuidelineVideoDevelopment[]>([])
  const [developLoading, setDevelopLoading] = useState(false)
  const [developError, setDevelopError] = useState<string | null>(null)
  const [developContext, setDevelopContext] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDocumentTitle(guideline.title)
      setCoverageStart(toMonthOption(guideline.coverage_start ?? guideline.month))
      setCoverageEnd(toMonthOption(guideline.coverage_end ?? guideline.coverage_start ?? guideline.month))
      setDrafts(current => Object.fromEntries(videos.map(video => [video.id, current[video.id] ?? {
        title: video.title,
        script: video.script ?? '',
        targetMonth: video.month?.slice(0, 7) ?? '',
        deliverableId: video.deliverable_id ?? '',
        shotBreakdown: video.shot_breakdown ?? '',
        requirements: video.requirements ?? '',
        visualNotes: video.visual_notes ?? '',
      }])))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [guideline.id, guideline.title, guideline.coverage_start, guideline.coverage_end, guideline.month, videos])

  // Fetch schedule deliverables across coverage window months
  useEffect(() => {
    let current = true
    if (!guideline.client_id) {
      const timer = window.setTimeout(() => {
        setScheduleDeliverables([])
        setScheduleError(null)
      }, 0)
      return () => window.clearTimeout(timer)
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
      shot_breakdown: draft.shotBreakdown.trim() || null,
      requirements: draft.requirements.trim() || null,
      visual_notes: draft.visualNotes.trim() || null,
    })
    setBusy(null)
    if (result.error) { setError(result.error); return }
    setDrafts(current => {
      if (current[video.id] !== draft) return current
      const next = { ...current }
      delete next[video.id]
      return next
    })
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
    if (publish) {
      if (videos.some(video => {
        const draft = drafts[video.id]
        return draft && (draft.title !== video.title || draft.script !== (video.script ?? '')
          || draft.targetMonth !== (video.month?.slice(0, 7) ?? '')
          || draft.deliverableId !== (video.deliverable_id ?? '')
          || draft.shotBreakdown !== (video.shot_breakdown ?? '')
          || draft.requirements !== (video.requirements ?? '')
          || draft.visualNotes !== (video.visual_notes ?? ''))
      })) {
        setError('Save your video changes before publishing the guideline.')
        return
      }
      const incomplete = videos.filter(v => !v.script?.trim() || /^script pending/i.test(v.script.trim()))
      if (incomplete.length > 0) {
        setError(`Cannot publish: ${incomplete.length} video${incomplete.length === 1 ? '' : 's'} ${incomplete.length === 1 ? 'is' : 'are'} missing a complete script.`)
        return
      }
      if (videos.length === 0) {
        setError('Cannot publish: add at least one video with a complete script before publishing.')
        return
      }
    }
    setBusy('publish')
    setError(null)
    const result = await setGuidelinePublication(guideline.id, publish)
    setBusy(null)
    if (result.error) { setError(result.error); return }
    await onChanged()
  }

  async function archiveVideo(video: ContentGuidelineVideo) {
    if (!window.confirm(`Archive "${video.title}"? This removes it from the guideline but keeps the record.`)) return
    setBusy(`archive-${video.id}`)
    setError(null)
    const result = await runGuideAction(video.id, 'archive')
    setBusy(null)
    if (result.error) { setError(result.error); return }
    await onChanged()
  }

  // ── Step 1: plan ordered, client-specific ideas (drafts — nothing is written) ──
  async function planIdeas() {
    if (!guideline.client_id || !coverageStart || !coverageEnd) {
      setIdeasError('Set the coverage window first.')
      return
    }
    setIdeasLoading(true)
    setIdeasError(null)
    setIdeas([])
    const result = await planGuidelineVideoIdeas(guideline, { start: `${coverageStart}-01`, end: `${coverageEnd}-01` })
    setIdeasLoading(false)
    setPlannedOnce(true)
    if (result.error) { setIdeasError(result.error); return }
    setIdeas(result.data.ideas.map((idea, index) => ({ ...idea, _localId: `idea-${index}` })))
    setIdeasContext(
      `${result.data.context.clientName} · ${result.data.context.coverageMonths.join(', ')} · ${result.data.context.totalDeliverableSlots} Client Schedule slot${result.data.context.totalDeliverableSlots === 1 ? '' : 's'}`,
    )
    setResearchNote(result.data.sources.liveExternalResearch[0] ?? null)
  }

  async function acceptIdea(idea: GuidelineVideoIdea & { _localId: string }, position: number) {
    setBusy(`idea-${idea._localId}`)
    setError(null)
    const result = await addGuidelineVideo(guideline, ideaToVideoInput(idea, position, currentUserId ?? null))
    setBusy(null)
    if (result.error) { setError(result.error); return }
    setIdeas(current => current.filter(item => item._localId !== idea._localId))
    await onChanged()
  }

  async function acceptAllIdeas() {
    setBusy('accept-all')
    setError(null)
    let position = videos.length
    for (const idea of ideas) {
      position += 1
      const result = await addGuidelineVideo(guideline, ideaToVideoInput(idea, position, currentUserId ?? null))
      if (result.error) { setBusy(null); setError(result.error); await onChanged(); return }
    }
    setIdeas([])
    setBusy(null)
    await onChanged()
  }

  function skipIdea(localId: string) {
    setIdeas(current => current.filter(item => item._localId !== localId))
  }

  // ── Step 2: develop the SAVED videos — saved order and staff edits are authoritative ──
  async function developSavedVideos() {
    if (videos.length === 0) {
      setDevelopError('Accept or add at least one video first.')
      return
    }
    if (!coverageStart || !coverageEnd) {
      setDevelopError('Set the coverage window first.')
      return
    }
    setDevelopLoading(true)
    setDevelopError(null)
    setDevelopments([])
    const result = await developGuidelineVideos(guideline, { start: `${coverageStart}-01`, end: `${coverageEnd}-01` })
    setDevelopLoading(false)
    if (result.error) { setDevelopError(result.error); return }
    setDevelopments(result.data.developments)
    setDevelopContext(`${result.data.context.developedCount} of ${result.data.context.requestedCount} video${result.data.context.requestedCount === 1 ? '' : 's'} drafted — review before saving.`)
  }

  const DEVELOP_FIELDS = [
    ['script', 'script', 'Complete script'],
    ['shotBreakdown', 'shot_breakdown', 'Shot-by-shot breakdown'],
    ['requirements', 'requirements', 'People, products & props'],
    ['visualNotes', 'visual_notes', 'Visual / filming notes'],
    ['cta', 'cta', 'Call to action'],
  ] as const

  function developmentConflicts(video: ContentGuidelineVideo, development: GuidelineVideoDevelopment) {
    return DEVELOP_FIELDS.filter(([draftField, videoField]) =>
      Boolean(development[draftField]?.trim()) && Boolean((video[videoField] as string | null)?.trim()))
  }

  /** `fill` writes only empty fields; `replace` overwrites the staff text as well (explicit click). */
  async function applyDevelopment(video: ContentGuidelineVideo, development: GuidelineVideoDevelopment, mode: 'fill' | 'replace') {
    const patch: Record<string, string> = {}
    for (const [draftField, videoField] of DEVELOP_FIELDS) {
      const value = development[draftField]?.trim()
      if (!value) continue
      const existing = (video[videoField] as string | null)?.trim()
      if (!existing || mode === 'replace') patch[videoField] = value
    }
    if (Object.keys(patch).length === 0) {
      setDevelopError('Every field already has your own text. Use Replace to overwrite it.')
      return
    }
    setBusy(`develop-${video.id}`)
    setDevelopError(null)
    const result = await updateGuidelineVideo(video.id, patch)
    setBusy(null)
    if (result.error) { setDevelopError(result.error); return }
    setDevelopments(current => current.filter(item => item.videoId !== video.id))
    setDrafts(current => {
      const next = { ...current }
      delete next[video.id]
      return next
    })
    await onChanged()
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
            {guideline.client_published_at && run.client_id && (profile?.role === 'admin' || profile?.role === 'manager') && (
              <ActionButton
                size="sm"
                variant="secondary"
                onClick={() => {
                  const month = guideline.coverage_start ? guideline.coverage_start.slice(0, 7) : guideline.month?.slice(0, 7)
                  navigate(`/admin/content-guide-preview?client=${encodeURIComponent(run.client_id!)}${month ? `&month=${month}` : ''}`)
                }}
              >
                Preview as client
              </ActionButton>
            )}
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
              {monthOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <span className="block text-[10px] text-white/40">First month this shoot plans content for.</span>
          </label>
          <label className="block space-y-1">
            <span className={LABEL_CLS}>Coverage end month</span>
            <select className={INPUT_CLS} value={coverageEnd} onChange={event => setCoverageEnd(event.target.value)}>
              <option value="">Select end month</option>
              {monthOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
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

        {/* AI Content Director — plan ideas, then develop the saved videos */}
        <div className="rounded-xl border border-violet-300/20 bg-violet-300/[0.04] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-black text-white">AI Content Director</p>
              <p className="mt-1 text-xs leading-relaxed text-white/50">
                Step 1 plans ideas for this client from its approved client knowledge, the Client Schedule and the approved Marketing Library.
                You edit and reorder them. Step 2 writes the scripts, shot plans and CTAs for the videos you kept.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <ActionButton size="sm" variant="secondary" loading={ideasLoading} onClick={() => void planIdeas()}>
                {plannedOnce ? 'Plan more ideas' : 'Plan video ideas'}
              </ActionButton>
              <ActionButton size="sm" variant="secondary" loading={developLoading} disabled={videos.length === 0} onClick={() => void developSavedVideos()}>
                Develop scripts &amp; shot plans
              </ActionButton>
            </div>
          </div>
          {ideasContext && <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-violet-200/60">{ideasContext}</p>}
          {researchNote && <p className="mt-1 text-[11px] text-white/40">{researchNote}</p>}
          {ideasError && <p className="mt-2 text-xs text-red-300">{ideasError}</p>}
          {developError && <p className="mt-2 text-xs text-red-300">{developError}</p>}
          {developContext && developments.length > 0 && <p className="mt-2 text-[11px] text-teal-200/70">{developContext}</p>}
          {plannedOnce && ideas.length === 0 && !ideasLoading && !ideasError && (
            <p className="mt-3 text-xs text-white/40">No new ideas were returned. Adjust the coverage window, or add videos yourself below.</p>
          )}

          {ideas.length > 0 && (
            <>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-200/70">Step 1 · proposed ideas, in order</p>
                <ActionButton size="sm" loading={busy === 'accept-all'} onClick={() => void acceptAllIdeas()}>Accept all in order</ActionButton>
              </div>
              <ol className="mt-2 space-y-2">
                {ideas.map((idea, index) => (
                  <li key={idea._localId} className="rounded-lg border border-violet-300/15 bg-black/30 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-white">{guidelineVideoName(videos.length + index + 1, idea.title)}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
                            {idea.targetMonth ? monthLabel(idea.targetMonth) : 'Unallocated'}
                          </span>
                          {idea.deliverableId && <span className="rounded-full border border-brand-teal/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-teal">Client Schedule slot</span>}
                        </div>
                        <p className="mt-1.5 text-xs italic text-white/45">{idea.objective}</p>
                        {idea.hook && <p className="mt-1 text-xs text-violet-200/60">Hook: {idea.hook}</p>}
                        {idea.angle && <p className="mt-1 text-xs text-white/55">{idea.angle}</p>}
                        {idea.audience && <p className="mt-1 text-[11px] text-white/40">Audience: {idea.audience}</p>}
                        {idea.needsConfirmation && (
                          <p className="mt-1.5 rounded border border-amber-300/25 bg-amber-300/[0.07] px-2 py-1 text-[11px] text-amber-100">
                            Confirm with client: {idea.needsConfirmation}
                          </p>
                        )}
                        {idea.evidence.length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-white/40">Where this comes from</summary>
                            <ul className="mt-1 space-y-1">
                              {idea.evidence.map((item, evidenceIndex) => (
                                <li key={evidenceIndex} className="text-[11px] text-white/45">
                                  <span className="font-bold uppercase tracking-wider text-white/35">{humanizeStatus(item.kind)}</span>{' '}{item.note}
                                  {item.sourceUri && (
                                    <a className="ml-1 text-brand-teal underline" href={item.sourceUri} target="_blank" rel="noreferrer">source</a>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <ActionButton size="sm" loading={busy === `idea-${idea._localId}`} onClick={() => void acceptIdea(idea, videos.length + 1)}>Accept</ActionButton>
                        <ActionButton size="sm" variant="ghost" onClick={() => skipIdea(idea._localId)}>Skip</ActionButton>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}

          {developments.length > 0 && (
            <>
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-teal-200/70">Step 2 · drafted for your saved videos</p>
              <ul className="mt-2 space-y-2">
                {developments.map(development => {
                  const video = videos.find(item => item.id === development.videoId)
                  if (!video) return null
                  const index = videos.indexOf(video)
                  const conflicts = developmentConflicts(video, development)
                  return (
                    <li key={development.videoId} className="rounded-lg border border-teal-300/15 bg-black/30 p-3">
                      <p className="text-sm font-black text-white">{guidelineVideoName(index + 1, video.title)}</p>
                      {conflicts.length > 0 ? (
                        <p className="mt-1 text-[11px] text-amber-200/80">
                          You already wrote: {conflicts.map(([, , label]) => label).join(', ')}. Those stay unless you choose Replace.
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] text-white/40">All fields are empty — applying fills them in.</p>
                      )}
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-white/40">Read the draft</summary>
                        <div className="mt-1 space-y-2">
                          {DEVELOP_FIELDS.map(([draftField, , label]) => development[draftField]?.trim() ? (
                            <div key={draftField}>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">{label}</p>
                              <pre className="mt-0.5 whitespace-pre-wrap rounded bg-black/40 px-2 py-1.5 text-[11px] leading-relaxed text-white/55">{development[draftField]}</pre>
                            </div>
                          ) : null)}
                          {development.notes && <p className="text-[11px] text-amber-200/70">Confirm: {development.notes}</p>}
                        </div>
                      </details>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <ActionButton size="sm" loading={busy === `develop-${video.id}`} onClick={() => void applyDevelopment(video, development, 'fill')}>
                          {conflicts.length > 0 ? 'Fill empty fields' : 'Apply to this video'}
                        </ActionButton>
                        {conflicts.length > 0 && (
                          <ActionButton size="sm" variant="secondary" loading={busy === `develop-${video.id}`} onClick={() => void applyDevelopment(video, development, 'replace')}>
                            Replace my text
                          </ActionButton>
                        )}
                        <ActionButton size="sm" variant="ghost" onClick={() => setDevelopments(current => current.filter(item => item.videoId !== development.videoId))}>Discard draft</ActionButton>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
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
                shotBreakdown: video.shot_breakdown ?? '',
                requirements: video.requirements ?? '',
                visualNotes: video.visual_notes ?? '',
              }
              const changed = draft.title !== video.title
                || draft.script !== (video.script ?? '')
                || draft.targetMonth !== (video.month?.slice(0, 7) ?? '')
                || draft.deliverableId !== (video.deliverable_id ?? '')
                || draft.shotBreakdown !== (video.shot_breakdown ?? '')
                || draft.requirements !== (video.requirements ?? '')
                || draft.visualNotes !== (video.visual_notes ?? '')
              return (
                <li key={video.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 break-words text-xs font-black uppercase tracking-[0.14em] text-brand-teal">{guidelineVideoName(index + 1, draft.title || video.title)}</p>
                    <div className="flex items-center gap-1">
                      <button type="button" title="Move video up" disabled={index === 0 || busy === 'reorder'} onClick={() => void moveVideo(index, -1)} className="h-8 w-8 rounded-lg border border-white/10 text-white/55 hover:text-white disabled:opacity-25">&#8593;</button>
                      <button type="button" title="Move video down" disabled={index === videos.length - 1 || busy === 'reorder'} onClick={() => void moveVideo(index, 1)} className="h-8 w-8 rounded-lg border border-white/10 text-white/55 hover:text-white disabled:opacity-25">&#8595;</button>
                      <button type="button" title="Archive video" disabled={busy?.startsWith('archive-')} onClick={() => void archiveVideo(video)} className="h-8 w-8 rounded-lg border border-amber-300/25 text-amber-200 hover:bg-amber-300/10 disabled:opacity-25" aria-label="Archive video">&#9745;</button>
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
                    <span className={LABEL_CLS}>Descriptive name (shown as {guidelineVideoNumber(index + 1)} - name)</span>
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
                      {monthOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <span className="block text-[10px] text-white/40">The publication month this video targets. Leave unallocated while scheduling is confirmed.</span>
                  </label>
                  <label className="mt-3 block space-y-1.5">
                    <span className={LABEL_CLS}>Complete script</span>
                    <textarea
                      className={`${INPUT_CLS} min-h-24 resize-y leading-relaxed`}
                      value={draft.script}
                      onChange={event => setDrafts(current => ({ ...current, [video.id]: { ...draft, script: event.target.value } }))}
                      placeholder="Enter the complete spoken and on-screen script..."
                    />
                  </label>
                  {([
                    ['shotBreakdown', 'Shot-by-shot breakdown'],
                    ['requirements', 'People, products & props'],
                    ['visualNotes', 'Visual / filming notes'],
                  ] as const).map(([field, label]) => (
                    <label key={field} className="mt-3 block space-y-1.5">
                      <span className={LABEL_CLS}>{label}</span>
                      <textarea className={`${INPUT_CLS} min-h-24 resize-y leading-relaxed`}
                        value={draft[field]}
                        onChange={event => setDrafts(current => ({ ...current, [video.id]: { ...draft, [field]: event.target.value } }))} />
                    </label>
                  ))}
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
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-teal">Add {guidelineVideoNumber(videos.length + 1)}</p>
          <label className="mt-3 block space-y-1.5">
            <span className={LABEL_CLS}>Video name</span>
            <input className={INPUT_CLS} value={newTitle} onChange={event => setNewTitle(event.target.value)} placeholder="Video title" />
          </label>
          <label className="mt-3 block space-y-1.5">
            <span className={LABEL_CLS}>Target month</span>
            <select className={INPUT_CLS} value={newTargetMonth} onChange={event => setNewTargetMonth(event.target.value)}>
              <option value="">Unallocated — planned content</option>
              {monthOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
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
            <ActionButton size="sm" loading={busy === 'add'} onClick={() => void addVideo()}>Add {guidelineVideoNumber(videos.length + 1)}</ActionButton>
          </div>
        </div>
      </div>
    </section>
  )
}
