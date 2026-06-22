import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AuthShell, { AuthMessage } from '../components/AuthShell'
import PasswordField from '../components/PasswordField'
import { friendlyAuthError } from '../lib/authErrors'

export default function ResetPassword() {
  const { updatePassword, signOut, isPasswordRecovery, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    if (password.length < 6) {
      setError('Choose a password with at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    setError(null)
    const { error } = await updatePassword(password)
    if (error) {
      setSubmitting(false)
      setError(friendlyAuthError(error, 'Could not update your password. Please try again.'))
      return
    }
    // End the recovery session so the user signs in fresh with the new password.
    setDone(true)
    void signOut()
  }

  // Success — shown regardless of the sign-out that follows.
  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="You're all set">
        <div className="space-y-5">
          <AuthMessage tone="success">
            Your password has been updated. Sign in with your new password to continue.
          </AuthMessage>
          <Link
            to="/login"
            className="block w-full bg-brand-accent text-brand-bg text-center font-semibold py-2.5 rounded-lg text-sm hover:brightness-110 transition"
          >
            Continue to sign in
          </Link>
        </div>
      </AuthShell>
    )
  }

  if (loading) {
    return (
      <AuthShell title="Set a new password">
        <p className="text-center text-sm text-brand-primary">Checking your reset link...</p>
      </AuthShell>
    )
  }

  // No active recovery link/session — direct visit or expired link.
  if (!isPasswordRecovery) {
    return (
      <AuthShell title="Reset link needed">
        <div className="space-y-5">
          <AuthMessage tone="info">
            This reset link is missing or has expired. Request a new password reset.
          </AuthMessage>
          <Link
            to="/forgot-password"
            className="block w-full bg-brand-accent text-brand-bg text-center font-semibold py-2.5 rounded-lg text-sm hover:brightness-110 transition"
          >
            Request a new reset link
          </Link>
          <p className="text-center text-sm text-brand-primary">
            <Link to="/login" className="text-brand-accent hover:brightness-110 font-medium transition">
              Back to sign in
            </Link>
          </p>
        </div>
      </AuthShell>
    )
  }

  const footer = (
    <Link to="/login" className="text-brand-accent hover:brightness-110 font-medium transition">
      Back to sign in
    </Link>
  )

  return (
    <AuthShell title="Set a new password" subtitle="Choose a new password for your account." footer={footer}>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <PasswordField
          id="new-password"
          label="New password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />
        <PasswordField
          id="confirm-password"
          label="Confirm new password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
        />

        {error && <AuthMessage tone="error">{error}</AuthMessage>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-brand-accent text-brand-bg font-semibold py-2.5 rounded-lg text-sm hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 focus:ring-offset-brand-surface transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </AuthShell>
  )
}
