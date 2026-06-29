import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { ActionButton } from '../../components/ui/Buttons'
import { EmptyState } from '../../components/ui/States'
import {
  DELIVERABLE_TYPES,
  PRODUCTION_STATUSES,
  PRODUCTION_STATUS_LABELS,
  generateMonthFromPackages,
  getMonthlyPackageTotals,
  listClientPackages,
  listMonthlyDeliverablesByMonth,
  monthKey,
  updateMonthlyDeliverableStatus,
  type DeliverableType,
  type MonthlyDeliverable,
  type ProductionStatus,
} from '../../lib/planner'
import { listActiveClients, type ClientOption } from '../../lib/commandCentre'

const TYPE_LABELS: Record<DeliverableType, string> = {
  dp: 'DP',
  photo: 'Photo',
  video: 'Video',
  reel: 'Reel',
  content_run: 'Content Run',
  website_update: 'Website Update',
  monthly_report: 'Report',
  strategy: 'Strategy',
  admin: 'Admin',
  other: 'Other',
}

const DISPLAY_TYPES: DeliverableType[] = ['dp', 'photo', 'video', 'reel', 'other']

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

function statusTone(status: ProductionStatus) {
  if (status === 'posted' || status === 'scheduled' || status === 'approved') return 'text-brand-accent border-brand-accent/25 bg-brand-accent/10'
  if (status === 'blocked' || status === 'client_changes' || status === 'internal_changes') return 'text-amber-300 border-amber-400/25 bg-amber-400/10'
  if (status === 'waiting_client' || status === 'ready_client_approval') return 'text-sky-200 border-sky-300/25 bg-sky-300/10'
  return 'text-white/60 border-white/10 bg-white/[0.03]'
}

