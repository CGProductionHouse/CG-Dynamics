import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Pill } from '../../components/ui/Badges'
import { ActionButton } from '../../components/ui/Buttons'
import { PremiumCard, PremiumCardHeader } from '../../components/ui/PremiumCard'
import { EmptyState, LoadingState } from '../../components/ui/States'
import { listClients, type Client } from '../../lib/db/clients'
import {
  deactivateGoogleAdsCampaignLink,
  deactivateGoogleAdsDedicatedLink,
  deriveGoogleAdsCampaignReview,
  formatGoogleAdsCustomerId,
  getGoogleAdsWorkspace,
  isGoogleAdsAccountReady,
  listGoogleAdsCampaigns,
  monthDateRange,
  saveGoogleAdsCampaignMappings,
  saveGoogleAdsDedicatedLink,
  setGoogleAdsAccountMode,
  syncGoogleAds,
  validateGoogleAdsModeCoexistence,
  type GoogleAdsAccount,
  type GoogleAdsAccountMode,
  type GoogleAdsCampaign,
  type GoogleAdsNameSuggestion,
  type GoogleAdsSyncResult,
  type GoogleAdsWorkspace,
} from '../../lib/googleAds'

const INPUT_CLASS = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-accent/60 disabled:cursor-not-allowed disabled:opacity-60'

function currentMonth(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Never'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleString()
}

function formatMonth(value: string): string {
  const [year, month] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)))
}

function readyAccountSelection(readyIds: Set<string>, current: Set<string>): Set<string> {
  const valid = new Set([...current].filter(accountId => readyIds.has(accountId)))
  if (valid.size === 0 && readyIds.size === 1) return new Set(readyIds)
  return valid
}

function relevantClients(allClients: Client[], googleWorkspace: GoogleAdsWorkspace): Client[] {
  const mappedClientIds = new Set([
    ...googleWorkspace.accountLinks.filter(link => link.active).map(link => link.clientId),
    ...googleWorkspace.campaignLinks.filter(link => link.active).map(link => link.clientId),
  ])
  return allClients.filter(client => client.active || mappedClientIds.has(client.id))
}

