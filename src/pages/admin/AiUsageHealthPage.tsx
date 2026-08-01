import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ActionButton } from '../../components/ui/Buttons'
import { EmptyState, LoadingState } from '../../components/ui/States'
import {
  getAiUsageAggregates,
  getProviderDisplayStatus,
  getMaskedProviderDiagnostics,
  isCurrentDashboardRequest,
  monthStart,
  runMaskedProviderHealthCheck,
  setAiBudget,
  type AiBudget,
  type AiUsageAggregates,
  type MaskedProviderDiagnostic,
  type ProviderDisplayStatus,
  type RuntimeHealth,
  type UsageSeriesRow,
} from '../../lib/aiUsageHealth'

const number = new Intl.NumberFormat('en-ZA')
const decimal = new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 2 })

function zar(micros: number | null | undefined) {
  if (micros == null) return 'Unknown'
  return `R ${decimal.format(micros / 1_000_000)}`
}

function providerMoney(micros: number | null, currency: string) {
  if (micros == null) return 'Unknown'
  return `${currency} ${decimal.format(micros / 1_000_000)}`
}

function budgetState(budget: AiBudget | null) {
  if (!budget) return { label: 'Not configured', tone: 'unavailable' as RuntimeHealth, message: 'Hard protection cannot run without a monthly budget.' }
  const used = budget.committed_zar_micros + budget.reserved_zar_micros
  if (used >= budget.hard_limit_zar_micros) return { label: 'Hard limit reached', tone: 'unavailable' as RuntimeHealth, message: 'New metered requests are denied before a provider call.' }
  if (used > budget.soft_limit_zar_micros) return { label: 'Soft limit exceeded', tone: 'degraded' as RuntimeHealth, message: 'Usage remains allowed until the hard limit is reached.' }
  if (budget.soft_limit_zar_micros > 0 && used * 100 >= budget.soft_limit_zar_micros * budget.warning_threshold_percent) return { label: 'Warning threshold reached', tone: 'degraded' as RuntimeHealth, message: 'Spend is approaching the monthly soft limit.' }
  return { label: 'Protected', tone: 'healthy' as RuntimeHealth, message: 'Hard budget denial is active before provider requests are sent.' }
}

function statusClasses(status: ProviderDisplayStatus) {
  if (status === 'healthy') return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
  if (status === 'degraded') return 'border-amber-400/25 bg-amber-400/10 text-amber-200'
  if (status === 'unavailable') return 'border-red-400/25 bg-red-400/10 text-red-200'
  return 'border-white/10 bg-white/[0.05] text-white/55'
}

function attemptCoverage(attempts: number, unknown: number) {
  const known = Math.max(0, attempts - unknown)
  if (attempts === 0) return 'No eligible attempts'
  if (unknown === 0) return `Complete coverage for ${number.format(attempts)} attempts`
  return `Partial coverage: known for ${number.format(known)} of ${number.format(attempts)} attempts`
}

function telemetryCoverage(eligibleAttempts: number, unknownAttempts: number, label: string) {
  if (eligibleAttempts === 0) return `N/A: no eligible ${label} attempts`
  if (unknownAttempts >= eligibleAttempts) return `Unknown ${label} telemetry for all ${number.format(eligibleAttempts)} eligible attempts`
  if (unknownAttempts === 0) return `Complete ${label} telemetry for ${number.format(eligibleAttempts)} eligible attempts`
  return `Partial ${label} telemetry: ${number.format(unknownAttempts)} of ${number.format(eligibleAttempts)} eligible attempts unknown`
}

function aggregateValue(value: number | null, unknown: number | undefined, format: (known: number) => string) {
  if (value == null) return 'Unknown'
  return `${unknown != null && unknown > 0 ? 'At least ' : ''}${format(value)}`
}

function observationFreshness(observedAt: string | null, now: number) {
  if (!observedAt) return 'Never checked'
  const timestamp = Date.parse(observedAt)
  if (!Number.isFinite(timestamp)) return 'Checked time unavailable'
  const ageMinutes = Math.max(0, Math.floor((now - timestamp) / 60_000))
  const age = ageMinutes < 1 ? 'just now' : ageMinutes < 60 ? `${ageMinutes}m ago` : `${Math.floor(ageMinutes / 60)}h ago`
  return `Checked ${new Date(timestamp).toLocaleString('en-ZA')} · ${age}${now - timestamp > 15 * 60_000 ? ' · stale' : ''}`
}

