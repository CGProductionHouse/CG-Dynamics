import { useEffect, useMemo, useState } from 'react'
import { ClientPortalShell } from '../../components/client/ClientPortalShell'
import { useAuth } from '../../contexts/AuthContext'
import { getClient, type Client } from '../../lib/db/clients'
import { listPublishedReportsForClient, type Report } from '../../lib/db/reports'
import { getReportMonthFromPeriod, monthDisplayLabel, selectMonthlyReports } from '../../lib/reportPeriod'
import { buildClientStrategyPreview } from '../../lib/clientPortal'
import { readStrategyData, ACTION_PLAN_LABELS, type StrategyData } from '../../lib/strategyEngine'

export default function ClientStrategyPage() {
  const { profile } = useAuth()
  const [client, setClient] = useState<Client | null>(null)
  const [report, setReport] = useState<Report | null>(null)
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
          listPublishedReportsForClient(profile.client_id),
        ])
        if (!active) return
        if (clientResult.error || reportsResult.error) throw new Error('Data unavailable')
        setClient(clientResult.data)
        const found = selectMonthlyReports(reportsResult.data)[0] ?? null
        setReport(found)
      } catch {
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [profile?.client_id])

  const strategy = useMemo(() => report ? readStrategyData(report.strategy_data) : null, [report])
  const preview = useMemo(() => buildClientStrategyPreview(report), [report])
  const reportMonth = report ? getReportMonthFromPeriod(report) : null

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

  return (
    <ClientPortalShell client={client}>
      <section className="max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-report-accent">
          {reportMonth ? `Strategy from ${monthDisplayLabel(reportMonth)} review` : 'Strategy'}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-5xl">Strategy & Direction</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-report-muted">
          The reviewed strategy connecting past performance, current direction and the action plan ahead.
        </p>
      </section>

      {loading ? (
        <div className="mt-8 rounded-lg border border-white/[0.08] bg-white/[0.03] px-5 py-6">
          <p className="text-sm leading-6 text-report-muted">Loading strategy…</p>
        </div>
      ) : error ? (
        <div className="mt-8 rounded-lg border border-[#d8a07a]/20 bg-[#d8a07a]/[0.06] px-5 py-6">
          <p className="text-sm leading-6 text-[#d8a07a]">Your strategy could not be loaded right now. Please try again shortly.</p>
        </div>
      ) : !report || preview.length === 0 ? (
        <div className="mt-8 rounded-lg border border-white/[0.08] bg-white/[0.03] px-5 py-6">
          <p className="text-sm leading-6 text-report-muted">
            Your next strategy update will appear here once the current reporting review is complete.
          </p>
        </div>
      ) : (
        <>
          <section className="mt-8 space-y-4">
            {preview.map(item => (
              <article
                key={item.label}
                className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-5 shadow-[0_18px_55px_rgba(0,0,0,0.2)]"
              >
                <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${
                  item.phase === 'review' ? 'text-report-muted' : 'text-report-accent'
                }`}>
                  {item.label}
                </p>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-report-text">{item.value}</p>
              </article>
            ))}
          </section>

          {strategy && strategyDriversContent(strategy) && (
            <section className="mt-10">
              <h2 className="text-xl font-semibold tracking-normal text-white">Strategic drivers</h2>
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
              <h2 className="text-xl font-semibold tracking-normal text-white">Action plan</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {actionPlanEntries.map(entry => (
                  <article
                    key={entry.label}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-5 shadow-[0_18px_55px_rgba(0,0,0,0.2)]"
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
    </ClientPortalShell>
  )
}

function strategyDriversContent(strategy: StrategyData): string | null {
  return strategy.strategyDrivers.length > 0 ? strategy.strategyDrivers.join(', ') : null
}
