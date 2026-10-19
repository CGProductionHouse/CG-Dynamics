import { useEffect, useId, useRef } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { monthDisplayLabel } from '../../lib/reportPeriod'
import { businessMonthKey } from '../../lib/businessTime'
import ClientContentCalendarPage from './ClientContentCalendarPage'
import ClientContentGuidesPage from './ClientContentGuidesPage'
import ClientStrategyPage from './ClientStrategyPage'
import { useClientPortal } from '../../components/client/ClientPortalContext'
import { ClientPackageSummary } from '../../components/client/ClientPackageSummary'
import { clientStrategyMonths, selectClientStrategyMonth } from '../../lib/clientStrategyMonths'
import { moveClientTabFocus } from '../../lib/clientTabKeyboard'

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const PLAN_TABS = [
  { key: 'strategy', label: 'Strategy' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'guidelines', label: 'Content Guidelines' },
  { key: 'package', label: 'Your package' },
] as const

type PlanTab = (typeof PLAN_TABS)[number]['key']
const PLAN_TAB_KEYS = PLAN_TABS.map(item => item.key)

function currentMonth() {
  return businessMonthKey()
}

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber - 1 + amount, 1)).toISOString().slice(0, 7)
}

export default function ClientPlanPage() {
  const { client } = useClientPortal()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabsId = useId()
  const tabButtons = useRef<Partial<Record<PlanTab, HTMLButtonElement | null>>>({})

  const requestedMonth = searchParams.get('month')
  const requestedTab = searchParams.get('tab')
  const tab: PlanTab = PLAN_TABS.some(item => item.key === requestedTab) ? requestedTab as PlanTab : 'strategy'
  const month = tab === 'strategy'
    ? selectClientStrategyMonth(requestedMonth)
    : requestedMonth && MONTH_PATTERN.test(requestedMonth) ? requestedMonth : currentMonth()
  const [strategyCurrentMonth, strategyNextMonth] = clientStrategyMonths()

  useEffect(() => {
    if (requestedMonth === month) return
    setSearchParams(current => {
      const canonical = new URLSearchParams(current)
      canonical.set('month', month)
      return canonical
    }, { replace: true })
  }, [month, requestedMonth, setSearchParams])

  function updatePlan(next: { tab?: PlanTab; month?: string }) {
    setSearchParams(current => {
      const updated = new URLSearchParams(current)
      const nextTab = next.tab ?? tab
      updated.set('tab', nextTab)
      updated.set('month', nextTab === 'strategy' ? selectClientStrategyMonth(next.month ?? month) : next.month ?? month)
      return updated
    })
  }

  const tabPanel = tab === 'calendar'
    ? <ClientContentCalendarPage embedded month={month} />
    : tab === 'guidelines'
      ? <ClientContentGuidesPage embedded month={month} />
      : tab === 'package'
        ? <ClientPackageSummary packageSettings={client?.package_settings} clientId={client?.id} />
        : <ClientStrategyPage embedded month={month} />

  return (
    <>
      <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[radial-gradient(circle_at_12%_5%,rgba(45,212,191,0.16),transparent_34%),radial-gradient(circle_at_90%_15%,rgba(249,115,22,0.12),transparent_28%),linear-gradient(145deg,rgba(10,27,24,0.96),rgba(5,12,11,0.94))] px-5 py-6 shadow-[0_34px_100px_-55px_rgba(0,0,0,0.95)] sm:px-8 sm:py-10 lg:px-10">
        <div aria-hidden className="absolute -left-16 top-8 h-44 w-44 rounded-full bg-[#2dd4bf]/10 blur-3xl" />
        <div aria-hidden className="absolute -right-20 bottom-0 h-52 w-52 rounded-full bg-[#f97316]/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.26em] text-[#2dd4bf]">Monthly direction</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white sm:text-6xl">Your plan</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Strategy, calendar and content guidelines.
            </p>
          </div>
          {tab !== 'package' && <div className="shrink-0 rounded-2xl border border-white/10 bg-black/20 p-2 backdrop-blur">
            <p className="px-3 pt-1 text-[0.65rem] font-black uppercase tracking-[0.2em] text-slate-500">Working month</p>
            {tab === 'strategy' ? (
              <div className="mt-2 flex items-center gap-1" aria-label="Strategy months">
                {[strategyCurrentMonth, strategyNextMonth].map(strategyOption => (
                  <button key={strategyOption} type="button" aria-pressed={month === strategyOption} onClick={() => updatePlan({ month: strategyOption })} className={`min-h-11 rounded-xl px-3 text-sm font-bold transition ${month === strategyOption ? 'bg-white text-[#06110f]' : 'text-slate-400 hover:bg-white/[0.07] hover:text-white'}`}>{monthDisplayLabel(strategyOption)}</button>
                ))}
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-1">
                <button type="button" aria-label="Previous month" onClick={() => updatePlan({ month: shiftMonth(month, -1) })} className="min-h-11 min-w-11 rounded-xl text-lg text-slate-400 transition hover:bg-white/[0.07] hover:text-white">‹</button>
                <p className="min-w-36 text-center text-sm font-black text-white sm:min-w-40">{monthDisplayLabel(month)}</p>
                <button type="button" aria-label="Next month" onClick={() => updatePlan({ month: shiftMonth(month, 1) })} className="min-h-11 min-w-11 rounded-xl text-lg text-slate-400 transition hover:bg-white/[0.07] hover:text-white">›</button>
              </div>
            )}
          </div>}
        </div>
      </section>

      <div className="mt-6 pb-1">
        <div role="tablist" aria-label="Plan sections" className="grid w-full grid-cols-2 gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-1 sm:flex sm:w-fit sm:rounded-full">
          {PLAN_TABS.map((item, index) => (
            <button
              key={item.key}
              ref={element => { tabButtons.current[item.key] = element }}
              id={`${tabsId}-${item.key}-tab`}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              aria-controls={`${tabsId}-${item.key}-panel`}
              tabIndex={tab === item.key ? 0 : -1}
              onKeyDown={event => moveClientTabFocus(event, index, tab, PLAN_TAB_KEYS, tabButtons.current)}
              onClick={() => updatePlan({ tab: item.key })}
              className={`min-h-11 min-w-0 rounded-full px-2 py-2 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2dd4bf] sm:px-5 sm:text-sm ${tab === item.key ? 'bg-white text-[#06110f] shadow-lg' : 'text-slate-400 hover:bg-white/[0.055] hover:text-white'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* A new client/month is a new read scope, not the previous panel's state.
          Remount before effects run so old scripts/calendar/strategy cannot flash
          beneath the newly selected month. The persistent portal shell stays put. */}
      {PLAN_TABS.map(item => (
        <section key={`${client?.id ?? 'unavailable'}:${month}:${item.key}`}
          id={`${tabsId}-${item.key}-panel`} role="tabpanel"
          aria-labelledby={`${tabsId}-${item.key}-tab`} hidden={tab !== item.key}
          tabIndex={tab === item.key ? 0 : undefined}
          className="mt-7 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2dd4bf]">
          {tab === item.key ? tabPanel : null}
        </section>
      ))}
    </>
  )
}

export function ClientPlanLegacyRedirect({ tab }: { tab: PlanTab }) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  params.set('tab', tab)
  return <Navigate to={`/client/plan?${params.toString()}`} replace />
}
