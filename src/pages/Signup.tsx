import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import PasswordField from '../components/PasswordField'
import AuthShell, { AuthMessage } from '../components/AuthShell'
import { friendlyAuthError } from '../lib/authErrors'

function hasInviteMarker() {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('invited') === '1' || window.location.hash.includes('type=invite')
}

export default function Signup() {
  const { user, profile, loading, completeInvite } = useAuth()
  const navigate = useNavigate()
  const [inviteMarker] = useState(hasInviteMarker)
  const [fullName, setFullName] = useState(() => {
    const value = user?.user_metadata?.full_name
    return typeof value === 'string' ? value : ''
  })
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const provisionalInvitedAccount = Boolean(
    user?.invited_at && profile?.role === 'client' && !profile.client_id
  )
  const inviteFlow = inviteMarker || provisionalInvitedAccount

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitting) return
    if (password.length < 8) {
      setError('Choose a password with at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    setError(null)
    const result = await completeInvite(password, fullName)
    setSubmitting(false)
    if (result.error || !result.role) {
      setError(friendlyAuthError(result.error, 'Could not complete this invitation. Ask an admin to resend it.'))
      return
    }

    navigate(result.role === 'client' ? '/dashboard' : '/admin/cg-hub', { replace: true })
  }

  if (loading) {
    return (
      <AuthShell title="Opening invitation" subtitle="Checking your secure CG Dynamics link.">
        <p role="status" className="text-center text-sm text-brand-primary">Please wait...</p>
      </AuthShell>
    )
  }

  if (!inviteFlow) {
    return (
      <AuthShell title="Invitation required" subtitle="CG Dynamics accounts are created by an administrator.">
        <div className="space-y-5">
          <AuthMessage tone="info">
            Public registration is disabled. Open the secure link in your invitation email, or ask an admin to send or resend your invitation.
          </AuthMessage>
          <Link
            to={user ? '/' : '/login'}
            className="block w-full rounded-lg bg-brand-accent py-2.5 text-center text-sm font-semibold text-brand-bg transition hover:brightness-110"
          >
            {user ? 'Return to CG Dynamics' : 'Back to sign in'}
          </Link>
        </div>
      </AuthShell>
    )
  }

  if (!user) {
    return (
      <AuthShell title="Invitation link unavailable" subtitle="This secure invitation could not be opened.">
        <div className="space-y-5">
          <AuthMessage tone="error">
            The invitation is missing, expired, or already used. Ask an admin to resend the pending invitation.
          </AuthMessage>
          <Link
            to="/login"
            className="block w-full rounded-lg border border-brand-muted py-2.5 text-center text-sm font-semibold text-brand-primary transition hover:border-brand-accent/40 hover:text-white"
          >
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Complete your invitation" subtitle={`Set up access for ${user.email ?? 'your invited account'}.`}>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <label htmlFor="full-name" className="mb-1.5 block text-sm font-medium text-brand-accent">
            Full name
          </label>
          <input
            id="full-name"
            value={fullName}
            onChange={event => setFullName(event.target.value)}
            autoComplete="name"
            className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3.5 py-2.5 text-sm text-white transition placeholder:text-brand-primary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-accent"
            placeholder="Your name"
          />
        </div>

        <PasswordField
          id="password"
          label="Create password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />
        <PasswordField
          id="confirm-password"
          label="Confirm password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
        />

        {error && <AuthMessage tone="error">{error}</AuthMessage>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-accent py-2.5 text-sm font-semibold text-brand-bg transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 focus:ring-offset-brand-surface disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Completing setup...' : 'Complete account setup'}
        </button>
      </form>
    </AuthShell>
  )
}
