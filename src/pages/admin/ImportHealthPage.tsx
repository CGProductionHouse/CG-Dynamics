import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ActionButton } from '../../components/ui/Buttons'
import { EmptyState } from '../../components/ui/States'
import { supabase } from '../../lib/supabase'

type Counts = {
  plannerTasks: number
  clientPackages: number
  packageTemplates: number
  monthlyDeliverables: number
}

type PlannerTaskRow = {
  bucket_id: string | null
  original_bucket_name: string | null
  client_id: string | null
  status?: string | null
}

type BucketRow = {
  id: string
  board_id: string | null
  name: string
  bucket_type: string | null
}

type BoardRow = {
  id: string
  name: string
  slug: string
  board_type: string
}

type ClientRow = {
  id: string
  name: string
}

type MonthlyRow = {
  client_id: string
  package_id: string | null
  template_id: string | null
  month: string
  due_date: string | null
  scheduled_date: string | null
  production_status?: string | null
}

const EMPTY_COUNTS: Counts = {
  plannerTasks: 0,
  clientPackages: 0,
  packageTemplates: 0,
  monthlyDeliverables: 0,
}

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function countBy<T>(items: T[], keyFn: (item: T) => string) {
  const counts = new Map<string, number>()
  for (const item of items) {
    const key = keyFn(item) || 'Unassigned'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

async function getTableCount(table: string) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

export default function ImportHealthPage() {
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS)
  const [plannerTasks, setPlannerTasks] = useState<PlannerTaskRow[]>([])
  const [buckets, setBuckets] = useState<BucketRow[]>([])
  const [boards, setBoards] = useState<BoardRow[]>([])
  const [clients, setClients] = useState<ClientRow[]>([])
  const [monthlyDeliverables, setMonthlyDeliverables] = useState<MonthlyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)

    try {
      const [
        plannerTasksCount,
        clientPackagesCount,
        packageTemplatesCount,
        monthlyDeliverablesCount,
        tasksResult,
        bucketsResult,
        boardsResult,
        clientsResult,
        monthlyResult,
      ] = await Promise.all([
        getTableCount('planner_tasks'),
        getTableCount('client_packages'),
        getTableCount('package_deliverable_templates'),
        getTableCount('monthly_deliverables'),
        supabase.from('planner_tasks').select('bucket_id, original_bucket_name, client_id, status'),
        supabase.from('planner_buckets').select('id, board_id, name, bucket_type'),
        supabase.from('planner_boards').select('id, name, slug, board_type'),
        supabase.from('clients').select('id, name').eq('active', true).order('name'),
        supabase.from('monthly_deliverables').select('client_id, package_id, template_id, month, due_date, scheduled_date, production_status').is('archived_at', null),
      ])

      const firstError = tasksResult.error
        ?? bucketsResult.error
        ?? boardsResult.error
        ?? clientsResult.error
        ?? monthlyResult.error

      if (firstError) throw firstError

      setCounts({
        plannerTasks: plannerTasksCount,
        clientPackages: clientPackagesCount,
        packageTemplates: packageTemplatesCount,
        monthlyDeliverables: monthlyDeliverablesCount,
      })
      setPlannerTasks((tasksResult.data ?? []) as PlannerTaskRow[])
      setBuckets((bucketsResult.data ?? []) as BucketRow[])
      setBoards((boardsResult.data ?? []) as BoardRow[])
      setClients((clientsResult.data ?? []) as ClientRow[])
      setMonthlyDeliverables((monthlyResult.data ?? []) as MonthlyRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load import health.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const bucketNameById = useMemo(() => new Map(buckets.map(bucket => [bucket.id, bucket.name])), [buckets])
  const clientNameById = useMemo(() => new Map(clients.map(client => [client.id, client.name])), [clients])
  const clientNormalised = useMemo(
    () => new Map(clients.map(client => [normalise(client.name), client.name])),
    [clients],
  )
  const clientScheduleBoardIds = useMemo(
    () => new Set(boards.filter(board => board.board_type === 'client_schedule' || board.slug === 'client-schedule').map(board => board.id)),
    [boards],
  )

  const plannerBucketCounts = useMemo(() => {
    return countBy(plannerTasks, task => {
      if (task.bucket_id && bucketNameById.has(task.bucket_id)) return bucketNameById.get(task.bucket_id) ?? ''
      return task.original_bucket_name ?? 'Unassigned'
    })
  }, [bucketNameById, plannerTasks])

  const clientScheduleBuckets = useMemo(() => {
    return buckets
      .filter(bucket => bucket.board_id && clientScheduleBoardIds.has(bucket.board_id))
      .map(bucket => ({
        bucket: bucket.name,
        matchedClient: clientNormalised.get(normalise(bucket.name)) ?? 'No client match',
      }))
      .sort((a, b) => a.bucket.localeCompare(b.bucket))
  }, [buckets, clientNormalised, clientScheduleBoardIds])

  const monthlyByClient = useMemo(() => {
    return countBy(monthlyDeliverables, item => clientNameById.get(item.client_id) ?? 'Unknown client')
  }, [clientNameById, monthlyDeliverables])

  const deliverablesByMonth = useMemo(() => {
    return countBy(monthlyDeliverables, item => item.month?.slice(0, 7) ?? 'No month')
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [monthlyDeliverables])

  const deliverablesByStatus = useMemo(() => {
    return countBy(monthlyDeliverables, item => item.production_status ?? 'No status')
  }, [monthlyDeliverables])

  const selectedYear = new Date().getFullYear()
  const visibleThisYear = useMemo(
    () => monthlyDeliverables.filter(item => item.month?.startsWith(String(selectedYear))).length,
    [monthlyDeliverables, selectedYear],
  )

  const plannerLinked = useMemo(() => plannerTasks.filter(task => task.client_id).length, [plannerTasks])
  const plannerUnlinked = plannerTasks.length - plannerLinked

  const missingDueOrSchedule = useMemo(
    () => monthlyDeliverables.filter(item => !item.due_date && !item.scheduled_date).length,
    [monthlyDeliverables],
  )

  const missingLinks = useMemo(() => ({
    client: monthlyDeliverables.filter(item => !item.client_id || !clientNameById.has(item.client_id)).length,
    package: monthlyDeliverables.filter(item => !item.package_id).length,
    template: monthlyDeliverables.filter(item => !item.template_id).length,
  }), [clientNameById, monthlyDeliverables])

  const unmatchedClientBuckets = useMemo(
    () => clientScheduleBuckets.filter(row => row.matchedClient === 'No client match').length,
    [clientScheduleBuckets],
  )

  const needsAttention = missingDueOrSchedule > 0 || missingLinks.client > 0 || unmatchedClientBuckets > 0

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-accent">Admin</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white">Import Health</h1>
          <p className="mt-1 text-sm text-brand-primary/60">Teams Planner import sanity checks.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton variant="outline" size="sm" onClick={load} loading={loading}>
            Refresh
          </ActionButton>
          <Link to="/admin/planner">
            <ActionButton variant="ghost" size="sm">Planner</ActionButton>
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(item => <div key={item} className="h-24 animate-pulse rounded-xl bg-white/[0.04]" />)}
        </div>
      ) : error ? (
        <EmptyState title="Could not load import health" message="Refresh or check the planner tables." centered={false} />
      ) : (
        <>
          <div className={`mb-5 rounded-xl border px-4 py-3 ${
            needsAttention
              ? 'border-amber-400/25 bg-amber-400/[0.07]'
              : 'border-brand-teal/25 bg-brand-teal/[0.06]'
          }`}>
            <p className={`text-sm font-bold ${needsAttention ? 'text-amber-200' : 'text-[#2dd4bf]'}`}>
              {needsAttention ? 'Needs attention' : 'Data looks healthy'}
            </p>
            <p className="mt-1 text-xs text-brand-primary/65">
              {needsAttention
                ? 'Review missing dates, client matches or links before relying on production views.'
                : 'Imported tasks, packages and deliverables are present and linked enough for production views.'}
            </p>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <HealthStat label="Planner tasks" value={counts.plannerTasks} />
            <HealthStat label="Client packages" value={counts.clientPackages} />
            <HealthStat label="Package templates" value={counts.packageTemplates} />
            <HealthStat label="Monthly deliverables" value={counts.monthlyDeliverables} />
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <HealthStat label="Missing date" value={missingDueOrSchedule} warn={missingDueOrSchedule > 0} />
            <HealthStat label="Missing client" value={missingLinks.client} warn={missingLinks.client > 0} />
            <HealthStat label="Missing package" value={missingLinks.package} warn={missingLinks.package > 0} />
            <HealthStat label="Missing template" value={missingLinks.template} warn={missingLinks.template > 0} />
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <HealthStat label={`${selectedYear} master visible`} value={visibleThisYear} />
            <HealthStat label="Planner linked clients" value={plannerLinked} />
            <HealthStat label="Planner unlinked" value={plannerUnlinked} warn={plannerUnlinked > 0} />
            <HealthNote title="Client Schedule source" value="monthly_deliverables" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <HealthList title="Planner buckets with tasks" rows={plannerBucketCounts} />
            <ClientMatchList rows={clientScheduleBuckets} />
            <HealthList title="Monthly deliverables by client" rows={monthlyByClient} />
            <HealthList title="Deliverables by month" rows={deliverablesByMonth} />
            <HealthList title="Deliverables by status" rows={deliverablesByStatus} />
          </div>
        </>
      )}
    </div>
  )
}

