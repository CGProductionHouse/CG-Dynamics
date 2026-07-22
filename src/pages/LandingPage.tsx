import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LandingPage() {
  const { user, loading, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center gap-6">
      <img
        src="/CG_App_Icon.png"
        alt="CG Dynamics"
        className="w-28 h-28 rounded-2xl shadow-[0_0_40px_rgba(45,212,191,0.15)]"
      />
      <div className="text-center">
        <h1 className="text-4xl font-bold text-brand-accent tracking-tight m-0">
          CG Dynamics
        </h1>
        <p className="mt-3 text-brand-primary text-xs tracking-[0.35em] uppercase font-medium">
          Business Intelligence Platform
        </p>
      </div>

      {!loading && (
        <div className="flex items-center gap-3 mt-2">
          {user ? (
            <>
              <span className="text-sm text-brand-primary">
                Welcome, <span className="text-white">{user.email}</span>
              </span>
              <button
                onClick={() => signOut()}
                className="text-sm border border-brand-muted text-brand-accent px-4 py-2 rounded-lg hover:bg-brand-muted/30 focus:outline-none focus:ring-2 focus:ring-brand-accent transition"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm border border-brand-muted text-brand-accent px-4 py-2 rounded-lg hover:bg-brand-muted/30 focus:outline-none focus:ring-2 focus:ring-brand-accent transition"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="text-sm bg-brand-accent text-brand-bg font-semibold px-4 py-2 rounded-lg hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 focus:ring-offset-brand-bg transition"
              >
                Accept invite
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}
