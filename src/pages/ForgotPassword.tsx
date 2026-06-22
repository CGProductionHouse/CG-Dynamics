import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AuthShell, { AuthMessage } from '../components/AuthShell'
import { friendlyAuthError } from '../lib/authErrors'
import { useCooldown } from '../hooks/useCooldown'

export default function ForgotPassword() {
  const { resetPasswordForEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [resendMessage, setResendMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const cooldown = useCooldown(60)

  async function sendResetEmail(trimmed: string) {
    const { error } = await resetPasswordForEmail(trimmed)
    // Throttle repeat requests regardless of outcome.
    cooldown.start()
    return error
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Enter your email address.')
      return
    }
    setLoading(true)
    setError(null)
    const error = await sendResetEmail(trimmed)
    setLoading(false)
    if (error) {
      setError(friendlyAuthError(error, 'Could not send the reset link. Please try again later.'))
      return
    }
    setSent(true)
  }

  async function handleResend() {
    if (loading || cooldown.active) return
    setResendMessage(null)
    setLoading(true)
    const error = await sendResetEmail(email.trim())
    setLoading(false)
    if (error) {
      setResendMessage({ tone: 'error', text: friendlyAuthError(error, 'Could not resend the reset link.') })
    } else {
      setResendMessage({ tone: 'success', text: 'Reset link sent again. Check your inbox (and spam folder).' })
    }
  }

  const footer = (
    <>
      Remembered it?{' '}
      <Link to="/login" className="text-brand-accent hover:brightness-110 font-medium transition">
        Back to sign in
      </Link>
    </>
  )

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle="Password reset on the way" footer={footer}>
        <div className="space-y-4">
          <AuthMessage tone="success">
            If an account exists for <span className="text-white">{email}</span>, we have sent a
            password reset link. Open it on this device to choose a new password.
          </AuthMessage>
          <p className="text-xs text-brand-primary">
            The link can take a minute to arrive. Remember to check your spam folder.
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={loading || cooldown.active}
            className="w-full rounded-lg border border-brand-accent/40 bg-brand-accent/10 py-2 text-sm font-medium text-brand-accent hover:bg-brand-accent/20 transition disabled:opacity-60"
          >
            {loading
              ? 'Sending...'
              : cooldown.active
                ? `Please wait ${cooldown.remaining}s before requesting another email`
                : 'Resend reset link'}
          </button>
          {resendMessage && <AuthMessage tone={resendMessage.tone}>{resendMessage.text}</AuthMessage>}
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Forgot password"
      subtitle="We'll email you a secure reset link."
      footer={footer}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-brand-accent mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition"
            placeholder="you@example.com"
          />
        </div>

        {error && <AuthMessage tone="error">{error}</AuthMessage>}

        <button
          type="submit"
          disabled={loading || cooldown.active}
          className="w-full bg-brand-accent text-brand-bg font-semibold py-2.5 rounded-lg text-sm hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 focus:ring-offset-brand-surface transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading
            ? 'Sending link...'
            : cooldown.active
              ? `Please wait ${cooldown.remaining}s`
              : 'Send reset link'}
        </button>
      </form>
    </AuthShell>
  )
}
