import { useState, useEffect, useMemo } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { ActionButton } from '../../components/ui/Buttons'
import { Pill } from '../../components/ui/Badges'
import { EmptyState } from '../../components/ui/States'
import {
  listClientPackages,
  createClientPackage,
  listPackageDeliverableTemplates,
  createPackageDeliverableTemplate,
  updatePackageDeliverableTemplate,
  deactivatePackageDeliverableTemplate,
  archiveClientPackage,
  PACKAGE_DELIVERABLE_LABELS,
  PACKAGE_DELIVERABLE_TYPES,
  type ClientPackage,
  type PackageDeliverableTemplate,
  type CreateClientPackageInput,
  type CreatePackageDeliverableTemplateInput,
  type DeliverableType,
} from '../../lib/planner'
import { listActiveClients, type ClientOption } from '../../lib/commandCentre'

const TYPE_LABELS = PACKAGE_DELIVERABLE_LABELS

const MAIN_TYPE_META: Record<DeliverableType, { short: string; codePrefix: string; titlePrefix: string }> = {
  dp: { short: 'DP', codePrefix: 'DP', titlePrefix: 'DP' },
  photo: { short: 'F', codePrefix: 'F', titlePrefix: 'F' },
  video: { short: 'Video', codePrefix: 'Video', titlePrefix: 'Video' },
  reel: { short: 'Reel', codePrefix: 'Reel', titlePrefix: 'Reel' },
  content_run: { short: 'Content', codePrefix: 'Content', titlePrefix: 'Content' },
  website_update: { short: 'Web', codePrefix: 'Web', titlePrefix: 'Web' },
  monthly_report: { short: 'Report', codePrefix: 'Report', titlePrefix: 'Report' },
  strategy: { short: 'Strategy', codePrefix: 'Strategy', titlePrefix: 'Strategy' },
  admin: { short: 'Admin', codePrefix: 'Admin', titlePrefix: 'Admin' },
  other: { short: 'Other', codePrefix: 'Other', titlePrefix: 'Other' },
}

const DEFAULT_QUANTITIES: Record<DeliverableType, number> = {
  dp: 0,
  photo: 0,
  video: 0,
  reel: 0,
  content_run: 0,
  website_update: 0,
  monthly_report: 0,
  strategy: 0,
  admin: 0,
  other: 0,
}

const QUANTITY_FIELDS: { type: DeliverableType; label: string }[] = [
  { type: 'dp', label: 'DP quantity' },
  { type: 'photo', label: 'F quantity' },
  { type: 'video', label: 'Video quantity' },
  { type: 'reel', label: 'Reel quantity' },
]

function filterActive<T extends { active?: boolean }>(items: T[]): T[] {
  return items.filter(i => i.active !== false)
}