type AggregateTelemetry = Pick<UsageSeriesRow,
  'attempts' | 'input_tokens' | 'output_tokens' | 'audio_seconds' | 'token_eligible_attempts' |
  'unknown_input_attempts' | 'unknown_output_attempts' |
  'audio_eligible_attempts' | 'unknown_audio_attempts' |
  'estimated_zar_cost_micros' | 'unknown_cost_attempts'
>

function aggregateCost(row: Pick<AggregateTelemetry, 'attempts' | 'estimated_zar_cost_micros' | 'unknown_cost_attempts'>) {
  return `${aggregateValue(row.estimated_zar_cost_micros, row.unknown_cost_attempts, known => zar(known))} · ${attemptCoverage(row.attempts, row.unknown_cost_attempts).toLowerCase()}`
}

function safeCount(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
}

function telemetryValue(value: number | null | undefined, eligibleAttempts: number, unknownAttempts: number, format: (known: number) => string) {
  if (eligibleAttempts === 0) return 'N/A'
  if (value == null || !Number.isFinite(value)) return 'Unknown'
  return `${unknownAttempts > 0 ? 'At least ' : ''}${format(value)}`
}

function aggregateTelemetry(row: Partial<AggregateTelemetry>) {
  const tokenEligible = safeCount(row.token_eligible_attempts)
  const inputUnknown = Math.min(tokenEligible, safeCount(row.unknown_input_attempts))
  const outputUnknown = Math.min(tokenEligible, safeCount(row.unknown_output_attempts))
  const audioEligible = safeCount(row.audio_eligible_attempts)
  const audioUnknown = Math.min(audioEligible, safeCount(row.unknown_audio_attempts))
  return `${telemetryValue(row.input_tokens, tokenEligible, inputUnknown, known => number.format(known))} in / ${telemetryValue(row.output_tokens, tokenEligible, outputUnknown, known => number.format(known))} out · ${telemetryCoverage(tokenEligible, inputUnknown, 'input token').toLowerCase()} · ${telemetryCoverage(tokenEligible, outputUnknown, 'output token').toLowerCase()} · ${telemetryValue(row.audio_seconds, audioEligible, audioUnknown, known => `${decimal.format(known)} sec`)} audio · ${telemetryCoverage(audioEligible, audioUnknown, 'audio').toLowerCase()}`
}

function aggregateActivity(row: UsageSeriesRow) {
  return `${number.format(row.attempts)} attempts · ${number.format(row.skipped)} skipped · ${number.format(row.retries)} retries`
}

