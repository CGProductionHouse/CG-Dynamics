import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ClientPicker } from '../../components/ClientPicker'
import { GuidedStrategyEditor, type StrategyContext } from '../../components/strategy/GuidedStrategy'
import { StatusBadge } from '../../components/ui/Badges'
import { ActionButton } from '../../components/ui/Buttons'
import { useAuth } from '../../contexts/AuthContext'
import { getMonthEvents } from '../../lib/contentCalendar'
import { getClient, readPackageSettings, type Client } from '../../lib/db/clients'
import {
  DEFAULT_OPTIONS,
  listStrategyOptions,
  type StrategyCategory,
  type StrategyOption,
} from '../../lib/db/strategyOptions'
import {
  amendMonthlyStrategy,
  getMonthlyStrategy,
  seedMonthlyStrategy,
  transitionMonthlyStrategy,
  type MonthlyClientStrategy,
  type MonthlyStrategyStatus,
} from '../../lib/monthlyStrategy'
import { monthDisplayLabel } from '../../lib/reportPeriod'
import { emptyStrategyData, readStrategyData, type StrategyData } from '../../lib/strategyEngine'

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function statusVariant(status: MonthlyStrategyStatus) {
  if (status === 'published') return 'published' as const
  if (status === 'approved') return 'ready-to-publish' as const
  return 'internal-draft' as const
}

function statusLabel(status: MonthlyStrategyStatus) {
  if (status === 'published') return 'Published to client'
  if (status === 'approved') return 'Approved · ready to publish'
  return 'Internal draft'
}

