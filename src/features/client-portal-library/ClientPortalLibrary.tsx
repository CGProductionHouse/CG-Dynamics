import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClientPortalEmptyState } from '../../components/client/ClientPortalStates'
import { getClientPortalAssetAccess, loadClientPortalLibraryFiles } from './api'
import type {
  ClientPortalLibraryAsset,
  ClientPortalLibraryCategory,
  ClientPortalLibraryCategorySummary,
  ClientPortalLibraryFilesPage,
  ClientPortalLibraryState,
} from './types'

const CATEGORY_LABELS: Record<ClientPortalLibraryCategory, string> = {
  brand_identity: 'Brand Identity',
  graphic_design: 'Graphic Design',
  video: 'Video',
}

export function ClientPortalLibrary({ library }: { library: ClientPortalLibraryState }) {
  if (!library.available) {
    return (
      <ClientPortalEmptyState
        eyebrow="Client-safe library"
        title="Your library is being prepared"
        message="CG will make this space available after the exact client-safe folder has been verified. Working files, source files and raw production assets remain private."
      />
    )
  }

  return (
    <section aria-labelledby="client-library-heading" className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2dd4bf]">Client files</p>
          <h2 id="client-library-heading" className="mt-2 text-2xl font-black tracking-[-0.035em] text-white sm:text-3xl">Library</h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-slate-400">Choose a category, year and month. Files load only when you open that section.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {library.categories.map(summary => <LibraryCategory key={summary.category} summary={summary} />)}
      </div>
    </section>
  )
}

function LibraryCategory({ summary }: { summary: ClientPortalLibraryCategorySummary }) {
  const flat = summary.category === 'brand_identity'
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [page, setPage] = useState<ClientPortalLibraryFilesPage | null>(null)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestSequence = useRef(0)

  async function loadFiles(year: number | null, month: number | null, offset = 0) {
    const key = `${year ?? 'flat'}-${month ?? 'flat'}`
    const requestId = requestSequence.current + 1
    requestSequence.current = requestId
    setSelectedYear(year)
    setSelectedMonth(month)
    setLoading(true)
    setError(null)
    const result = await loadClientPortalLibraryFiles(summary.category, year, month, offset)
    if (requestSequence.current !== requestId) return
    if (!result.data) {
      setError(result.error)
      setLoading(false)
      return
    }
    setPage(current => offset > 0 && loadedKey === key && current
      ? { assets: [...current.assets, ...result.data!.assets], nextOffset: result.data!.nextOffset }
      : result.data)
    setLoadedKey(key)
    setLoading(false)
  }

  function chooseYear(year: number) {
    setSelectedYear(year)
    setSelectedMonth(null)
    requestSequence.current += 1
    setPage(null)
    setLoadedKey(null)
    setError(null)
  }

  const selectedYearSummary = summary.years.find(item => item.year === selectedYear)
  const currentKey = `${selectedYear ?? 'flat'}-${selectedMonth ?? 'flat'}`
  const visiblePage = loadedKey === currentKey ? page : null

  return (
    <article className="min-w-0 rounded-[1.75rem] border border-white/[0.08] bg-white/[0.035] p-5 shadow-[0_24px_70px_-52px_rgba(0,0,0,0.95)] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-black text-white">{CATEGORY_LABELS[summary.category]}</h3>
        <FileCount count={summary.fileCount} />
      </div>

      {summary.fileCount === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm leading-6 text-slate-500">No files in this category yet.</p>
      ) : flat ? (
        <div className="mt-5">
          {!visiblePage && <BrowseButton loading={loading} onClick={() => void loadFiles(null, null)}>View files</BrowseButton>}
          {visiblePage && <FileList page={visiblePage} loading={loading} error={error} onMore={() => void loadFiles(null, null, visiblePage.nextOffset ?? 0)} />}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-500">Year</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {summary.years.map(year => (
                <button key={year.year} type="button" onClick={() => chooseYear(year.year)} className={choiceClass(selectedYear === year.year)}>
                  {year.year} <span className="text-slate-500">({year.fileCount})</span>
                </button>
              ))}
            </div>
          </div>
          {selectedYearSummary && (
            <div>
              <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-500">Month</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedYearSummary.months.map(month => (
                  <button key={month.month} type="button" onClick={() => void loadFiles(selectedYearSummary.year, month.month)} className={choiceClass(selectedMonth === month.month)}>
                    {monthLabel(month.month)} <span className="text-slate-500">({month.fileCount})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {loading && !visiblePage && <p className="text-sm text-slate-400" role="status">Loading files…</p>}
          {error && !visiblePage && <p className="text-sm text-[#fb923c]" role="alert">{error}</p>}
          {visiblePage && <FileList page={visiblePage} loading={loading} error={error} onMore={() => void loadFiles(selectedYear, selectedMonth, visiblePage.nextOffset ?? 0)} />}
        </div>
      )}
    </article>
  )
}

function FileList({ page, loading, error, onMore }: { page: ClientPortalLibraryFilesPage; loading: boolean; error: string | null; onMore: () => void }) {
  return (
    <div className="divide-y divide-white/[0.07]">
      {page.assets.length === 0 && <p className="py-5 text-sm text-slate-500">No files in this section yet.</p>}
      {page.assets.map(asset => <LibraryAssetRow key={asset.id} asset={asset} />)}
      {error && <p className="py-3 text-xs text-[#fb923c]" role="alert">{error}</p>}
      {page.nextOffset != null && <button type="button" disabled={loading} onClick={onMore} className="mt-3 min-h-10 rounded-xl border border-white/10 px-3 text-xs font-bold text-slate-300 disabled:opacity-50">{loading ? 'Loading…' : 'Load more'}</button>}
    </div>
  )
}

