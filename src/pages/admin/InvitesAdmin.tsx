import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { listClients, type Client } from '../../lib/db/clients'
import {
  createInvite,
  deleteInvite,
  listInvites,
  type ClientInvite,
  type InviteRole,
} from '../../lib/db/invites'

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return fallback
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function InvitesAdmin() {
  const { profile } = useAuth()
  const [invites, setInvites] = useState<ClientInvite[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [clientId, setClientId] = useState('')
  const [role, setRole] = useState<InviteRole>('client')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const clientNameById = useMemo(
    () => new Map(clients.map(client => [client.id, client.name])),
    [clients]
  )

  async function load(options: { silent?: boolean } = {}) {
    if (!options.silent) setLoading(true)
    setError(null)
    try {
      const [invitesRes, clientsRes] = await Promise.all([listInvites(), listClients()])
      const loadError = invitesRes.error ?? clientsRes.error
      if (loadError) {
        setError(loadError.message)
        return
      }
      setInvites(invitesRes.data)
      setClients(clientsRes.data)
      if (!clientId) setClientId(clientsRes.data[0]?.id ?? '')
    } catch (error) {
      setError(errorMessage(error, 'Could not load invites.'))
    } finally {
      if (!options.silent) setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Enter an email address to invite.')
      return
    }
    if (!clientId) {
      setError('Select a client for this invite.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const { error } = await createInvite({
        email: trimmed,
        client_id: clientId,
        role,
        created_by: profile?.id ?? null,
      })
      if (error) {
        const isDuplicate = error.message.toLowerCase().includes('duplicate')
        setError(
          isDuplicate
            ? 'There is already a pending invite for that email.'
            : error.message
        )
        return
      }
      setSuccess(`Invite created for ${trimmed.toLowerCase()}.`)
      setEmail('')
      await load({ silent: true })
    } catch (error) {
      setError(errorMessage(error, 'Could not create invite.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(invite: ClientInvite) {
    const confirmed = window.confirm(`Delete the invite for ${invite.email}?`)
    if (!confirmed) return

    setBusyId(invite.id)
    setError(null)
    setSuccess(null)
    try {
      const { error } = await deleteInvite(invite.id)
      if (error) {
        setError(error.message)
        return
      }
      setSuccess('Invite deleted.')
      await load({ silent: true })
    } catch (error) {
      setError(errorMessage(error, 'Could not delete invite.'))
    } finally {
      setBusyId(null)
    }
  }

  const activeClients = clients.filter(client => client.active)

  return (
    <div className="w-full max-w-4xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Invites</h1>
        <p className="mt-2 text-sm text-brand-primary max-w-2xl">
          Pre-approve a client email. When that person signs up or next logs in, their account is
          automatically linked to the chosen client and they see their dashboard right away.
        </p>
      </div>

      {error && <Message tone="error" text={error} />}
      {success && <Message tone="success" text={success} />}

      <form
        onSubmit={handleCreate}
        className="mb-6 rounded-xl border border-brand-muted bg-brand-surface p-4 sm:p-5"
      >
        <h2 className="text-sm font-semibold text-white mb-4">Create invite</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_0.8fr_auto] lg:items-end">
          <Field label="Client email">
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="client@example.com"
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
          </Field>
          <Field label="Client">
            <select
              value={clientId}
              onChange={event => setClientId(event.target.value)}
              disabled={loading}
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
            >
              {activeClients.length === 0 && <option value="">No clients</option>}
              {activeClients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Role">
            <select
              value={role}
              onChange={event => setRole(event.target.value as InviteRole)}
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
            >
              <option value="client">Client</option>
              <option value="team">Team</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-brand-bg hover:brightness-110 transition disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Create invite'}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-brand-primary">Loading invites...</p>
      ) : invites.length === 0 ? (
        <div className="rounded-xl border border-brand-muted bg-brand-surface p-8 text-center text-sm text-brand-primary">
          No invites yet. Create one above to pre-approve a client.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-brand-muted bg-brand-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-muted text-left">
                <th className="px-4 py-3 font-medium text-brand-primary">Email</th>
                <th className="px-4 py-3 font-medium text-brand-primary">Client</th>
                <th className="px-4 py-3 font-medium text-brand-primary">Role</th>
                <th className="px-4 py-3 font-medium text-brand-primary">Status</th>
                <th className="px-4 py-3 font-medium text-brand-primary">Created</th>
                <th className="px-4 py-3 font-medium text-brand-primary">Accepted</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {invites.map(invite => (
                <tr key={invite.id} className="border-b border-brand-muted last:border-0">
                  <td className="px-4 py-3 text-white break-all">{invite.email}</td>
                  <td className="px-4 py-3 text-brand-primary">
                    {clientNameById.get(invite.client_id) ?? invite.client_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 capitalize text-brand-primary">{invite.role}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        invite.status === 'accepted'
                          ? 'bg-brand-accent/20 text-brand-accent'
                          : 'bg-amber-400/10 text-amber-300'
                      }`}
                    >
                      {invite.status === 'accepted' ? 'Accepted' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-brand-primary">{formatDateTime(invite.created_at)}</td>
                  <td className="px-4 py-3 text-brand-primary">{formatDateTime(invite.accepted_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void handleDelete(invite)}
                      disabled={busyId === invite.id}
                      className="text-xs text-red-300 hover:text-red-200 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-brand-accent mb-1.5">{label}</span>
      {children}
    </label>
  )
}

function Message({ tone, text }: { tone: 'success' | 'error'; text: string }) {
  const styles = tone === 'success'
    ? 'text-brand-accent bg-brand-accent/10 border-brand-accent/20'
    : 'text-red-400 bg-red-400/10 border-red-400/20'
  return <p className={`mb-4 rounded-lg border px-3 py-2 text-sm ${styles}`}>{text}</p>
}
