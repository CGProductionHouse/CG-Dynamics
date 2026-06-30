import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { ActionButton } from '../../components/ui/Buttons'
import { EmptyState } from '../../components/ui/States'
import {
  PACKAGE_DELIVERABLE_LABELS,
  PACKAGE_DELIVERABLE_TYPES,
  SIMPLIFIED_STATUS_LABELS,
  SIMPLIFIED_STATUS_OPTIONS,
  SIMPLIFIED_TO_BACKEND_STATUS,
  generateMonthFromPackages,
  getMonthlyPackageTotals,
  listClientPackages,
  listMonthlyDeliverablesByMonth,
  monthKey,
  simplifyProductionStatus,
  updateMonthlyDeliverableStatus,
  updateMonthlyDeliverableSchedule,
  type DeliverableType,
  type MonthlyDeliverable,
  type SimplifiedProductionStatus,
} from '../../lib/planner'
import { listActiveClients, type ClientOption } from '../../lib/commandCentre'

const TYPE_LABELS: Record<DeliverableType, string> = {
  ...PACKAGE_DELIVERABLE_LABELS,
  dp: 'DP',
  photo: 'F',
  video: 'Video',
  reel: 'Reel',
}

const DISPLAY_TYPES: DeliverableType[] = ['dp', 'photo', 'video', 'reel']

const STATUS_TONE: Record<SimplifiedProductionStatus, string> = {
  not_started: 'text-white/50 border-white/10 bg-white/[0.03]',
  in_progress: 'text-brand-accent border-brand-accent/25 bg-brand-accent/[0.07]',
  ready_review: 'text-amber-300 border-amber-400/25 bg-amber-400/[0.07]',
  awaiting_client: 'text-sky-200 border-sky-300/25 bg-sky-300/[0.07]',
  meta_drafts: 'text-[#2dd4bf] border-[#2dd4bf]/25 bg-[#2dd4bf]/[0.07]',
  scheduled_posted: 'text-[#2dd4bf] border-[#2dd4bf]/25 bg-[#2dd4bf]/[0.07]',
}

const STATUS_STAT_TONE: Record<SimplifiedProductionStatus, string> = {
  not_started: 'text-white',
  in_progress: 'text-brand-accent',
  ready_review: 'text-amber-300',
  awaiting_client: 'text-sky-300',
  meta_drafts: 'text-[#2dd4bf]',
  scheduled_posted: 'text-[#2dd4bf]',
}

type DeliverableSource = 'package' | 'client_request' | 'moved' | 'replaced' | 'unlinked'

function deliverableSource(d: MonthlyDeliverable): DeliverableSource {
  if (d.moved_from_deliverable_id) return 'moved'
  if (d.replaced_by_request_id) return 'replaced'
  if (d.priority === 'client_request') return 'client_request'
  if (d.package_id || d.template_id) return 'package'
  return 'unlinked'
}

const SOURCE_LABEL: Record<DeliverableSource, string> = {
  package: 'Package',
  client_request: 'Client request',
  moved: 'Moved',
  replaced: 'Replaced',
  unlinked: 'Unlinked',
}

const SOURCE_CHIP_STYLE: Record<DeliverableSource, string> = {
  package: 'border-brand-teal/25 bg-brand-teal/[0.07] text-[#2dd4bf]',
  client_request: 'border-amber-400/25 bg-amber-400/[0.07] text-amber-300',
  moved: 'border-white/10 bg-white/[0.03] text-white/40',
  replaced: 'border-white/10 bg-white/[0.03] text-white/40',
  unlinked: 'border-white/[0.06] bg-white/[0.015] text-white/25',
}

function toMonthStart(key: string) {
  return `${key}-01`
}

function shiftMonth(key: string, amount: number) {
  const [year, month] = key.split('-').map(Number)
  const date = new Date(year, month - 1 + amount, 1)
  return monthKey(date)
}

function formatDate(value: string | null) {
  if (!value) return null
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
  })
}

function formatMonthHeading(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
}

const STAFF_STATUSES: SimplifiedProductionStatus[] = ['not_started', 'in_progress', 'ready_review', 'awaiting_client']
const FINAL_STATUSES: SimplifiedProductionStatus[] = ['meta_drafts', 'scheduled_posted']

