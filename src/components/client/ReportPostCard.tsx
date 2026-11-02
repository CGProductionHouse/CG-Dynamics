import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { RankingMetric, ReportStatsPost } from '../../lib/reportStats'
import { displayContentType, formatDate, formatNumber, PLATFORM_LABELS } from '../../lib/reportStats'
import { buildMetaContentMetrics } from '../../lib/metaMetrics'
import { reportPostImageUrl, reportPostPermalink } from '../../lib/reportPostMedia'
import eye from '../../assets/lucide/eye.svg'
import users from '../../assets/lucide/users.svg'
import heart from '../../assets/lucide/heart.svg'
import image from '../../assets/lucide/image.svg'
import video from '../../assets/lucide/video.svg'
import externalLink from '../../assets/lucide/external-link.svg'
import chevron from '../../assets/lucide/chevron-down.svg'
import maximize from '../../assets/lucide/maximize-2.svg'
import close from '../../assets/lucide/x.svg'

function Icon({ src, className = 'h-4 w-4' }: { src: string; className?: string }) {
  return <img src={src} alt="" aria-hidden="true" className={`${className} shrink-0 brightness-0 invert`} />
}

function PostMedia({ url, isVideo, featured }: { url: string | null; isVideo: boolean; featured: boolean }) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (zoomed && dialog.current && !dialog.current.open) dialog.current.showModal()
  }, [zoomed])
  return <div className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden border-b border-white/[0.06] bg-[radial-gradient(ellipse_at_top_left,rgba(45,212,191,0.16),transparent_65%),linear-gradient(135deg,#102320,#071311)] ${featured ? 'md:aspect-auto md:h-full md:min-h-[20rem]' : ''}`}>
    {url && !failed ? <>
      {!loaded && <span className="absolute text-xs text-slate-400" role="status">Loading preview</span>}
      <img data-post-media src={url} alt={isVideo ? 'Video cover' : 'Post image'} loading="lazy" decoding="async" referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-contain" />
      {loaded && <button type="button" onClick={() => setZoomed(true)} aria-label="Enlarge post image" aria-haspopup="dialog" className="absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-black/70 text-white hover:bg-black/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2dd4bf]"><Icon src={maximize} /></button>}
    </> : <div className="flex flex-col items-center gap-3 px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
        <Icon src={isVideo ? video : image} className="h-7 w-7 opacity-70" />
      </span>
      <span className="text-xs text-slate-400">Preview unavailable</span>
    </div>}
    {isVideo && url && !failed && <span className="absolute bottom-3 right-3 flex items-center gap-2 rounded-full bg-black/75 px-3 py-1.5 text-xs font-semibold text-white"><Icon src={video} />Video</span>}
    <dialog ref={dialog} aria-label="Post image preview" onClose={() => setZoomed(false)} onClick={event => { if(event.target===event.currentTarget) dialog.current?.close() }} className="m-auto max-h-[90dvh] max-w-[94vw] rounded-2xl border border-white/15 bg-[#071311] p-3 text-white shadow-2xl backdrop:bg-black/80">
      {zoomed && <div>
        <div className="mb-2 flex items-center justify-between gap-4 pl-2"><span className="text-sm font-semibold">Post preview</span><button type="button" aria-label="Close image preview" onClick={() => dialog.current?.close()} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2dd4bf]"><Icon src={close} /></button></div>
        <img src={url ?? undefined} alt={isVideo ? 'Full-size video cover' : 'Full-size post image'} referrerPolicy="no-referrer" className="max-h-[74dvh] max-w-full rounded-lg object-contain" onError={() => {dialog.current?.close();setFailed(true)}} />
      </div>}
    </dialog>
  </div>
}