export default function PackageMasterPage() {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  const isAdmin = profile?.role === 'admin'

  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [clientSearch, setClientSearch] = useState('')

  const [packages, setPackages] = useState<ClientPackage[]>([])
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)

  const [templates, setTemplates] = useState<PackageDeliverableTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)

  const [createPkgOpen, setCreatePkgOpen] = useState(false)
  const [createTplOpen, setCreateTplOpen] = useState(false)

  const [pkgName, setPkgName] = useState('')
  const [pkgStartDate, setPkgStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [pkgNotes, setPkgNotes] = useState('')
  const [pkgSaving, setPkgSaving] = useState(false)
  const [pkgError, setPkgError] = useState<string | null>(null)

  const [tplCode, setTplCode] = useState('')
  const [tplType, setTplType] = useState<DeliverableType>('dp')
  const [tplTitle, setTplTitle] = useState('')
  const [tplAssignee, setTplAssignee] = useState('')
  const [tplDayOfMonth, setTplDayOfMonth] = useState('')
  const [tplSaving, setTplSaving] = useState(false)
  const [tplError, setTplError] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<Record<DeliverableType, number>>(DEFAULT_QUANTITIES)
  const [quantitySaving, setQuantitySaving] = useState(false)
  const [quantityMessage, setQuantityMessage] = useState<string | null>(null)

  const [tableMissing, setTableMissing] = useState(false)

  useEffect(() => {
    let active = true
    setClientsLoading(true)
    listActiveClients().then(({ data, error }) => {
      if (!active) return
      setClientsLoading(false)
      if (error) {
        if (error.message?.includes('does not exist') || error.code === '42P01') {
          setTableMissing(true)
          return
        }
        return
      }
      setClients(data ?? [])
      const clientId = searchParams.get('client')
      if (clientId && data?.some(client => client.id === clientId)) {
        setSelectedClientId(clientId)
      }
    })
    return () => { active = false }
  }, [searchParams])

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients
    const q = clientSearch.toLowerCase()
    return clients.filter(c => c.name.toLowerCase().includes(q))
  }, [clients, clientSearch])

  const selectedClient = useMemo(
    () => clients.find(c => c.id === selectedClientId),
    [clients, selectedClientId]
  )

  async function loadPackages(clientId: string) {
    setPackagesLoading(true)
    setPackages([])
    setSelectedPackageId(null)
    setTemplates([])
    const { data, error } = await listClientPackages({ clientId })
    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        setTableMissing(true)
      }
    } else {
      setPackages(data ?? [])
      if (data && data.length > 0) {
        setSelectedPackageId(data[0].id)
      }
    }
    setPackagesLoading(false)
  }

  useEffect(() => {
    if (selectedClientId) {
      void loadPackages(selectedClientId)
    } else {
      setPackages([])
      setSelectedPackageId(null)
      setTemplates([])
    }
  }, [selectedClientId])

  async function loadTemplates(pkgId: string) {
    setTemplatesLoading(true)
    const { data, error } = await listPackageDeliverableTemplates(pkgId)
    if (!error) {
      setTemplates(data ?? [])
    }
    setTemplatesLoading(false)
  }

  useEffect(() => {
    if (selectedPackageId) {
      void loadTemplates(selectedPackageId)
    } else {
      setTemplates([])
    }
  }, [selectedPackageId])

  const currentPackage = useMemo(
    () => packages.find(p => p.id === selectedPackageId),
    [packages, selectedPackageId]
  )

  const templateStats = useMemo(() => {
    const active = filterActive(templates).filter(t => PACKAGE_DELIVERABLE_TYPES.includes(t.deliverable_type))
    return {
      dp: active.filter(t => t.deliverable_type === 'dp').reduce((s, t) => s + t.count_per_month, 0),
      photo: active.filter(t => t.deliverable_type === 'photo').reduce((s, t) => s + t.count_per_month, 0),
      video: active.filter(t => t.deliverable_type === 'video').reduce((s, t) => s + t.count_per_month, 0),
      reel: active.filter(t => t.deliverable_type === 'reel').reduce((s, t) => s + t.count_per_month, 0),
    }
  }, [templates])

  useEffect(() => {
    setQuantities(current => ({
      ...current,
      dp: templateStats.dp,
      photo: templateStats.photo,
      video: templateStats.video,
      reel: templateStats.reel,
    }))
  }, [templateStats])

  async function handleCreatePackage(e: FormEvent) {
    e.preventDefault()
    if (pkgSaving || !pkgName.trim() || !selectedClientId) return
    setPkgSaving(true)
    setPkgError(null)
    const input: CreateClientPackageInput = {
      client_id: selectedClientId,
      package_name: pkgName.trim(),
      start_date: pkgStartDate,
      notes: pkgNotes.trim() || null,
    }
    const { error } = await createClientPackage(input)
    if (error) {
      setPkgError(error.message)
    } else {
      setPkgName('')
      setPkgNotes('')
      setCreatePkgOpen(false)
      await loadPackages(selectedClientId)
    }
    setPkgSaving(false)
  }

  function templateCode(type: DeliverableType, index: number) {
    const prefix = MAIN_TYPE_META[type].codePrefix
    return type === 'video' || type === 'reel' ? `${prefix} ${index}` : `${prefix}${index}`
  }

  async function savePackageQuantities() {
    if (!selectedPackageId || quantitySaving) return
    setQuantitySaving(true)
    setQuantityMessage(null)

    for (const type of PACKAGE_DELIVERABLE_TYPES) {
      const target = Math.max(0, Math.round(quantities[type] || 0))
      const existing = filterActive(templates)
        .filter(template => template.deliverable_type === type)
        .sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code))

      for (let i = 0; i < target; i++) {
        const code = templateCode(type, i + 1)
        const current = existing[i]
        if (current) {
          await updatePackageDeliverableTemplate(current.id, {
            code,
            title_template: code,
            count_per_month: 1,
            sort_order: i + 1,
            active: true,
          })
        } else {
          await createPackageDeliverableTemplate({
            package_id: selectedPackageId,
            code,
            deliverable_type: type,
            title_template: code,
            count_per_month: 1,
          })
        }
      }

      for (const extra of existing.slice(target)) {
        await deactivatePackageDeliverableTemplate(extra.id)
      }
    }

    await loadTemplates(selectedPackageId)
    setQuantityMessage('Package quantities saved.')
    setQuantitySaving(false)
  }

  async function handleCreateTemplate(e: FormEvent) {
    e.preventDefault()
    if (tplSaving || !tplCode.trim() || !selectedPackageId) return
    setTplSaving(true)
    setTplError(null)
    const input: CreatePackageDeliverableTemplateInput = {
      package_id: selectedPackageId,
      code: tplCode.trim(),
      deliverable_type: tplType,
      title_template: tplTitle.trim() || tplCode.trim(),
      count_per_month: 1,
      default_assignee_name: tplAssignee.trim() || undefined,
      default_day_of_month: tplDayOfMonth ? parseInt(tplDayOfMonth, 10) : undefined,
    }
    const { error } = await createPackageDeliverableTemplate(input)
    if (error) {
      setTplError(error.message)
    } else {
      setTplCode('')
      setTplTitle('')
      setTplAssignee('')
      setTplDayOfMonth('')
      setCreateTplOpen(false)
      await loadTemplates(selectedPackageId)
    }
    setTplSaving(false)
  }

  async function handleDeactivateTemplate(id: string) {
    const { error } = await deactivatePackageDeliverableTemplate(id)
    if (!error && selectedPackageId) {
      await loadTemplates(selectedPackageId)
    }
  }

  async function handleArchivePackage(id: string) {
    const endDate = new Date().toISOString().slice(0, 10)
    const { error } = await archiveClientPackage(id, endDate)
    if (!error && selectedClientId) {
      await loadPackages(selectedClientId)
    }
  }

  if (tableMissing) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-xl font-black tracking-tight text-white">Package Master</h1>
        <EmptyState
          title="Planner tables not set up"
          message="Run the Phase 6 migrations to enable package management."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5">
        <h1 className="text-3xl font-black tracking-tight text-white">Package Master</h1>
        <p className="mt-1 text-sm text-white/45">Set the package.</p>
      </div>

      {/* Client selector */}
      <div className="mb-5">
        <label className="mb-1.5 block text-xs font-medium text-white/50">Client</label>
        {clientsLoading ? (
          <div className="h-10 w-full animate-pulse rounded-lg bg-white/10" />
        ) : (
          <div className="relative">
            <input
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              placeholder="Search clients"
              className="w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-brand-accent"
            />
            {clientSearch && filteredClients.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-brand-surface shadow-xl">
                {filteredClients.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setSelectedClientId(c.id); setClientSearch(''); setCreatePkgOpen(false) }}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.04] ${
                      selectedClientId === c.id ? 'text-brand-accent font-medium' : 'text-white/70'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            {clientSearch && filteredClients.length === 0 && (
              <p className="mt-1 text-xs text-white/30">No clients match "{clientSearch}"</p>
            )}
          </div>
        )}
      </div>

      {!selectedClient ? (
        <EmptyState
          title="Select a client"
          message="Choose a client to view packages."
          centered={false}
        />
      ) : (
        <>
          {/* Client header */}
          <div className="mb-5 flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Selected</p>
              <h2 className="text-lg font-bold text-white">{selectedClient.name}</h2>
            </div>
            {isAdmin && (
              <ActionButton variant="outline" size="sm" onClick={() => setCreatePkgOpen(!createPkgOpen)}>
                {createPkgOpen ? 'Cancel' : 'New package'}
              </ActionButton>
            )}
          </div>

          {/* Create package form */}
          {createPkgOpen && isAdmin && (
            <div className="mb-5 rounded-xl bg-white/[0.035] p-4">
              <h3 className="mb-3 text-sm font-semibold text-white">New package</h3>
              <form onSubmit={handleCreatePackage} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-white/50">Package name *</label>
                    <input
                      value={pkgName}
                      onChange={e => setPkgName(e.target.value)}
                      required
                      placeholder="e.g. Standard Monthly"
                    className="w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-brand-accent"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-white/50">Start date *</label>
                    <input
                      type="date"
                      value={pkgStartDate}
                      onChange={e => setPkgStartDate(e.target.value)}
                      required
                      className="w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-white/50">Notes</label>
                  <textarea
                    value={pkgNotes}
                    onChange={e => setPkgNotes(e.target.value)}
                    rows={2}
                    placeholder="Optional"
                    className="w-full resize-none rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-brand-accent"
                  />
                </div>
                {pkgError && <p className="text-xs text-red-400">{pkgError}</p>}
                <ActionButton variant="primary" type="submit" disabled={pkgSaving || !pkgName.trim()} loading={pkgSaving}>
                  Create package
                </ActionButton>
              </form>
            </div>
          )}

          {/* Packages list */}
          {packagesLoading ? (
            <div className="mb-5 space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />
              ))}
            </div>
          ) : packages.length === 0 ? (
            <div className="mb-6">
              <EmptyState
                title="No packages yet"
                message={isAdmin ? 'Create a package to define monthly deliverables.' : 'No packages set up yet.'}
                centered={false}
              />
            </div>
          ) : (
            <div className="mb-6 space-y-2">
              {packages.map(pkg => {
                const isSelected = pkg.id === selectedPackageId
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setSelectedPackageId(pkg.id)}
                  className={`w-full rounded-lg px-4 py-3 text-left transition-all ${
                      isSelected
                        ? 'bg-brand-accent/10'
                        : 'bg-white/[0.025] hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold text-white">{pkg.package_name}</span>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-white/40">
                          <span>From {pkg.start_date}</span>
                          {pkg.end_date && <span>· End {pkg.end_date}</span>}
                          {pkg.status !== 'active' && <Pill tone="neutral">{pkg.status}</Pill>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {pkg.notes && (
                          <span className="hidden sm:block max-w-[200px] truncate text-xs text-white/30">
                            {pkg.notes}
                          </span>
                        )}
                        {isSelected && isAdmin && pkg.status === 'active' && (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); handleArchivePackage(pkg.id) }}
                            className="rounded-lg border border-red-400/30 px-2.5 py-1 text-[11px] text-red-400 hover:bg-red-400/10 transition-colors"
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Selected package detail */}
          {currentPackage && (
            <div className="mb-6">
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg bg-white/[0.025] p-3 text-center">
                  <p className="text-xl font-semibold text-white">{templateStats.dp}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mt-0.5">DP (Designed Poster)</p>
                </div>
                <div className="rounded-lg bg-white/[0.025] p-3 text-center">
                  <p className="text-xl font-semibold text-white">{templateStats.photo}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mt-0.5">F (Photo)</p>
                </div>
                <div className="rounded-lg bg-white/[0.025] p-3 text-center">
                  <p className="text-xl font-semibold text-white">{templateStats.video}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mt-0.5">Video</p>
                </div>
                <div className="rounded-lg bg-white/[0.025] p-3 text-center">
                  <p className="text-xl font-semibold text-white">{templateStats.reel}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mt-0.5">Reel</p>
                </div>
              </div>

              {isAdmin && (
                <div className="mb-4 rounded-xl bg-white/[0.025] p-3">
                  <div className="grid gap-2 sm:grid-cols-4">
                    {QUANTITY_FIELDS.map(field => (
                      <label key={field.type} className="block">
                        <span className="mb-1 block text-[11px] font-medium text-white/45">{field.label}</span>
                        <input
                          type="number"
                          min={0}
                          value={quantities[field.type]}
                          onChange={event => setQuantities(current => ({
                            ...current,
                            [field.type]: Math.max(0, Math.round(Number(event.target.value) || 0)),
                          }))}
                          className="w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <ActionButton size="sm" onClick={savePackageQuantities} loading={quantitySaving}>
                      Save Quantities
                    </ActionButton>
                    {quantityMessage && <span className="text-xs text-brand-accent">{quantityMessage}</span>}
                  </div>
                </div>
              )}

              <div className="mb-4 flex flex-wrap gap-1.5">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setCreateTplOpen(!createTplOpen)}
                    className="rounded-lg bg-brand-accent/10 px-2.5 py-1.5 text-xs font-medium text-brand-accent hover:bg-brand-accent/15 transition-colors"
                  >
                    {createTplOpen ? 'Hide advanced' : 'Advanced template'}
                  </button>
                )}
              </div>

              {!isAdmin && (
                <p className="mb-3 text-xs text-amber-400/70">Admin access required to add or edit templates.</p>
              )}

              {/* Custom template form */}
              {createTplOpen && isAdmin && (
                <div className="mb-4 rounded-xl bg-white/[0.035] p-4">
                  <h3 className="mb-3 text-sm font-semibold text-white">Add deliverable template</h3>
                  <form onSubmit={handleCreateTemplate} className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-[11px] text-white/50">Code *</label>
                        <input
                          value={tplCode}
                          onChange={e => setTplCode(e.target.value)}
                          required
                          placeholder="e.g. DP5"
                           className="w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-brand-accent"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-white/50">Type</label>
                        <select
                          value={tplType}
                          onChange={e => setTplType(e.target.value as DeliverableType)}
                          className="w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
                        >
                          {PACKAGE_DELIVERABLE_TYPES.map(t => (
                            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-white/50">Title template</label>
                        <input
                          value={tplTitle}
                          onChange={e => setTplTitle(e.target.value)}
                          placeholder="e.g. Designed Poster {instance}"
                          className="w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-brand-accent"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-white/50">Default assignee</label>
                        <input
                          value={tplAssignee}
                          onChange={e => setTplAssignee(e.target.value)}
                          placeholder="Staff name"
                          className="w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-brand-accent"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-white/50">Default day of month</label>
                        <input
                          type="number"
                          min={1}
                          max={28}
                          value={tplDayOfMonth}
                          onChange={e => setTplDayOfMonth(e.target.value)}
                          placeholder="e.g. 15"
                          className="w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-brand-accent"
                        />
                      </div>
                    </div>
                    {tplError && <p className="text-xs text-red-400">{tplError}</p>}
                    <ActionButton variant="primary" type="submit" disabled={tplSaving || !tplCode.trim()} loading={tplSaving}>
                      Add template
                    </ActionButton>
                  </form>
                </div>
              )}

              {/* Template list */}
              {templatesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-10 animate-pulse rounded-lg bg-white/[0.04]" />
                  ))}
                </div>
              ) : templates.length === 0 ? (
                <p className="text-sm text-white/30">No templates yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl bg-white/[0.02]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-brand-muted/20 bg-white/[0.02]">
                        <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-white/40">Code</th>
                        <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-white/40">Type</th>
                        <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-white/40">Title</th>
                        <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-white/40 hidden sm:table-cell">Count</th>
                        <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-white/40 hidden md:table-cell">Assignee</th>
                        <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-white/40 hidden md:table-cell">Day</th>
                        <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-white/40">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-muted/10">
                      {filterActive(templates).filter(t => PACKAGE_DELIVERABLE_TYPES.includes(t.deliverable_type)).map(t => (
                        <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-3 py-2.5">
                            <span className="font-medium text-white">{t.code}</span>
                          </td>
                          <td className="px-3 py-2.5 text-white/60">{TYPE_LABELS[t.deliverable_type]}</td>
                          <td className="px-3 py-2.5 text-white/60 truncate max-w-[160px]">{t.title_template}</td>
                          <td className="px-3 py-2.5 text-white/60 hidden sm:table-cell">{t.count_per_month}</td>
                          <td className="px-3 py-2.5 text-white/40 hidden md:table-cell">{t.default_assignee_name ?? '—'}</td>
                          <td className="px-3 py-2.5 text-white/40 hidden md:table-cell">{t.default_day_of_month ?? '—'}</td>
                          <td className="px-3 py-2.5 text-right">
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeactivateTemplate(t.id)}
                                className="rounded border border-brand-muted/30 px-2 py-0.5 text-[11px] text-white/40 hover:text-red-400 hover:border-red-400/30 transition-colors"
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {!isAdmin && (
            <p className="mt-6 text-xs text-white/30">
              Only admins can create or modify packages and templates.
            </p>
          )}
        </>
      )}
    </div>
  )
}
