import { useEffect, useMemo, useState } from 'react'
import { ClientPortalShell } from '../../components/client/ClientPortalShell'
import { GuidedStrategyView } from '../../components/strategy/GuidedStrategy'
import { useAuth } from '../../contexts/AuthContext'
import { getClient, type Client } from '../../lib/db/clients'
import { getClientPublishedMonthlyStrategy } from '../../lib/monthlyStrategy'
import { monthDisplayLabel } from '../../lib/reportPeriod'
import { readStrategyData, type StrategyData } from '../../lib/strategyEngine'

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function ClientStrategyPage({ embedded = false, month }: { embedded?: boolean; month?: string }) {
  const { profile } = useAuth()
  const [client, setClient] = useState<Client | null>(null)
  const [strategy, setStrategy] = useState<StrategyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const strategyMonth = month ?? currentMonth()

  useEffect(() => {
    let active = true
    async function load() {
      if (!profile?.client_id) { setLoading(false); return }
      setLoading(true)
      setError(false)
      setStrategy(null)
      try {
        const [clientResult, strategyResult] = await Promise.all([
          embedded ? Promise.resolve({ data: null, error: null }) : getClient(profile.client_id),
          getClientPublishedMonthlyStrategy(strategyMonth),
        ])
        if (!active) return
        if (clientResult.error || strategyResult.error) throw new Error('Data unavailable')
        setClient(clientResult.data as Client | null)
        setStrategy(strategyResult.data ? readStrategyData(strategyResult.data.strategy_data) : null)
      } catch {
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [embedded, profile?.client_id, strategyMonth])

  const hasPublishedContent = useMemo(() => strategy && (
    strategy.strategyGoingForward.trim()
    || strategy.strategyDrivers.length > 0
    || strategy.clientDirection.length > 0
    || strategy.clientActionsRequired.length > 0
    || strategy.calendarSelections.some(selection => selection.use)
    || Object.values(strategy.actionPlan).some(section => section.enabled && (section.items.length > 0 || section.notes.trim()))
  ), [strategy])

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
      ) : !strategy || !hasPublishedContent ? (
        <div className="relative mt-8 overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.1),transparent_40%),rgba(255,255,255,0.035)] px-6 py-8 shadow-[0_24px_70px_-48px_rgba(0,0,0,0.95)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-report-accent">Strategy under review</p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-report-muted">
            Your {monthDisplayLabel(strategyMonth)} strategy update will appear here once it has been reviewed and published.
          </p>
        </div>
      ) : (
        <section className="mt-8">
          <GuidedStrategyView data={strategy} variant="report" />
        </section>
      )}
    </>
  )
  return embedded ? content : <ClientPortalShell client={client}>{content}</ClientPortalShell>
}
