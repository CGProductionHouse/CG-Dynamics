import { useId, useState } from 'react'
import { ClientLogo, type ClientLogoClient } from '../ClientLogo'
import type { PublishedContentGuideline } from '../../lib/clientContentGuides'
import { guidelineVideoName } from '../../lib/contentGuidelineNaming'
import { monthDisplayLabel } from '../../lib/reportPeriod'

/** Presentation only. Callers must supply the existing client-safe projection. */
export function ContentGuidelineDocument({ guide, client, selected = false, clientPath }: {
  guide: PublishedContentGuideline
  client: ClientLogoClient
  selected?: boolean
  clientPath?: string
}) {
  const documentId = useId()
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [manualLink, setManualLink] = useState('')
  const videoId = (index: number) => `${documentId}-video-${index}`
  async function copyLink() {
    if (!clientPath) return
    const link = new URL(clientPath, window.location.origin).href
    try {
      await navigator.clipboard.writeText(link)
      setCopyState('copied')
    } catch { setManualLink(link); setCopyState('failed') }
  }
  const date = guide.filming_date ? new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Johannesburg',
  }).format(new Date(`${guide.filming_date}T12:00:00Z`)) : null

  return (
    <article className={`min-w-0 overflow-hidden rounded-[1.75rem] border bg-[#091714] text-report-text shadow-[0_32px_90px_-55px_#000] ${selected ? 'border-report-accent/50' : 'border-white/10'}`} aria-label={guide.title}>
      <header className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(ellipse_at_top_left,rgba(45,212,191,0.18),transparent_65%)] p-5 sm:p-8 lg:p-10">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-report-accent via-report-accent/50 to-[#f29b55]" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-report-accent">CG Production House <span className="mx-2 text-white/25">/</span> Creative studio</p>
          {clientPath && <button type="button" onClick={() => void copyLink()} className="min-h-11 rounded-full border border-white/15 px-4 text-xs font-semibold text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-report-accent">{copyState === 'copied' ? 'Link copied' : 'Copy guideline link'} <span aria-hidden="true">↗</span></button>}
        </div>
        <div role="status" className="text-xs text-report-muted">{copyState === 'failed' ? 'Select and copy the client link below. Client sign-in is required.' : copyState === 'copied' ? 'Opens this published guide. Client sign-in is required.' : null}</div>
        {copyState === 'failed' && <input aria-label="Client guideline link" readOnly value={manualLink} onFocus={event => event.currentTarget.select()} className="mt-3 min-h-11 w-full rounded-xl border border-white/20 bg-black/20 px-3 text-sm text-white" />}
        <div className="mt-7 flex items-center gap-4 sm:mt-10">
          <ClientLogo client={client} boxClassName="h-14 w-14 rounded-2xl sm:h-16 sm:w-16" frameClassName="border border-white/10 bg-white/[0.04]" />
          <div className="min-w-0"><p className="text-xs text-report-muted">Created for</p><p className="mt-1 break-words text-lg font-bold text-white sm:text-2xl">{client.name}</p></div>
        </div>
        <h2 className="mt-7 text-4xl font-black leading-[1.05] tracking-[-0.045em] text-white sm:text-6xl">Content<br className="sm:hidden" /> guideline<span className="text-report-accent">.</span></h2>
        <p className="mt-3 max-w-3xl break-words text-base text-report-muted sm:text-lg">{guide.title}</p>
        <div className="mt-7 flex flex-wrap gap-x-8 gap-y-4 border-t border-white/10 pt-5 text-sm">
          {guide.month && <Meta label="Content month" value={monthDisplayLabel(guide.month.slice(0, 7))} />}
          {date && <Meta label="Filming" value={date} />}
          <Meta label="In this guide" value={`${guide.videos.length} video${guide.videos.length === 1 ? '' : 's'}`} />
        </div>
      </header>
      <div className="grid min-w-0 lg:grid-cols-[235px_minmax(0,1fr)]">
        <nav aria-label="Videos in this guideline" className="border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
          <div className="lg:sticky lg:top-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-report-muted">The video lineup</p>
            <ol className="mt-3 space-y-1">{guide.videos.map((video, index) => <li key={`${video.position}-${index}`}><a href={`#${videoId(index)}`} className="flex min-h-11 items-start gap-3 rounded-xl px-2 py-3 text-sm text-report-text transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-report-accent"><span className="pt-0.5 font-mono text-xs text-report-accent">{String(video.position).padStart(2, '0')}</span><span className="min-w-0 break-words">{video.title}</span></a></li>)}</ol>
          </div>
        </nav>
        <ol className="min-w-0 divide-y divide-white/10">{guide.videos.map((video, index) => (
          <li key={`${video.position}-${index}`} id={videoId(index)} className="min-w-0 scroll-mt-6 p-5 sm:p-8 lg:p-10">
            <div className="mb-5 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-report-muted">
              <span className="rounded-md bg-report-accent/10 px-2.5 py-1.5 text-report-accent">Video {String(video.position).padStart(2, '0')}</span>
              {video.platform && <span className="break-words px-1">{video.platform}</span>}{video.format && <span className="break-words px-1">{video.format}</span>}
            </div>
            <h3 className="break-words text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">{guidelineVideoName(video.position ?? index + 1, video.title)}</h3>
            {video.objective && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-report-muted">{video.objective}</p>}
            {video.hook && <div className="mt-5 border-l-2 border-report-accent pl-4"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-report-accent">The opening</p><p className="mt-2 whitespace-pre-wrap break-words text-base leading-7 text-white">{video.hook}</p></div>}
            <section aria-label={`Script for ${video.title}`} className="mt-6 overflow-hidden rounded-2xl bg-[#f4f3ee] text-[#172824]">
              <div className="flex items-center justify-between gap-3 border-b border-[#172824]/10 px-5 py-4 sm:px-7"><p className="text-[10px] font-bold uppercase tracking-[0.16em]">{video.script?.trim() ? 'Complete script' : 'Script'}</p><span aria-hidden="true" className="font-mono text-xs text-[#62706a]">{String(video.position).padStart(2, '0')} / CG</span></div>
              <p className="whitespace-pre-wrap break-words px-5 py-6 text-[15px] leading-8 sm:px-7 sm:py-7 sm:text-base">{video.script?.trim() ? video.script : 'A script is not available for this video.'}</p>
            </section>
            {(video.shot_breakdown || video.visual_notes) && <details className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025]">
              <summary className="min-h-11 cursor-pointer rounded-2xl px-5 py-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-report-accent">Filming & visual direction</summary>
              <div className="space-y-5 px-5 pb-5">{video.shot_breakdown && <Direction label="Shot direction" value={video.shot_breakdown} />}{video.visual_notes && <Direction label="Visual direction" value={video.visual_notes} />}</div>
            </details>}
            {video.cta && <div className="mt-5 rounded-2xl border border-report-accent/15 bg-report-accent/[0.05] p-5"><Direction label="The next step" value={video.cta} /></div>}
          </li>
        ))}</ol>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-5 text-[10px] font-semibold tracking-wide text-report-muted sm:px-8"><span>CG PRODUCTION HOUSE</span><span>CREATE. CONNECT. GROW.</span></footer>
    </article>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-report-muted">{label}</p><p className="mt-1 font-semibold text-white">{value}</p></div>
}
function Direction({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-report-accent">{label}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-report-text">{value}</p></div>
}