export default function AiUsageHealthPage() {
  const [month, setMonth] = useState(() => monthStart(new Date()).slice(0, 7))
  const [data, setData] = useState<AiUsageAggregates | null>(null)
  const [diagnostics, setDiagnostics] = useState<MaskedProviderDiagnostic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkMessage, setCheckMessage] = useState<string | null>(null)
  const [savingBudget, setSavingBudget] = useState(false)
  const [budgetError, setBudgetError] = useState<string | null>(null)
  const [softLimit, setSoftLimit] = useState('')
  const [hardLimit, setHardLimit] = useState('')
  const [warningThreshold, setWarningThreshold] = useState('80')
  const [now, setNow] = useState(() => Date.now())
  const loadSequenceRef = useRef(0)
  const budgetSequenceRef = useRef(0)
  const healthSequenceRef = useRef(0)
  const monthRef = useRef(month)

  async function load(selectedMonth = monthRef.current, clearCurrent = false) {
    if (selectedMonth !== monthRef.current) return
    const sequence = ++loadSequenceRef.current
    if (clearCurrent) setData(null)
    setLoading(true)
    setError(null)
    setDiagnosticsError(null)
    try {
      const [aggregateResult, diagnosticResult] = await Promise.allSettled([
        getAiUsageAggregates(`${selectedMonth}-01`),
        getMaskedProviderDiagnostics(),
      ])
      if (sequence !== loadSequenceRef.current || selectedMonth !== monthRef.current) return
      setNow(Date.now())

      if (aggregateResult.status === 'rejected') {
        setError(aggregateResult.reason instanceof Error ? aggregateResult.reason.message : 'Could not load AI usage health.')
        setData(null)
      } else {
        setData(aggregateResult.value)
        const budget = aggregateResult.value.budget
        setSoftLimit(budget ? String(budget.soft_limit_zar_micros / 1_000_000) : '')
        setHardLimit(budget ? String(budget.hard_limit_zar_micros / 1_000_000) : '')
        setWarningThreshold(budget ? String(budget.warning_threshold_percent) : '80')
      }

      if (diagnosticResult.status === 'rejected') {
        setDiagnostics([])
        setDiagnosticsError('Key configuration could not be verified. No secret values were requested or exposed.')
      } else {
        setDiagnostics(diagnosticResult.value)
      }
    } finally {
      if (sequence === loadSequenceRef.current && selectedMonth === monthRef.current) setLoading(false)
    }
  }

  const loadForMonthChange = useEffectEvent(load)

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadForMonthChange(month) }, 0)
    return () => {
      window.clearTimeout(timer)
      loadSequenceRef.current += 1
    }
  }, [month])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  function changeMonth(nextMonth: string) {
    loadSequenceRef.current += 1
    monthRef.current = nextMonth
    setData(null)
    setLoading(true)
    setError(null)
    setDiagnosticsError(null)
    setBudgetError(null)
    setSoftLimit('')
    setHardLimit('')
    setWarningThreshold('80')
    setMonth(nextMonth)
  }

  async function saveBudget(event: FormEvent) {
    event.preventDefault()
    if (!data) return
    const soft = Number(softLimit)
    const hard = Number(hardLimit)
    const warning = Number(warningThreshold)
    if (!Number.isFinite(soft) || soft < 0 || !Number.isFinite(hard) || hard < soft || !Number.isInteger(warning) || warning < 1 || warning > 100) {
      setBudgetError('Enter valid limits. Hard must be at least soft, and warning must be 1 to 100%.')
      return
    }
    const operationSequence = ++budgetSequenceRef.current
    const request = { month: monthRef.current, loadSequence: loadSequenceRef.current }
    setSavingBudget(true)
    setBudgetError(null)
    try {
      await setAiBudget({
        month: `${request.month}-01`, softLimitZar: soft, hardLimitZar: hard,
        warningThresholdPercent: warning, expectedVersion: data.budget?.version ?? 0,
      })
      if (isCurrentDashboardRequest(request, monthRef.current, loadSequenceRef.current)) await load(request.month)
    } catch (reason) {
      if (!isCurrentDashboardRequest(request, monthRef.current, loadSequenceRef.current)) return
      const message = reason instanceof Error ? reason.message : 'Could not save the AI budget.'
      if (/budget version conflict/i.test(message)) {
        await load(request.month)
        if (monthRef.current === request.month) setBudgetError('This budget changed in another session. The latest values are now loaded; review them and save again.')
      } else {
        setBudgetError(message)
      }
    } finally {
      if (operationSequence === budgetSequenceRef.current) setSavingBudget(false)
    }
  }

  async function runHealthCheck() {
    const operationSequence = ++healthSequenceRef.current
    const request = { month: monthRef.current, loadSequence: loadSequenceRef.current }
    setChecking(true)
    setCheckMessage(null)
    try {
      const result = await runMaskedProviderHealthCheck()
      if (isCurrentDashboardRequest(request, monthRef.current, loadSequenceRef.current)) {
        setCheckMessage(result?.success
          ? `Health check succeeded via ${result.provider ?? 'an enabled provider'} (${result.model ?? 'configured model'}).`
          : result?.error ?? 'No provider was available.')
        await load(request.month)
      }
    } catch (reason) {
      if (isCurrentDashboardRequest(request, monthRef.current, loadSequenceRef.current)) setCheckMessage(reason instanceof Error ? reason.message : 'Provider health check failed.')
    } finally {
      if (operationSequence === healthSequenceRef.current) setChecking(false)
    }
  }

  const configuredByProvider = new Map(diagnostics.map(item => [item.provider, item.configured]))
  const protection = budgetState(data?.budget ?? null)
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-accent">Admin governance</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">AI usage & provider health</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-primary/65">Live metering, budget protection, route configuration and masked runtime diagnostics. Costs are estimates from pricing snapshots, not provider invoices.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="ai-health-month">Usage month</label>
          <input id="ai-health-month" type="month" value={month} onChange={event => changeMonth(event.target.value)} className="min-h-11 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white [color-scheme:dark]" />
          <ActionButton variant="outline" onClick={() => void load(month)} loading={loading} className="min-h-11">Refresh</ActionButton>
          <Link to="/admin/import-health" className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-bold text-white/65 hover:bg-white/[0.06] hover:text-white">System Health</Link>
        </div>
      </header>

      {loading && !data ? <LoadingState message="Loading complete server-side aggregates…" size="lg" /> : null}
      {error ? <EmptyState title="AI health could not be loaded" message={error} centered={false} action={<ActionButton onClick={() => void load(month)}>Try again</ActionButton>} /> : null}

      {data ? (
        <div className="space-y-6">
          <section className={`rounded-2xl border p-5 ${statusClasses(protection.tone)}`} aria-live="polite">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em]">Monthly protection</p>
                <h2 className="mt-1 text-xl font-black">{protection.label}</h2>
                <p className="mt-1 text-sm opacity-80">{protection.message}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs font-bold uppercase tracking-wide opacity-60">Committed + reserved</p>
                <p className="mt-1 text-2xl font-black">{zar(data.budget ? data.budget.committed_zar_micros + data.budget.reserved_zar_micros : null)}</p>
                <p className="text-xs opacity-70">Hard limit {zar(data.budget?.hard_limit_zar_micros)}</p>
              </div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Current month summary">
            <MetricCard label="Requests" value={number.format(data.summary.requests)} detail={`${data.summary.succeeded} succeeded · ${data.summary.failed} failed · ${data.summary.denied} denied`} />
            <MetricCard label="Estimated ZAR" value={aggregateValue(data.summary.estimated_zar_cost_micros, data.summary.unknown_cost_attempts, known => zar(known))} detail={attemptCoverage(data.summary.attempts, data.summary.unknown_cost_attempts)} />
            <MetricCard label="Tokens" value={`${telemetryValue(data.summary.input_tokens, data.summary.token_eligible_attempts, data.summary.unknown_input_attempts, known => number.format(known))} in`} detail={`${telemetryValue(data.summary.output_tokens, data.summary.token_eligible_attempts, data.summary.unknown_output_attempts, known => number.format(known))} out · ${telemetryCoverage(data.summary.token_eligible_attempts, data.summary.unknown_input_attempts, 'input token').toLowerCase()} · ${telemetryCoverage(data.summary.token_eligible_attempts, data.summary.unknown_output_attempts, 'output token').toLowerCase()}`} />
            <MetricCard label="Reliability" value={`${data.summary.fallbacks} fallbacks`} detail={`${data.summary.attempts} attempts · ${data.summary.skipped} skipped · ${data.summary.retries} retries · ${data.summary.avg_latency_ms == null ? 'unknown' : `${decimal.format(data.summary.avg_latency_ms)} ms`} avg`} />
          </section>

          {data.summary.requests === 0 ? (
            <EmptyState title="No metered usage this month" message="There are no request or attempt aggregates for the selected month. Provider routes and budget controls remain live below." centered={false} />
          ) : (
            <section className="grid gap-4 lg:grid-cols-2">
              <UsageBars rows={data.daily} />
              <CurrencyPanel data={data} />
            </section>
          )}

          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-white">Provider routes</h2>
                <p className="mt-1 text-sm text-white/50">Ordered by capability, tier and route priority. Configuration is masked; runtime state uses only safe observations.</p>
                {diagnosticsError ? <p className="mt-2 text-xs text-amber-200">{diagnosticsError}</p> : null}
                {checkMessage ? <p className="mt-2 text-sm text-white/70" aria-live="polite">{checkMessage}</p> : null}
              </div>
              <ActionButton variant="secondary" onClick={() => void runHealthCheck()} loading={checking} className="min-h-11 shrink-0">Run metered health check</ActionButton>
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/8">
              <table className="min-w-[860px] w-full text-left text-sm">
                <caption className="sr-only">Configured AI provider routes and recent runtime health</caption>
                <thead className="bg-black/25 text-[11px] uppercase tracking-wider text-white/40">
                  <tr><th scope="col" className="px-3 py-3">Tier order</th><th scope="col" className="px-3 py-3">Route</th><th scope="col" className="px-3 py-3">Tier</th><th scope="col" className="px-3 py-3">Model</th><th scope="col" className="px-3 py-3">Pricing</th><th scope="col" className="px-3 py-3">Key</th><th scope="col" className="px-3 py-3">Runtime</th></tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.routes.map(route => {
                    const configured = configuredByProvider.get(route.provider)
                    const runtime = getProviderDisplayStatus(route, configured, now)
                    return (
                      <tr key={route.id} className="text-white/70">
                        <th scope="row" className="px-3 py-3 font-bold text-white">{route.priority}</th>
                        <td className="px-3 py-3"><span className="font-semibold text-white">{route.provider}</span><span className="block text-xs text-white/40">{route.capability} · {route.enabled ? 'enabled' : 'disabled'}</span></td>
                        <td className="px-3 py-3 capitalize">{route.tier}</td>
                        <td className="max-w-64 px-3 py-3 font-mono text-xs">{route.model}</td>
                        <td className="px-3 py-3 text-xs">{route.pricing_currency}<span className="block text-white/40">as of {route.pricing_as_of}</span></td>
                        <td className="px-3 py-3">{configured == null ? 'Unknown' : configured ? 'Configured (masked)' : 'Missing'}</td>
                        <td className="px-3 py-3"><StatusPill status={runtime} /><span className="mt-1 block text-xs text-white/35">{observationFreshness(route.last_observed_at, now)}</span>{route.last_latency_ms != null ? <span className="block text-xs text-white/35">{number.format(route.last_latency_ms)} ms</span> : null}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
            <form onSubmit={saveBudget} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
              <h2 className="text-lg font-black text-white">Monthly budget</h2>
              <p className="mt-1 text-sm text-white/50">Optimistic version {data.budget?.version ?? 'new'}. Concurrent changes are rejected.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <BudgetInput label="Soft limit (ZAR)" value={softLimit} onChange={setSoftLimit} />
                <BudgetInput label="Hard limit (ZAR)" value={hardLimit} onChange={setHardLimit} />
                <BudgetInput label="Warning threshold (%)" value={warningThreshold} onChange={setWarningThreshold} min="1" max="100" />
              </div>
              {budgetError ? <p className="mt-3 text-sm text-red-200" role="alert">{budgetError}</p> : null}
              <ActionButton type="submit" loading={savingBudget} className="mt-4 min-h-11">Save protected budget</ActionButton>
            </form>
            <DataTable title="Usage by user" columns={['User', 'Requests', 'Results', 'Attempt activity', 'Telemetry', 'Est. ZAR', 'Avg latency']} rows={data.users.map(row => [row.full_name ?? 'Unnamed user', row.requests, `${row.succeeded} succeeded · ${row.failed} failed · ${row.denied} denied`, aggregateActivity(row), aggregateTelemetry(row), aggregateCost(row), row.avg_latency_ms == null ? 'Unknown' : `${decimal.format(row.avg_latency_ms)} ms`])} />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <DataTable title="Feature & action" columns={['Feature', 'Action', 'Requests', 'Results', 'Attempt activity', 'Telemetry', 'Est. ZAR', 'Avg latency']} rows={data.features.map(row => [row.feature ?? 'Unknown', row.action ?? 'Unknown', row.requests, `${row.succeeded} succeeded · ${row.failed} failed · ${row.denied} denied`, aggregateActivity(row), aggregateTelemetry(row), aggregateCost(row), row.avg_latency_ms == null ? 'Unknown' : `${decimal.format(row.avg_latency_ms)} ms`])} />
            <DataTable title="Provider & model usage" columns={['Provider', 'Model', 'Attempts', 'Success', 'Failed', 'Skipped', 'Denied', 'Retries', 'Fallbacks', 'Telemetry', 'Est. ZAR', 'Avg latency']} rows={data.providers.map(row => [
              row.provider,
              row.model,
              row.attempts,
              row.succeeded,
              row.failed,
               row.skipped,
               row.denied,
              row.retries,
              row.fallbacks,
               aggregateTelemetry(row),
              `${aggregateValue(row.estimated_zar_cost_micros, row.unknown_cost_attempts, known => zar(known))} · ${attemptCoverage(row.attempts, row.unknown_cost_attempts).toLowerCase()}`,
              row.avg_latency_ms == null ? 'Unknown' : `${decimal.format(row.avg_latency_ms)} ms`,
            ])} />
          </section>

          <DataTable title="Monthly totals" columns={['Month', 'Requests', 'Results', 'Attempt activity', 'Telemetry', 'Est. ZAR', 'Avg latency']} rows={data.monthly.map(row => [row.month ?? '', row.requests, `${row.succeeded} succeeded · ${row.failed} failed · ${row.denied} denied`, aggregateActivity(row), aggregateTelemetry(row), aggregateCost(row), row.avg_latency_ms == null ? 'Unknown' : `${decimal.format(row.avg_latency_ms)} ms`])} />
        </div>
      ) : null}
    </main>
  )
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.055] to-white/[0.015] p-4"><p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/35">{label}</p><p className="mt-2 text-2xl font-black text-white">{value}</p><p className="mt-2 text-xs leading-5 text-white/45">{detail}</p></div>
}

