import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import PasswordField from '../components/PasswordField'
import BrandMark from '../components/BrandMark'
import { AuthMessage } from '../components/AuthShell'
import { friendlyAuthError } from '../lib/authErrors'

function isNotConfirmed(error: { message?: string; code?: string } | null) {
  if (!error) return false
  if (error.code === 'email_not_confirmed') return true
  return /not confirmed/i.test(error.message ?? '')
}

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [unconfirmed, setUnconfirmed] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setUnconfirmed(false)
    setLoading(true)
    const { error, role, pendingInviteSetup } = await signIn(email, password)
    setLoading(false)
    if (error) {
      if (isNotConfirmed(error as { message?: string; code?: string })) {
        setUnconfirmed(true)
        setError('This email is registered but not confirmed yet.')
      } else {
        setError(friendlyAuthError(error, 'Could not sign in. Check your details and try again.'))
      }
    } else if (!role) {
      setError('Could not load your profile after sign in.')
    } else {
      const requestedPath = (location.state as { from?: string } | null)?.from
      const destination = pendingInviteSetup
        ? '/signup'
        : role === 'client'
          ? '/dashboard'
          : requestedPath?.startsWith('/admin/') ? requestedPath : '/admin/cg-hub'
      navigate(destination, { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.1),transparent_28rem)] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm bg-brand-surface/95 border border-brand-muted rounded-xl p-6 shadow-[0_0_50px_rgba(45,212,191,0.1)] sm:p-8">
        <div className="mb-7 flex justify-center">
          <BrandMark subtitle="Client reporting portal" />
        </div>
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl font-bold text-white">Sign in</h1>
          <p className="mt-1 text-sm text-brand-primary">Access your CG Production House reporting workspace.</p>
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

          <div>
            <PasswordField
              id="password"
              label="Password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
            />
            <div className="mt-1.5 text-right">
              <Link to="/forgot-password" className="text-xs text-brand-primary hover:text-brand-accent transition">
                Forgot password?
              </Link>
            </div>
          </div>

          {error && <AuthMessage tone={unconfirmed ? 'info' : 'error'}>{error}</AuthMessage>}

          {unconfirmed && (
            <div className="space-y-3 rounded-lg border border-brand-muted bg-brand-bg/50 px-3 py-3">
              <p className="text-xs text-brand-primary">
                Ask an admin to resend your pending CG Dynamics invitation.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-accent text-brand-bg font-semibold py-2.5 rounded-lg text-sm hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 focus:ring-offset-brand-surface transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-brand-primary">
          Have an invitation?{' '}
          <Link to="/signup" className="text-brand-accent hover:brightness-110 font-medium transition">
            Complete setup
          </Link>
        </p>
      </div>
    </div>
  )
}
