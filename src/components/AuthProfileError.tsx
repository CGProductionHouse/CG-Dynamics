import { useAuth } from '../contexts/AuthContext'

/** Guarded read recovery, never a login/session mutation or raw server error. */
export function AuthProfileError() {
  const { retryProfile } = useAuth()
  return <div className="flex min-h-screen items-center justify-center bg-brand-bg p-6">
    <section role="alert" className="w-full max-w-md rounded-xl border border-red-400/20 bg-red-400/10 p-6">
      <h1 className="text-xl font-bold text-white">Your profile could not be loaded</h1>
      <p className="mt-3 text-sm text-brand-primary">Please try again.</p>
      <button type="button" onClick={() => void retryProfile()}
        className="mt-5 min-h-11 rounded-lg border border-brand-teal/40 px-4 py-2 text-sm font-bold text-white hover:bg-brand-teal/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal">Try again</button>
    </section>
  </div>
}