function HealthNote({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-brand-teal/25 bg-brand-teal/[0.06] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">{title}</p>
      <p className="mt-2 text-sm font-black text-[#2dd4bf]">{value}</p>
      <p className="mt-1 text-xs text-white/45">Planner Board Client Schedule no longer uses empty planner buckets as its source.</p>
    </div>
  )
}

function HealthStat({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${warn ? 'border-amber-400/25 bg-amber-400/[0.06]' : 'border-white/10 bg-white/[0.035]'}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className={`mt-2 text-3xl font-black ${warn ? 'text-amber-300' : 'text-white'}`}>{value.toLocaleString()}</p>
    </div>
  )
}

function HealthList({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <h2 className="mb-3 text-sm font-bold text-white">{title}</h2>
      <div className="max-h-[28rem] space-y-1 overflow-y-auto pr-1">
        {rows.length === 0 ? (
          <p className="text-sm text-white/35">No rows found.</p>
        ) : rows.map(row => (
          <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg bg-black/20 px-3 py-2">
            <span className="min-w-0 truncate text-sm text-white/70">{row.label}</span>
            <span className="shrink-0 text-sm font-black text-brand-accent">{row.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function ClientMatchList({ rows }: { rows: Array<{ bucket: string; matchedClient: string }> }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <h2 className="mb-3 text-sm font-bold text-white">Client schedule buckets</h2>
      <div className="max-h-[28rem] space-y-1 overflow-y-auto pr-1">
        {rows.length === 0 ? (
          <p className="text-sm text-white/35">No client schedule buckets found.</p>
        ) : rows.map(row => (
          <div key={row.bucket} className="rounded-lg bg-black/20 px-3 py-2">
            <p className="truncate text-sm font-semibold text-white/75">{row.bucket}</p>
            <p className={`mt-0.5 truncate text-xs ${row.matchedClient === 'No client match' ? 'text-amber-300' : 'text-[#2dd4bf]'}`}>
              {row.matchedClient}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
