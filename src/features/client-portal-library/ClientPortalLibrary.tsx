import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClientPortalEmptyState } from '../../components/client/ClientPortalStates'
import { openClientPortalAsset } from './api'
import {
  CLIENT_PORTAL_LIBRARY_CATEGORIES,
  type ClientPortalLibraryAsset,
  type ClientPortalLibraryCategory,
  type ClientPortalLibraryState,
} from './types'

const CATEGORY_LABELS: Record<ClientPortalLibraryCategory, string> = {
  brand_identity: 'Brand Identity',
  graphic_design: 'Graphic Design',
  video: 'Video',
  photography: 'Photography',
}

export function ClientPortalLibrary({ library }: { library: ClientPortalLibraryState }) {
  const groups = useMemo(() => {
    const byCategory = new Map<ClientPortalLibraryCategory, ClientPortalLibraryAsset[]>()
    for (const category of CLIENT_PORTAL_LIBRARY_CATEGORIES) byCategory.set(category, [])
    for (const asset of library.assets) byCategory.get(asset.category)?.push(asset)
    return byCategory
  }, [library.assets])

  if (!library.available) {
    return (
      <ClientPortalEmptyState
        eyebrow="Client-safe library"
        title="Your approved library is being prepared"
        message="CG will make this space available after the exact client-safe folder has been verified. Working files, source files and raw production assets remain private."
      />
    )
  }

  return (
    <section aria-labelledby="client-library-heading" className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2dd4bf]">Approved client files</p>
          <h2 id="client-library-heading" className="mt-2 text-2xl font-black tracking-[-0.035em] text-white sm:text-3xl">Library</h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-slate-400">Only final files approved for your organisation appear here.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {library.categories.map(category => (
          <LibraryCategory key={category} category={category} assets={groups.get(category) ?? []} />
        ))}
      </div>
    </section>
  )
}

function LibraryCategory({ category, assets }: { category: ClientPortalLibraryCategory; assets: ClientPortalLibraryAsset[] }) {
  return (
    <article className="min-w-0 rounded-[1.75rem] border border-white/[0.08] bg-white/[0.035] p-5 shadow-[0_24px_70px_-52px_rgba(0,0,0,0.95)] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-black text-white">{CATEGORY_LABELS[category]}</h3>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-400">
          {assets.length} {assets.length === 1 ? 'file' : 'files'}
        </span>
      </div>

      {assets.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm leading-6 text-slate-500">No approved files in this category yet.</p>
      ) : (
        <div className="mt-4 divide-y divide-white/[0.07]">
          {assets.map(asset => <LibraryAssetRow key={asset.id} asset={asset} />)}
        </div>
      )}
    </article>
  )
}

function LibraryAssetRow({ asset }: { asset: ClientPortalLibraryAsset }) {
  const [busy, setBusy] = useState<'open' | 'download' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canOpen = Boolean(asset.mimeType && /^(image\/(?:avif|gif|jpeg|png|webp)|application\/pdf|video\/mp4)$/i.test(asset.mimeType))

  async function access(disposition: 'open' | 'download') {
    setBusy(disposition)
    setError(null)
    const result = await openClientPortalAsset(asset.id, disposition)
    if (!result.data) {
      setError(result.error)
      setBusy(null)
      return
    }
    const url = URL.createObjectURL(result.data)
    const anchor = document.createElement('a')
    anchor.href = url
    if (disposition === 'open') {
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
    } else {
      anchor.download = result.filename || asset.displayName
    }
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    setBusy(null)
  }

  return (
    <div className="py-4 first:pt-1 last:pb-1">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{asset.displayName}</p>
          <p className="mt-1 text-xs text-slate-500">{fileSummary(asset)}</p>
          {asset.deliverableTitle && <p className="mt-1 truncate text-xs text-slate-400">Linked to {asset.deliverableTitle}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {asset.planMonth && (
            <Link to={`/client/plan?month=${encodeURIComponent(asset.planMonth)}`} className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-3 text-xs font-bold text-slate-300 transition hover:border-[#2dd4bf]/30 hover:text-white">
              View in Plan
            </Link>
          )}
          {canOpen && <button type="button" disabled={busy !== null} onClick={() => void access('open')} className="min-h-10 rounded-xl border border-white/10 px-3 text-xs font-bold text-slate-300 transition hover:border-[#2dd4bf]/30 hover:text-white disabled:opacity-50">
            {busy === 'open' ? 'Opening…' : 'Open'}
          </button>}
          <button type="button" disabled={busy !== null} onClick={() => void access('download')} className="min-h-10 rounded-xl bg-[#2dd4bf] px-3 text-xs font-black text-[#03110e] transition hover:bg-[#5eead4] disabled:opacity-50">
            {busy === 'download' ? 'Downloading…' : 'Download'}
          </button>
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-[#fb923c]">{error}</p>}
    </div>
  )
}

function fileSummary(asset: ClientPortalLibraryAsset) {
  const type = asset.mimeType?.split('/').pop()?.toUpperCase() || 'FILE'
  if (asset.sizeBytes == null) return type
  if (asset.sizeBytes < 1024) return `${type} · ${asset.sizeBytes} B`
  if (asset.sizeBytes < 1024 * 1024) return `${type} · ${(asset.sizeBytes / 1024).toFixed(1)} KB`
  return `${type} · ${(asset.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}
