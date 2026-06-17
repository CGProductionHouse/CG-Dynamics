import { useState, useEffect, useMemo } from 'react'
import type { FormEvent } from 'react'
import { useLocalDraft } from '../../hooks/useLocalDraft'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  listClients,
  createClient,
  updateClient,
  type Client,
} from '../../lib/db/clients'
import { listImportGroups } from '../../lib/db/importedMetaPosts'
import { listManualMetrics } from '../../lib/db/manualMetrics'
import { ClientLogo } from '../../components/ClientLogo'
import { listReports } from '../../lib/db/reports'

interface OverviewStats {
  totalClients: number
  publishedReports: number
  draftReports: number
  imports: number
  manualSummaries: number
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return fallback
}

function sortClients(clients: Client[]) {
  return [...clients].sort((a, b) => a.name.localeCompare(b.name))
}

function upsertClient(clients: Client[], client: Client) {
  const exists = clients.some(c => c.id === client.id)
  const nextClients = exists
    ? clients.map(c => c.id === client.id ? client : c)
    : [...clients, client]
  return sortClients(nextClients)
}

export default function ClientsList() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [clients, setClients] = useState<Client[]>([])
  const [overview, setOverview] = useState<OverviewStats>({
    totalClients: 0,
    publishedReports: 0,
    draftReports: 0,
    imports: 0,
    manualSummaries: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<{ open: boolean; client?: Client }>({ open: false })
  const [bulkOpen, setBulkOpen] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  async function load(options: { silent?: boolean } = {}): Promise<string | null> {
    if (!options.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const [clientsRes, reportsRes, importsRes, manualRes] = await Promise.all([
        listClients(),
        listReports(),
        listImportGroups(),
        listManualMetrics(),
      ])
      if (clientsRes.error) {
        const message = clientsRes.error.message
        setError(message)
        return message
      }
      setClients(clientsRes.data)
      setOverview({
        totalClients: clientsRes.data.length,
        publishedReports: reportsRes.data.filter(report => report.status === 'published').length,
        draftReports: reportsRes.data.filter(report => report.status === 'draft').length,
        imports: importsRes.data.length,
        manualSummaries: manualRes.data.length,
      })
      setError(null)
      return null
    } catch (error) {
      const message = errorMessage(error, 'Could not load clients.')
      setError(message)
      return message
    } finally {
      if (!options.silent) setLoading(false)
    }
  }

  async function handleSave(
    input: { name: string; tier: 'standard' | 'premium'; active: boolean; logo_url: string | null }
  ): Promise<string | null> {
    try {
      const existing = modal.client
      if (existing) {
        const { data, error } = await updateClient(existing.id, input)
        if (error) return error.message
        if (data) setClients(current => upsertClient(current, data))
      } else {
        const { data, error } = await createClient({
          name: input.name,
          tier: input.tier,
          active: input.active,
        })
        if (error) return error.message
        if (data) setClients(current => upsertClient(current, data))
      }

      void load({ silent: true }).then(refreshError => {
        if (refreshError) {
          setError(`Saved, but could not refresh the clients list: ${refreshError}`)
        }
      })
      return null
    } catch (error) {
      return errorMessage(error, 'Could not save client.')
    }
  }

  return (
    <div className="w-full max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-brand-primary mb-2">Admin dashboard</p>
          <h1 className="text-xl font-semibold text-white">Clients</h1>
        </div>
        {isAdmin && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              onClick={() => setBulkOpen(true)}
              className="w-full rounded-lg border border-brand-muted px-4 py-2.5 text-sm font-semibold text-brand-primary transition hover:border-white/30 hover:text-white sm:w-auto"
            >
              Bulk add clients
            </button>
            <button
              onClick={() => setModal({ open: true })}
              className="w-full rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-brand-bg transition hover:brightness-110 sm:w-auto"
            >
              Add client
            </button>
          </div>
        )}
      </div>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <OverviewCard label="Total clients" value={overview.totalClients} />
        <OverviewCard label="Published reports" value={overview.publishedReports} />
        <OverviewCard label="Draft reports" value={overview.draftReports} />
        <OverviewCard label="Imports" value={overview.imports} />
        <OverviewCard label="Manual summaries" value={overview.manualSummaries} />
      </section>

      <section className="mb-6 rounded-xl border border-brand-muted bg-brand-surface p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Quick actions</h2>
            <p className="mt-1 text-xs text-brand-primary">
              Jump straight to the reporting workflow.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
            {isAdmin && (
              <>
                <QuickLink to="/admin/import" label="Import CSV" primary />
                <QuickLink to="/admin/reports/new" label="Create report" />
                <QuickLink to="/admin/invites" label="Invites" />
              </>
            )}
            <QuickLink to="/admin/manual-metrics" label="Manual metrics" />
            <QuickLink to="/admin/reports" label="Reports" />
            <QuickLink to="/admin/published" label="Client preview" />
          </div>
        </div>
      </section>

      {loading ? (
        <p className="text-brand-primary text-sm">Loading...</p>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {clients.length === 0 ? (
              <div className="rounded-xl border border-brand-muted bg-brand-surface px-4 py-8 text-center text-sm text-brand-primary">
                No clients yet.
              </div>
            ) : (
              clients.map(c => (
                <article key={c.id} className="rounded-xl border border-brand-muted bg-brand-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <ClientLogo client={c} />
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold text-white break-words">{c.name}</h2>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${
                              c.tier === 'premium'
                                ? 'bg-brand-accent/20 text-brand-accent'
                                : 'bg-brand-muted text-brand-primary'
                            }`}
                          >
                            {c.tier}
                          </span>
                          <span className={`text-xs font-medium ${c.active ? 'text-green-400' : 'text-red-400'}`}>
                            {c.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => setModal({ open: true, client: c })}
                        className="shrink-0 rounded-lg border border-brand-muted px-3 py-2 text-sm text-brand-primary hover:text-brand-accent"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="hidden bg-brand-surface border border-brand-muted rounded-xl overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-muted text-left">
                  <th className="px-4 py-3 text-brand-primary font-medium">Client</th>
                  <th className="px-4 py-3 text-brand-primary font-medium">Tier</th>
                  <th className="px-4 py-3 text-brand-primary font-medium">Status</th>
                  {isAdmin && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 4 : 3} className="px-4 py-8 text-center text-brand-primary">
                      No clients yet.
                    </td>
                  </tr>
                ) : (
                  clients.map(c => (
                    <tr
                      key={c.id}
                      className="border-b border-brand-muted last:border-0 hover:bg-brand-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3 text-white font-medium">
                        <div className="flex items-center gap-3">
                          <ClientLogo client={c} />
                          <span>{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                            c.tier === 'premium'
                              ? 'bg-brand-accent/20 text-brand-accent'
                              : 'bg-brand-muted text-brand-primary'
                          }`}
                        >
                          {c.tier}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${c.active ? 'text-green-400' : 'text-red-400'}`}>
                          {c.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setModal({ open: true, client: c })}
                            className="text-xs text-brand-primary hover:text-brand-accent transition-colors"
                          >
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modal.open && (
        <ClientModal
          client={modal.client}
          onSave={handleSave}
          onClose={() => setModal({ open: false })}
        />
      )}

      {bulkOpen && (
        <BulkImportModal
          clients={clients}
          onImported={() => void load({ silent: true })}
          onClose={() => setBulkOpen(false)}
        />
      )}
    </div>
  )
}

function OverviewCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-brand-muted bg-brand-surface p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-brand-primary">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}

function QuickLink({ to, label, primary = false }: { to: string; label: string; primary?: boolean }) {
  const classes = primary
    ? 'border-brand-accent bg-brand-accent text-brand-bg'
    : 'border-brand-muted text-brand-primary hover:text-white hover:border-white/30'

  return (
    <Link
      to={to}
      className={`rounded-lg border px-3 py-2.5 text-center text-sm font-semibold transition ${classes}`}
    >
      {label}
    </Link>
  )
}

// Client modal

function ClientModal({
  client,
  onSave,
  onClose,
}: {
  client?: Client
  onSave: (input: { name: string; tier: 'standard' | 'premium'; active: boolean; logo_url: string | null }) => Promise<string | null>
  onClose: () => void
}) {
  const [name, setName] = useState(client?.name ?? '')
  const [tier, setTier] = useState<'standard' | 'premium'>(client?.tier ?? 'standard')
  const [logoUrl, setLogoUrl] = useState(client?.logo_url ?? '')
  const [active, setActive] = useState(client?.active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Client name is required.')
      return
    }

    setSaving(true)
    setError(null)
    let saved = false
    try {
      const err = await onSave({ name: trimmedName, tier, active, logo_url: logoUrl.trim() || null })
      if (err) {
        setError(err)
        return
      }
      saved = true
      onClose()
    } catch (error) {
      setError(errorMessage(error, 'Could not save client.'))
    } finally {
      if (!saved) setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={e => { if (!saving && e.target === e.currentTarget) onClose() }}
    >
      <div className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-sm overflow-y-auto rounded-xl border border-brand-muted bg-brand-surface p-5 shadow-[0_0_40px_rgba(0,0,0,0.5)] sm:p-6">
        <h2 className="text-base font-semibold text-white mb-5">
          {client ? 'Edit client' : 'Add client'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-accent mb-1.5">
              Name
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent transition"
              placeholder="Client name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-accent mb-1.5">
              Tier
            </label>
            <select
              value={tier}
              onChange={e => setTier(e.target.value as 'standard' | 'premium')}
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent transition"
            >
              <option value="standard">Standard (quarterly)</option>
              <option value="premium">Premium (monthly)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-accent mb-1.5">
              Client logo URL
            </label>
            <input
              type="url"
              value={logoUrl}
              onChange={e => setLogoUrl(e.target.value)}
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent transition"
              placeholder="https://example.com/logo.png"
            />
            <p className="mt-1.5 text-xs text-brand-primary">
              Paste a logo image URL. Recommended: transparent PNG or square logo.
            </p>
          </div>

          {client && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={active}
                onChange={e => setActive(e.target.checked)}
                className="w-4 h-4 rounded accent-brand-accent"
              />
              <span className="text-sm text-brand-accent">Active</span>
            </label>
          )}

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 border border-brand-muted text-brand-primary py-2.5 rounded-lg text-sm hover:text-white hover:border-white/30 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-brand-accent text-brand-bg font-semibold py-2.5 rounded-lg text-sm hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Bulk import modal

function parseBulkText(text: string, existingClients: Client[]) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const seen = new Set<string>()
  const unique: string[] = []
  const inListDupes: string[] = []
  for (const line of lines) {
    const key = line.toLowerCase()
    if (seen.has(key)) {
      inListDupes.push(line)
    } else {
      seen.add(key)
      unique.push(line)
    }
  }
  const existingLower = new Set(existingClients.map(c => c.name.toLowerCase()))
  const toAdd = unique.filter(n => !existingLower.has(n.toLowerCase()))
  const toSkip = unique.filter(n => existingLower.has(n.toLowerCase()))
  return { toAdd, toSkip, inListDupes }
}

type BulkDraft = { text: string; tier: 'standard' | 'premium' }

function BulkImportModal({
  clients,
  onImported,
  onClose,
}: {
  clients: Client[]
  onImported: () => void
  onClose: () => void
}) {
  const { profile } = useAuth()
  const draftKey = `cg_bulk_${profile?.id ?? 'anon'}`
  const { getInitialDraft, saveDraft, clearDraft, hasDraft } = useLocalDraft<BulkDraft>(draftKey)

  const [text, setText] = useState<string>(() => getInitialDraft()?.text ?? '')
  const [tier, setTier] = useState<'standard' | 'premium'>(() => getInitialDraft()?.tier ?? 'standard')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ added: string[]; failed: string[] } | null>(null)

  const { toAdd, toSkip, inListDupes } = useMemo(
    () => parseBulkText(text, clients),
    [text, clients]
  )

  async function handleImport() {
    if (importing || toAdd.length === 0) return
    setImporting(true)
    const settlements = await Promise.allSettled(
      toAdd.map(name => createClient({ name, tier, active: true, logo_url: null }))
    )
    const added: string[] = []
    const failed: string[] = []
    settlements.forEach((s, i) => {
      if (s.status === 'fulfilled' && !s.value.error) {
        added.push(toAdd[i])
      } else {
        failed.push(toAdd[i])
      }
    })
    setImporting(false)
    setResult({ added, failed })
    clearDraft()
    onImported()
  }

  function handleClearDraft() {
    clearDraft()
    setText('')
    setTier('standard')
  }

  const OVERLAY = 'fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center'
  const PANEL = 'my-auto w-full max-w-lg overflow-y-auto rounded-xl border border-brand-muted bg-brand-surface shadow-[0_0_40px_rgba(0,0,0,0.5)]'

  if (result) {
    return (
      <div className={OVERLAY} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className={`${PANEL} p-5 sm:p-6`}>
          <h2 className="mb-4 text-base font-semibold text-white">Import complete</h2>

          {result.added.length > 0 && (
            <div className="mb-3 rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3">
              <p className="mb-2 text-sm font-medium text-green-400">
                {result.added.length} client{result.added.length !== 1 ? 's' : ''} added
              </p>
              <ul className="space-y-0.5">
                {result.added.map(name => (
                  <li key={name} className="text-xs text-green-300">{name}</li>
                ))}
              </ul>
            </div>
          )}

          {result.failed.length > 0 && (
            <div className="mb-3 rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-3">
              <p className="mb-2 text-sm font-medium text-red-400">
                {result.failed.length} client{result.failed.length !== 1 ? 's' : ''} could not be added
              </p>
              <ul className="space-y-0.5">
                {result.failed.map(name => (
                  <li key={name} className="text-xs text-red-300">{name}</li>
                ))}
              </ul>
            </div>
          )}

          {result.added.length === 0 && result.failed.length === 0 && (
            <p className="mb-3 text-sm text-brand-primary">Nothing was imported.</p>
          )}

          <p className="mb-5 text-xs text-brand-primary">
            Logos auto-resolve from <code className="rounded bg-brand-muted/60 px-1 py-0.5 text-brand-accent">/client-logos/client-name-slug.png</code> once a matching file is placed there.
          </p>

          <button
            onClick={onClose}
            className="w-full rounded-lg bg-brand-accent py-2.5 text-sm font-semibold text-brand-bg transition hover:brightness-110"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  const hasInput = toAdd.length > 0 || toSkip.length > 0

  return (
    <div className={OVERLAY} onClick={e => { if (!importing && e.target === e.currentTarget) onClose() }}>
      <div className={`${PANEL} p-5 sm:p-6`}>
        <h2 className="mb-1 text-base font-semibold text-white">Bulk add clients</h2>
        <p className="mb-4 text-xs text-brand-primary">
          Paste one client name per line. Existing clients are skipped automatically.
        </p>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-brand-accent">
            Client names
          </label>
          <textarea
            rows={10}
            value={text}
            onChange={e => {
              const next = e.target.value
              setText(next)
              saveDraft({ text: next, tier })
            }}
            disabled={importing}
            placeholder={"Action Sport\nBohemia\nCape Lumber\nDelta Gas\n..."}
            className="w-full resize-y rounded-lg border border-brand-muted bg-brand-bg px-3.5 py-2.5 font-mono text-sm text-white placeholder-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent transition disabled:opacity-60"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-brand-accent">
            Default tier
          </label>
          <select
            value={tier}
            onChange={e => {
              const next = e.target.value as 'standard' | 'premium'
              setTier(next)
              saveDraft({ text, tier: next })
            }}
            disabled={importing}
            className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent transition disabled:opacity-60"
          >
            <option value="standard">Standard (quarterly)</option>
            <option value="premium">Premium (monthly)</option>
          </select>
        </div>

        {hasInput && (
          <div className="mb-4 space-y-2 rounded-lg border border-brand-muted bg-brand-bg/50 p-3">
            <p className="text-xs font-medium text-brand-primary uppercase tracking-wider">Preview</p>

            {toAdd.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-green-400">
                  {toAdd.length} new client{toAdd.length !== 1 ? 's' : ''} to add
                </p>
                <ul className="max-h-40 overflow-y-auto space-y-0.5">
                  {toAdd.map(name => (
                    <li key={name} className="flex items-center gap-1.5 text-xs text-green-300">
                      <span className="text-green-500">+</span>
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {toSkip.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-brand-primary">
                  {toSkip.length} already exist{toSkip.length === 1 ? 's' : ''} — will be skipped
                </p>
                <ul className="max-h-28 overflow-y-auto space-y-0.5">
                  {toSkip.map(name => (
                    <li key={name} className="flex items-center gap-1.5 text-xs text-brand-primary/60">
                      <span>–</span>
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {inListDupes.length > 0 && (
              <p className="text-xs text-brand-primary/50">
                {inListDupes.length} duplicate line{inListDupes.length !== 1 ? 's' : ''} in your list ignored
              </p>
            )}
          </div>
        )}

        <p className="mb-4 text-xs text-brand-primary">
          Logo URLs left blank — logos auto-resolve from{' '}
          <code className="rounded bg-brand-muted/60 px-1 py-0.5 text-brand-accent">/client-logos/client-name-slug.png</code>{' '}
          if a matching file exists.
        </p>

        {hasDraft && (
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-brand-primary">Draft saved on this device.</p>
            <button
              type="button"
              onClick={handleClearDraft}
              disabled={importing}
              className="text-xs text-brand-accent hover:brightness-110 transition disabled:opacity-60"
            >
              Clear draft
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="flex-1 rounded-lg border border-brand-muted py-2.5 text-sm text-brand-primary transition hover:border-white/30 hover:text-white disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || toAdd.length === 0}
            className="flex-1 rounded-lg bg-brand-accent py-2.5 text-sm font-semibold text-brand-bg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {importing
              ? 'Importing...'
              : toAdd.length > 0
                ? `Import ${toAdd.length} client${toAdd.length !== 1 ? 's' : ''}`
                : 'Import clients'}
          </button>
        </div>
      </div>
    </div>
  )
}
