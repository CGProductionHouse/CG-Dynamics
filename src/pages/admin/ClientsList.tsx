import { useState, useEffect, useMemo } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { PremiumCard } from '../../components/ui/PremiumCard'
import { ActionButton } from '../../components/ui/Buttons'
import { Pill, StatusBadge } from '../../components/ui/Badges'
import { EmptyState } from '../../components/ui/States'
import { useLocalDraft } from '../../hooks/useLocalDraft'
import {
  listClients,
  createClient,
  updateClient,
  updateClientPackage,
  archiveClient,
  restoreClient,
  deleteClient,
  clientHasData,
  readPackageSettings,
  EMPTY_PACKAGE_SETTINGS,
  type Client,
  type PackageSettings,
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

type ViewFilter = 'active' | 'archived' | 'all'
type ConfirmAction =
  | { type: 'archive'; client: Client }
  | { type: 'restore'; client: Client }
  | { type: 'delete'; client: Client; checkingData: boolean; hasData: boolean | null }

export default function ClientsList() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  // Persist whether the bulk-import modal is open so a page reload reopens it
  // automatically with the pasted list restored.
  const {
    getInitialDraft: getBulkOpen,
    saveDraft: saveBulkOpen,
    clearDraft: clearBulkOpen,
  } = useLocalDraft<boolean>(`cg_bulk_open_${profile?.id ?? 'anon'}`)

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
  const [bulkOpen, setBulkOpen] = useState<boolean>(() => getBulkOpen() ?? false)
  const [viewFilter, setViewFilter] = useState<ViewFilter>('active')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [packageNotice, setPackageNotice] = useState<string | null>(null)

  const displayClients = useMemo(() => {
    if (viewFilter === 'active') return clients.filter(c => c.active)
    if (viewFilter === 'archived') return clients.filter(c => !c.active)
    return clients
  }, [clients, viewFilter])

  function openBulk() {
    setBulkOpen(true)
    saveBulkOpen(true)
  }

  function closeBulk() {
    setBulkOpen(false)
    clearBulkOpen()
  }

  async function doArchive(client: Client) {
    const { error } = await archiveClient(client.id)
    if (error) throw error
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, active: false } : c))
  }

  async function doRestore(client: Client) {
    const { error } = await restoreClient(client.id)
    if (error) throw error
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, active: true } : c))
  }

  async function doDelete(client: Client) {
    const { error } = await deleteClient(client.id)
    if (error) throw error
    setClients(prev => prev.filter(c => c.id !== client.id))
  }

  async function openDeleteConfirm(client: Client) {
    setConfirmAction({ type: 'delete', client, checkingData: true, hasData: null })
    const has = await clientHasData(client.id)
    setConfirmAction(prev =>
      prev?.type === 'delete' && prev.client.id === client.id
        ? { ...prev, checkingData: false, hasData: has }
        : prev
    )
  }

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
    input: {
      name: string
      tier: 'standard' | 'premium'
      active: boolean
      logo_url: string | null
      package: PackageSettings
    }
  ): Promise<string | null> {
    try {
      const existing = modal.client
      let savedId: string | null = null
      if (existing) {
        const { data, error } = await updateClient(existing.id, {
          name: input.name,
          tier: input.tier,
          active: input.active,
          logo_url: input.logo_url,
        })
        if (error) return error.message
        if (data) {
          savedId = data.id
          setClients(current => upsertClient(current, data))
        }
      } else {
        const { data, error } = await createClient({
          name: input.name,
          tier: input.tier,
          active: input.active,
        })
        if (error) return error.message
        if (data) {
          savedId = data.id
          setClients(current => upsertClient(current, data))
        }
      }

      // Best-effort package save: never blocks the core client save. If the
      // phase-3j column is not present yet, show a soft migration notice.
      if (savedId) {
        const pkgResult = await updateClientPackage(savedId, input.package)
        if (pkgResult.migrationNeeded) {
          setPackageNotice('Client saved. Monthly package settings need the phase-3j migration (clients.package_settings) before they can be stored.')
        } else if (pkgResult.error) {
          setPackageNotice(`Client saved, but the package could not be stored: ${pkgResult.error.message}`)
        } else {
          setPackageNotice(null)
          if (pkgResult.data) setClients(current => upsertClient(current, pkgResult.data!))
        }
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
    <div className="w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f2b66f] mb-2">Client management</p>
          <h1 className="font-display text-4xl font-black uppercase tracking-wide text-white">Clients</h1>
        </div>
        {isAdmin && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <ActionButton variant="secondary" onClick={openBulk}>Bulk add clients</ActionButton>
            <ActionButton variant="primary" onClick={() => setModal({ open: true })}>Add client</ActionButton>
          </div>
        )}
      </div>

      <section className="mb-5 grid grid-cols-3 gap-2 lg:max-w-2xl">
        {([
          ['Total clients', overview.totalClients],
          ['Published reports', overview.publishedReports],
          ['Draft reports', overview.draftReports],
        ] as const).map(([label, value]) => (
          <PremiumCard key={label} padding="sm" className="bg-white/[0.035]">
            <p className="text-[10px] uppercase tracking-[0.12em] text-brand-primary/70">{label}</p>
            <p className="mt-2 text-2xl font-black text-white">{value}</p>
          </PremiumCard>
        ))}
      </section>

      {packageNotice && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2">
          <p className="text-sm text-amber-200">{packageNotice}</p>
          <button
            type="button"
            onClick={() => setPackageNotice(null)}
            className="shrink-0 text-xs text-amber-200/60 hover:text-amber-200"
          >
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-brand-primary text-sm">Loading...</p>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : (
        <>
          <div className="mb-4 flex w-fit gap-1 rounded-md border border-white/10 bg-white/[0.04] p-1">
            {(['active', 'archived', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setViewFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                  viewFilter === f
                    ? 'bg-brand-accent text-black'
                    : 'text-brand-primary hover:text-white'
                }`}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className="space-y-3 md:hidden">
            {displayClients.length === 0 ? (
              <EmptyState
                title={viewFilter === 'archived' ? 'No archived clients' : viewFilter === 'active' ? 'No active clients' : 'No clients yet'}
                message={viewFilter === 'archived' ? 'Archived clients will appear here.' : viewFilter === 'active' ? 'Add a client, then link Meta assets before syncing reports.' : 'Clients you add will appear here.'}
                centered={false}
              />
            ) : (
              displayClients.map(c => (
                <PremiumCard key={c.id} padding="sm">
                  <div className="flex items-start gap-3">
                    <ClientLogo client={c} />
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-semibold text-white break-words">{c.name}</h2>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Pill tone={c.tier === 'premium' ? 'accent' : 'neutral'}>{c.tier}</Pill>
                        <StatusBadge
                          label={c.active ? 'Active' : 'Archived'}
                          variant={c.active ? 'published' : 'internal-draft'}
                        />
                      </div>
                      <div className="mt-2">
                        <PackageChips client={c} />
                      </div>
                    </div>
                  </div>

                  {c.active ? (
                    <ClientQuickActions client={c} isAdmin={isAdmin} onEdit={() => setModal({ open: true, client: c })} />
                  ) : (
                    isAdmin && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <ActionButton variant="secondary" size="sm" onClick={() => setConfirmAction({ type: 'restore', client: c })}>Restore</ActionButton>
                        <ActionButton variant="danger" size="sm" onClick={() => void openDeleteConfirm(c)}>Delete</ActionButton>
                      </div>
                    )
                  )}

                  {c.active && isAdmin && (
                    <div className="mt-2 border-t border-brand-muted/40 pt-2">
                      <ActionButton variant="ghost" size="sm" onClick={() => setConfirmAction({ type: 'archive', client: c })}>Archive client</ActionButton>
                    </div>
                  )}
                </PremiumCard>
              ))
            )}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-white/10 bg-brand-surface/90 md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.025] text-left">
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-white/35">Client</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-white/35">Package</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-white/35">Performance</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-white/35">Production</th>
                  {isAdmin && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {displayClients.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 5 : 4} className="px-4 py-8">
                      <div className="mx-auto max-w-sm">
                        <EmptyState
                          title={viewFilter === 'archived' ? 'No archived clients' : viewFilter === 'active' ? 'No active clients' : 'No clients yet'}
                          message={viewFilter === 'archived' ? 'Archived clients will appear here.' : viewFilter === 'active' ? 'Add a client, then link Meta assets before syncing reports.' : 'Clients you add will appear here.'}
                          centered={false}
                        />
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayClients.map(c => (
                    <tr
                      key={c.id}
                      className="border-b border-white/8 last:border-0 hover:bg-white/[0.035] transition-colors align-top"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ClientLogo client={c} />
                          <div>
                            <span className="text-sm font-semibold text-white">{c.name}</span>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <Pill tone={c.tier === 'premium' ? 'accent' : 'neutral'}>{c.tier}</Pill>
                              <StatusBadge
                                label={c.active ? 'Active' : 'Archived'}
                                variant={c.active ? 'published' : 'internal-draft'}
                              />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <PackageChips client={c} />
                      </td>
                      {c.active ? (
                        <>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              <ClientActionLink to={`/admin/reports?client=${c.id}`} label="Reports" teal />
                              {isAdmin && <ClientActionLink to={`/admin/integrations/meta?client=${c.id}`} label="Meta / Sync" />}
                              <ClientActionLink to="/admin/published" label="Client Preview" />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              <ClientActionLink to={`/admin/package-master?client=${c.id}`} label="Package" />
                              <ClientActionLink to={`/admin/monthly-planner?client=${c.id}`} label="Monthly Planner" />
                            </div>
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <ActionButton variant="ghost" size="sm" onClick={() => setModal({ open: true, client: c })}>Edit</ActionButton>
                                <ActionButton variant="ghost" size="sm" onClick={() => setConfirmAction({ type: 'archive', client: c })}>Archive</ActionButton>
                              </div>
                            </td>
                          )}
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3" />
                          <td className="px-4 py-3" />
                          {isAdmin && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <ActionButton variant="ghost" size="sm" onClick={() => setConfirmAction({ type: 'restore', client: c })}>Restore</ActionButton>
                                <ActionButton variant="danger" size="sm" onClick={() => void openDeleteConfirm(c)}>Delete</ActionButton>
                              </div>
                            </td>
                          )}
                        </>
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

      {confirmAction && (
        <ConfirmModal
          action={confirmAction}
          onClose={() => setConfirmAction(null)}
          onArchive={doArchive}
          onRestore={doRestore}
          onDelete={doDelete}
        />
      )}

      {bulkOpen && (
        <BulkImportModal
          clients={clients}
          onImported={() => void load({ silent: true })}
          onClose={closeBulk}
        />
      )}
    </div>
  )
}

function ClientActionLink({ to, label, teal = false }: { to: string; label: string; teal?: boolean }) {
  return (
    <Link
      to={to}
      className={`rounded-md border px-2.5 py-1 text-xs font-bold transition ${
        teal
          ? 'border-brand-teal/30 bg-brand-teal/[0.07] text-[#2dd4bf] hover:border-brand-teal/60 hover:text-white'
          : 'border-white/8 bg-white/[0.03] text-brand-primary hover:border-white/20 hover:text-white'
      }`}
    >
      {label}
    </Link>
  )
}

// Compact package chip row derived from client.package_settings
function PackageChips({ client }: { client: Client }) {
  const pkg = client.package_settings ? readPackageSettings(client.package_settings) : null
  const chips = pkg
    ? [
        { label: 'DP', value: pkg.design_posters_per_month },
        { label: 'F', value: pkg.photo_posts_per_month },
        { label: 'Video', value: pkg.professional_videos_per_month },
        { label: 'Reel', value: pkg.reels_per_month },
      ].filter(c => c.value > 0)
    : []

  if (chips.length === 0) {
    return <span className="text-[11px] text-white/25">Package not set</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map(chip => (
        <span
          key={chip.label}
          className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-bold text-white/65"
        >
          {chip.label} {chip.value}
        </span>
      ))}
    </div>
  )
}

// Mobile card actions — split into Performance and Production groups
function ClientQuickActions({
  client,
  isAdmin,
  onEdit,
}: {
  client: Client
  isAdmin: boolean
  onEdit: () => void
}) {
  return (
    <div className="mt-4 space-y-2.5">
      <div>
        <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/25">Performance</p>
        <div className="flex flex-wrap gap-1.5">
          <ClientActionLink to={`/admin/reports?client=${client.id}`} label="Reports" teal />
          {isAdmin && <ClientActionLink to={`/admin/integrations/meta?client=${client.id}`} label="Meta / Sync" />}
          <ClientActionLink to="/admin/published" label="Client Preview" />
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/25">Production</p>
        <div className="flex flex-wrap gap-1.5">
          <ClientActionLink to={`/admin/package-master?client=${client.id}`} label="Package" />
          <ClientActionLink to={`/admin/monthly-planner?client=${client.id}`} label="Monthly Planner" />
        </div>
      </div>
      {isAdmin && (
        <div className="pt-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md border border-white/8 px-3 py-1 text-xs font-bold text-brand-primary/60 transition hover:border-white/20 hover:text-white"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  )
}

function PackageNumber({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-brand-primary mb-1">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
      />
    </label>
  )
}

// Client modal

function ClientModal({
  client,
  onSave,
  onClose,
}: {
  client?: Client
  onSave: (input: { name: string; tier: 'standard' | 'premium'; active: boolean; logo_url: string | null; package: PackageSettings }) => Promise<string | null>
  onClose: () => void
}) {
  const [name, setName] = useState(client?.name ?? '')
  const [tier, setTier] = useState<'standard' | 'premium'>(client?.tier ?? 'standard')
  const [logoUrl, setLogoUrl] = useState(client?.logo_url ?? '')
  const [active, setActive] = useState(client?.active ?? true)
  const [pkg, setPkg] = useState<PackageSettings>(() =>
    client?.package_settings ? readPackageSettings(client.package_settings) : { ...EMPTY_PACKAGE_SETTINGS }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setPkgNum(key: keyof PackageSettings, value: string) {
    const n = Math.max(0, Math.round(Number(value)))
    setPkg(current => ({ ...current, [key]: Number.isFinite(n) ? n : 0 }))
  }

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
      const err = await onSave({ name: trimmedName, tier, active, logo_url: logoUrl.trim() || null, package: pkg })
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
      <div className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-brand-muted bg-brand-surface p-5 shadow-[0_0_40px_rgba(0,0,0,0.5)] sm:p-6">
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

          <fieldset className="rounded-lg border border-brand-muted bg-brand-bg/40 p-3.5">
            <legend className="px-1.5 text-sm font-semibold text-brand-accent">Package</legend>
            <div className="grid grid-cols-2 gap-3">
              <PackageNumber label="Video" value={pkg.professional_videos_per_month} onChange={v => setPkgNum('professional_videos_per_month', v)} />
              <PackageNumber label="Reel" value={pkg.reels_per_month} onChange={v => setPkgNum('reels_per_month', v)} />
              <PackageNumber label="F" value={pkg.photo_posts_per_month} onChange={v => setPkgNum('photo_posts_per_month', v)} />
              <PackageNumber label="DP" value={pkg.design_posters_per_month} onChange={v => setPkgNum('design_posters_per_month', v)} />
              <PackageNumber label="Animated posters" value={pkg.animated_posters_per_month} onChange={v => setPkgNum('animated_posters_per_month', v)} />
              <PackageNumber label="Shoot days" value={pkg.shoot_days_per_month} onChange={v => setPkgNum('shoot_days_per_month', v)} />
            </div>
            <label className="mt-3 flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={pkg.campaign_management_included}
                onChange={e => setPkg(current => ({ ...current, campaign_management_included: e.target.checked }))}
                className="h-4 w-4 rounded accent-brand-accent"
              />
              <span className="text-sm text-white">Campaign management included</span>
            </label>
            {pkg.campaign_management_included && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-brand-primary mb-1">Monthly campaign budget (R)</label>
                <input
                  type="number"
                  min={0}
                  value={pkg.monthly_campaign_budget}
                  onChange={e => setPkgNum('monthly_campaign_budget', e.target.value)}
                  className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
                />
              </div>
            )}
            <div className="mt-3">
              <label className="block text-xs font-medium text-brand-primary mb-1">Package notes</label>
              <textarea
                value={pkg.package_notes}
                onChange={e => setPkg(current => ({ ...current, package_notes: e.target.value }))}
                rows={2}
                placeholder="Anything specific about this client's package."
                className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3 py-2 text-sm text-white placeholder-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
            </div>
          </fieldset>

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <ActionButton variant="secondary" onClick={onClose} disabled={saving} fullWidth>Cancel</ActionButton>
            <ActionButton variant="primary" type="submit" disabled={saving} loading={saving} fullWidth>
              Save
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  )
}

// Confirm modal (archive / restore / delete)

function ConfirmModal({
  action,
  onClose,
  onArchive,
  onRestore,
  onDelete,
}: {
  action: ConfirmAction
  onClose: () => void
  onArchive: (c: Client) => Promise<void>
  onRestore: (c: Client) => Promise<void>
  onDelete: (c: Client) => Promise<void>
}) {
  const [confirmName, setConfirmName] = useState('')
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  async function execute(fn: () => Promise<void>) {
    setSaving(true)
    setModalError(null)
    try {
      await fn()
      onClose()
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Something went wrong.')
      setSaving(false)
    }
  }

  const OVERLAY = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'
  const PANEL = 'w-full max-w-sm rounded-xl border border-brand-muted bg-brand-surface p-5 shadow-[0_0_40px_rgba(0,0,0,0.5)] sm:p-6'
  const btnBase = 'flex-1 rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed'

  if (action.type === 'restore') {
    return (
      <div className={OVERLAY} onClick={e => { if (!saving && e.target === e.currentTarget) onClose() }}>
        <div className={PANEL}>
          <h2 className="mb-1 text-base font-semibold text-white">Restore client?</h2>
          <p className="mb-5 text-sm text-brand-primary">
            <strong className="text-white">{action.client.name}</strong> will reappear in all workflows.
          </p>
          {modalError && <p className="mb-3 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-400">{modalError}</p>}
          <div className="flex gap-3">
            <ActionButton onClick={onClose} disabled={saving} variant="secondary" size="sm">Cancel</ActionButton>
            <button onClick={() => execute(() => onRestore(action.client))} disabled={saving} className={`${btnBase} bg-green-600 text-white hover:brightness-110`}>
              {saving ? 'Restoring...' : 'Restore'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (action.type === 'archive') {
    return (
      <div className={OVERLAY} onClick={e => { if (!saving && e.target === e.currentTarget) onClose() }}>
        <div className={PANEL}>
          <h2 className="mb-1 text-base font-semibold text-white">Archive client?</h2>
          <p className="mb-5 text-sm text-brand-primary">
            <strong className="text-white">{action.client.name}</strong> will be hidden from all workflows. You can restore them at any time.
          </p>
          {modalError && <p className="mb-3 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-400">{modalError}</p>}
          <div className="flex gap-3">
            <ActionButton onClick={onClose} disabled={saving} variant="secondary" size="sm">Cancel</ActionButton>
            <button onClick={() => execute(() => onArchive(action.client))} disabled={saving} className={`${btnBase} bg-amber-600 text-white hover:brightness-110`}>
              {saving ? 'Archiving...' : 'Archive'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Delete flow
  if (action.checkingData) {
    return (
      <div className={OVERLAY}>
        <div className={PANEL}>
          <p className="text-sm text-brand-primary">Checking for existing data...</p>
        </div>
      </div>
    )
  }

  if (action.hasData) {
    return (
      <div className={OVERLAY} onClick={e => { if (!saving && e.target === e.currentTarget) onClose() }}>
        <div className={PANEL}>
          <h2 className="mb-1 text-base font-semibold text-white">Cannot delete</h2>
          <p className="mb-5 text-sm text-brand-primary">
            <strong className="text-white">{action.client.name}</strong> has report data. Archive instead to keep history safe.
          </p>
          {modalError && <p className="mb-3 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-400">{modalError}</p>}
          <div className="flex gap-3">
            <ActionButton onClick={onClose} disabled={saving} variant="secondary" size="sm">Cancel</ActionButton>
            <button onClick={() => execute(() => onArchive(action.client))} disabled={saving} className={`${btnBase} bg-amber-600 text-white hover:brightness-110`}>
              {saving ? 'Archiving...' : 'Archive instead'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // No data - require name match to confirm permanent deletion
  const nameMatches = confirmName === action.client.name

  return (
    <div className={OVERLAY} onClick={e => { if (!saving && e.target === e.currentTarget) onClose() }}>
      <div className={PANEL}>
        <h2 className="mb-1 text-base font-semibold text-white">Delete permanently?</h2>
        <p className="mb-4 text-sm text-brand-primary">
          This cannot be undone. Type <strong className="text-white">{action.client.name}</strong> to confirm.
        </p>
        <input
          value={confirmName}
          onChange={e => setConfirmName(e.target.value)}
          disabled={saving}
          placeholder={action.client.name}
          className="mb-4 w-full rounded-lg border border-brand-muted bg-brand-bg px-3.5 py-2.5 text-sm text-white placeholder-brand-primary/40 focus:outline-none focus:ring-2 focus:ring-red-500 transition disabled:opacity-60"
        />
        {modalError && <p className="mb-3 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-400">{modalError}</p>}
        <div className="flex gap-3">
          <ActionButton onClick={onClose} disabled={saving} variant="secondary" size="sm">Cancel</ActionButton>
          <button onClick={() => execute(() => onDelete(action.client))} disabled={saving || !nameMatches} className={`${btnBase} bg-red-600 text-white hover:brightness-110`}>
            {saving ? 'Deleting...' : 'Delete permanently'}
          </button>
        </div>
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
  const activeLower = new Set(existingClients.filter(c => c.active).map(c => c.name.toLowerCase()))
  const archivedLower = new Set(existingClients.filter(c => !c.active).map(c => c.name.toLowerCase()))
  const toAdd = unique.filter(n => !activeLower.has(n.toLowerCase()) && !archivedLower.has(n.toLowerCase()))
  const toSkip = unique.filter(n => activeLower.has(n.toLowerCase()))
  const toRestoreInstead = unique.filter(n => archivedLower.has(n.toLowerCase()))
  return { toAdd, toSkip, inListDupes, toRestoreInstead }
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

  const { toAdd, toSkip, inListDupes, toRestoreInstead } = useMemo(
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

          <ActionButton variant="primary" onClick={onClose} fullWidth>Done</ActionButton>
        </div>
      </div>
    )
  }

  const hasInput = toAdd.length > 0 || toSkip.length > 0 || toRestoreInstead.length > 0

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
                  {toSkip.length} already exist{toSkip.length === 1 ? 's' : ''} - will be skipped
                </p>
                <ul className="max-h-28 overflow-y-auto space-y-0.5">
                  {toSkip.map(name => (
                    <li key={name} className="flex items-center gap-1.5 text-xs text-brand-primary/60">
                      <span>-</span>
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {toRestoreInstead.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-amber-400">
                  {toRestoreInstead.length} archived - restore instead of re-adding
                </p>
                <ul className="max-h-28 overflow-y-auto space-y-0.5">
                  {toRestoreInstead.map(name => (
                    <li key={name} className="flex items-center gap-1.5 text-xs text-amber-400/70">
                      <span>↺</span>
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
          Logo URLs left blank - logos auto-resolve from{' '}
          <code className="rounded bg-brand-muted/60 px-1 py-0.5 text-brand-accent">/client-logos/client-name-slug.png</code>{' '}
          if a matching file exists.
        </p>

        {hasDraft && (
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-brand-primary">Draft saved on this device.</p>
            <ActionButton variant="ghost" size="sm" onClick={handleClearDraft} disabled={importing}>Clear draft</ActionButton>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <ActionButton variant="secondary" onClick={onClose} disabled={importing} fullWidth>Cancel</ActionButton>
          <ActionButton variant="primary" onClick={handleImport} disabled={importing || toAdd.length === 0} loading={importing} fullWidth>
            {toAdd.length > 0
              ? `Import ${toAdd.length} client${toAdd.length !== 1 ? 's' : ''}`
              : 'Import clients'}
          </ActionButton>
        </div>
      </div>
    </div>
  )
}
