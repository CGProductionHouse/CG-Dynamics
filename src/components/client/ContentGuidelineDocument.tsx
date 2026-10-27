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
    <article className={`min-w-0 overflow-hidden rounded-[2rem] border bg-[#030706] text-white shadow-[0_35px_90px_-45px_rgba(0,0,0,0.95)] ${selected ? 'border-[#2dd4bf]/40' : 'border-white/10'}`} aria-label={guide.title}>
      <header className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_8%_0%,rgba(45,212,191,0.13),transparent_40%),radial-gradient(circle_at_96%_8%,rgba(249,115,22,0.10),transparent_30%)] p-5 sm:p-8">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2dd4bf] via-[#14b8a6] to-[#f97316]" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.26em] text-[#2dd4bf]">CG Production House</p>
          {clientPath && <button type="button" onClick={() => void copyLink()} className="min-h-11 rounded-full bg-white px-5 py-2.5 text-xs font-bold text-[#06110f] shadow-lg transition hover:bg-[#dffcf6] focus-visible:outline-2 focus-visible:outline-[#2dd4bf]">{copyState === 'copied' ? 'Link copied' : 'Copy guideline link'} <span aria-hidden="true">↗</span></button>}
        </div>
        <div role="status" className="text-xs text-slate-400">{copyState === 'failed' ? 'Select and copy the client link below. Client sign-in is required.' : copyState === 'copied' ? 'Opens this published guide. Client sign-in is required.' : null}</div>
        {copyState === 'failed' && <input aria-label="Client guideline link" readOnly value={manualLink} onFocus={event => event.currentTarget.select()} className="mt-3 min-h-11 w-full rounded-xl border border-white/20 bg-black/20 px-3 text-sm text-white" />}
        <div className="mt-6 flex items-center gap-4">
          <ClientLogo client={client} boxClassName="h-12 w-12 rounded-2xl sm:h-14 sm:w-14" frameClassName="border border-white/10 bg-white/[0.07]" />
          <p className="min-w-0 break-words text-lg font-bold text-white sm:text-xl">{client.name}</p>
        </div>
        <h2 className="mt-5 text-3xl font-black leading-tight tracking-[-0.035em] text-white sm:text-5xl">Content guideline</h2>
        <p className="mt-3 max-w-3xl break-words text-sm text-slate-400 sm:text-base">{guide.title}</p>
        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-4 border-t border-white/10 pt-5 text-sm">
          {guide.month && <Meta label="Content month" value={monthDisplayLabel(guide.month.slice(0, 7))} />}
          {date && <Meta label="Filming" value={date} />}
          <Meta label="In this guide" value={`${guide.videos.length} video${guide.videos.length === 1 ? '' : 's'}`} />
        </div>
      </header>
      <div className="grid min-w-0 lg:grid-cols-[235px_minmax(0,1fr)]">
        <nav aria-label="Videos in this guideline" className="border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
          <div className="lg:sticky lg:top-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">The video lineup</p>
            <ol className="mt-3 space-y-2">{guide.videos.map((video, index) => <li key={`${video.position}-${index}`}><a href={`#${videoId(index)}`} className="flex min-h-11 items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-3 text-sm text-slate-200 transition hover:border-[#2dd4bf]/35 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-[#2dd4bf]"><span className="pt-0.5 font-mono text-xs text-[#2dd4bf]">{String(video.position).padStart(2, '0')}</span><span className="min-w-0 break-words">{video.title}</span></a></li>)}</ol>
          </div>
        </nav>
        <ol className="min-w-0 divide-y divide-white/10">{guide.videos.map((video, index) => (
          <li key={`${video.position}-${index}`} id={videoId(index)} className="min-w-0 scroll-mt-6 p-5 sm:p-8 lg:p-10">
            <div className="mb-5 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              <span className="rounded-md bg-[#2dd4bf]/10 px-2.5 py-1.5 text-[#2dd4bf]">Video {String(video.position).padStart(2, '0')}</span>
              {video.platform && <span className="break-words px-1">{video.platform}</span>}{video.format && <span className="break-words px-1">{video.format}</span>}
            </div>
            <h3 className="break-words text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">{guidelineVideoName(video.position ?? index + 1, video.title)}</h3>
            {video.objective && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-400">{video.objective}</p>}
            {video.hook && <div className="mt-5 border-l-2 border-[#2dd4bf] pl-4"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#2dd4bf]">The opening</p><p className="mt-2 whitespace-pre-wrap break-words text-base leading-7 text-white">{video.hook}</p></div>}
            <section aria-label={`Script for ${video.title}`} className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] text-slate-200">
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4 sm:px-7"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{video.script?.trim() ? 'Complete script' : 'Script'}</p><span aria-hidden="true" className="font-mono text-xs text-slate-500">{String(video.position).padStart(2, '0')} / CG</span></div>
              <p className="whitespace-pre-wrap break-words px-5 py-6 text-[15px] leading-8 sm:px-7 sm:py-7 sm:text-base">{video.script?.trim() ? video.script : 'A script is not available for this video.'}</p>
            </section>
            {(video.shot_breakdown || video.visual_notes) && <details className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025]">
              <summary className="min-h-11 cursor-pointer rounded-2xl px-5 py-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-[#2dd4bf]">Filming & visual direction</summary>
              <div className="space-y-5 px-5 pb-5">{video.shot_breakdown && <Direction label="Shot direction" value={video.shot_breakdown} />}{video.visual_notes && <Direction label="Visual direction" value={video.visual_notes} />}</div>
            </details>}
            {video.cta && <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-5"><Direction label="The next step" value={video.cta} /></div>}
          </li>
        ))}</ol>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-5 text-[10px] font-semibold tracking-wide text-slate-500 sm:px-8"><span>CG PRODUCTION HOUSE</span><span>CREATE. CONNECT. GROW.</span></footer>
    </article>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="mt-1 font-semibold text-white">{value}</p></div>
}
function Direction({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#2dd4bf]">{label}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">{value}</p></div>
}