export default function MonthlyStrategyPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedMonth = searchParams.get('month')
  const month = requestedMonth && MONTH_PATTERN.test(requestedMonth) ? requestedMonth : currentMonth()
  const clientId = searchParams.get('client') ?? ''

  const [client, setClient] = useState<Client | null>(null)
  const [strategy, setStrategy] = useState<MonthlyClientStrategy | null>(null)
  const [draftData, setDraftData] = useState<StrategyData>(emptyStrategyData)
  const [internalNotes, setInternalNotes] = useState('')
  const [optionsByCategory, setOptionsByCategory] = useState<Record<StrategyCategory, StrategyOption[]>>(DEFAULT_OPTIONS)
  const [usingDefaults, setUsingDefaults] = useState(true)
  const [loadedScope, setLoadedScope] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const scopeKey = clientId ? `${clientId}:${month}:${reloadKey}` : ''
  const loading = Boolean(clientId && loadedScope !== scopeKey)

  useEffect(() => {
    if (requestedMonth === month) return
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      next.set('month', month)
      return next
    }, { replace: true })
  }, [month, requestedMonth, setSearchParams])

  useEffect(() => {
    void reloadOptions()
  }, [])

  useEffect(() => {
    let active = true
    if (!clientId) {
      return () => { active = false }
    }

    Promise.all([getClient(clientId), getMonthlyStrategy(clientId, month)])
      .then(([clientResult, strategyResult]) => {
        if (!active) return
        if (clientResult.error || !clientResult.data || strategyResult.error) {
          throw new Error('Could not load the exact client-month strategy.')
        }
        setClient(clientResult.data)
        setStrategy(strategyResult.data)
        setDraftData(strategyResult.data ? readStrategyData(strategyResult.data.strategy_data) : emptyStrategyData())
        setInternalNotes(strategyResult.data?.internal_notes ?? '')
      })
      .catch(loadError => {
        if (!active) return
        setClient(null)
        setStrategy(null)
        setDraftData(emptyStrategyData())
        setInternalNotes('')
        setError(loadError instanceof Error ? loadError.message : 'Could not load strategy.')
      })
      .finally(() => {
        if (active) setLoadedScope(scopeKey)
      })
    return () => { active = false }
  }, [clientId, month, scopeKey])

  async function reloadOptions() {
    const result = await listStrategyOptions()
    setOptionsByCategory(result.byCategory)
    setUsingDefaults(result.usingDefaults)
  }

  function updateScope(nextClientId: string, nextMonth = month) {
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      next.set('month', nextMonth)
      if (nextClientId) next.set('client', nextClientId)
      else next.delete('client')
      return next
    })
    setSuccess(null)
    setError(null)
  }

  async function runAction(label: string, action: () => Promise<{ error: { message: string } | null }>, successMessage: string) {
    setBusy(label)
    setError(null)
    setSuccess(null)
    try {
      const result = await action()
      if (result.error) throw new Error(result.error.message)
      setSuccess(successMessage)
      setReloadKey(value => value + 1)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'The strategy action could not be completed.')
    } finally {
      setBusy(null)
    }
  }

  const context = useMemo<StrategyContext>(() => ({
    clientName: client?.name ?? 'Client',
    packageSettings: readPackageSettings(client?.package_settings),
    calendarEvents: getMonthEvents(month),
    topPost: null,
  }), [client, month])

  const dirty = useMemo(() => strategy !== null && (
    JSON.stringify(draftData) !== JSON.stringify(readStrategyData(strategy.strategy_data))
    || internalNotes !== (strategy.internal_notes ?? '')
  ), [draftData, internalNotes, strategy])

  const coverage = strategy ? Object.entries(strategy.seed_context.source_coverage) : []
  const isAdmin = profile?.role === 'admin'

  return (
    <div className="w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[radial-gradient(circle_at_8%_0%,rgba(45,212,191,0.14),transparent_32%),radial-gradient(circle_at_92%_10%,rgba(249,115,22,0.1),transparent_28%),linear-gradient(145deg,rgba(10,27,24,0.96),rgba(5,12,11,0.94))] px-5 py-7 sm:px-8 sm:py-9">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-teal">Canonical monthly strategy</p>
        <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-[-0.035em] text-white sm:text-5xl">Review the month before clients see it.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-primary sm:text-base">
              Prepare one exact client-month draft from approved Dynamics intelligence, amend it here, then approve and publish it explicitly.
            </p>
          </div>
          {strategy && <StatusBadge label={statusLabel(strategy.workflow_status)} variant={statusVariant(strategy.workflow_status)} size="md" />}
        </div>
      </section>

      <section className="mt-6 grid gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 sm:grid-cols-[minmax(0,1fr)_12rem] sm:p-5">
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-brand-primary">Exact client</span>
          <ClientPicker
            value={clientId || null}
            label={client?.name ?? ''}
            onChange={selected => updateScope(selected?.id ?? '')}
            placeholder="Choose an active client"
            showAllOnFocus
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-brand-primary">Strategy month</span>
          <input
            type="month"
            value={month}
            onChange={event => updateScope(clientId, event.target.value)}
            className="min-h-11 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
          />
        </label>
      </section>

      {error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      {success && <p className="mt-4 rounded-xl border border-brand-teal/25 bg-brand-teal/10 px-4 py-3 text-sm text-[#66d0c3]">{success}</p>}

      {!clientId ? (
        <section className="mt-6 rounded-3xl border border-dashed border-white/10 bg-white/[0.025] px-6 py-12 text-center">
          <h2 className="text-xl font-bold text-white">Choose a client to begin</h2>
          <p className="mt-2 text-sm text-brand-primary">No strategy is read or written until an exact client and month are selected.</p>
        </section>
      ) : loading ? (
        <section className="mt-6 rounded-3xl border border-white/[0.08] bg-white/[0.035] px-6 py-10 text-sm text-brand-primary">Loading {monthDisplayLabel(month)} strategy…</section>
      ) : !strategy ? (
        <section className="mt-6 overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.09),transparent_38%),rgba(255,255,255,0.035)] p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-teal">No draft yet</p>
          <h2 className="mt-3 text-2xl font-black text-white">Prepare {client?.name ?? 'this client'}’s {monthDisplayLabel(month)} baseline</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-brand-primary">
            This explicit action reuses the idempotent #391 seed. It considers prior strategy evidence, the recorded package and deliverables, exact-client events, approved context and client intelligence, plus the canonical South African content calendar. It never publishes or overwrites an existing draft.
          </p>
          <ActionButton
            className="mt-6"
            loading={busy === 'seed'}
            onClick={() => void runAction('seed', () => seedMonthlyStrategy({ clientId, month, actorProfileId: profile?.id, idempotencyKey: crypto.randomUUID() }), 'Draft prepared for staff review.')}
          >
            Prepare draft
          </ActionButton>
        </section>
      ) : (
        <>
          <section className="mt-6 rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5 sm:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-teal">Seed evidence</p>
                <p className="mt-2 text-sm leading-6 text-brand-primary">The baseline is provenance-backed. “None” remains missing context, never an invented fact.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {coverage.map(([source, state]) => (
                    <span key={source} className={`rounded-full border px-3 py-1 text-xs ${state === 'available' ? 'border-brand-teal/25 bg-brand-teal/10 text-[#66d0c3]' : 'border-white/10 bg-white/[0.04] text-brand-primary'}`}>
                      {source.replaceAll('_', ' ')} · {state}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-xs leading-5 text-brand-primary/70 lg:text-right">
                <p>Version {strategy.version}</p>
                <p>{strategy.published_at ? `Last published ${new Date(strategy.published_at).toLocaleString('en-ZA')}` : 'Not published'}</p>
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-white/[0.08] bg-brand-surface p-4 sm:p-6">
            <GuidedStrategyEditor
              data={draftData}
              onChange={setDraftData}
              context={context}
              optionsByCategory={optionsByCategory}
              usingDefaults={usingDefaults}
              isAdmin={isAdmin}
              onReloadOptions={() => void reloadOptions()}
            />

            <label className="mt-6 block border-t border-white/[0.08] pt-6">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-brand-primary">Internal review notes</span>
              <textarea
                value={internalNotes}
                onChange={event => setInternalNotes(event.target.value)}
                rows={4}
                placeholder="Internal only. Never included in the client projection."
                className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white placeholder:text-brand-primary/40 focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
            </label>
          </section>

          <section className="sticky bottom-3 z-20 mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#07100f]/95 p-4 shadow-2xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-brand-primary">
              {dirty ? 'Unsaved staff amendments. Save before approval.' : strategy.workflow_status === 'published' ? 'The published client snapshot is live.' : 'All changes saved.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <ActionButton
                variant="secondary"
                loading={busy === 'save'}
                disabled={!dirty}
                onClick={() => void runAction('save', () => amendMonthlyStrategy({ clientId, month, expectedVersion: strategy.version, strategyData: draftData, internalNotes, actorProfileId: profile?.id, idempotencyKey: crypto.randomUUID() }), 'Draft amendments saved.')}
              >
                Save draft
              </ActionButton>
              {strategy.workflow_status === 'draft' && (
                <ActionButton
                  variant="outline"
                  loading={busy === 'approve'}
                  disabled={dirty}
                  onClick={() => void runAction('approve', () => transitionMonthlyStrategy({ clientId, month, expectedVersion: strategy.version, targetStatus: 'approved', actorProfileId: profile?.id, idempotencyKey: crypto.randomUUID() }), 'Strategy approved. It is not client-visible until published.')}
                >
                  Approve strategy
                </ActionButton>
              )}
              {strategy.workflow_status === 'approved' && (
                <ActionButton
                  loading={busy === 'publish'}
                  onClick={() => {
                    if (!window.confirm(`Publish ${client?.name ?? 'this client'}’s ${monthDisplayLabel(month)} strategy to the client portal?`)) return
                    void runAction('publish', () => transitionMonthlyStrategy({ clientId, month, expectedVersion: strategy.version, targetStatus: 'published', actorProfileId: profile?.id, idempotencyKey: crypto.randomUUID() }), 'Strategy published to the exact client-month portal view.')
                  }}
                >
                  Publish to client
                </ActionButton>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