function StatusPill({ status }: { status: ProviderDisplayStatus }) {
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-black capitalize ${statusClasses(status)}`}>{status === 'stale' ? 'Stale / unknown' : status}</span>
}

function UsageBars({ rows }: { rows: UsageSeriesRow[] }) {
  const max = Math.max(1, ...rows.map(row => row.requests))
  return <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"><h2 className="text-lg font-black text-white">Daily requests</h2><div className="mt-4 space-y-4">{rows.map(row => <div key={row.day}><div className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3"><span className="text-xs text-white/50">{row.day?.slice(5)}</span><div className="h-3 overflow-hidden rounded-full bg-white/[0.06]" role="img" aria-label={`${row.day}: ${row.requests} requests`}><div className="h-full rounded-full bg-gradient-to-r from-brand-accent to-amber-300" style={{ width: `${Math.max(3, row.requests / max * 100)}%` }} /></div><span className="text-right text-xs font-black text-white">{row.requests}</span></div><p className="ml-[6.25rem] mt-1 text-[11px] leading-4 text-white/35">{row.succeeded} succeeded · {row.failed} failed · {row.denied} denied · {aggregateActivity(row)} · {aggregateCost(row)} · {row.avg_latency_ms == null ? 'unknown latency' : `${decimal.format(row.avg_latency_ms)} ms avg latency`}</p></div>)}</div></section>
}

function CurrencyPanel({ data }: { data: AiUsageAggregates }) {
  return <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"><h2 className="text-lg font-black text-white">Cost by provider currency</h2><p className="mt-1 text-xs text-white/45">Original estimated currency is preserved. ZAR is shown separately using each route snapshot FX rate.</p><div className="mt-4 space-y-3">{data.currency_costs.length ? data.currency_costs.map(row => <div key={row.currency} className="flex items-center justify-between gap-4 rounded-xl bg-black/20 px-4 py-3"><div><p className="font-black text-white">{aggregateValue(row.provider_cost_micros, row.unknown_cost_attempts, known => providerMoney(known, row.currency))}</p><p className="text-xs text-white/40">{row.priced_attempts === row.attempts ? `Complete pricing coverage for ${number.format(row.attempts)} attempts` : `Partial pricing coverage: ${number.format(row.priced_attempts)} of ${number.format(row.attempts)} attempts · ${number.format(row.unknown_cost_attempts)} unknown`}</p></div><p className="font-bold text-brand-accent">{aggregateValue(row.zar_cost_micros, row.unknown_cost_attempts, known => zar(known))}</p></div>) : <p className="text-sm text-white/45">No known provider-currency costs for this month. Unknown costs are not converted to zero.</p>}</div></section>
}

function BudgetInput({ label, value, onChange, min = '0', max }: { label: string; value: string; onChange: (value: string) => void; min?: string; max?: string }) {
  return <label className="text-sm font-bold text-white/70">{label}<input required type="number" step="0.01" min={min} max={max} value={value} onChange={event => onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-white/10 bg-black/20 px-3 text-white focus:border-brand-accent focus:outline-none" /></label>
}

function DataTable({ title, columns, rows }: { title: string; columns: string[]; rows: Array<Array<string | number>> }) {
  return <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"><h2 className="text-lg font-black text-white">{title}</h2><div className="mt-4 overflow-x-auto rounded-xl border border-white/8"><table className="min-w-[640px] w-full text-left text-sm"><caption className="sr-only">{title}</caption><thead className="bg-black/25 text-[11px] uppercase tracking-wider text-white/40"><tr>{columns.map(column => <th key={column} scope="col" className="px-3 py-3">{column}</th>)}</tr></thead><tbody className="divide-y divide-white/5">{rows.length ? rows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => cellIndex === 0 ? <th key={columns[cellIndex]} scope="row" className="px-3 py-3 font-semibold text-white">{typeof cell === 'number' ? number.format(cell) : cell}</th> : <td key={columns[cellIndex]} className="px-3 py-3 text-white/60">{typeof cell === 'number' ? number.format(cell) : cell}</td>)}</tr>) : <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-white/40">No live rows for this month.</td></tr>}</tbody></table></div></section>
}
