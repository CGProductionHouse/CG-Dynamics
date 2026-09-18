import { useEffect, useState } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { actionMonthForReport } from '../../lib/clientPortal'
import { listClientPublishedReports } from '../../lib/db/reports'
import { monthDisplayLabel, selectMonthlyReports } from '../../lib/reportPeriod'
import ClientContentCalendarPage from './ClientContentCalendarPage'
import ClientContentGuidesPage from './ClientContentGuidesPage'
import ClientStrategyPage from './ClientStrategyPage'

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const PLAN_TABS = [
  { key: 'strategy', label: 'Strategy' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'guidelines', label: 'Content Guidelines' },
] as const

type PlanTab = (typeof PLAN_TABS)[number]['key']

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber - 1 + amount, 1)).toISOString().slice(0, 7)
}

export default function ClientPlanPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedMonth = searchParams.get('month')
  const month = requestedMonth && MONTH_PATTERN.test(requestedMonth) ? requestedMonth : currentMonth()
  const requestedTab = searchParams.get('tab')
  const tab: PlanTab = PLAN_TABS.some(item => item.key === requestedTab) ? requestedTab as PlanTab : 'strategy'

  useEffect(() => {
    let active = true
    async function canonicalizeMonth() {
      if (!profile?.client_id) return
      if (requestedMonth) return
      const now = new Date()
      const canonical = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      if (canonical !== requestedMonth) {
        setSearchParams(current => {
          current.set('month', canonical)
          return current
        })
      }
    }
    void canonicalizeMonth()
    return () => { active = false }
  }, [profile?.client_id, requestedMonth])

  function updatePlan(next: { tab?: PlanTab; month?: string }) {
    setSearchParams(current => {
      current.set('tab', next.tab ?? tab)
      current.set('month', next.month ?? month)
      return current
    })
  }

  const tabPanel = tab === 'calendar'
    ? <ClientContentCalendarPage embedded month={month} />
    : tab === 'guidelines'
      ? <ClientContentGuidesPage embedded month={month} />
      : <ClientStrategyPage embedded month={month} />

  return (
    <>
      <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[radial-gradient(circle_at_12%_5%,rgba(45,212,191,0.16),transparent_34%),radial-gradient(circle_at_90%_15%,rgba(249,115,22,0.12),transparent_28%),linear-gradient(145deg,rgba(10,27,24,0.96),rgba(5,12,11,0.94))] px-5 py-7 shadow-[0_34px_100px_-55px_rgba(0,0,0,0.95)] sm:px-8 sm:py-10 lg:px-10">
        <div aria-hidden className="absolute -left-16 top-8 h-44 w-44 rounded-full bg-[#2dd4bf]/10 blur-3xl" />
        <div aria-hidden className="absolute -right-20 bottom-0 h-52 w-52 rounded-full bg-[#f97316]/10 blur-3xl" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.26em] text-[#2dd4bf]">Monthly direction</p>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] text-white sm:text-6xl">Your plan, connected.</h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Strategy, scheduled content and production guidance for one shared working month.
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border border-white/10 bg-black/20 p-2 backdrop-blur">
            <p className="px-3 pt-1 text-[0.65rem] font-black uppercase tracking-[0.2em] text-slate-500">Working month</p>
            <div className="mt-2 flex items-center gap-1">
              <button type="button" aria-label="Previous month" onClick={() => updatePlan({ month: shiftMonth(month, -1) })} className="min-h-11 min-w-11 rounded-xl text-lg text-slate-400 transition hover:bg-white/[0.07] hover:text-white">‹</button>
              <p className="min-w-36 text-center text-sm font-black text-white sm:min-w-40">{monthDisplayLabel(month)}</p>
              <button type="button" aria-label="Next month" onClick={() => updatePlan({ month: shiftMonth(month, 1) })} className="min-h-11 min-w-11 rounded-xl text-lg text-slate-400 transition hover:bg-white/[0.07] hover:text-white">›</button>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 overflow-x-auto pb-1" aria-label="Plan sections">
        <div role="tablist" className="flex min-w-max w-fit gap-1 rounded-full border border-white/[0.08] bg-white/[0.035] p-1">
          {PLAN_TABS.map(item => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              aria-pressed={tab === item.key}
              onClick={() => updatePlan({ tab: item.key })}
              className={`min-h-11 rounded-full px-5 py-2 text-sm font-bold transition ${tab === item.key ? 'bg-white text-[#06110f] shadow-lg' : 'text-slate-400 hover:bg-white/[0.055] hover:text-white'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <section role="tabpanel" className="mt-7">{tabPanel}</section>
    </>
  )
}

export function ClientPlanLegacyRedirect({ tab }: { tab: PlanTab }) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  params.set('tab', tab)
  return <Navigate to={`/client/plan?${params.toString()}`} replace />
}
