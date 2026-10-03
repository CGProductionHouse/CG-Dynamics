import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { DashboardModel, DashboardTone, RankedRow } from '../../lib/websitePerformanceDashboard'
import { WebsiteLeadBreakdownCard } from './WebsiteLeadBreakdownCard'

const number = (value: number) => new Intl.NumberFormat('en-ZA').format(value)
const pct = (rate: number) => `${Math.round(rate * 1000) / 10}%`

const TONE: Record<DashboardTone, string> = {
  good: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200',
  info: 'border-teal-300/30 bg-teal-300/10 text-teal-200',
  warn: 'border-amber-300/30 bg-amber-300/10 text-amber-200',
}

/**
 * Premium Website Performance story (#335 traffic + canonical #405 enquiries/leads), in the
 * #389 client-dashboard visual language. Pure presentation: the model decides what is truthful.
 */
export function WebsitePerformanceDashboard({
  model,
  clientName,
  monthLabel,
  clientId,
  period,
  leadInboxHref,
  toolbar,
}: {
  model: DashboardModel
  clientName: string
  monthLabel: string
  /** Exact client for the lead breakdown; null = the signed-in client. */
  clientId: string | null
  period: { from: string; to: string }
  leadInboxHref: string | null
  toolbar?: ReactNode
}) {
  return <div className="space-y-6" aria-label={`Website performance for ${clientName}`}>
    <Hero model={model} clientName={clientName} monthLabel={monthLabel} toolbar={toolbar} />

    {model.kpis.length > 0
      ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Key website metrics">
          {model.kpis.map((kpi) => <Kpi key={kpi.key} label={kpi.label} value={number(kpi.value)} hint={kpi.hint} accent={kpi.key === 'enquiries' || kpi.key === 'qualified' || kpi.key === 'won'} />)}
        </div>
      : <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-slate-400">No usable website figures for this month yet. See data confidence below; nothing is shown as zero.</p>}

    {model.actions && !model.actions.tracked && <SetupNote>{model.actions.note}</SetupNote>}

    <LeadPerformance model={model} clientId={clientId} period={period} leadInboxHref={leadInboxHref} />

    {model.traffic && <section aria-label="Traffic" className="grid gap-5 lg:grid-cols-2">
      <RankedCard eyebrow="Traffic" title="Where visitors came from" rows={model.traffic.sources} unit="visitors" empty="No traffic sources recorded for this month." />
      <RankedCard eyebrow="Traffic" title="Top pages" rows={model.traffic.pages} unit="page views" empty="No page views recorded for this month." />
    </section>}

    {model.actions?.tracked && model.actions.byType.length > 0 && <RankedCard eyebrow="Engagement" title="Visitor actions" rows={model.actions.byType} unit="actions" empty="" />}

    <details className="group rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-4 text-sm text-slate-400">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
        <span><span className="font-semibold text-teal-300">Data confidence</span> · {model.confidence.summary}</span>
        {model.confidence.notes.length > 0 && <span className="text-xs text-slate-500 group-open:hidden">{model.confidence.notes.length} measurement note{model.confidence.notes.length === 1 ? '' : 's'}</span>}
      </summary>
      {model.confidence.notes.length > 0 && <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">{model.confidence.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>}
    </details>
  </div>
}

function Hero({ model, clientName, monthLabel, toolbar }: { model: DashboardModel; clientName: string; monthLabel: string; toolbar?: ReactNode }) {
  return <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#071311]/95 shadow-[0_35px_90px_-45px_rgba(0,0,0,0.95)]">
    <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(45,212,191,0.22),transparent_34%),radial-gradient(circle_at_95%_15%,rgba(249,115,22,0.14),transparent_26%)]" />
    <div aria-hidden className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#2dd4bf] via-[#14b8a6] to-[#f97316]" />
    <div className="relative flex flex-col gap-5 p-5 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[#2dd4bf]">Website performance</p>
        <h2 className="mt-2 break-words text-3xl font-black tracking-[-0.03em] text-white sm:text-4xl">{clientName}</h2>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-300">
          <span className="font-semibold">{monthLabel}</span>
          {model.host && <span className="break-all text-slate-400">{model.host}</span>}
          <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${TONE[model.status.tone]}`}>{model.status.label}</span>
        </p>
      </div>
      {toolbar && <div className="flex shrink-0 flex-wrap gap-2">{toolbar}</div>}
    </div>
  </section>
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint: string | null; accent: boolean }) {
  return <div className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${accent ? 'border-teal-300/20 bg-teal-300/[0.06]' : 'border-white/10 bg-white/[0.045]'}`}>
    <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-400 sm:text-xs">{label}</p>
    <p className="mt-2 text-2xl font-black text-white sm:mt-3 sm:text-3xl">{value}</p>
    {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
  </div>
}

