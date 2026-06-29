import { useState, useEffect, useMemo } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { ActionButton } from '../../components/ui/Buttons'
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

const TYPE_LABELS = {
  ...PACKAGE_DELIVERABLE_LABELS,
  dp: 'DP',
  photo: 'F',
  video: 'Video',
  reel: 'Reel',
}

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
  { type: 'dp', label: 'DP' },
  { type: 'photo', label: 'F' },
  { type: 'video', label: 'Video' },
  { type: 'reel', label: 'Reel' },
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
  const [showTemplates, setShowTemplates] = useState(false)

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
    setShowTemplates(false)
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
    setQuantityMessage('Package saved.')
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
        <h1 className="mb-6 text-xl font-black tracking-tight text-white">Package</h1>
        <EmptyState
          title="Planner tables not set up"
          message="Run Phase 6 migrations."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="mb-5">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f2b66f]">Client workflow</p>
        <h1 className="mt-2 font-display text-4xl font-black uppercase tracking-wide text-white">Package</h1>
        <p className="mt-1 text-sm text-brand-primary/60">Monthly package quantities.</p>
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
              placeholder={selectedClient ? selectedClient.name : 'Search clients…'}
              className="w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2.5 text-sm text-white placeholder-white/45 focus:outline-none focus:ring-1 focus:ring-brand-accent"
            />
            {clientSearch && filteredClients.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-brand-surface shadow-xl">
                {filteredClients.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedClientId(c.id)
                      setClientSearch('')
                      setCreatePkgOpen(false)
                    }}
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
          message="Search above to get started."
          centered={false}
        />
      ) : (
        <>
          {/* Package header */}
          {packagesLoading ? (
            <div className="mb-5 h-20 animate-pulse rounded-xl bg-white/[0.04]" />
          ) : packages.length === 0 ? (
            <div className="mb-5">
              <div className="mb-4 flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-teal/60">{selectedClient.name}</p>
                  <p className="mt-0.5 text-sm text-white/40">No package yet.</p>
                </div>
                {isAdmin && (
                  <ActionButton variant="outline" size="sm" onClick={() => setCreatePkgOpen(!createPkgOpen)}>
                    {createPkgOpen ? 'Cancel' : 'New package'}
                  </ActionButton>
                )}
              </div>
              {!isAdmin && (
                <EmptyState title="No package yet" message="No package configured." centered={false} />
              )}
            </div>
          ) : currentPackage && (
            <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-teal/60">{selectedClient.name}</p>
                  <h2 className="mt-0.5 text-xl font-black text-white">{currentPackage.package_name}</h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-white/40">From {currentPackage.start_date}</span>
                    {currentPackage.end_date && <span className="text-xs text-white/40">· To {currentPackage.end_date}</span>}
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                      currentPackage.status === 'active'
                        ? 'border-brand-teal/25 text-[#2dd4bf]'
                        : 'border-white/10 text-white/30'
                    }`}>
                      {currentPackage.status === 'active' ? 'Active' : currentPackage.status}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                  {isAdmin && currentPackage.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => handleArchivePackage(currentPackage.id)}
                      className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white/40 transition-colors hover:border-red-400/30 hover:text-red-400"
                    >
                      Archive
                    </button>
                  )}
                  {isAdmin && (
                    <ActionButton variant="outline" size="sm" onClick={() => setCreatePkgOpen(!createPkgOpen)}>
                      {createPkgOpen ? 'Cancel' : 'New package'}
                    </ActionButton>
                  )}
                </div>
              </div>

              {/* Package switcher for multiple packages */}
              {packages.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-3">
                  {packages.map(pkg => (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setSelectedPackageId(pkg.id)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                        pkg.id === selectedPackageId
                          ? 'border-brand-teal/30 bg-brand-teal/[0.08] text-[#2dd4bf]'
                          : 'border-white/10 text-white/40 hover:text-white/70'
                      }`}
                    >
                      {pkg.package_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* New package form */}
          {createPkgOpen && isAdmin && (
            <div className="mb-5 rounded-xl border border-white/8 bg-white/[0.035] p-4">
              <h3 className="mb-3 text-sm font-bold text-white">New package</h3>
              <form onSubmit={handleCreatePackage} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-white/50">Package name</label>
                    <input
                      value={pkgName}
                      onChange={e => setPkgName(e.target.value)}
                      required
                      placeholder="e.g. Standard Monthly"
                      className="w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-brand-accent"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-white/50">Start date</label>
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
                  <label className="mb-1 block text-[11px] text-white/50">Notes (optional)</label>
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

          {/* Quantity editor — main section */}
          {currentPackage && (
            <div className="mb-6">
              {isAdmin ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="mb-4 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Monthly quantities</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {QUANTITY_FIELDS.map(field => (
                      <div key={field.type} className="rounded-lg border border-white/8 bg-white/[0.03] p-3">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/35">{field.label}</p>
                        <input
                          type="number"
                          min={0}
                          value={quantities[field.type]}
                          onChange={e => setQuantities(current => ({
                            ...current,
                            [field.type]: Math.max(0, Math.round(Number(e.target.value) || 0)),
                          }))}
                          className="w-full bg-transparent text-2xl font-black text-white focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <ActionButton size="sm" onClick={savePackageQuantities} loading={quantitySaving}>
                      Save
                    </ActionButton>
                    {quantityMessage && (
                      <span className="text-xs text-[#2dd4bf]">{quantityMessage}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {QUANTITY_FIELDS.map(field => (
                    <div key={field.type} className="rounded-lg border border-white/8 bg-white/[0.035] p-3 text-center">
                      <p className="text-2xl font-black text-white">{quantities[field.type]}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/40">{field.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Template list — secondary, collapsed */}
          {currentPackage && (
            <div>
              <button
                type="button"
                onClick={() => setShowTemplates(prev => !prev)}
                className="flex items-center gap-1.5 text-xs font-medium text-white/30 transition-colors hover:text-white/55"
              >
                <svg
                  className={`h-3.5 w-3.5 transition-transform ${showTemplates ? 'rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                {showTemplates ? 'Hide package items' : 'Show package items'}
              </button>

              {showTemplates && (
                <div className="mt-4">
                  {isAdmin && (
                    <div className="mb-3">
                      <button
                        type="button"
                        onClick={() => setCreateTplOpen(!createTplOpen)}
                        className="rounded-lg border border-white/8 px-2.5 py-1.5 text-xs font-medium text-white/40 transition-colors hover:border-white/20 hover:text-white/60"
                      >
                        {createTplOpen ? 'Hide' : '+ Custom item'}
                      </button>
                    </div>
                  )}

                  {!isAdmin && (
                    <p className="mb-3 text-xs text-amber-400/70">Admin access required to edit templates.</p>
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
                    <p className="text-sm text-white/30">No package items yet.</p>
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
                            <tr key={t.id} className="transition-colors hover:bg-white/[0.02]">
                              <td className="px-3 py-2.5">
                                <span className="font-medium text-white">{t.code}</span>
                              </td>
                              <td className="px-3 py-2.5 text-white/60">{TYPE_LABELS[t.deliverable_type]}</td>
                              <td className="max-w-[160px] truncate px-3 py-2.5 text-white/60">{t.title_template}</td>
                              <td className="hidden px-3 py-2.5 text-white/60 sm:table-cell">{t.count_per_month}</td>
                              <td className="hidden px-3 py-2.5 text-white/40 md:table-cell">{t.default_assignee_name ?? '—'}</td>
                              <td className="hidden px-3 py-2.5 text-white/40 md:table-cell">{t.default_day_of_month ?? '—'}</td>
                              <td className="px-3 py-2.5 text-right">
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeactivateTemplate(t.id)}
                                    className="rounded border border-brand-muted/30 px-2 py-0.5 text-[11px] text-white/40 transition-colors hover:border-red-400/30 hover:text-red-400"
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
            </div>
          )}
        </>
      )}
    </div>
  )
}
