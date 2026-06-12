import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import AuthShell, { AuthMessage } from '../components/AuthShell'
import PasswordField from '../components/PasswordField'

export default function ResetPassword() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  // Whether we arrived here from a valid recovery link.
  const [recoveryReady, setRecoveryReady] = useState(false)

  useEffect(() => {
    // Supabase parses the recovery token from the URL and emits a
    // PASSWORD_RECOVERY event; a session also means the link was valid.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setRecoveryReady(true)
    })
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setRecoveryReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    if (password.length < 6) {
      setError('Choose a password with at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError(null)
    const { error } = await updatePassword(password)
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="You're all set">
        <div className="space-y-5">
          <AuthMessage tone="success">
            Your password has been updated. You can now sign in with your new password.
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

        {!recoveryReady && (
          <AuthMessage tone="info">
            Open this page from the reset link in your email. If you typed the address directly or the
            link expired, request a new one from “Forgot password”.
          </AuthMessage>
        )}

        {error && <AuthMessage tone="error">{error}</AuthMessage>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-accent text-brand-bg font-semibold py-2.5 rounded-lg text-sm hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 focus:ring-offset-brand-surface transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </AuthShell>
  )
}
