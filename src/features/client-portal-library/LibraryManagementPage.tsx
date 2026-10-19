import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { ActionButton } from '../../components/ui/Buttons'
import { libraryManagement, projectManagedLibrary, projectLibraryBrowse, managementWriteConfirmed, LIBRARY_MANAGEMENT_LABELS, type ManagedLibrary, type LibraryEntry, type LibraryBrowse } from './managementApi'
import type { ClientPortalLibraryCategory } from './types'

export default function LibraryManagementPage() {
  const { profile } = useAuth()
  const [params] = useSearchParams()
  const clientId = params.get('client') ?? ''
  if (profile?.role !== 'admin') return <p className="p-6 text-brand-primary">Admin access required.</p>
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(clientId)) return <div className="p-6"><Link to="/admin/clients" className="text-brand-teal">Choose a client</Link></div>
  return <LibraryManager key={`${profile.id}:${clientId}`} clientId={clientId} />
}

export function LibraryManager({ clientId }: { clientId: string }) {
  const [library, setLibrary] = useState<ManagedLibrary | null>(null)
  const [category, setCategory] = useState<ClientPortalLibraryCategory>('brand_identity')
  const [path, setPath] = useState<Array<{ id: string; name: string }>>([])
  const [page, setPage] = useState<LibraryBrowse | null>(null)
  const [selection, setSelection] = useState<LibraryEntry | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [month, setMonth] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const alive = useRef(false)
  const browseGeneration = useRef(0)
  const writeLock = useRef(false)

  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    let current = true
    void libraryManagement('staff_library_review', clientId).then(result => {
      if (!current) return
      const data = projectManagedLibrary(result.data, clientId)
      setLibrary(data)
      setError(data ? null : result.error ?? 'This library could not be verified.')
    })
    return () => { current = false }
  }, [clientId, revision])

  // Every folder/category transition removes the prior file selection before
  // the next request. A late read cannot refill another selected section.
  useEffect(() => {
    if (!library?.prepared) return
    const generation = ++browseGeneration.current
    let current = true
    void libraryManagement('staff_library_browse', clientId, { category, folderPath: path.map(p => p.id), offset: 0 }).then(result => {
      if (!current || generation !== browseGeneration.current) return
      const data = projectLibraryBrowse(result.data)
      setPage(data)
      if (!data) setError(result.error ?? 'Files could not be loaded.')
    })
    return () => { current = false }
  }, [clientId, category, path, library?.prepared, revision])

  function navigate(next: ClientPortalLibraryCategory, folders: typeof path = []) {
    browseGeneration.current++
    setCategory(next); setPath(folders); setPage(null); setSelection(null); setConfirmed(false); setDisplayName(''); setMonth(''); setError(null); setNotice(null)
  }
  async function mutate(action: string, input: Record<string, unknown>, message: string) {
    if (writeLock.current) return
    writeLock.current = true
    setBusy(true); setError(null); setNotice(null)
    const result = await libraryManagement(action, clientId, input)
    writeLock.current = false
    if (!alive.current) return
    setBusy(false)
    // Failed writes are never retried automatically: require a fresh read first.
    setSelection(null); setConfirmed(false); setPage(null); setLibrary(null)
    setRevision(r => r + 1)
    if (result.error || !managementWriteConfirmed(action, result.data, clientId, input.enabled)) setNotice('Action unconfirmed. Reloading the saved state; check it before trying again.')
    else setNotice(message)
  }
  async function more() {
    if (page?.nextOffset == null) return
    const generation = ++browseGeneration.current
    setBusy(true)
    const result = await libraryManagement('staff_library_browse', clientId, { category, folderPath: path.map(p => p.id), offset: page.nextOffset })
    if (!alive.current || generation !== browseGeneration.current) return
    setBusy(false)
    const data = projectLibraryBrowse(result.data)
    if (!data) setError(result.error ?? 'Files could not be loaded.')
    else setPage(previous => previous ? { entries: [...previous.entries, ...data.entries], nextOffset: data.nextOffset } : data)
  }
  const inputClass = 'min-h-11 w-full rounded-lg border border-white/15 bg-brand-bg px-3 text-sm text-white'
  return <main className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-8">
    <Link to="/admin/clients" className="inline-flex min-h-11 items-center text-sm text-brand-teal">← Clients</Link>
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-widest text-brand-teal">Brand Hub</p><h1 className="mt-1 break-words text-3xl font-bold text-white">{library?.clientName ?? 'Client library'}</h1></div>
      <Link to={`/admin/client-portal-preview?client=${clientId}&area=brand-hub`} className="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-4 text-sm text-white">Client preview ↗</Link>
    </header>
    {notice && <p role="status" className="text-sm text-brand-teal">{notice}</p>}
    {error && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-red-300"><p>{error}</p><ActionButton variant="secondary" disabled={busy} onClick={() => { setError(null); setRevision(r => r + 1) }}>Reload</ActionButton></div>}
    {!library ? !error && <p role="status" className="text-sm text-brand-primary">Verifying library…</p> : <>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-brand-surface p-4">
        <span className="text-sm text-white">{library.enabled ? 'Visible to client' : library.prepared ? 'Ready · private' : 'Not linked yet'}</span>
        {library.enabled ? <ActionButton variant="secondary" disabled={busy} onClick={() => void mutate('staff_library_enable', { enabled: false, confirmed: true }, 'Library hidden from the client.')}>Hide library</ActionButton> : !library.prepared ? <ActionButton disabled={busy} onClick={() => void mutate('staff_library_prepare', {}, 'Library linked. Files remain private until selected.')}>Link verified folders</ActionButton>
          : <ActionButton variant={library.enabled ? 'secondary' : 'primary'} disabled={busy} onClick={() => void mutate('staff_library_enable', { enabled: !library.enabled, confirmed: true }, library.enabled ? 'Library hidden from the client.' : 'Library enabled. Only selected files are visible.')}>{library.enabled ? 'Hide library' : 'Enable library'}</ActionButton>}
      </section>
      {library.verificationError && <p role="alert" className="text-sm text-brand-primary">{library.verificationError}</p>}
      {library.prepared && <>
        <nav aria-label="Library sections" className="flex flex-wrap gap-2">{Object.entries(LIBRARY_MANAGEMENT_LABELS).map(([key, label]) => <ActionButton key={key} variant={category === key ? 'primary' : 'secondary'} disabled={busy} aria-pressed={category === key} onClick={() => navigate(key as ClientPortalLibraryCategory)}>{label}</ActionButton>)}</nav>
        <section aria-label="Available files" className="rounded-2xl border border-white/10 bg-brand-surface p-4">
          {path.length > 0 && <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-brand-primary"><ActionButton variant="ghost" disabled={busy} onClick={() => navigate(category, path.slice(0, -1))}>← Back</ActionButton><span className="break-all">{path.map(p => p.name).join(' / ')}</span></div>}
          {!page ? <p className="text-sm text-brand-primary">{error ? 'Files unavailable.' : 'Loading files…'}</p> : page.entries.length === 0 ? <p className="text-sm text-brand-primary">No files in this folder.</p> : <ul className="divide-y divide-white/10">{page.entries.map(file => <li key={file.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-3"><span className="min-w-0 flex-1 break-words text-sm text-white">{file.folder ? '▸ ' : ''}{file.name}</span><ActionButton size="sm" variant="secondary" disabled={busy || (!file.folder && !file.selectable) || (file.folder && (path.length >= 5 || category === 'brand_identity'))} onClick={() => file.folder ? navigate(category, [...path, { id: file.id, name: file.name }]) : (setSelection(file), setDisplayName(file.name), setConfirmed(false))}>{file.folder ? 'Open folder' : file.selectable ? 'Select file' : 'Internal format'}</ActionButton></li>)}</ul>}
          {page?.nextOffset != null && <ActionButton className="mt-3" variant="secondary" disabled={busy} onClick={() => void more()}>More files</ActionButton>}
        </section>
        {selection && <section aria-label="Publish selected file" className="space-y-4 rounded-2xl border border-brand-teal/30 bg-brand-surface p-4">
          <h2 className="break-words font-bold text-white">{selection.name}</h2>
          {selection.reviewUrl && <a href={selection.reviewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-brand-teal">Review source file ↗</a>}
          <label className="block space-y-1 text-sm text-brand-primary"><span>Client-facing name</span><input className={inputClass} value={displayName} maxLength={255} disabled={busy} onChange={e => setDisplayName(e.target.value)} /></label>
          {category !== 'brand_identity' && <label className="block space-y-1 text-sm text-brand-primary"><span>Delivery month</span><input type="month" className={inputClass} value={month} disabled={busy} onChange={e => setMonth(e.target.value)} /></label>}
          <label className="flex min-h-11 items-start gap-3 text-sm text-brand-primary"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} /><span>I reviewed this exact file. It is final, belongs to this client and is cleared for client delivery.</span></label>
          <ActionButton disabled={busy || !confirmed || !displayName.trim() || (category !== 'brand_identity' && !/^\d{4}-\d{2}$/.test(month))} onClick={() => void mutate('staff_library_publish', { category, folderPath: path.map(p => p.id), itemId: selection.id, displayName, confirmed, year: Number(month.slice(0, 4)), month: Number(month.slice(5, 7)) }, 'Selected file published to this library.')}>Publish selected file</ActionButton>
        </section>}
        <section aria-label="Published files" className="space-y-3"><h2 className="font-bold text-white">Selected for client</h2>{library.assets.filter(a => a.active).length === 0 ? <p className="text-sm text-brand-primary">No files published.</p> : <ul className="divide-y divide-white/10">{library.assets.filter(a => a.active).map(asset => <li key={asset.id} className="flex flex-wrap items-center justify-between gap-3 py-2"><span className="min-w-0 flex-1 break-words text-sm text-white">{asset.displayName}</span><ActionButton variant="ghost" disabled={busy} onClick={() => void mutate('staff_library_hide', { assetId: asset.id }, 'File hidden. Its history is retained.')}>Hide file</ActionButton></li>)}</ul>}</section>
      </>}
    </>}
  </main>
}
