import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import BrandMark from '../components/BrandMark'
import {
  consentReturnPath,
  describeScope,
  needsConsent,
  parseScopes,
  readAuthorizationId,
  redirectUrlFrom,
} from '../lib/oauthConsent'

type ConsentClient = { name: string; uri?: string }

// Outcome of the async authorization lookup / decision. Synchronous states (loading,
// missing id, unauthenticated) are derived at render, so nothing sets state directly in
// an effect.
type Resolved =
  | { status: 'consent'; client: ConsentClient; scopes: string[] }
  | { status: 'redirecting' }
  | { status: 'error'; message: string }

type ViewState = { status: 'resolving' } | Resolved

const GENERIC_ERROR = 'We could not load this authorization request. It may have expired. Please start the connection again from ChatGPT.'

// Send the browser to the OAuth client's completed redirect URL. This is an external
// callback URL returned by Supabase Auth, so it must be a full-page navigation, never a
// react-router navigate.
function followRedirect(url: string) {
  window.location.assign(url)
}

export default function OAuthConsentPage() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const authorizationId = readAuthorizationId(location.search)
  const [resolved, setResolved] = useState<Resolved | null>(null)
  const [deciding, setDeciding] = useState<null | 'approve' | 'deny'>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    // Wait for the session to resolve; the missing-id error is derived at render.
    if (loading || !authorizationId) return

    // Not signed in → existing CG Dynamics login, preserving a safe return path back to
    // this exact consent request. No second auth/session system.
    if (!user) {
      navigate('/login', { replace: true, state: { from: consentReturnPath(authorizationId) } })
      return
    }

    // Resolve the authorization details exactly once per mount.
    if (startedRef.current) return
    startedRef.current = true

    let active = true
    void (async () => {
      try {
        const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
        if (!active) return
        if (error || !data) {
          setResolved({ status: 'error', message: GENERIC_ERROR })
          return
        }
        // Already consented / auto-approved: Supabase returns a ready redirect URL.
        if (!needsConsent(data)) {
          const url = redirectUrlFrom(data)
          if (url) {
            setResolved({ status: 'redirecting' })
            followRedirect(url)
          } else {
            setResolved({ status: 'error', message: GENERIC_ERROR })
          }
          return
        }
        setResolved({
          status: 'consent',
          client: { name: data.client?.name || 'the requesting application', uri: data.client?.uri },
          scopes: parseScopes(data.scope),
        })
      } catch {
        if (active) setResolved({ status: 'error', message: GENERIC_ERROR })
      }
    })()

    return () => {
      active = false
    }
  }, [authorizationId, user, loading, navigate])

  async function decide(kind: 'approve' | 'deny') {
    if (!authorizationId || deciding) return
    setDeciding(kind)
    try {
      const { data, error } = kind === 'approve'
        ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
        : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true })
      const url = redirectUrlFrom(data)
      if (error || !url) {
        setDeciding(null)
        setResolved({ status: 'error', message: 'We could not record your decision. Please try again from ChatGPT.' })
        return
      }
      setResolved({ status: 'redirecting' })
      followRedirect(url)
    } catch {
      setDeciding(null)
      setResolved({ status: 'error', message: 'Something went wrong recording your decision. Please try again from ChatGPT.' })
    }
  }

  // Derived view: synchronous cases first, then the async outcome.
  const view: ViewState = !authorizationId
    ? { status: 'error', message: 'This authorization request is missing or invalid. Please start the connection again from ChatGPT.' }
    : loading || !user
      ? { status: 'resolving' }
      : resolved ?? { status: 'resolving' }

  return (
    <div className="min-h-screen bg-brand-bg bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.1),transparent_28rem)] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm bg-brand-surface/95 border border-brand-muted rounded-xl p-6 shadow-[0_0_50px_rgba(45,212,191,0.1)] sm:p-8">
        <div className="mb-7 flex justify-center">
          <BrandMark subtitle="Authorize connection" />
        </div>

        {(view.status === 'resolving' || view.status === 'redirecting') && (
          <p className="text-center text-sm text-brand-primary" role="status">
            {view.status === 'redirecting' ? 'Completing the connection…' : 'Loading authorization request…'}
          </p>
        )}

        {view.status === 'error' && (
          <div className="space-y-5">
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3" role="alert">
              {view.message}
            </p>
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="w-full bg-brand-surface border border-brand-muted text-white font-semibold py-2.5 rounded-lg text-sm hover:border-brand-accent transition"
            >
              Back to CG Dynamics
            </button>
          </div>
        )}

        {view.status === 'consent' && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-xl font-bold text-white">Authorize access</h1>
              <p className="mt-2 text-sm text-brand-primary">
                <span className="font-semibold text-brand-accent">{view.client.name}</span> is requesting access to your CG Dynamics account.
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-brand-primary mb-2">It will be able to</p>
              {view.scopes.length > 0 ? (
                <ul className="space-y-2">
                  {view.scopes.map(scope => (
                    <li key={scope} className="flex items-start gap-2 text-sm text-white">
                      <span aria-hidden className="mt-0.5 text-brand-accent">•</span>
                      <span>{describeScope(scope)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-brand-primary">No additional permissions were requested.</p>
              )}
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => decide('approve')}
                disabled={deciding !== null}
                className="w-full bg-brand-accent text-brand-bg font-semibold py-2.5 rounded-lg text-sm hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 focus:ring-offset-brand-surface transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {deciding === 'approve' ? 'Authorizing…' : 'Approve'}
              </button>
              <button
                type="button"
                onClick={() => decide('deny')}
                disabled={deciding !== null}
                className="w-full bg-transparent border border-brand-muted text-brand-primary font-semibold py-2.5 rounded-lg text-sm hover:text-white hover:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-muted transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {deciding === 'deny' ? 'Cancelling…' : 'Deny'}
              </button>
            </div>

            <p className="text-center text-xs text-brand-primary">
              Signed in as {user?.email ?? 'your CG Dynamics account'}.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