function SetupNote({ children }: { children: ReactNode }) {
  return <p className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-xs leading-relaxed text-slate-400">
    <span aria-hidden className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-slate-500" />
    <span><span className="font-semibold text-slate-300">Setup:</span> {children}</span>
  </p>
}

function LeadPerformance({ model, clientId, period, leadInboxHref }: { model: DashboardModel; clientId: string | null; period: { from: string; to: string }; leadInboxHref: string | null }) {
  const leads = model.leads
  return <section aria-label="Lead performance" className="min-w-0 rounded-[2rem] border border-white/10 bg-[#071311] p-4 sm:p-8">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">From visits to enquiries</p>
        <h3 className="mt-2 text-2xl font-black text-white">Lead performance</h3>
      </div>
      {leadInboxHref && leads.state === 'available' && <Link to={leadInboxHref} className="rounded-xl border border-teal-300/40 px-4 py-2 text-sm font-bold text-teal-200 hover:bg-teal-300/10">Open Lead Inbox</Link>}
    </div>

    {leads.state !== 'available'
      ? <p className="mt-4 text-sm text-slate-400">{leads.note}</p>
      : leads.total === 0
        ? <p className="mt-4 text-sm text-slate-400">No website enquiries were received this month.</p>
        : <>
            <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Pipeline</p>
                {leads.pipeline
                  ? <ol className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label="Lead pipeline">
                      {leads.pipeline.map((stage) => <li key={stage.key} className={`min-w-0 rounded-xl border px-1 py-3 text-center sm:px-3 ${stage.value > 0 ? 'border-teal-300/25 bg-teal-300/[0.07]' : 'border-white/10 bg-white/[0.02]'}`}>
                        <p className="text-xl font-black text-white sm:text-2xl">{number(stage.value)}</p>
                        <p className="mt-1 text-[0.65rem] font-semibold uppercase leading-tight tracking-wide text-slate-400 sm:text-[0.68rem]">{stage.label}</p>
                      </li>)}
                    </ol>
                  : <p className="mt-3 text-sm text-slate-400">{number(leads.total)} enquiries this month.</p>}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Lead quality</p>
                <QualityBar good={leads.quality.good} poor={leads.quality.poor} unreviewed={leads.quality.unreviewed} />
                <p className="mt-3 text-sm text-slate-300">
                  {leads.qualificationRate === null ? 'Qualification rate not available yet.' : <>Qualification rate <span className="font-bold text-white">{pct(leads.qualificationRate)}</span> of {number(leads.total)}</>}
                </p>
              </div>
            </div>
            <WebsiteLeadBreakdownCard clientId={clientId} from={period.from} to={period.to} />
          </>}
  </section>
}

function QualityBar({ good, poor, unreviewed }: { good: number; poor: number; unreviewed: number }) {
  const total = good + poor + unreviewed
  const share = (value: number) => (total > 0 ? `${(value / total) * 100}%` : '0%')
  return <div className="mt-3">
    <div aria-hidden className="flex h-3 overflow-hidden rounded-full bg-white/5">
      <div className="h-full bg-emerald-400/80" style={{ width: share(good) }} />
      <div className="h-full bg-orange-400/80" style={{ width: share(poor) }} />
      <div className="h-full bg-slate-500/60" style={{ width: share(unreviewed) }} />
    </div>
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
      <li><span className="font-bold text-emerald-300">{number(good)}</span> Good</li>
      <li><span className="font-bold text-orange-300">{number(poor)}</span> Poor</li>
      <li><span className="font-bold text-slate-300">{number(unreviewed)}</span> Not reviewed</li>
    </ul>
  </div>
}

function RankedCard({ eyebrow, title, rows, unit, empty }: { eyebrow: string; title: string; rows: RankedRow[]; unit: string; empty: string }) {
  const max = Math.max(0, ...rows.map((row) => row.value))
  return <div className="min-w-0 rounded-[2rem] border border-white/10 bg-white/[0.025] p-4 sm:p-6">
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">{eyebrow}</p>
    <h3 className="mt-2 text-lg font-black text-white">{title}</h3>
    {rows.length
      ? <ol className="mt-4 space-y-3 text-sm" aria-label={title}>
          {rows.slice(0, 8).map((row, index) => <li key={row.label}>
            <div className="flex items-baseline justify-between gap-4">
              <span className="min-w-0 break-words text-slate-200"><span className="mr-2 text-xs font-bold text-slate-500">{index + 1}</span>{row.label}</span>
              <span className="shrink-0 font-semibold text-white">{number(row.value)} <span className="text-xs font-normal text-slate-500">{unit}</span></span>
            </div>
            <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-teal-400/80" style={{ width: `${max > 0 ? (row.value / max) * 100 : 0}%` }} /></div>
          </li>)}
        </ol>
      : <p className="mt-3 text-sm text-slate-400">{empty}</p>}
  </div>
}
