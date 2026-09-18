import { useEffect, useMemo, useState } from 'react'
import {
  listClientPortalAccess,
  provisionClientPortalAccess,
  resetClientPortalAccess,
  setClientPortalAccessEnabled,
  type ClientPortalAccessRow,
  type ClientPortalAccessReceipt,
} from '../../lib/clientPortalAccess'

function message(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export default function ClientAccessAdmin() {
  const [rows, setRows] = useState<ClientPortalAccessRow[]>([])
  const [usernames, setUsernames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState<(ClientPortalAccessReceipt & { client_name: string }) | null>(null)
  const [query, setQuery] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    const result = await listClientPortalAccess()
    if (result.error) {
      setError(result.error.message)
      setLoading(false)
      return
    }
    setRows(result.data)
    setUsernames(Object.fromEntries(result.data.map(row => [
      row.client_id,
      row.username ?? row.proposed_username,
    ])))
    setLoading(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(row =>
      row.client_name.toLowerCase().includes(needle) ||
      (row.username ?? row.proposed_username).toLowerCase().includes(needle)
    )
  }, [query, rows])

  async function provision(row: ClientPortalAccessRow) {
    setBusyId(row.client_id)
    setError(null)
    setLastAction(null)
    try {
      const result = await provisionClientPortalAccess(row.client_id, usernames[row.client_id] ?? row.proposed_username)
      if (result.error || !result.data) throw result.error ?? new Error('Could not provision client access.')
      setLastAction({ ...result.data, client_name: row.client_name })
      await load()
    } catch (error) {
      setError(message(error, 'Could not provision client access.'))
    } finally {
      setBusyId(null)
    }
  }

  async function reset(row: ClientPortalAccessRow) {
    setBusyId(row.client_id)
    setError(null)
    setLastAction(null)
    try {
      const result = await resetClientPortalAccess(row.client_id)
      if (result.error || !result.data) throw result.error ?? new Error('Could not reset client access.')
      setLastAction({ ...result.data, client_name: row.client_name })
      await load()
    } catch (error) {
      setError(message(error, 'Could not reset client access.'))
    } finally {
      setBusyId(null)
    }
  }

  async function toggle(row: ClientPortalAccessRow) {
    setBusyId(row.client_id)
    setError(null)
    try {
      const result = await setClientPortalAccessEnabled(row.client_id, !row.enabled)
      if (result.error) throw result.error
      await load()
    } catch (error) {
      setError(message(error, 'Could not change client access.'))
    } finally {
      setBusyId(null)
    }
  }

  async function copyCredentials() {
    if (!lastAction) return
    // CA-approved Phase 1 convention. Keep the password out of rendered DOM and API responses.
    const password = `${lastAction.username}_cgimport { useEffect, useMemo, useState } from 'react'
import {
  listClientPortalAccess,
  provisionClientPortalAccess,
  resetClientPortalAccess,
  setClientPortalAccessEnabled,
  type ClientPortalAccessRow,
  type ClientPortalAccessReceipt,
} from '../../lib/clientPortalAccess'

function message(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export default function ClientAccessAdmin() {
  const [rows, setRows] = useState<ClientPortalAccessRow[]>([])
  const [usernames, setUsernames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState<(ClientPortalAccessReceipt & { client_name: string }) | null>(null)
  const [query, setQuery] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    const result = await listClientPortalAccess()
    if (result.error) {
      setError(result.error.message)
      setLoading(false)
      return
    }
    setRows(result.data)
    setUsernames(Object.fromEntries(result.data.map(row => [
      row.client_id,
      row.username ?? row.proposed_username,
    ])))
    setLoading(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(row =>
      row.client_name.toLowerCase().includes(needle) ||
      (row.username ?? row.proposed_username).toLowerCase().includes(needle)
    )
  }, [query, rows])

  async function provision(row: ClientPortalAccessRow) {
    setBusyId(row.client_id)
    setError(null)
    setLastAction(null)
    try {
      const result = await provisionClientPortalAccess(row.client_id, usernames[row.client_id] ?? row.proposed_username)
      if (result.error || !result.data) throw result.error ?? new Error('Could not provision client access.')
      setLastAction({ ...result.data, client_name: row.client_name })
      await load()
    } catch (error) {
      setError(message(error, 'Could not provision client access.'))
    } finally {
      setBusyId(null)
    }
  }

  async function reset(row: ClientPortalAccessRow) {
    setBusyId(row.client_id)
    setError(null)
    setLastAction(null)
    try {
      const result = await resetClientPortalAccess(row.client_id)
      if (result.error || !result.data) throw result.error ?? new Error('Could not reset client access.')
      setLastAction({ ...result.data, client_name: row.client_name })
      await load()
    } catch (error) {
      setError(message(error, 'Could not reset client access.'))
    } finally {
      setBusyId(null)
    }
  }

  async function toggle(row: ClientPortalAccessRow) {
    setBusyId(row.client_id)
    setError(null)
    try {
      const result = await setClientPortalAccessEnabled(row.client_id, !row.enabled)
      if (result.error) throw result.error
      await load()
    } catch (error) {
      setError(message(error, 'Could not change client access.'))
    } finally {
      setBusyId(null)
    }
  }


    const text = `CG Dynamics\nUsername: ${lastAction.username}\nPassword: ${password}\nLogin: https://www.cgdynamics.co.za/login`
    await navigator.clipboard.writeText(text)
  }

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Client access</h2>
          <p className="mt-1 max-w-2xl text-sm text-brand-primary">
            Provision the shared client portal login for current active-package clients. Existing client users are preserved.
          </p>
        </div>
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search clients"
          className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3.5 py-2.5 text-sm text-white placeholder:text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent sm:max-w-xs"
        />
      </div>

      {lastAction && (
        <div className="mb-5 rounded-xl border border-brand-accent/30 bg-brand-accent/10 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-accent">Client access ready</p>
          <p className="mt-2 text-sm font-semibold text-white">{lastAction.client_name}</p>
          <p className="mt-2 text-sm text-brand-primary">
            Username: <strong className="text-white">{lastAction.username}</strong>
          </p>
          <button
            type="button"
            onClick={() => void copyCredentials()}
            className="mt-3 rounded-lg bg-brand-accent px-3 py-2 text-xs font-bold text-black transition hover:brightness-110"
          >
            Copy login details
          </button>
          <p className="mt-2 text-xs text-brand-primary/70">
            Starter password is not rendered or returned by the provisioning action. It is generated only when an admin deliberately copies login details.
          </p>
        </div>
      )}

      {error && (
        <p className="mb-5 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {loading ? (
        <p className="py-8 text-sm text-brand-primary">Loading client access…</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-brand-muted bg-brand-surface">
          <div className="hidden grid-cols-[minmax(13rem,1.3fr)_minmax(12rem,1fr)_7rem_12rem] gap-3 border-b border-brand-muted px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-brand-primary md:grid">
            <span>Client</span>
            <span>Username</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>

          {filtered.map(row => {
            const busy = busyId === row.client_id
            return (
              <div key={row.client_id} className="grid gap-3 border-b border-brand-muted px-4 py-4 last:border-0 md:grid-cols-[minmax(13rem,1.3fr)_minmax(12rem,1fr)_7rem_12rem] md:items-center">
                <div>
                  <p className="font-semibold text-white">{row.client_name}</p>
                  <p className="mt-0.5 text-xs text-brand-primary">
                    {row.existing_client_users > 0
                      ? `${row.existing_client_users} existing client user${row.existing_client_users === 1 ? '' : 's'} preserved`
                      : 'No existing client user'}
                  </p>
                </div>

                <input
                  value={usernames[row.client_id] ?? row.proposed_username}
                  onChange={event => setUsernames(current => ({ ...current, [row.client_id]: event.target.value }))}
                  disabled={busy}
                  autoCapitalize="none"
                  spellCheck={false}
                  className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent disabled:opacity-60"
                />

                <div>
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                    row.provisioned && row.enabled
                      ? 'bg-emerald-400/10 text-emerald-300'
                      : row.provisioned
                        ? 'bg-amber-400/10 text-amber-300'
                        : 'bg-white/5 text-brand-primary'
                  }`}>
                    {row.provisioned ? (row.enabled ? 'Active' : 'Disabled') : 'Not set up'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 md:justify-end">
                  {!row.provisioned ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void provision(row)}
                      className="rounded-lg bg-brand-accent px-3 py-2 text-xs font-bold text-black transition hover:brightness-110 disabled:opacity-50"
                    >
                      {busy ? 'Setting up…' : 'Provision'}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void provision(row)}
                        className="rounded-lg border border-brand-muted px-3 py-2 text-xs font-semibold text-brand-primary transition hover:border-brand-accent/40 hover:text-white disabled:opacity-50"
                      >
                        Save username
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void reset(row)}
                        className="rounded-lg border border-brand-muted px-3 py-2 text-xs font-semibold text-brand-primary transition hover:border-brand-accent/40 hover:text-white disabled:opacity-50"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggle(row)}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                          row.enabled
                            ? 'border-red-400/20 text-red-300 hover:bg-red-400/10'
                            : 'border-emerald-400/20 text-emerald-300 hover:bg-emerald-400/10'
                        }`}
                      >
                        {row.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-brand-primary">No matching active-package clients.</p>
          )}
        </div>
      )}
    </div>
  )
}