/** Same post presentation for Overview and platform reports, without raw payloads. */
export function ReportPostCard({ post, rank, rankingMetric, children, featured = false }: {
  post: ReportStatsPost; rank?: number; rankingMetric?: RankingMetric | null; children?: ReactNode; featured?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const captionId = useId()
  const media = reportPostImageUrl(post.imageUrl)
  const permalink = reportPostPermalink(post.permalink, post.platform)
  const metrics = buildMetaContentMetrics(post)
  const caption = post.caption?.trim() || 'Post'
  const contentType = displayContentType(post.post_type) ?? post.post_type
  const platform = post.platform ? PLATFORM_LABELS[post.platform] : 'social media'
  const partial = typeof post.engagements !== 'number' && typeof post.engagementKnownSubtotal === 'number'
  const interactions = metrics.find(metric => metric.key === 'content_interactions')
  const measuredRanking = rankingMetric === 'views' && post.impressions === null
    || rankingMetric === 'reach' && post.reach === null
    || rankingMetric === 'interactions' && post.engagements === null ? null : rankingMetric

  return <article className={`flex min-w-0 flex-col overflow-hidden rounded-3xl border bg-[#0b1715] shadow-[0_24px_60px_-40px_rgba(0,0,0,0.95)] ${featured ? 'md:grid md:grid-cols-2' : ''} ${rank === 1 ? 'border-[#2dd4bf]/35' : 'border-white/[0.08]'}`}>
    <div className="relative">
      <PostMedia key={media} url={media} isVideo={/video|reel/i.test(post.post_type ?? '')} featured={featured} />
      {rank && <span className={`absolute left-3 top-3 rounded-full px-3 py-1.5 text-xs font-black ${rank === 1 ? 'bg-[#2dd4bf] text-[#06110f]' : 'border border-white/15 bg-[#06110f]/90 text-white'}`}>#{rank}{measuredRanking ? ` · By ${measuredRanking}` : ''}</span>}
    </div>
    <div className="flex flex-1 flex-col p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>{contentType || platform}</span><time dateTime={post.publish_time ?? undefined}>{formatDate(post.publish_time)}</time>
      </div>
      <p id={captionId} className={`mt-3 break-words text-base font-semibold leading-relaxed text-white ${expanded ? 'whitespace-pre-line' : 'line-clamp-2'}`}>{caption}</p>
      {post.caption?.trim() && <button type="button" aria-expanded={expanded} aria-controls={captionId}
        onClick={() => setExpanded(value => !value)} className="mt-2 inline-flex min-h-11 items-center gap-2 self-start rounded-lg text-xs font-semibold text-slate-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2dd4bf]">
        {expanded ? 'Less caption' : 'Read caption'}<Icon src={chevron} className={`h-3 w-3 ${expanded ? 'rotate-180' : ''}`} />
      </button>}
      <div className="mt-auto pt-4">
        {metrics.length > 0 && <dl className="flex flex-wrap gap-x-6 gap-y-4 border-t border-white/[0.08] pt-4">
          {metrics.map(metric => <div key={metric.key}>
            <dt className="flex items-center gap-1.5 text-xs text-slate-400"><Icon src={metric.key === 'views' ? eye : metric.key === 'reach' ? users : heart} className="h-3.5 w-3.5 opacity-70" />
              {metric.key === 'content_interactions' ? /legacy|imported/i.test(metric.label) ? 'Imported engagements' : 'Interactions' : metric.label}
            </dt>
            <dd className="mt-1 text-3xl font-black tracking-[-0.04em] text-white">{formatNumber(metric.value)}</dd>
          </div>)}
        </dl>}
        {partial && <p className="mt-3 text-xs text-slate-400">{formatNumber(post.engagementKnownSubtotal!)} known interactions · {post.engagementCoverage?.observed ?? 0}/{post.engagementCoverage?.required ?? 0} fields</p>}
        {metrics.length === 0 && !partial && <p className="text-xs text-slate-400">Interaction data unavailable</p>}
        {interactions && <details className="mt-3 text-xs text-slate-400"><summary className="min-h-8 cursor-pointer py-2 hover:text-white">Metric details</summary><p className="pb-2 leading-relaxed">{interactions.label}</p></details>}
        {permalink && <a href={permalink} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-white transition-colors hover:border-[#2dd4bf]/40 hover:bg-[#2dd4bf]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2dd4bf]">View on {platform}<Icon src={externalLink} /></a>}
        {children}
      </div>
    </div>
  </article>
}
