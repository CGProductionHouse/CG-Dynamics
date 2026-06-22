import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import PasswordField from '../components/PasswordField'
import BrandMark from '../components/BrandMark'
import { AuthMessage } from '../components/AuthShell'
import { friendlyAuthError, isAlreadyRegistered, isEmailRateLimit, SIGNUP_RATE_LIMITED_MESSAGE } from '../lib/authErrors'
import { useCooldown } from '../hooks/useCooldown'

const CARD =
  'w-full max-w-sm bg-brand-surface/95 border border-brand-muted rounded-xl p-6 shadow-[0_0_50px_rgba(45,212,191,0.1)] sm:p-8'
const PAGE =
  'min-h-screen bg-brand-bg bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.1),transparent_28rem)] flex items-center justify-center px-4 py-8'

export default function Signup() {
  const { signUp, resendConfirmation } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [pendingAccount, setPendingAccount] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const resendCooldown = useCooldown(60)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setResendMessage(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error, alreadyRegistered } = await signUp(email, password)
    setLoading(false)

    if (error) {
      // The account may already exist on the server even though the
      // confirmation email was throttled — guide the user instead of letting
      // them hammer the sign-up button.
      if (isEmailRateLimit(error)) {
        setInfo(SIGNUP_RATE_LIMITED_MESSAGE)
      } else if (isAlreadyRegistered(error)) {
        setPendingAccount(true)
      } else {
        setError(friendlyAuthError(error, 'Could not create your account. Please try again.'))
      }
    } else if (alreadyRegistered) {
      setPendingAccount(true)
    } else {
      setSuccess(true)
    }
  }

  async function handleResend() {
    if (resending || resendCooldown.active) return
    if (!email.trim()) {
      setResendMessage({ tone: 'error', text: 'Enter your email above first.' })
      return
    }
    setResending(true)
    setResendMessage(null)
    const { error } = await resendConfirmation(email.trim())
    setResending(false)
    if (error) {
      setResendMessage({ tone: 'error', text: friendlyAuthError(error, 'Could not resend the confirmation email.') })
    } else {
      setResendMessage({ tone: 'success', text: 'Confirmation email sent. Check your inbox (and spam folder).' })
    }
    // Throttle repeat requests regardless of outcome.
    resendCooldown.start()
  }

  if (success) {
    return (
      <div className={PAGE}>
        <div className={`${CARD} text-center`}>
          <div className="w-12 h-12 rounded-full bg-brand-accent/10 border border-brand-accent/30 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-brand-accent mb-2">Check your email</h2>
          <p className="text-sm text-brand-primary">
            We sent a confirmation link to <span className="text-white">{email}</span>. Click it to
            activate your account.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block text-sm text-brand-accent hover:brightness-110 font-medium transition"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  if (pendingAccount) {
    return (
      <div className={PAGE}>
        <div className={CARD}>
          <div className="mb-6 flex justify-center">
            <BrandMark subtitle="Client reporting portal" />
          </div>
          <h2 className="text-xl font-bold text-white text-center mb-2">This email may already be registered</h2>
          <p className="text-sm text-brand-primary text-center mb-5">
            Try signing in, reset your password, or resend the confirmation email for{' '}
            <span className="text-white">{email}</span>.
          </p>
          <div className="space-y-3">
            <Link
              to="/login"
              className="block w-full bg-brand-accent text-brand-bg text-center font-semibold py-2.5 rounded-lg text-sm hover:brightness-110 transition"
            >
              Go to sign in
            </Link>
            <Link
              to="/forgot-password"
              className="block w-full border border-brand-muted text-brand-primary text-center py-2.5 rounded-lg text-sm hover:text-white hover:border-white/30 transition"
            >
              Reset password
            </Link>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || resendCooldown.active}
              className="block w-full border border-brand-accent/40 bg-brand-accent/10 text-brand-accent text-center py-2.5 rounded-lg text-sm font-medium hover:bg-brand-accent/20 transition disabled:opacity-60"
            >
              {resending
                ? 'Sending...'
                : resendCooldown.active
                  ? `Please wait ${resendCooldown.remaining}s before requesting another email`
                  : 'Resend confirmation email'}
            </button>
            {resendMessage && <AuthMessage tone={resendMessage.tone}>{resendMessage.text}</AuthMessage>}
          </div>
          <p className="mt-6 text-center text-sm text-brand-primary">
            Wrong email?{' '}
            <button
              type="button"
              onClick={() => { setPendingAccount(false); setResendMessage(null) }}
              className="text-brand-accent hover:brightness-110 font-medium transition"
            >
              Edit details
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={PAGE}>
      <div className={CARD}>
        <div className="mb-7 flex justify-center">
          <BrandMark subtitle="Client reporting portal" />
        </div>
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl font-bold text-white">Create account</h1>
          <p className="mt-1 text-sm text-brand-primary">Create access for the CG Dynamics reporting workspace.</p>
        </div>

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

          <PasswordField
            id="password"
            label="Password"
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
          {info && <AuthMessage tone="info">{info}</AuthMessage>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-accent text-brand-bg font-semibold py-2.5 rounded-lg text-sm hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 focus:ring-offset-brand-surface transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-brand-primary">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-accent hover:brightness-110 font-medium transition">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
