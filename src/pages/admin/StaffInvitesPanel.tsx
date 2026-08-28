import { useEffect, useEffectEvent, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ROLE_LABELS,
  STATUS_LABELS,
  cancelStaffInvitation,
  expireStaffInvitations,
  listStaffInvitations,
  resendStaffInvitation,
  sendStaffInvitation,
  type StaffInvitation,
  type StaffInvitationRole,
  type StaffInvitationStatus,
} from '../../lib/db/staffInvitations'

// Staff invitations (PR 5).
//
// Every row rendered here comes from public.staff_invitations, the same table
// the invitation is written to. The previous screen reported an invitation as
// saved and then listed a different source, so "sent" and "No pending invites"
// could both be true on the same page. There is exactly one source here, and
// it is re-read from the database after every action.

const STATUS_STYLES: Record<StaffInvitationStatus, string> = {
  pending: 'bg-amber-400/10 text-amber-300',
  sending: 'bg-sky-400/10 text-sky-300',
  sent: 'bg-sky-400/15 text-sky-200',
  accepted: 'bg-brand-accent/20 text-brand-accent',
  failed: 'bg-red-400/10 text-red-300',
  expired: 'bg-brand-muted/40 text-brand-primary',
  cancelled: 'bg-brand-muted/40 text-brand-primary',
}

const OPEN: StaffInvitationStatus[] = ['pending', 'sending', 'sent', 'failed']

function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message)
  return fallback
}