export default function MonthlyPlannerPage() {
  const [searchParams] = useSearchParams()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const isScheduleController = isAdmin
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()))
  const [deliverables, setDeliverables] = useState<MonthlyDeliverable[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [activePackageCount, setActivePackageCount] = useState(0)
  const [clientFilter, setClientFilter] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | SimplifiedProductionStatus>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | DeliverableType>('all')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [tableMissing, setTableMissing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [drawerDeliverable, setDrawerDeliverable] = useState<MonthlyDeliverable | null>(null)
  const [drawerClientName, setDrawerClientName] = useState('')

  const monthStart = toMonthStart(selectedMonth)

  const clientNameById = useMemo(() => {
    return new Map(clients.map(client => [client.id, client.name]))
  }, [clients])

  // Status counts from all package deliverables this month (unfiltered)
  const statusCounts = useMemo(() => {
    const counts: Record<SimplifiedProductionStatus, number> = {
      not_started: 0, in_progress: 0, ready_review: 0,
      awaiting_client: 0, meta_drafts: 0, scheduled_posted: 0,
    }
    for (const d of deliverables) {
      if (!PACKAGE_DELIVERABLE_TYPES.includes(d.deliverable_type)) continue
      counts[simplifyProductionStatus(d.production_status)]++
    }
    return counts
  }, [deliverables])

  const filteredDeliverables = useMemo(() => {
    const search = clientSearch.trim().toLowerCase()
    return deliverables.filter(deliverable => {
      if (!PACKAGE_DELIVERABLE_TYPES.includes(deliverable.deliverable_type)) return false
      if (statusFilter !== 'all' && simplifyProductionStatus(deliverable.production_status) !== statusFilter) return false
      if (!search) return true
      const clientName = clientNameById.get(deliverable.client_id) ?? 'Unknown client'
      return clientName.toLowerCase().includes(search)
    })
  }, [clientNameById, clientSearch, deliverables, statusFilter])

  const groupedDeliverables = useMemo(() => {
    const groups = new Map<string, MonthlyDeliverable[]>()
    for (const deliverable of filteredDeliverables) {
      const current = groups.get(deliverable.client_id) ?? []
      current.push(deliverable)
      groups.set(deliverable.client_id, current)
    }
    return Array.from(groups.entries())
      .map(([clientId, items]) => ({
        clientId,
        clientName: clientNameById.get(clientId) ?? 'Unknown client',
        items: items.sort((a, b) => a.deliverable_type.localeCompare(b.deliverable_type) || a.code.localeCompare(b.code) || a.instance_number - b.instance_number),
        totals: getMonthlyPackageTotals(items),
      }))
      .sort((a, b) => a.clientName.localeCompare(b.clientName))
  }, [clientNameById, filteredDeliverables])

  const overallTotals = useMemo(() => getMonthlyPackageTotals(filteredDeliverables), [filteredDeliverables])

  const sourceCounts = useMemo(() => {
    let pkg = 0, clientReq = 0, movedOrReplaced = 0, unlinked = 0
    for (const d of filteredDeliverables) {
      const src = deliverableSource(d)
      if (src === 'package') pkg++
      else if (src === 'client_request') clientReq++
      else if (src === 'moved' || src === 'replaced') movedOrReplaced++
      else unlinked++
    }
    return { pkg, clientReq, movedOrReplaced, unlinked }
  }, [filteredDeliverables])

  async function loadData() {
    setLoading(true)
    setTableMissing(false)
    setErrorMessage(null)

    const [clientResult, packageResult, deliverableResult] = await Promise.all([
      listActiveClients(),
      listClientPackages({ status: 'active' }),
      listMonthlyDeliverablesByMonth(monthStart, {
        clientId: clientFilter || undefined,
        deliverableType: typeFilter === 'all' ? undefined : typeFilter,
      }),
    ])

    setLoading(false)

    if (clientResult.error || packageResult.error || deliverableResult.error) {
      const error = clientResult.error ?? packageResult.error ?? deliverableResult.error
      if (error?.message?.includes('does not exist') || error?.code === '42P01') {
        setTableMissing(true)
        return
      }
      setErrorMessage(error?.message ?? 'Could not load monthly planner data.')
      return
    }

    setClients(clientResult.data ?? [])
    const clientId = searchParams.get('client')
    if (clientId && !clientFilter && clientResult.data?.some(client => client.id === clientId)) {
      setClientFilter(clientId)
    }
    setActivePackageCount(packageResult.data?.length ?? 0)
    setDeliverables(deliverableResult.data ?? [])
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStart, clientFilter, typeFilter])

  useEffect(() => {
    if (!drawerDeliverable) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setDrawerDeliverable(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerDeliverable])

  function openDrawer(deliverable: MonthlyDeliverable, clientName: string) {
    setDrawerDeliverable(deliverable)
    setDrawerClientName(clientName)
  }

  async function handleGenerate() {
    if (!isAdmin) return
    setGenerating(true)
    setMessage(null)
    setErrorMessage(null)

    const result = await generateMonthFromPackages(monthStart)
    setGenerating(false)

    if (result.error) {
      setErrorMessage(result.error.message ?? 'Could not generate monthly deliverables.')
      return
    }

    setMessage(`Generated ${result.inserted} deliverables. Skipped ${result.skipped} existing items.`)
    await loadData()
  }

  async function handleStatusChange(id: string, status: SimplifiedProductionStatus) {
    if (!profile) return
    setStatusError(null)
    // TODO: confirm RLS allows staff production-status updates.
    if (FINAL_STATUSES.includes(status) && !isScheduleController) {
      setStatusError('Only admin can set final scheduling statuses.')
      return
    }
    setErrorMessage(null)
    const backendStatus = SIMPLIFIED_TO_BACKEND_STATUS[status]
    const { error } = await updateMonthlyDeliverableStatus(id, backendStatus)
    if (error) {
      setErrorMessage(error.message ?? 'Could not update status.')
      return
    }
    setDeliverables(current => current.map(item => item.id === id ? { ...item, production_status: backendStatus } : item))
    setDrawerDeliverable(prev => prev?.id === id ? { ...prev, production_status: backendStatus } : prev)
  }

  async function handleScheduleChange(id: string, scheduledDate: string | null) {
    const { error } = await updateMonthlyDeliverableSchedule(id, scheduledDate)
    if (error) {
      setErrorMessage(error.message ?? 'Could not update schedule.')
      return
    }
    setDeliverables(current => current.map(item => item.id === id ? { ...item, scheduled_date: scheduledDate } : item))
    setDrawerDeliverable(prev => prev?.id === id ? { ...prev, scheduled_date: scheduledDate } : prev)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-4 h-6 w-48 animate-pulse rounded bg-white/10" />
        <div className="mb-4 h-10 w-full animate-pulse rounded-lg bg-white/[0.04]" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-40 animate-pulse rounded-lg bg-white/[0.04]" />)}
        </div>
      </div>
    )
  }

  if (tableMissing) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-xl font-black tracking-tight text-white">Monthly Planner</h1>
        <EmptyState title="Planner tables not set up" message="Run the planner migrations." />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f2b66f]">Planner</p>
          <h1 className="mt-2 font-display text-4xl font-black uppercase tracking-wide text-white">
            {formatMonthHeading(selectedMonth)}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
            className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-brand-primary hover:text-white"
          >
            ← Prev
          </button>
          <input
            type="month"
            value={selectedMonth}
            onChange={event => setSelectedMonth(event.target.value)}
            className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-white outline-none focus:border-brand-accent/50"
          />
          <button
            type="button"
            onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
            className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-brand-primary hover:text-white"
          >
            Next →
          </button>
          {isAdmin && (
            <ActionButton size="sm" variant="outline" onClick={handleGenerate} loading={generating}>
              Generate month
            </ActionButton>
          )}
        </div>
      </div>

      {(message || errorMessage) && (
        <div className={`mb-3 rounded-lg px-3 py-2 text-sm ${errorMessage ? 'bg-red-400/10 text-red-200' : 'bg-brand-accent/10 text-brand-accent'}`}>
          {errorMessage ?? message}
        </div>
      )}

      {statusError && (
        <div className="mb-3 rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {statusError}
        </div>
      )}

      {/* Status summary */}
      <div className="mb-4 grid grid-cols-3 gap-2 lg:grid-cols-6">
        {SIMPLIFIED_STATUS_OPTIONS.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
            className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
              statusFilter === s
                ? `${STATUS_TONE[s]} ring-1 ring-inset ring-white/20`
                : 'border-white/8 bg-white/[0.025] hover:bg-white/[0.04]'
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35 truncate">
              {SIMPLIFIED_STATUS_LABELS[s]}
            </p>
            <p className={`mt-1 text-xl font-black ${statusFilter === s ? STATUS_STAT_TONE[s] : 'text-white'}`}>
              {statusCounts[s]}
            </p>
          </button>
        ))}
      </div>

      {/* Type totals */}
      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
        <div className="rounded-lg bg-white/[0.02] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.1em] text-white/30">Total</p>
          <p className="mt-1 text-lg font-black text-white">{overallTotals.total}</p>
        </div>
        {DISPLAY_TYPES.map(type => (
          <div key={type} className="rounded-lg bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.1em] text-white/30">{TYPE_LABELS[type]}</p>
            <p className="mt-1 text-lg font-black text-white">
              {overallTotals.byType[type].complete}
              <span className="text-sm font-medium text-white/30">/{overallTotals.byType[type].total}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Package usage summary */}
      {filteredDeliverables.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/30">Package usage</span>
          <div className="flex flex-wrap gap-1.5">
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${SOURCE_CHIP_STYLE.package}`}>
              Package {sourceCounts.pkg}
            </span>
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${SOURCE_CHIP_STYLE.client_request}`}>
              Client request {sourceCounts.clientReq}
            </span>
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${SOURCE_CHIP_STYLE.moved}`}>
              Moved/Replaced {sourceCounts.movedOrReplaced}
            </span>
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${SOURCE_CHIP_STYLE.unlinked}`}>
              Unlinked {sourceCounts.unlinked}
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 grid gap-2 rounded-xl border border-white/8 bg-white/[0.025] p-3 md:grid-cols-4">
        <select
          value={clientFilter}
          onChange={event => setClientFilter(event.target.value)}
          className="rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white outline-none focus:border-brand-accent/50"
        >
          <option value="">All clients</option>
          {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
        <input
          type="search"
          value={clientSearch}
          onChange={event => setClientSearch(event.target.value)}
          placeholder="Search client"
          className="rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-brand-accent/50"
        />
        <select
          value={statusFilter}
          onChange={event => setStatusFilter(event.target.value as 'all' | SimplifiedProductionStatus)}
          className="rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white outline-none focus:border-brand-accent/50"
        >
          <option value="all">All statuses</option>
          {SIMPLIFIED_STATUS_OPTIONS.map(status => <option key={status} value={status}>{SIMPLIFIED_STATUS_LABELS[status]}</option>)}
        </select>
        <select
          value={typeFilter}
          onChange={event => setTypeFilter(event.target.value as 'all' | DeliverableType)}
          className="rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white outline-none focus:border-brand-accent/50"
        >
          <option value="all">All types</option>
          {PACKAGE_DELIVERABLE_TYPES.map(type => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}
        </select>
      </div>

      {/* Deliverable groups */}
      {groupedDeliverables.length === 0 ? (
        <EmptyState
          title="No deliverables this month."
          message={activePackageCount === 0 ? 'Set up packages in Package Master first.' : isAdmin ? 'Use Generate month to create deliverables.' : ''}
          action={isAdmin ? (
            <ActionButton variant="outline" onClick={handleGenerate} loading={generating}>
              Generate month
            </ActionButton>
          ) : undefined}
          centered={false}
        />
      ) : (
        <div className="space-y-3">
          {groupedDeliverables.map(group => (
            <section key={group.clientId} className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
              <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">{group.clientName}</h2>
                  <p className="text-xs text-white/35">
                    {group.totals.total - group.totals.remaining}/{group.totals.total} done
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-1.5 text-[11px] sm:flex">
                  {DISPLAY_TYPES.map(type => (
                    <MiniTotal key={type} label={TYPE_LABELS[type]} total={group.totals.byType[type].total} complete={group.totals.byType[type].complete} />
                  ))}
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map(deliverable => {
                  const simplified = simplifyProductionStatus(deliverable.production_status)
                  return (
                    <article key={deliverable.id} className="rounded-lg border border-white/8 bg-black/30 p-3">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-bold text-white">
                              {displayDeliverableCode(deliverable)}
                            </span>
                            <span className="text-[11px] text-white/35">{TYPE_LABELS[deliverable.deliverable_type]}</span>
                            <SourceChip source={deliverableSource(deliverable)} />
                            {deliverable.priority === 'urgent' && (
                              <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                                Urgent
                              </span>
                            )}
                          </div>
                          <button type="button" onClick={() => openDrawer(deliverable, group.clientName)} className="mt-1 text-left">
                            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white hover:text-brand-accent transition-colors">
                              {deliverable.title}
                            </h3>
                          </button>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[simplified]}`}>
                            {SIMPLIFIED_STATUS_LABELS[simplified]}
                          </span>
                          <button
                            type="button"
                            onClick={() => openDrawer(deliverable, group.clientName)}
                            className="rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[11px] text-white/30 hover:text-white hover:border-white/20 transition-colors"
                            title="Open details"
                          >
                            ···
                          </button>
                        </div>
                      </div>

                      <div className="space-y-0.5 text-xs text-white/40">
                        {deliverable.assigned_to_name && (
                          <p>Staff: <span className="text-white/65">{deliverable.assigned_to_name}</span></p>
                        )}
                        {deliverable.due_date && (
                          <p>Due: <span className="text-white/65">{formatDate(deliverable.due_date)}</span></p>
                        )}
                      </div>

                      {profile && (
                        FINAL_STATUSES.includes(simplified) && !isScheduleController ? (
                          <div className="mt-3 flex items-center gap-2">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[simplified]}`}>
                              {SIMPLIFIED_STATUS_LABELS[simplified]}
                            </span>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/25">Final</span>
                          </div>
                        ) : (
                          <select
                            value={simplified}
                            onChange={event => handleStatusChange(deliverable.id, event.target.value as SimplifiedProductionStatus)}
                            className="mt-3 w-full rounded-md border border-white/10 bg-brand-bg px-2 py-1.5 text-xs text-white outline-none focus:border-brand-accent/50"
                          >
                            {(isScheduleController ? SIMPLIFIED_STATUS_OPTIONS : STAFF_STATUSES).map(status => (
                              <option key={status} value={status}>{SIMPLIFIED_STATUS_LABELS[status]}</option>
                            ))}
                          </select>
                        )
                      )}
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {drawerDeliverable && (
        <DeliverableDetailDrawer
          deliverable={drawerDeliverable}
          clientName={drawerClientName}
          isAdmin={isAdmin}
          isScheduleController={isScheduleController}
          onClose={() => setDrawerDeliverable(null)}
          onStatusChange={handleStatusChange}
          onScheduleChange={handleScheduleChange}
        />
      )}
    </div>
  )
}

function displayDeliverableCode(deliverable: MonthlyDeliverable) {
  const instance = String(deliverable.instance_number)
  if (deliverable.code.trim().endsWith(instance)) return deliverable.code
  if (deliverable.deliverable_type === 'video' || deliverable.deliverable_type === 'reel') {
    return `${deliverable.code} ${instance}`
  }
  return `${deliverable.code}${instance}`
}

function MiniTotal({ label, total, complete }: { label: string; total: number; complete: number }) {
  return (
    <div className="rounded-md bg-white/[0.02] px-2 py-1">
      <p className="text-white/30">{label}</p>
      <p className="font-bold text-white/70">{complete}/{total}</p>
    </div>
  )
}

function SourceChip({ source }: { source: DeliverableSource }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SOURCE_CHIP_STYLE[source]}`}>
      {SOURCE_LABEL[source]}
    </span>
  )
}

const PACKAGE_ACTIONS = [
  { value: 'use_slot', label: 'Use package slot' },
  { value: 'addon', label: 'Mark as add-on' },
  { value: 'move_work', label: 'Move to another month' },
] as const

function DeliverableDetailDrawer({
  deliverable,
  clientName,
  isAdmin,
  isScheduleController,
  onClose,
  onStatusChange,
  onScheduleChange,
}: {
  deliverable: MonthlyDeliverable
  clientName: string
  isAdmin: boolean
  isScheduleController: boolean
  onClose: () => void
  onStatusChange: (id: string, status: SimplifiedProductionStatus) => void
  onScheduleChange: (id: string, date: string | null) => Promise<void>
}) {
  const simplified = simplifyProductionStatus(deliverable.production_status)
  const source = deliverableSource(deliverable)
  const [schedDate, setSchedDate] = useState(deliverable.scheduled_date ?? '')
  const [schedSaving, setSchedSaving] = useState(false)
  const [schedMsg, setSchedMsg] = useState<string | null>(null)

  async function handleScheduleSave() {
    if (schedSaving) return
    setSchedSaving(true)
    setSchedMsg(null)
    await onScheduleChange(deliverable.id, schedDate || null)
    setSchedSaving(false)
    setSchedMsg('Saved')
    setTimeout(() => setSchedMsg(null), 2000)
  }

  const inputCls = 'w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-white/[0.08] bg-[#111111] sm:w-[460px]">
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-bold text-white">
                {displayDeliverableCode(deliverable)}
              </span>
              <span className="text-[11px] text-white/40">{TYPE_LABELS[deliverable.deliverable_type]}</span>
              <SourceChip source={source} />
              {deliverable.priority === 'urgent' && (
                <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">Urgent</span>
              )}
            </div>
            <h2 className="text-base font-bold text-white leading-snug">{deliverable.title}</h2>
            <p className="mt-0.5 text-xs text-white/40">{clientName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-white/40 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {deliverable.moved_from_deliverable_id && (
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/50">
              Moved from another month
            </div>
          )}
          {deliverable.replaced_by_request_id && (
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/50">
              Replaced by client request
            </div>
          )}

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Status</p>
            {FINAL_STATUSES.includes(simplified) && !isScheduleController ? (
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[simplified]}`}>
                  {SIMPLIFIED_STATUS_LABELS[simplified]}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/25">Final</span>
              </div>
            ) : (
              <select
                value={simplified}
                onChange={event => onStatusChange(deliverable.id, event.target.value as SimplifiedProductionStatus)}
                className="w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
              >
                {(isScheduleController ? SIMPLIFIED_STATUS_OPTIONS : STAFF_STATUSES).map(status => (
                  <option key={status} value={status}>{SIMPLIFIED_STATUS_LABELS[status]}</option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-3">
            {deliverable.assigned_to_name && (
              <div>
                <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Staff</p>
                <p className="text-sm text-white/70">{deliverable.assigned_to_name}</p>
              </div>
            )}
            {deliverable.due_date && (
              <div>
                <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Due date</p>
                <p className="text-sm text-white/70">{formatDate(deliverable.due_date)}</p>
              </div>
            )}
            {!isAdmin && deliverable.scheduled_date && (
              <div>
                <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Scheduled</p>
                <p className="text-sm text-white/70">{formatDate(deliverable.scheduled_date)}</p>
              </div>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Helpers</p>
            {deliverable.helper_names !== undefined ? (
              deliverable.helper_names.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {deliverable.helper_names.map(name => (
                    <span key={name} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-white/70">
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-white/40">No helpers yet</p>
              )
            ) : (
              <p className="text-[11px] text-white/30">After migration phase-7b</p>
            )}
          </div>

          {isAdmin && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Scheduled date</p>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={schedDate}
                  onChange={e => setSchedDate(e.target.value)}
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={handleScheduleSave}
                  disabled={schedSaving}
                  className="shrink-0 rounded-lg border border-brand-accent/30 bg-brand-accent/10 px-3 py-2 text-sm font-semibold text-brand-accent hover:bg-brand-accent/20 disabled:opacity-50 transition-colors"
                >
                  {schedSaving ? '…' : 'Save'}
                </button>
              </div>
              {schedMsg && <p className="mt-1 text-[11px] text-brand-accent">{schedMsg}</p>}
            </div>
          )}

          {deliverable.notes && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Notes</p>
              <p className="whitespace-pre-wrap text-sm text-white/60">{deliverable.notes}</p>
            </div>
          )}

          {isAdmin && (
            <div className="border-t border-white/[0.06] pt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/35">Package action</p>
              <div className="space-y-0.5">
                {PACKAGE_ACTIONS.map(action => (
                  <button
                    key={action.value}
                    type="button"
                    disabled
                    className="flex w-full cursor-not-allowed items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-white/25"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/15" />
                    {action.label}
                  </button>
                ))}
                <p className="pt-0.5 text-[10px] text-white/20">After migration phase-7a</p>
              </div>
            </div>
          )}

          <div className="border-t border-white/[0.06] pt-4">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Timer</p>
            <div className="flex items-center gap-2">
              <button type="button" disabled className="cursor-not-allowed rounded-md border border-white/[0.08] px-3 py-1.5 text-xs text-white/25">Start</button>
              <button type="button" disabled className="cursor-not-allowed rounded-md border border-white/[0.08] px-3 py-1.5 text-xs text-white/25">Pause</button>
              <button type="button" disabled className="cursor-not-allowed rounded-md border border-white/[0.08] px-3 py-1.5 text-xs text-white/25">Stop</button>
            </div>
            <p className="mt-1.5 text-[10px] text-white/20">After migration</p>
          </div>
        </div>

        <div className="border-t border-white/[0.08] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white/60 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  )
}
