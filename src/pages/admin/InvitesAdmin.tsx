import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { listClients, type Client } from '../../lib/db/clients'
import {
  deleteInvite,
  listInvites,
  sendInvite,
  type ClientInvite,
  type InviteRole,
} from '../../lib/db/invites'
import { roleLabel } from '../../lib/roles'

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

export default function InvitesAdmin({ embedded = false }: { embedded?: boolean }) {
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

  const loadEvent = useEffectEvent(load)

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadEvent() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Enter an email address to invite.')
      return
    }
    if (role === 'client' && !clientId) {
      setError('Select a client for this invite.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const { data, error } = await sendInvite({
        email: trimmed,
        client_id: role === 'client' ? clientId : null,
        role,
      })
      if (error) {
        setError(error.message)
        return
      }
      setSuccess(
        data?.delivery === 'resent'
          ? `Invitation resent to ${trimmed.toLowerCase()}.`
          : `Invitation sent to ${trimmed.toLowerCase()}.`
      )
      setEmail('')
      await load({ silent: true })
    } catch (error) {
      setError(errorMessage(error, 'Could not create invite.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleResend(invite: ClientInvite) {
    if (busyId) return
    setBusyId(invite.id)
    setError(null)
    setSuccess(null)
    try {
      const { error } = await sendInvite({
        email: invite.email,
        client_id: invite.client_id,
        role: invite.role,
      })
      if (error) {
        setError(error.message)
        return
      }
      setSuccess(`Invitation resent to ${invite.email}.`)
      await load({ silent: true })
    } catch (error) {
      setError(errorMessage(error, 'Could not resend the invitation.'))
    } finally {
      setBusyId(null)
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
  const pendingInvites = invites.filter(invite => invite.status === 'pending')
  const acceptedInvites = invites.filter(invite => invite.status === 'accepted')

  function inviteTarget(invite: ClientInvite) {
    return invite.client_id
      ? clientNameById.get(invite.client_id) ?? invite.client_id.slice(0, 8)
      : 'Global workforce access'
  }

  function renderInviteRows(rows: ClientInvite[], emptyText: string) {
    if (rows.length === 0) {
      return (
        <tr>
          <td colSpan={7} className="px-4 py-8 text-center text-brand-primary">
            {emptyText}
          </td>
        </tr>
      )
    }

    return rows.map(invite => (
      <tr key={invite.id} className="border-b border-brand-muted last:border-0">
        <td className="px-4 py-3 text-white break-all">{invite.email}</td>
        <td className="px-4 py-3 text-brand-primary">
          {inviteTarget(invite)}
        </td>
        <td className="px-4 py-3 text-brand-primary">{roleLabel(invite.role)}</td>
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
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-3 whitespace-nowrap">
            {invite.status === 'pending' && (
              <button
                type="button"
                onClick={() => void handleResend(invite)}
                disabled={busyId === invite.id}
                className="text-xs text-brand-primary hover:text-brand-accent transition-colors disabled:opacity-60"
              >
                {busyId === invite.id ? 'Sending...' : 'Resend invite'}
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleDelete(invite)}
              disabled={busyId === invite.id}
              className="text-xs text-red-300 hover:text-red-200 disabled:opacity-60"
            >
              Delete
            </button>
          </div>
        </td>
      </tr>
    ))
  }

  function renderInviteCards(rows: ClientInvite[], emptyText: string) {
    if (rows.length === 0) {
      return (
        <div className="rounded-xl border border-brand-muted bg-brand-bg/40 px-4 py-6 text-center text-sm text-brand-primary">
          {emptyText}
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {rows.map(invite => (
          <article key={invite.id} className="rounded-xl border border-brand-muted bg-brand-bg/45 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-all text-sm font-semibold text-white">{invite.email}</p>
                <p className="mt-1 text-xs text-brand-primary">{inviteTarget(invite)}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  invite.status === 'accepted'
                    ? 'bg-brand-accent/20 text-brand-accent'
                    : 'bg-amber-400/10 text-amber-300'
                }`}
              >
                {invite.status === 'accepted' ? 'Accepted' : 'Pending'}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1 text-brand-primary">
                {roleLabel(invite.role)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1 text-brand-primary">
                Created {formatDateTime(invite.created_at)}
              </span>
              {invite.accepted_at && (
                <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1 text-brand-primary">
                  Accepted {formatDateTime(invite.accepted_at)}
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              {invite.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => void handleResend(invite)}
                  disabled={busyId === invite.id}
                  className="rounded-lg border border-brand-muted px-3 py-2 text-sm font-semibold text-brand-primary transition hover:border-brand-accent/40 hover:text-white disabled:opacity-60"
                >
                  {busyId === invite.id ? 'Sending...' : 'Resend invite'}
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleDelete(invite)}
                disabled={busyId === invite.id}
                className="rounded-lg border border-red-400/20 px-3 py-2 text-sm font-semibold text-red-300 transition hover:border-red-400/40 hover:text-red-200 disabled:opacity-60"
              >
                Delete invite
              </button>
            </div>
          </article>
        ))}
      </div>
    )
  }

  function renderInviteTable(title: string, rows: ClientInvite[], emptyText: string) {
    return (
      <section className="overflow-hidden rounded-xl border border-brand-muted bg-brand-surface">
        <div className="border-b border-brand-muted px-4 py-3">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
        </div>
        <div className="p-3 md:hidden">
          {renderInviteCards(rows, emptyText)}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-sm">
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
            <tbody>{renderInviteRows(rows, emptyText)}</tbody>
          </table>
        </div>
      </section>
    )
  }

  return (
    <div className={embedded ? 'w-full' : 'w-full max-w-4xl p-4 sm:p-6 lg:p-8'}>
      <div className="mb-6">
        {embedded ? <h2 className="text-xl font-semibold text-white">Invites</h2> : <h1 className="text-xl font-semibold text-white">Invites</h1>}
        <p className="mt-2 text-sm text-brand-primary max-w-2xl">
          Send secure invitations for client and workforce access. Client invites link to one
          active client; staff and manager invites are global operational accounts.
        </p>
        <p className="mt-3 max-w-2xl rounded-lg border border-brand-accent/20 bg-brand-accent/10 px-3 py-2 text-sm text-brand-accent">
          CG Dynamics sends a Supabase Auth invitation email. The recipient uses that secure link
          to set a password and complete their assigned access.
        </p>
        <p className="mt-2 max-w-2xl text-xs text-brand-primary">
          Note: Auth emails (sign-up confirmations and password resets) require Supabase SMTP
          configuration for reliable delivery. Without it, these emails are rate-limited and may not arrive.
        </p>
      </div>

      {error && <Message tone="error" text={error} />}
      {success && <Message tone="success" text={success} />}

      <form
        onSubmit={handleCreate}
        className="mb-6 rounded-xl border border-brand-muted bg-brand-surface p-4 sm:p-5"
      >
        <h2 className="text-sm font-semibold text-white mb-4">Send invitation</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_0.8fr_auto] lg:items-end">
          <Field label="Invite email">
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="client@example.com"
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
          </Field>
          <Field label="Client">
            {role === 'client' ? (
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
            ) : (
              <div className="w-full rounded-lg border border-brand-muted bg-brand-bg/60 px-3.5 py-2.5 text-sm text-brand-primary">
                All clients (global access)
              </div>
            )}
          </Field>
          <Field label="Role">
            <select
              value={role}
              onChange={event => setRole(event.target.value as InviteRole)}
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
            >
              <option value="client">Client</option>
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
            </select>
          </Field>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-brand-bg hover:brightness-110 transition disabled:opacity-60"
          >
            {saving ? 'Sending...' : 'Send invite'}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-brand-primary">Loading invites...</p>
      ) : invites.length === 0 ? (
        <div className="rounded-xl border border-brand-muted bg-brand-surface p-8 text-center text-sm text-brand-primary">
          No invites yet. Send one above to add a client or workforce user.
        </div>
      ) : (
        <div className="space-y-5">
          {renderInviteTable('Pending invites', pendingInvites, 'No pending invites.')}
          {renderInviteTable('Accepted invites', acceptedInvites, 'No accepted invites yet.')}
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
