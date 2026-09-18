import { useEffect, useMemo, useState } from 'react'
import { ClientPortalShell } from '../../components/client/ClientPortalShell'
import { useAuth } from '../../contexts/AuthContext'
import { getClient, type Client } from '../../lib/db/clients'
import { listClientPublishedReports, type ClientReport } from '../../lib/db/reports'
import { monthDisplayLabel, selectMonthlyReports } from '../../lib/reportPeriod'
import { actionMonthForReport, buildClientStrategyPreview } from '../../lib/clientPortal'
import { readStrategyData, ACTION_PLAN_LABELS, type StrategyData } from '../../lib/strategyEngine'

export default function ClientStrategyPage({ embedded = false, month }: { embedded?: boolean; month?: string }) {
  const { profile } = useAuth()
  const [client, setClient] = useState<Client | null>(null)
  const [report, setReport] = useState<ClientReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      if (!profile?.client_id) { setLoading(false); return }
      setLoading(true)
      setError(false)
      try {
        const [clientResult, reportsResult] = await Promise.all([
          getClient(profile.client_id),
          listClientPublishedReports(),
        ])
        if (!active) return
        if (clientResult.error || reportsResult.error) throw new Error('Data unavailable')
        setClient(clientResult.data)
        const monthlyReports = selectMonthlyReports(reportsResult.data)
        const found = month
          ? monthlyReports.find(candidate => actionMonthForReport(candidate) === month) ?? null
          : monthlyReports[0] ?? null
        setReport(found)
      } catch {
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [month, profile?.client_id])

  const strategy = useMemo(() => report ? readStrategyData(report.strategy_data) : null, [report])
  const preview = useMemo(() => buildClientStrategyPreview(report), [report])
  const strategyMonth = month ?? actionMonthForReport(report)

  const actionPlanEntries = useMemo(() => {
    if (!strategy) return []
    return (Object.keys(ACTION_PLAN_LABELS) as Array<keyof typeof ACTION_PLAN_LABELS>)
      .filter(key => strategy.actionPlan[key].enabled)
      .map(key => ({
        label: ACTION_PLAN_LABELS[key],
        items: strategy.actionPlan[key].items,
        notes: strategy.actionPlan[key].notes,
      }))
  }, [strategy])

  const content = (
    <>
      <section className="max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-report-accent">
          {strategyMonth ? monthDisplayLabel(strategyMonth) : 'Strategy'}
        </p>
        <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-white sm:text-5xl">Strategy &amp; direction</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-report-muted">
          The reviewed strategy connecting past performance, current direction and the action plan ahead.
        </p>
      </section>

      {loading ? (
        <div className="mt-8 rounded-3xl border border-white/[0.08] bg-white/[0.04] px-6 py-8 shadow-[0_24px_70px_-48px_rgba(0,0,0,0.95)]">
          <p className="text-sm leading-6 text-report-muted">Loading strategy…</p>
        </div>
      ) : error ? (
        <div className="mt-8 rounded-3xl border border-[#d8a07a]/20 bg-[#d8a07a]/[0.06] px-6 py-8 shadow-[0_24px_70px_-48px_rgba(0,0,0,0.95)]">
          <p className="text-sm leading-6 text-[#d8a07a]">Your strategy could not be loaded right now. Please try again shortly.</p>
        </div>
      ) : !report || preview.length === 0 ? (
        <div className="relative mt-8 overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.1),transparent_40%),rgba(255,255,255,0.035)] px-6 py-8 shadow-[0_24px_70px_-48px_rgba(0,0,0,0.95)]">
          <p className="text-sm leading-6 text-report-muted">
            Your next strategy update will appear here once the current reporting review is complete.
          </p>
        </div>
      ) : (
        <>
          <section className="mt-8 grid gap-4 lg:grid-cols-2">
            {preview.map((item, index) => (
              <article
                key={item.label}
                className={`relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.04] p-6 shadow-[0_24px_70px_-48px_rgba(0,0,0,0.95)] ${index === 0 ? 'lg:col-span-2 lg:p-8' : ''}`}
              >
                <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${
                  item.phase === 'review' ? 'text-report-muted' : 'text-report-accent'
                }`}>
                  {item.label}
                </p>
                <p className={`mt-3 whitespace-pre-line text-report-text ${index === 0 ? 'max-w-4xl text-base leading-7' : 'text-sm leading-6'}`}>{item.value}</p>
              </article>
            ))}
          </section>

          {strategy && strategyDriversContent(strategy) && (
            <section className="mt-10">
              <h3 className="text-2xl font-black tracking-[-0.025em] text-white">Strategic drivers</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {strategy.strategyDrivers.map(driver => (
                  <span key={driver} className="rounded-full border border-report-accent/25 bg-report-accent/10 px-3 py-1.5 text-xs text-report-accent">
                    {driver}
                  </span>
                ))}
              </div>
            </section>
          )}

          {actionPlanEntries.length > 0 && (
            <section className="mt-10">
              <h3 className="text-2xl font-black tracking-[-0.025em] text-white">Action plan</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {actionPlanEntries.map(entry => (
                  <article
                    key={entry.label}
                    className="rounded-3xl border border-white/[0.08] bg-[linear-gradient(145deg,rgba(45,212,191,0.055),rgba(255,255,255,0.025))] p-6 shadow-[0_24px_70px_-48px_rgba(0,0,0,0.95)]"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-report-accent">{entry.label}</p>
                    {entry.items.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {entry.items.map((item, i) => (
                          <li key={i} className="text-sm leading-6 text-report-text before:mr-2 before:text-report-faint before:content-['•']">{item}</li>
                        ))}
                      </ul>
                    )}
                    {entry.notes && (
                      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-report-faint">{entry.notes}</p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  )
  return embedded ? content : <ClientPortalShell client={client}>{content}</ClientPortalShell>
}

function strategyDriversContent(strategy: StrategyData): string | null {
  return strategy.strategyDrivers.length > 0 ? strategy.strategyDrivers.join(', ') : null
}
