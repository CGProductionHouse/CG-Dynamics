import { useEffect, useState } from 'react'
import { ActionButton } from '../../components/ui/Buttons'
import {
  addGuidelineVideo,
  guidelineScheduleCandidates,
  importGuidelineVideosFromSchedule,
  reorderGuidelineVideos,
  setGuidelinePublication,
  updateContentGuideline,
  updateGuidelineVideo,
  type ContentGuideline,
  type ContentGuidelineVideo,
  type ContentRun,
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
  deliverableId: string
}

export default function ContentGuidelineDocumentEditor({
  guideline,
  run,
  videos,
  currentUserId,
  onChanged,
}: Props) {
  const [documentTitle, setDocumentTitle] = useState(guideline.title)
  const [drafts, setDrafts] = useState<Record<string, VideoDraft>>({})
  const [newTitle, setNewTitle] = useState('')
  const [newScript, setNewScript] = useState('')
  const [newDeliverableId, setNewDeliverableId] = useState('')
  const [scheduleDeliverables, setScheduleDeliverables] = useState<MonthlyDeliverable[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDocumentTitle(guideline.title)
      setDrafts(Object.fromEntries(videos.map(video => [video.id, {
        title: video.title,
        script: video.script ?? '',
        deliverableId: video.deliverable_id ?? '',
      }])))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [guideline.id, guideline.title, videos])

  useEffect(() => {
    let current = true
    const month = guideline.month?.slice(0, 7) ?? ''
    if (!guideline.client_id || !month) {
      const timer = window.setTimeout(() => {
        setScheduleDeliverables([])
        setScheduleError(null)
      }, 0)
      return () => { current = false; window.clearTimeout(timer) }
    }

    void listMonthlyDeliverablesByMonth(month, { clientId: guideline.client_id }).then(({ data, error: loadError }) => {
      if (!current) return
      if (loadError) {
        setScheduleDeliverables([])
        setScheduleError(loadError.message)
        return
      }

      setScheduleError(null)
      setScheduleDeliverables(
        ((data ?? []) as MonthlyDeliverable[]).filter(item =>
          item.deliverable_type === 'video' || item.deliverable_type === 'reel',
        ),
      )
    })

    return () => { current = false }
  }, [guideline.client_id, guideline.month])

  function deliverableLabel(deliverable: MonthlyDeliverable) {
    const date = deliverable.scheduled_date ?? deliverable.due_date ?? 'Unscheduled'
    const code = deliverable.code.endsWith(String(deliverable.instance_number))
      ? deliverable.code
      : `${deliverable.code} ${deliverable.instance_number}`
    return `${code} | ${deliverable.title} | ${date}`
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
    if (result.error) {
      setError(result.error)
      return
    }
    const importedWithScript = result.data.filter(video => Boolean(video.script?.trim())).length
    const importedWithoutScript = result.data.length - importedWithScript
    setImportMessage(
      importedWithoutScript > 0
        ? `Imported ${result.data.length} schedule video${result.data.length === 1 ? '' : 's'}. ${importedWithoutScript} still need${importedWithoutScript === 1 ? 's' : ''} a complete script.`
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

  async function addVideo() {
    const title = newTitle.trim()
    const script = newScript.trim()
    if (!title || !script) {
      setError('Enter a video name and complete script before adding the video.')
      return
    }
    setBusy('add')
    setError(null)
    const result = await addGuidelineVideo(guideline, {
      title,
      script,
      position: videos.length + 1,
      created_by: currentUserId ?? null,
      deliverable_id: newDeliverableId || null,
    })
    setBusy(null)
    if (result.error) { setError(result.error); return }
    setNewTitle('')
    setNewScript('')
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
              {run.name}{guideline.month ? ` | ${monthDisplayLabel(guideline.month.slice(0, 7))}` : ''}{run.run_date ? ` | Filming ${run.run_date}` : ''}
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
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {error && <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
        {importMessage && <p className="rounded-lg border border-emerald-300/25 bg-emerald-300/[0.07] px-3 py-2 text-sm text-emerald-100">{importMessage}</p>}

        {scheduleCandidates.length > 0 && (
          <div className="flex flex-col gap-3 rounded-xl border border-brand-teal/25 bg-brand-teal/[0.045] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-white">Client Schedule videos are ready to import</p>
              <p className="mt-1 text-xs leading-relaxed text-white/50">
                {scheduleCandidates.length} unlinked video{scheduleCandidates.length === 1 ? '' : 's'} for this client and month.
                {' '}{candidatesWithScript} include{candidatesWithScript === 1 ? 's' : ''} a Teams script
                {candidatesMissingScript > 0 ? `; ${candidatesMissingScript} will need a script before publishing.` : '.'}
              </p>
            </div>
            <ActionButton size="sm" loading={busy === 'import'} onClick={() => void importScheduleVideos()}>
              Import {scheduleCandidates.length} from Client Schedule
            </ActionButton>
          </div>
        )}

        {videos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 px-4 py-5 text-center text-sm text-white/45">
            No videos yet. Add Video 1 below with its name and complete script.
          </p>
        ) : (
          <ol className="space-y-4">
            {videos.map((video, index) => {
              const draft = drafts[video.id] ?? {
                title: video.title,
                script: video.script ?? '',
                deliverableId: video.deliverable_id ?? '',
              }
              const changed = draft.title !== video.title
                || draft.script !== (video.script ?? '')
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
                      Links this script to the matching video or reel in Client Schedule.
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
                No video or reel deliverables are available for this client and month.
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