export default function GoogleAdsIntegrationPage() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [workspace, setWorkspace] = useState<GoogleAdsWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [syncMonth, setSyncMonth] = useState(currentMonth())
  const [syncAccountIds, setSyncAccountIds] = useState<Set<string>>(new Set())
  const [syncResult, setSyncResult] = useState<{ data: GoogleAdsSyncResult; month: string } | null>(null)

  async function load(silent = false) {
    try {
      const [clientResult, googleWorkspace] = await Promise.all([listClients('all'), getGoogleAdsWorkspace()])
      if (clientResult.error) throw new Error(clientResult.error.message)
      setClients(relevantClients(clientResult.data, googleWorkspace))
      setWorkspace(googleWorkspace)
      const readyIds = new Set(googleWorkspace.accounts.filter(account => isGoogleAdsAccountReady(account, googleWorkspace.accountLinks, googleWorkspace.campaignLinks)).map(account => account.id))
      setSyncAccountIds(current => readyAccountSelection(readyIds, current))
    } catch (loadError) {
      setError(messageFrom(loadError, 'Could not load Google Ads setup.'))
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([listClients('all'), getGoogleAdsWorkspace()])
      .then(([clientResult, googleWorkspace]) => {
        if (!active) return
        if (clientResult.error) throw new Error(clientResult.error.message)
        setClients(relevantClients(clientResult.data, googleWorkspace))
        setWorkspace(googleWorkspace)
        const readyIds = new Set(googleWorkspace.accounts.filter(account => isGoogleAdsAccountReady(account, googleWorkspace.accountLinks, googleWorkspace.campaignLinks)).map(account => account.id))
        setSyncAccountIds(readyAccountSelection(readyIds, new Set()))
      })
      .catch(loadError => {
        if (active) setError(messageFrom(loadError, 'Could not load Google Ads setup.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  async function runAction(key: string, task: () => Promise<string | void>) {
    setBusy(key)
    setError(null)
    setNotice(null)
    try {
      const message = await task()
      if (message) setNotice(message)
    } catch (actionError) {
      setError(messageFrom(actionError, 'Google Ads request failed.'))
    } finally {
      setBusy(null)
    }
  }

  function changeMode(account: GoogleAdsAccount, mode: GoogleAdsAccountMode) {
    if (mode === account.mode) return
    const dedicatedLinks = workspace?.accountLinks.filter(link => link.accountId === account.id) ?? []
    const campaignLinks = workspace?.campaignLinks.filter(link => link.accountId === account.id) ?? []
    const policyError = validateGoogleAdsModeCoexistence(mode, dedicatedLinks, campaignLinks)
    if (policyError) {
      setError(policyError)
      return
    }
    const warning = account.mode
      ? `Change ${account.name} from ${account.mode} to ${mode} mode? Existing mappings must be deactivated first.`
      : `Set ${account.name} to ${mode} mode?`
    if (!window.confirm(warning)) return
    void runAction(`mode:${account.id}`, async () => {
      await setGoogleAdsAccountMode(account.id, mode, account.mode !== null)
      await load(true)
      return `${account.name} is now in ${mode} mode.`
    })
  }

  function runSync() {
    void runAction('sync', async () => {
      const range = monthDateRange(syncMonth)
      const today = new Date().toISOString().slice(0, 10)
      const result = await syncGoogleAds({
        accountIds: [...syncAccountIds],
        startDate: range.startDate,
        endDate: range.endDate > today ? today : range.endDate,
      })
      setSyncResult({ data: result, month: syncMonth })
      await load(true)
      return result.ok ? 'Google Ads sync completed.' : 'Sync completed with errors.'
    })
  }

  if (loading) return <LoadingState message="Loading Google Ads integration..." className="min-h-[55vh]" />

  const clientNames = new Map(clients.map(client => [client.id, client.name]))
  const readyAccounts = workspace?.accounts.filter(account => isGoogleAdsAccountReady(account, workspace.accountLinks, workspace.campaignLinks)) ?? []

  return (
    <div className="w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-accent">Integrations</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Google Ads data sync</h1>
          <p className="mt-1 max-w-3xl text-sm text-brand-primary">Use dedicated mode for one client account, or shared mode to map individual campaigns. Suggestions never save automatically.</p>
        </div>
        <ActionButton variant="ghost" onClick={() => navigate('/admin/integrations')}>Back to integrations</ActionButton>
      </div>

      {error && <Message tone="error">{error}</Message>}
      {notice && <Message tone="success">{notice}</Message>}

      <div className="mt-6 space-y-6">
        <PremiumCard>
          <PremiumCardHeader eyebrow="Canonical accounts" title="Choose how each account is used" subtitle="Mode changes require confirmation. Dedicated and campaign mappings cannot coexist on the same account." action={<ActionButton variant="outline" loading={busy === 'refresh'} onClick={() => void runAction('refresh', async () => { await load(true); return 'Accounts refreshed.' })}>Refresh</ActionButton>} />
          {workspace?.accounts.length ? (
            <div className="space-y-4">
              {workspace.accounts.map(account => (
                <AccountCard
                  key={`${account.id}:${account.mode ?? 'unset'}:${workspace.accountLinks.find(link => link.accountId === account.id && link.active)?.clientId ?? 'none'}:${workspace.campaignLinks.filter(link => link.accountId === account.id && link.active).length}`}
                  account={account}
                  workspace={workspace}
                  clients={clients}
                  busy={busy}
                  clientNames={clientNames}
                  onModeChange={mode => changeMode(account, mode)}
                  onRunAction={runAction}
                  onReload={() => load(true)}
                />
              ))}
            </div>
          ) : <EmptyState title="No accounts discovered" message="The account list returned no canonical non-manager Google Ads accounts." />}
        </PremiumCard>

        <PremiumCard>
          <PremiumCardHeader eyebrow="Sync" title="Sync selected accounts once" subtitle="One request syncs the selected canonical accounts and reports mapped and unmapped campaign counts." />
          <div className="grid gap-4 md:grid-cols-[220px_1fr_auto] md:items-end">
            <Field label="Month"><input className={INPUT_CLASS} type="month" max={currentMonth()} value={syncMonth} onChange={event => setSyncMonth(event.target.value)} /></Field>
            <fieldset>
              <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-brand-primary">Accounts</legend>
              <div className="flex flex-wrap gap-2">
                {readyAccounts.map(account => (
                  <label key={account.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white">
                    <input type="checkbox" checked={syncAccountIds.has(account.id)} onChange={() => setSyncAccountIds(current => { const next = new Set(current); if (next.has(account.id)) next.delete(account.id); else next.add(account.id); return next })} />
                    {account.name}
                  </label>
                ))}
                {readyAccounts.length === 0 && <p className="text-sm text-brand-primary">Create at least one active dedicated or campaign mapping before syncing.</p>}
              </div>
            </fieldset>
            <ActionButton loading={busy === 'sync'} disabled={syncAccountIds.size === 0} onClick={runSync}>Run sync</ActionButton>
          </div>
          {syncResult && <div className="mt-5 space-y-2" aria-live="polite">{syncResult.data.results.map((item, index) => {
             const account = workspace?.accounts.find(candidate => candidate.id === item.accountId)
             const affectedClientIds = new Set([
               ...(workspace?.accountLinks.filter(link => link.active && link.accountId === item.accountId).map(link => link.clientId) ?? []),
               ...(workspace?.campaignLinks.filter(link => link.active && link.accountId === item.accountId).map(link => link.clientId) ?? []),
             ])
             const affectedClients = clients.filter(client => affectedClientIds.has(client.id))
              return <div key={`${item.accountId ?? 'sync'}:${index}`} className="rounded-lg border border-white/8 bg-black/20 px-4 py-3 text-sm"><div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between"><span className="font-medium text-white">{account?.name ?? 'Google Ads account'}</span><div className="flex flex-wrap gap-x-5 gap-y-1 text-brand-primary"><span>{affectedClientIds.size} mapped client{affectedClientIds.size === 1 ? '' : 's'}</span><span>{item.mappedCampaigns} mapped / {item.unmappedCampaigns} unmapped campaigns</span><span>{item.rowsWritten} rows imported</span></div><span className={item.ok ? 'text-brand-teal' : 'text-red-300'}>{item.message}</span></div>{affectedClients.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3"><span className="text-xs uppercase tracking-wide text-brand-primary">{formatMonth(syncResult.month)} dashboards</span>{affectedClients.map(client => <Link key={client.id} to={`/admin/client-dashboard?client=${encodeURIComponent(client.id)}&month=${encodeURIComponent(syncResult.month)}`} className="rounded-md border border-brand-accent/25 bg-brand-accent/10 px-2.5 py-1.5 text-xs font-semibold text-brand-accent hover:bg-brand-accent/20">{client.name}</Link>)}</div>}</div>
           })}</div>}
        </PremiumCard>
      </div>
    </div>
  )
}

function AccountCard({ account, workspace, clients, busy, clientNames, onModeChange, onRunAction, onReload }: {
  account: GoogleAdsAccount
  workspace: GoogleAdsWorkspace
  clients: Client[]
  busy: string | null
  clientNames: Map<string, string>
  onModeChange: (mode: GoogleAdsAccountMode) => void
  onRunAction: (key: string, task: () => Promise<string | void>) => Promise<void>
  onReload: () => Promise<void>
}) {
  const dedicatedLink = workspace.accountLinks.find(link => link.accountId === account.id && link.active)
  const campaignLinks = workspace.campaignLinks.filter(link => link.accountId === account.id && link.active)
  const lastRun = workspace.runs.find(run => run.accountId === account.id)
  const [dedicatedClientId, setDedicatedClientId] = useState(dedicatedLink?.clientId ?? '')
  const [campaigns, setCampaigns] = useState<GoogleAdsCampaign[] | null>(null)
  const [campaignError, setCampaignError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Record<string, GoogleAdsNameSuggestion>>({})
  const [draftClients, setDraftClients] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkClientId, setBulkClientId] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [channel, setChannel] = useState('all')
  const [mappingFilter, setMappingFilter] = useState<'all' | 'mapped' | 'unmapped'>('all')

  async function discoverCampaigns() {
    setCampaignError(null)
    try {
      const rows = await listGoogleAdsCampaigns(account)
      const review = deriveGoogleAdsCampaignReview(rows, clients, campaignLinks)
      setCampaigns(rows)
      setSuggestions(review.suggestions)
      setDraftClients(review.draftClientIds)
      setSelected(new Set(review.selectedCampaignIds))
    } catch (error) {
      setCampaignError(messageFrom(error, 'Could not discover campaigns.'))
    }
  }

  const visibleCampaigns = (campaigns ?? []).filter(campaign => {
    const link = campaignLinks.find(candidate => candidate.campaignId === campaign.campaignId)
    return (!search.trim() || campaign.name.toLowerCase().includes(search.trim().toLowerCase()))
      && (status === 'all' || campaign.status === status)
      && (channel === 'all' || campaign.channelType === channel)
      && (mappingFilter === 'all' || (mappingFilter === 'mapped' ? Boolean(link) : !link))
  })
  const statuses = [...new Set((campaigns ?? []).map(campaign => campaign.status))].sort()
  const channels = [...new Set((campaigns ?? []).map(campaign => campaign.channelType))].sort()
  const unmappedCount = campaigns ? campaigns.filter(campaign => !campaignLinks.some(link => link.campaignId === campaign.campaignId)).length : null

  function saveDedicated() {
    if (!window.confirm(`Save ${account.name} as a dedicated account for ${clientNames.get(dedicatedClientId) ?? 'the selected client'}?`)) return
    void onRunAction(`dedicated:${account.id}`, async () => {
      await saveGoogleAdsDedicatedLink(account.id, dedicatedClientId)
      await onReload()
      return 'Dedicated client link saved.'
    })
  }

  function saveSelected() {
    const mappings = [...selected].map(campaignId => ({ accountId: account.id, campaignId, clientId: draftClients[campaignId] ?? '' }))
    if (!mappings.length || mappings.some(mapping => !mapping.clientId)) {
      setCampaignError('Select a client for every selected campaign.')
      return
    }
    if (!window.confirm(`Confirm ${mappings.length} selected campaign mapping${mappings.length === 1 ? '' : 's'}?`)) return
    void onRunAction(`campaigns:${account.id}`, async () => {
      await saveGoogleAdsCampaignMappings(account.id, mappings)
      await onReload()
      setCampaigns(null)
      return `${mappings.length} campaign mapping${mappings.length === 1 ? '' : 's'} saved.`
    })
  }

  return (
    <section className="rounded-xl border border-white/10 bg-black/20 p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-white">{account.name}</h3><Pill tone="neutral">{account.currencyCode}</Pill>{account.mode && <Pill tone={account.mode === 'shared' ? 'accent' : 'teal'}>{account.mode}</Pill>}</div><p className="mt-1 text-xs text-brand-primary">{formatGoogleAdsCustomerId(account.customerId)} · {account.timeZone ?? 'Timezone unavailable'} · Last sync {formatDateTime(lastRun?.finishedAt ?? null)}</p></div>
        <Field label="Account mode"><select className={`${INPUT_CLASS} min-w-52`} value={account.mode ?? ''} disabled={busy === `mode:${account.id}`} onChange={event => onModeChange(event.target.value as GoogleAdsAccountMode)}><option value="" disabled>Select mode</option><option value="dedicated">Dedicated client</option><option value="shared">Shared campaigns</option></select></Field>
      </div>

      {!account.mode && <p className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-200">Choose and confirm an account mode before creating mappings.</p>}

      {account.mode === 'dedicated' && <div className="mt-5 rounded-lg border border-white/8 bg-black/20 p-4"><div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end"><Field label="Dedicated client"><ClientSearch clients={clients} value={dedicatedClientId} onChange={setDedicatedClientId} /></Field><ActionButton loading={busy === `dedicated:${account.id}`} disabled={!dedicatedClientId || dedicatedLink?.clientId === dedicatedClientId} onClick={saveDedicated}>Save dedicated client</ActionButton></div>{dedicatedLink && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-brand-primary">Mapped to <strong className="text-white">{clientNames.get(dedicatedLink.clientId) ?? 'Unknown client'}</strong>. No campaign mappings are used in dedicated mode.</span><ActionButton size="sm" variant="danger" loading={busy === `deactivate-dedicated:${account.id}`} onClick={() => { if (!window.confirm('Deactivate this dedicated client link?')) return; void onRunAction(`deactivate-dedicated:${account.id}`, async () => { await deactivateGoogleAdsDedicatedLink(account.id, dedicatedLink.id); await onReload(); return 'Dedicated link deactivated.' }) }}>Deactivate</ActionButton></div>}</div>}

      {account.mode === 'shared' && <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="text-sm text-brand-primary"><strong className="text-white">{campaignLinks.length}</strong> mapped{unmappedCount !== null && <> · <strong className="text-white">{unmappedCount}</strong> unmapped</>}</div><ActionButton variant="secondary" loading={busy === `discover:${account.id}`} onClick={() => void onRunAction(`discover:${account.id}`, async () => { await discoverCampaigns() })}>{campaigns ? 'Refresh campaigns' : 'Discover campaigns'}</ActionButton></div>
        {campaignError && <Message tone="error">{campaignError}</Message>}
        {campaigns && <>
          <p className="mt-3 text-xs text-brand-primary">Paused and removed campaigns remain selectable so historical reporting mappings can be maintained.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><input className={INPUT_CLASS} placeholder="Search campaigns" value={search} onChange={event => setSearch(event.target.value)} /><select className={INPUT_CLASS} value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{statuses.map(value => <option key={value}>{value}</option>)}</select><select className={INPUT_CLASS} value={channel} onChange={event => setChannel(event.target.value)}><option value="all">All channels</option>{channels.map(value => <option key={value}>{value}</option>)}</select><select className={INPUT_CLASS} value={mappingFilter} onChange={event => setMappingFilter(event.target.value as typeof mappingFilter)}><option value="all">Mapped and unmapped</option><option value="mapped">Mapped</option><option value="unmapped">Unmapped</option></select></div>
          <div className="mt-3 flex flex-col gap-3 rounded-lg border border-white/8 bg-black/20 p-3 sm:flex-row sm:items-end"><div className="flex-1"><Field label="Assign selected to client"><ClientSearch clients={clients} value={bulkClientId} onChange={setBulkClientId} /></Field></div><ActionButton variant="outline" disabled={!bulkClientId || selected.size === 0} onClick={() => setDraftClients(current => { const next = { ...current }; for (const id of selected) next[id] = bulkClientId; return next })}>Apply to selection</ActionButton><ActionButton disabled={selected.size === 0} loading={busy === `campaigns:${account.id}`} onClick={saveSelected}>Confirm selected mappings</ActionButton></div>
          <div className="mt-3 overflow-x-auto rounded-lg border border-white/8"><table className="min-w-[980px] w-full divide-y divide-white/8 text-left text-sm"><thead className="bg-black/30 text-xs uppercase tracking-wide text-brand-primary"><tr><th className="px-3 py-3">Select</th><th className="px-3 py-3">Campaign</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Channel</th><th className="px-3 py-3">Suggestion</th><th className="px-3 py-3">Client mapping</th><th className="px-3 py-3">Action</th></tr></thead><tbody className="divide-y divide-white/8">{visibleCampaigns.map(campaign => {
            const link = campaignLinks.find(candidate => candidate.campaignId === campaign.campaignId)
            const suggestion = suggestions[campaign.campaignId]
            return <tr key={campaign.campaignId}><td className="px-3 py-3"><input type="checkbox" checked={selected.has(campaign.campaignId)} onChange={() => setSelected(current => { const next = new Set(current); if (next.has(campaign.campaignId)) next.delete(campaign.campaignId); else next.add(campaign.campaignId); return next })} /></td><td className="px-3 py-3"><span className="font-medium text-white">{campaign.name}</span><br /><span className="text-xs text-brand-primary">{campaign.campaignId}</span></td><td className="px-3 py-3"><CampaignStatus status={campaign.status} /></td><td className="px-3 py-3 text-brand-primary">{campaign.channelType}</td><td className="px-3 py-3"><Suggestion suggestion={suggestion} /></td><td className="min-w-60 px-3 py-3">{link && <p className="mb-2 text-xs text-brand-teal">Current mapping: {clientNames.get(link.clientId) ?? 'Unknown client'}</p>}<ClientSearch clients={clients} value={draftClients[campaign.campaignId] ?? ''} onChange={clientId => { setDraftClients(current => ({ ...current, [campaign.campaignId]: clientId })); setSelected(current => new Set(current).add(campaign.campaignId)) }} /></td><td className="px-3 py-3">{link && <ActionButton size="sm" variant="danger" loading={busy === `deactivate-campaign:${link.id}`} onClick={() => { if (!window.confirm(`Deactivate the mapping for ${campaign.name}?`)) return; void onRunAction(`deactivate-campaign:${link.id}`, async () => { await deactivateGoogleAdsCampaignLink(account.id, link.id); await onReload(); setCampaigns(null); return 'Campaign mapping deactivated.' }) }}>Deactivate</ActionButton>}</td></tr>
          })}</tbody></table>{visibleCampaigns.length === 0 && <p className="p-4 text-sm text-brand-primary">No campaigns match these filters.</p>}</div>
        </>}
      </div>}
    </section>
  )
}

function ClientSearch({ clients, value, onChange }: { clients: Client[]; value: string; onChange: (clientId: string) => void }) {
  return <ClientSearchInput key={value} clients={clients} value={value} onChange={onChange} />
}

function ClientSearchInput({ clients, value, onChange }: { clients: Client[]; value: string; onChange: (clientId: string) => void }) {
  const selected = clients.find(client => client.id === value)
  const [query, setQuery] = useState(selected?.name ?? '')
  const [open, setOpen] = useState(false)
  const listId = useId()
  const normalizedQuery = query.trim().toLowerCase()
  const searchTerm = normalizedQuery === selected?.name.toLowerCase() ? '' : normalizedQuery
  const options = clients.filter(client => !searchTerm || client.name.toLowerCase().includes(searchTerm))

  return <div className="relative" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { const exact = clients.find(client => client.name.toLowerCase() === query.trim().toLowerCase()); onChange(exact?.id ?? ''); setQuery(exact?.name ?? ''); setOpen(false) } }}><div className="relative"><input className={`${INPUT_CLASS} pr-16`} role="combobox" aria-autocomplete="list" aria-controls={listId} aria-expanded={open} placeholder="Search clients" value={query} onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); onChange(''); setOpen(true) }} />{(query || value) && <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-brand-primary hover:bg-white/5 hover:text-white" onClick={() => { setQuery(''); onChange(''); setOpen(true) }}>Clear</button>}</div>{open && <div id={listId} role="listbox" className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-white/10 bg-brand-surface p-1 shadow-2xl">{options.map(client => <button key={client.id} type="button" role="option" aria-selected={client.id === value} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-white/5 ${client.id === value ? 'bg-brand-accent/10 text-brand-accent' : 'text-white'}`} onClick={() => { onChange(client.id); setQuery(client.name); setOpen(false) }}><span>{client.name}</span>{!client.active && <span className="ml-3 text-[11px] uppercase tracking-wide text-brand-primary">Mapped · archived</span>}</button>)}{options.length === 0 && <p className="px-3 py-2 text-sm text-brand-primary">No clients match this search.</p>}</div>}<p className="mt-1 text-xs text-brand-primary">{selected ? `Selected: ${selected.name}` : 'No client selected'}</p></div>
}

function Suggestion({ suggestion }: { suggestion: GoogleAdsNameSuggestion | undefined }) {
  if (!suggestion) return <span className="text-brand-primary">None</span>
  const tone = suggestion.confidence === 'high' ? 'text-brand-teal' : suggestion.confidence === 'ambiguous' ? 'text-amber-300' : 'text-brand-primary'
  return <div><p className={tone}>{suggestion.clientName ?? 'No unique match'} · {suggestion.confidence}</p><p className="text-xs text-brand-primary/70">{suggestion.reason}{suggestion.preselected ? ' · selected locally' : ' · not selected'}</p></div>
}

function CampaignStatus({ status }: { status: string }) {
  const historical = status === 'PAUSED' || status === 'REMOVED'
  return <div><Pill tone={historical ? 'amber' : 'teal'}>{status}</Pill>{historical && <p className="mt-1 text-[11px] text-amber-300">Historical · selectable</p>}</div>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-brand-primary">{label}</span>{children}</label>
}

function Message({ tone, children }: { tone: 'error' | 'success' | 'warning'; children: ReactNode }) {
  const styles = tone === 'error' ? 'border-red-400/25 bg-red-400/10 text-red-300' : tone === 'success' ? 'border-brand-teal/25 bg-brand-teal/10 text-brand-teal' : 'border-amber-400/25 bg-amber-400/10 text-amber-300'
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`mt-4 rounded-lg border px-4 py-3 text-sm ${styles}`}>{children}</div>
}
