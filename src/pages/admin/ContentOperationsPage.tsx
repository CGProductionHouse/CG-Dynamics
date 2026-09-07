import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { applyOpsFilters, fetchContentOps, opsFilterOptions, OPS_BUCKET_LABELS, OPS_BUCKET_ORDER, type OpsFilters, type OpsItem, type OpsSummary } from '../../lib/contentOps'

// #220 — Cross-client content operations dashboard. Read-only monitoring so
// approved content does not slip past scheduling/posting. Staff see only the
// clients RLS permits; no schedule, content store or provider write is created.

const today = () => new Date().toISOString().slice(0, 10)

function scheduleLink(item: OpsItem): string {
  const month = (item.scheduledDate ?? '').slice(0, 7)
  return `/admin/client-schedule?id=${item.id}${month ? `&month=${month}` : ''}&mode=all`
}

function ItemRow({ item }: { item: OpsItem }) {
  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 break-words text-sm font-bold text-white">{item.title}</p>
        <Link to={scheduleLink(item)} className="shrink-0 text-[11px] font-bold text-brand-teal hover:text-white">Open →</Link>
      </div>
      <p className="mt-0.5 break-words text-xs text-white/55">{item.clientName}{item.assignee ? ` · ${item.assignee}` : ''}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-white/55">{item.deliverableType}</span>
        {item.scheduledDate && <span className="text-white/45">{item.scheduledDate}</span>}
        {item.channels.map(c => <span key={c} className="text-white/40">{c}</span>)}
        {item.flags.overdue && <span className="rounded-full bg-red-400/15 px-2 py-0.5 font-bold text-red-300">Overdue</span>}
        {item.flags.missingCreativeLink && <span className="rounded-full bg-amber-300/15 px-2 py-0.5 font-bold text-amber-200">No creative link</span>}
        {item.flags.missingSchedule && <span className="rounded-full bg-amber-300/15 px-2 py-0.5 font-bold text-amber-200">No date</span>}
      </div>
    </li>
  )
}

const INPUT = 'min-h-11 rounded-lg border border-white/12 bg-black/30 px-3 text-sm text-white'

export default function ContentOperationsPage() {
  const [raw, setRaw] = useState<OpsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [filters, setFilters] = useState<OpsFilters>({ query: '', clientName: 'all', deliverableType: 'all', risksOnly: false })
  const setFilter = <K extends keyof OpsFilters>(k: K, v: OpsFilters[K]) => setFilters(p => ({ ...p, [k]: v }))
  const options = useMemo(() => raw ? opsFilterOptions(raw) : { clients: [], types: [] }, [raw])
  const summary = useMemo(() => raw ? applyOpsFilters(raw, filters) : null, [raw, filters])

  useEffect(() => {
    let active = true
    const load = async () => {
      const result = await fetchContentOps(today())
      if (!active) return
      setRaw(result.data)
      setError(result.error)
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [revision])

  const riskCards = useMemo(() => summary ? ([
    ['Overdue — date passed, not posted', summary.risks.overdue],
    ['Missing creative link', summary.risks.missingCreativeLink],
    ['Missing schedule date', summary.risks.missingSchedule],
  ] as const) : [], [summary])

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 pb-32 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-white">Content operations</h1>
        <div className="flex items-center gap-3">
          <Link to="/admin/content-reviews" className="min-h-11 text-sm text-brand-teal">Review queue</Link>
          <Link to="/admin/client-schedule" className="min-h-11 text-sm text-brand-teal">Client Schedule</Link>
          <button type="button" onClick={() => setRevision(v => v + 1)} className="min-h-11 rounded-lg border border-white/15 px-3 text-sm text-white">Refresh</button>
        </div>
      </div>
      <p className="text-sm text-white/55">Every content item from planning to posted, across the clients you can see. Nothing here posts to a platform — it makes sure nothing is forgotten.</p>

      {!loading && !error && raw && <div className="flex flex-wrap items-center gap-2">
        <input className={`${INPUT} min-w-[12rem] flex-1`} placeholder="Search title, client or assignee" value={filters.query ?? ''} onChange={e => setFilter('query', e.target.value)} />
        <select className={INPUT} value={filters.clientName} onChange={e => setFilter('clientName', e.target.value)}><option value="all">All clients</option>{options.clients.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select className={INPUT} value={filters.deliverableType} onChange={e => setFilter('deliverableType', e.target.value)}><option value="all">All types</option>{options.types.map(t => <option key={t} value={t}>{t}</option>)}</select>
        <label className="flex min-h-11 items-center gap-2 text-sm text-white/70"><input type="checkbox" className="h-4 w-4 accent-teal-400" checked={filters.risksOnly ?? false} onChange={e => setFilter('risksOnly', e.target.checked)} />Needs attention only</label>
      </div>}

      {loading ? <p className="text-white/60">Loading…</p>
        : error ? <p role="alert" className="text-red-300">{error}</p>
        : !summary ? null : <>
          {/* Risk strip */}
          <div className="grid gap-3 sm:grid-cols-3">
            {riskCards.map(([label, list]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-white/45">{label}</p>
                <p className={`mt-1 text-2xl font-black ${list.length > 0 ? 'text-amber-300' : 'text-white/30'}`}>{list.length}</p>
              </div>
            ))}
          </div>

          {/* Lifecycle buckets */}
          <div className="grid gap-4 lg:grid-cols-2">
            {OPS_BUCKET_ORDER.map(bucket => {
              const list = summary.buckets[bucket]
              return (
                <section key={bucket} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.015] p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-sm font-black uppercase tracking-[0.12em] text-white/50">{OPS_BUCKET_LABELS[bucket]}</h2>
                    <span className="text-lg font-black text-white/70">{list.length}</span>
                  </div>
                  {list.length === 0 ? <p className="mt-2 text-xs text-white/30">Nothing here.</p>
                    : <ul className="mt-2 space-y-2">{list.map(item => <ItemRow key={item.id} item={item} />)}</ul>}
                </section>
              )
            })}
          </div>
        </>}
    </div>
  )
}