function LibraryAssetRow({ asset }: { asset: ClientPortalLibraryAsset }) {
  const [busy, setBusy] = useState<'inline' | 'download' | 'stream' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const canView = Boolean(asset.mimeType && /^(image\/(?:avif|gif|jpeg|png|webp)|application\/pdf)$/i.test(asset.mimeType))
  const canPlay = /^video\/mp4$/i.test(asset.mimeType ?? '')

  async function access(purpose: 'inline' | 'download' | 'stream') {
    setBusy(purpose)
    setError(null)
    const result = await getClientPortalAssetAccess(asset.id, purpose)
    if (!result.data) {
      setError(result.error)
      setBusy(null)
      return
    }
    if (purpose === 'stream') {
      setVideoUrl(result.data.url)
    } else {
      const anchor = document.createElement('a')
      anchor.href = result.data.url
      if (purpose === 'inline') {
        anchor.target = '_blank'
        anchor.rel = 'noopener noreferrer'
      }
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
    }
    setBusy(null)
  }

  return (
    <div className="py-4 first:pt-1 last:pb-1">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
        <LazyThumbnail asset={asset} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{asset.displayName}</p>
          <p className="mt-1 text-xs text-slate-500">{fileSummary(asset)}</p>
          {asset.deliverableTitle && <p className="mt-1 truncate text-xs text-slate-400">Linked to {asset.deliverableTitle}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {asset.planMonth && <Link to={`/client/plan?month=${encodeURIComponent(asset.planMonth)}`} className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-3 text-xs font-bold text-slate-300">View in Plan</Link>}
          {canPlay && <button type="button" disabled={busy !== null} onClick={() => void access('stream')} className="min-h-10 rounded-xl border border-white/10 px-3 text-xs font-bold text-slate-300 disabled:opacity-50">{busy === 'stream' ? 'Preparing…' : 'Play'}</button>}
          {canView && <button type="button" disabled={busy !== null} onClick={() => void access('inline')} className="min-h-10 rounded-xl border border-white/10 px-3 text-xs font-bold text-slate-300 disabled:opacity-50">{busy === 'inline' ? 'Opening…' : 'View'}</button>}
          <button type="button" disabled={busy !== null} onClick={() => void access('download')} className="min-h-10 rounded-xl bg-[#2dd4bf] px-3 text-xs font-black text-[#03110e] disabled:opacity-50">{busy === 'download' ? 'Preparing…' : 'Download'}</button>
        </div>
      </div>
      {videoUrl && <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black"><video controls playsInline preload="metadata" src={videoUrl} className="aspect-video w-full" /></div>}
      {error && <p role="alert" className="mt-2 text-xs text-[#fb923c]">{error}</p>}
    </div>
  )
}

function LazyThumbnail({ asset }: { asset: ClientPortalLibraryAsset }) {
  const holder = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const eligible = /^(image\/|video\/)/i.test(asset.mimeType ?? '')

  useEffect(() => {
    if (!eligible || url) return
    const node = holder.current
    if (!node) return
    let active = true
    const load = async () => {
      const result = await getClientPortalAssetAccess(asset.id, 'thumbnail')
      if (active && result.data) setUrl(result.data.url)
    }
    if (!('IntersectionObserver' in window)) {
      void load()
      return () => { active = false }
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect()
        void load()
      }
    }, { rootMargin: '120px' })
    observer.observe(node)
    return () => { active = false; observer.disconnect() }
  }, [asset.id, eligible, url])

  if (!eligible) return null
  return <div ref={holder} className="h-14 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">{url && <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />}</div>
}

function FileCount({ count }: { count: number }) {
  return <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-400">{count} {count === 1 ? 'file' : 'files'}</span>
}

function BrowseButton({ loading, onClick, children }: { loading: boolean; onClick: () => void; children: string }) {
  return <button type="button" disabled={loading} onClick={onClick} className="min-h-10 rounded-xl border border-white/10 px-3 text-xs font-bold text-slate-300 disabled:opacity-50">{loading ? 'Loading…' : children}</button>
}

function choiceClass(selected: boolean) {
  return `min-h-10 rounded-xl border px-3 text-xs font-bold transition ${selected ? 'border-[#2dd4bf]/50 bg-[#2dd4bf]/10 text-white' : 'border-white/10 text-slate-300 hover:border-white/20'}`
}

function monthLabel(month: number) {
  return new Intl.DateTimeFormat('en-ZA', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, month - 1, 1)))
}

function fileSummary(asset: ClientPortalLibraryAsset) {
  const type = asset.mimeType?.split('/').pop()?.toUpperCase() || 'FILE'
  if (asset.sizeBytes == null) return type
  if (asset.sizeBytes < 1024) return `${type} · ${asset.sizeBytes} B`
  if (asset.sizeBytes < 1024 * 1024) return `${type} · ${(asset.sizeBytes / 1024).toFixed(1)} KB`
  return `${type} · ${(asset.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}