export default function MonthlyPlannerPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()))
  const [deliverables, setDeliverables] = useState<MonthlyDeliverable[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [activePackageCount, setActivePackageCount] = useState(0)
  const [clientFilter, setClientFilter] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ProductionStatus>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | DeliverableType>('all')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [tableMissing, setTableMissing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const monthStart = toMonthStart(selectedMonth)

  const clientNameById = useMemo(() => {
    return new Map(clients.map(client => [client.id, client.name]))
  }, [clients])

  const filteredDeliverables = useMemo(() => {
    const search = clientSearch.trim().toLowerCase()
    if (!search) return deliverables
    return deliverables.filter(deliverable => {
      const clientName = clientNameById.get(deliverable.client_id) ?? 'Unknown client'
      return clientName.toLowerCase().includes(search)
    })
  }, [clientNameById, clientSearch, deliverables])

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

  async function loadData() {
    setLoading(true)
    setTableMissing(false)
    setErrorMessage(null)

    const [clientResult, packageResult, deliverableResult] = await Promise.all([
      listActiveClients(),
      listClientPackages({ status: 'active' }),
      listMonthlyDeliverablesByMonth(monthStart, {
        clientId: clientFilter || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
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
    setActivePackageCount(packageResult.data?.length ?? 0)
    setDeliverables(deliverableResult.data ?? [])
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStart, clientFilter, statusFilter, typeFilter])

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

  async function handleStatusChange(id: string, status: ProductionStatus) {
    if (!isAdmin) return
    setErrorMessage(null)
    const { error } = await updateMonthlyDeliverableStatus(id, status)
    if (error) {
      setErrorMessage(error.message ?? 'Could not update status.')
      return
    }
    setDeliverables(current => current.map(item => item.id === id ? { ...item, production_status: status } : item))
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
        <EmptyState title="Planner tables not set up yet" message="Run phase-6 and phase-6b migrations before using the monthly board." />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-accent/70">Package Board</p>
          <h1 className="mt-1 text-xl font-black tracking-tight text-white">Monthly Planner</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/60 hover:border-brand-accent/30 hover:text-white"
          >
            Previous
          </button>
          <input
            type="month"
            value={selectedMonth}
            onChange={event => setSelectedMonth(event.target.value)}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-semibold text-white outline-none focus:border-brand-accent/50"
          />
          <button
            type="button"
            onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/60 hover:border-brand-accent/30 hover:text-white"
          >
            Next
          </button>
          {isAdmin && (
            <ActionButton size="sm" onClick={handleGenerate} loading={generating}>
              Generate month from packages
            </ActionButton>
          )}
        </div>
      </div>

      {(message || errorMessage) && (
        <div className={`mb-3 rounded-lg border px-3 py-2 text-sm ${errorMessage ? 'border-red-400/25 bg-red-400/10 text-red-200' : 'border-brand-accent/25 bg-brand-accent/10 text-brand-accent'}`}>
          {errorMessage ?? message}
        </div>
      )}

      <div className="mb-4 grid gap-2 rounded-xl border border-white/10 bg-white/[0.025] p-3 md:grid-cols-4">
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
          onChange={event => setStatusFilter(event.target.value as 'all' | ProductionStatus)}
          className="rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white outline-none focus:border-brand-accent/50"
        >
          <option value="all">All statuses</option>
          {PRODUCTION_STATUSES.map(status => <option key={status} value={status}>{PRODUCTION_STATUS_LABELS[status]}</option>)}
        </select>
        <select
          value={typeFilter}
          onChange={event => setTypeFilter(event.target.value as 'all' | DeliverableType)}
          className="rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white outline-none focus:border-brand-accent/50"
        >
          <option value="all">All types</option>
          {DELIVERABLE_TYPES.map(type => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}
        </select>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatBox label="Total" value={overallTotals.total} />
        <StatBox label="Remaining" value={overallTotals.remaining} warn={overallTotals.remaining > 0} />
        <StatBox label="DP" value={`${overallTotals.byType.dp.complete}/${overallTotals.byType.dp.total}`} />
        <StatBox label="Photo" value={`${overallTotals.byType.photo.complete}/${overallTotals.byType.photo.total}`} />
        <StatBox label="Video" value={`${overallTotals.byType.video.complete}/${overallTotals.byType.video.total}`} />
        <StatBox label="Reel" value={`${overallTotals.byType.reel.complete}/${overallTotals.byType.reel.total}`} />
      </div>

      {groupedDeliverables.length === 0 ? (
        <EmptyState
          title="No deliverables generated for this month yet."
          message={activePackageCount === 0 ? 'Set up packages in Package Master first.' : 'Generate this month from active Package Master templates.'}
          action={isAdmin ? (
            <ActionButton onClick={handleGenerate} loading={generating}>Generate month from packages</ActionButton>
          ) : undefined}
          centered={false}
        />
      ) : (
        <div className="space-y-4">
          {groupedDeliverables.map(group => (
            <section key={group.clientId} className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">{group.clientName}</h2>
                  <p className="text-xs text-white/40">{group.totals.remaining} remaining of {group.totals.total}</p>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-[11px] sm:grid-cols-6">
                  {DISPLAY_TYPES.map(type => (
                    <MiniTotal key={type} label={TYPE_LABELS[type]} total={group.totals.byType[type].total} complete={group.totals.byType[type].complete} />
                  ))}
                  <MiniTotal label="Remaining" total={group.totals.total} complete={group.totals.total - group.totals.remaining} warn />
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map(deliverable => (
                  <article key={deliverable.id} className="rounded-lg border border-white/8 bg-brand-bg/70 p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md bg-brand-accent/12 px-1.5 py-0.5 text-[11px] font-bold text-brand-accent">
                            {deliverable.code}{deliverable.instance_number}
                          </span>
                          <span className="text-[11px] text-white/40">{TYPE_LABELS[deliverable.deliverable_type]}</span>
                          {deliverable.priority !== 'normal' && (
                            <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                              {deliverable.priority === 'urgent' ? 'Urgent' : 'Client request'}
                            </span>
                          )}
                        </div>
                        <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-white">{deliverable.title}</h3>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(deliverable.production_status)}`}>
                        {PRODUCTION_STATUS_LABELS[deliverable.production_status]}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-white/45">
                      {deliverable.assigned_to_name && <p>Assigned: <span className="text-white/70">{deliverable.assigned_to_name}</span></p>}
                      {deliverable.scheduled_date && <p>Scheduled: <span className="text-white/70">{formatDate(deliverable.scheduled_date)}</span></p>}
                      {deliverable.due_date && <p>Due: <span className="text-white/70">{formatDate(deliverable.due_date)}</span></p>}
                      {deliverable.notes && <p className="line-clamp-2">Notes: <span className="text-white/60">{deliverable.notes}</span></p>}
                    </div>

                    {isAdmin && (
                      <select
                        value={deliverable.production_status}
                        onChange={event => handleStatusChange(deliverable.id, event.target.value as ProductionStatus)}
                        className="mt-3 w-full rounded-md border border-white/10 bg-brand-bg px-2 py-1.5 text-xs text-white outline-none focus:border-brand-accent/50"
                      >
                        {PRODUCTION_STATUSES.map(status => <option key={status} value={status}>{PRODUCTION_STATUS_LABELS[status]}</option>)}
                      </select>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, warn = false }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">{label}</p>
      <p className={`mt-1 text-lg font-black ${warn ? 'text-amber-300' : 'text-white'}`}>{value}</p>
    </div>
  )
}

function MiniTotal({ label, total, complete, warn = false }: { label: string; total: number; complete: number; warn?: boolean }) {
  return (
    <div className="rounded-md border border-white/8 bg-white/[0.025] px-2 py-1">
      <p className="text-white/35">{label}</p>
      <p className={`font-bold ${warn ? 'text-amber-300' : 'text-white/80'}`}>{complete}/{total}</p>
    </div>
  )
}
