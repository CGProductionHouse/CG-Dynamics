import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  listClients,
  createClient,
  updateClient,
  type Client,
} from '../../lib/db/clients'

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return fallback
}

function sortClients(clients: Client[]) {
  return [...clients].sort((a, b) => a.name.localeCompare(b.name))
}

function upsertClient(clients: Client[], client: Client) {
  const exists = clients.some(c => c.id === client.id)
  const nextClients = exists
    ? clients.map(c => c.id === client.id ? client : c)
    : [...clients, client]
  return sortClients(nextClients)
}

export default function ClientsList() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<{ open: boolean; client?: Client }>({ open: false })

  useEffect(() => {
    void load()
  }, [])

  async function load(options: { silent?: boolean } = {}): Promise<string | null> {
    if (!options.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const { data, error } = await listClients()
      if (error) {
        const message = error.message
        setError(message)
        return message
      }
      setClients(data)
      setError(null)
      return null
    } catch (error) {
      const message = errorMessage(error, 'Could not load clients.')
      setError(message)
      return message
    } finally {
      if (!options.silent) setLoading(false)
    }
  }

  async function handleSave(
    input: { name: string; tier: 'standard' | 'premium'; active: boolean }
  ): Promise<string | null> {
    try {
      const existing = modal.client
      if (existing) {
        const { data, error } = await updateClient(existing.id, input)
        if (error) return error.message
        if (data) setClients(current => upsertClient(current, data))
      } else {
        const { data, error } = await createClient({
          name: input.name,
          tier: input.tier,
          active: input.active,
        })
        if (error) return error.message
        if (data) setClients(current => upsertClient(current, data))
      }

      void load({ silent: true }).then(refreshError => {
        if (refreshError) {
          setError(`Saved, but could not refresh the clients list: ${refreshError}`)
        }
      })
      return null
    } catch (error) {
      return errorMessage(error, 'Could not save client.')
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Clients</h1>
        {isAdmin && (
          <button
            onClick={() => setModal({ open: true })}
            className="bg-brand-accent text-brand-bg text-sm font-semibold px-4 py-2 rounded-lg hover:brightness-110 transition"
          >
            Add client
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-brand-primary text-sm">Loading...</p>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : (
        <div className="bg-brand-surface border border-brand-muted rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-muted text-left">
                <th className="px-4 py-3 text-brand-primary font-medium">Name</th>
                <th className="px-4 py-3 text-brand-primary font-medium">Tier</th>
                <th className="px-4 py-3 text-brand-primary font-medium">Status</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 4 : 3} className="px-4 py-8 text-center text-brand-primary">
                    No clients yet.
                  </td>
                </tr>
              ) : (
                clients.map(c => (
                  <tr
                    key={c.id}
                    className="border-b border-brand-muted last:border-0 hover:bg-brand-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3 text-white font-medium">{c.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                          c.tier === 'premium'
                            ? 'bg-brand-accent/20 text-brand-accent'
                            : 'bg-brand-muted text-brand-primary'
                        }`}
                      >
                        {c.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${c.active ? 'text-green-400' : 'text-red-400'}`}>
                        {c.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setModal({ open: true, client: c })}
                          className="text-xs text-brand-primary hover:text-brand-accent transition-colors"
                        >
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal.open && (
        <ClientModal
          client={modal.client}
          onSave={handleSave}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  )
}

// ─── Client modal ────────────────────────────────────────────────────────────

function ClientModal({
  client,
  onSave,
  onClose,
}: {
  client?: Client
  onSave: (input: { name: string; tier: 'standard' | 'premium'; active: boolean }) => Promise<string | null>
  onClose: () => void
}) {
  const [name, setName] = useState(client?.name ?? '')
  const [tier, setTier] = useState<'standard' | 'premium'>(client?.tier ?? 'standard')
  const [active, setActive] = useState(client?.active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Client name is required.')
      return
    }

    setSaving(true)
    setError(null)
    let saved = false
    try {
      const err = await onSave({ name: trimmedName, tier, active })
      if (err) {
        setError(err)
        return
      }
      saved = true
      onClose()
    } catch (error) {
      setError(errorMessage(error, 'Could not save client.'))
    } finally {
      if (!saved) setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (!saving && e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-brand-surface border border-brand-muted rounded-2xl p-6 w-full max-w-sm shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <h2 className="text-base font-semibold text-white mb-5">
          {client ? 'Edit client' : 'Add client'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-accent mb-1.5">
              Name
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent transition"
              placeholder="Client name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-accent mb-1.5">
              Tier
            </label>
            <select
              value={tier}
              onChange={e => setTier(e.target.value as 'standard' | 'premium')}
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent transition"
            >
              <option value="standard">Standard (quarterly)</option>
              <option value="premium">Premium (monthly)</option>
            </select>
          </div>

          {client && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={active}
                onChange={e => setActive(e.target.checked)}
                className="w-4 h-4 rounded accent-brand-accent"
              />
              <span className="text-sm text-brand-accent">Active</span>
            </label>
          )}

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 border border-brand-muted text-brand-primary py-2.5 rounded-lg text-sm hover:text-white hover:border-white/30 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-brand-accent text-brand-bg font-semibold py-2.5 rounded-lg text-sm hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