export default function StaffInvitesPanel() {
  const [invitations, setInvitations] = useState<StaffInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<StaffInvitationRole>('team')
  const [saving, setSaving] = useState(false)
  // Set when the server suspects a mistyped domain and is waiting for a human
  // to confirm the address really is right.
  const [domainWarning, setDomainWarning] = useState<{ entered: string; suggested: string } | null>(null)

  async function load(options: { silent?: boolean } = {}) {
    if (!options.silent) setLoading(true)
    try {
      // Anything past its expiry becomes 'expired' before we read, so the list
      // never shows an invitation as live when its link no longer works.
      await expireStaffInvitations()
      const { data, error } = await listStaffInvitations()
      if (error) {
        setError(error.message)
        return
      }
      setError(null)
      setInvitations(data)
    } catch (thrown) {
      setError(errorMessage(thrown, 'Could not load staff invitations.'))
    } finally {
      if (!options.silent) setLoading(false)
    }
  }

  const loadEvent = useEffectEvent(load)
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadEvent() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  async function handleSend(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setError('Enter an email address to invite.')
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const result = await sendStaffInvitation({
        email: trimmed,
        role,
        fullName: fullName.trim() || null,
        // Only sent once the person has seen and dismissed the warning.
        acknowledgeDomain: domainWarning?.entered === trimmed.split('@')[1] ? domainWarning.entered : undefined,
      })

      if (result.error) {
        if (result.detail?.code === 'suspected_domain_typo' && result.detail.suggestedDomain && result.detail.enteredDomain) {
          setDomainWarning({ entered: result.detail.enteredDomain, suggested: result.detail.suggestedDomain })
        }
        setError(result.error.message)
        // The row may still exist as 'failed'; re-read so the list is truthful.
        await load({ silent: true })
        return
      }

      setDomainWarning(null)
      setNotice(`Invitation sent to ${trimmed}.`)
      setEmail('')
      setFullName('')
      await load({ silent: true })
    } catch (thrown) {
      setError(errorMessage(thrown, 'Could not send the invitation.'))
      await load({ silent: true })
    } finally {
      setSaving(false)
    }
  }

  async function handleResend(invitation: StaffInvitation) {
    if (busyId) return
    setBusyId(invitation.id)
    setError(null)
    setNotice(null)
    try {
      const { error } = await resendStaffInvitation(invitation.id)
      if (error) setError(error.message)
      else setNotice(`Invitation resent to ${invitation.email}.`)
    } catch (thrown) {
      setError(errorMessage(thrown, 'Could not resend the invitation.'))
    } finally {
      setBusyId(null)
      await load({ silent: true })
    }
  }

  async function handleCancel(invitation: StaffInvitation) {
    if (busyId) return
    if (!window.confirm(`Cancel the invitation for ${invitation.email}? It will stop working immediately.`)) return
    setBusyId(invitation.id)
    setError(null)
    setNotice(null)
    try {
      const { error } = await cancelStaffInvitation(invitation.id, 'cancelled from Invites screen')
      if (error) setError(error.message)
      else setNotice(`Invitation for ${invitation.email} cancelled.`)
    } catch (thrown) {
      setError(errorMessage(thrown, 'Could not cancel the invitation.'))
    } finally {
      setBusyId(null)
      await load({ silent: true })
    }
  }

  const open = invitations.filter(row => OPEN.includes(row.status))
  const history = invitations.filter(row => !OPEN.includes(row.status))

  function renderRow(invitation: StaffInvitation) {
    const canResend = invitation.status === 'failed' || invitation.status === 'sent'
      || invitation.status === 'pending' || invitation.status === 'expired'
    const canCancel = OPEN.includes(invitation.status) && invitation.status !== 'failed'

    return (
      <article
        key={invitation.id}
        data-testid="staff-invitation-row"
        data-status={invitation.status}
        data-email={invitation.email}
        className="rounded-xl border border-brand-muted bg-brand-bg/45 p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-all text-sm font-semibold text-white">{invitation.email}</p>
            <p className="mt-1 text-xs text-brand-primary">
              {invitation.intended_full_name ? `${invitation.intended_full_name} · ` : ''}
              {ROLE_LABELS[invitation.intended_role]}
            </p>
          </div>
          <span
            data-testid="staff-invitation-status"
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[invitation.status]}`}
          >
            {STATUS_LABELS[invitation.status]}
          </span>
        </div>

        {invitation.failure_reason && (
          <p data-testid="staff-invitation-failure" className="mt-3 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200">
            {invitation.failure_reason}
          </p>
        )}

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-brand-primary sm:grid-cols-4">
          <Detail label="Created">{formatDateTime(invitation.created_at)}</Detail>
          <Detail label="Sent">{formatDateTime(invitation.sent_at)}</Detail>
          <Detail label={invitation.status === 'accepted' ? 'Accepted' : 'Expires'}>
            {formatDateTime(invitation.status === 'accepted' ? invitation.accepted_at : invitation.expires_at)}
          </Detail>
          <Detail label="Retries">{invitation.retry_count}</Detail>
        </dl>

        {(canResend || canCancel) && (
          <div className="mt-3 flex items-center gap-4">
            {canResend && (
              <button
                type="button"
                onClick={() => void handleResend(invitation)}
                disabled={busyId === invitation.id}
                className="text-xs text-brand-primary transition-colors hover:text-brand-accent disabled:opacity-60"
              >
                {busyId === invitation.id ? 'Working…' : invitation.status === 'failed' ? 'Retry' : 'Resend'}
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                onClick={() => void handleCancel(invitation)}
                disabled={busyId === invitation.id}
                className="text-xs text-red-300 hover:text-red-200 disabled:opacity-60"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </article>
    )
  }

  return (
    <section className="mb-6 rounded-xl border border-brand-muted bg-brand-surface p-4 sm:p-5" data-testid="staff-invites-panel">
      <h2 className="text-sm font-semibold text-white">Staff invitations</h2>
      <p className="mt-1 text-xs text-brand-primary">
        Invites for people who work at CG Production House. Client portal access is separate, below.
      </p>

      {error && <p className="mt-3 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      {notice && <p className="mt-3 rounded-lg border border-brand-accent/20 bg-brand-accent/10 px-3 py-2 text-sm text-brand-accent">{notice}</p>}
      {domainWarning && (
        <p className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
          Nothing was sent. If <strong>@{domainWarning.entered}</strong> is really correct, press Send again to confirm.
          Otherwise correct it to <strong>@{domainWarning.suggested}</strong>.
        </p>
      )}

      <form onSubmit={handleSend} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_0.8fr_auto] lg:items-end">
        <Field label="Work email">
          <input
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            data-testid="staff-invite-email"
            placeholder="name@company.com"
            className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3.5 py-2.5 text-sm text-white placeholder-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent"
          />
        </Field>
        <Field label="Name (optional)">
          <input
            type="text"
            value={fullName}
            onChange={event => setFullName(event.target.value)}
            data-testid="staff-invite-name"
            placeholder="As it should appear on tasks"
            className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3.5 py-2.5 text-sm text-white placeholder-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent"
          />
        </Field>
        <Field label="Role">
          <select
            value={role}
            onChange={event => setRole(event.target.value as StaffInvitationRole)}
            data-testid="staff-invite-role"
            className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
          >
            <option value="team">Staff</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <button
          type="submit"
          disabled={saving}
          data-testid="staff-invite-send"
          className="rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-brand-bg transition hover:brightness-110 disabled:opacity-60"
        >
          {saving ? 'Sending…' : 'Send invite'}
        </button>
      </form>

      <div className="mt-5 space-y-4">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-primary">Needs attention</h3>
          {loading ? (
            <p className="text-sm text-brand-primary">Loading staff invitations…</p>
          ) : open.length === 0 ? (
            <p data-testid="staff-invites-empty" className="rounded-xl border border-brand-muted bg-brand-bg/40 px-4 py-5 text-center text-sm text-brand-primary">
              No open staff invitations.
            </p>
          ) : (
            <div className="space-y-3">{open.map(renderRow)}</div>
          )}
        </div>

        {history.length > 0 && (
          <details className="rounded-xl border border-brand-muted bg-brand-bg/30 p-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-brand-primary">
              History ({history.length})
            </summary>
            <div className="mt-3 space-y-3">{history.map(renderRow)}</div>
          </details>
        )}
      </div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-brand-accent">{label}</span>
      {children}
    </label>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-brand-primary/70">{label}</dt>
      <dd className="text-brand-primary">{children}</dd>
    </div>
  )
}
