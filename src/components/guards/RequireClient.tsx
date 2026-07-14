import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export function RequireClient() {
  const { user, profile, profileError, loading, isPasswordRecovery } = useAuth()
  const location = useLocation()

  if (loading) return <RouteLoading />
  if (isPasswordRecovery) return <Navigate to="/reset-password" replace />
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />
  if (profileError) return <ProfileError message={profileError} />
  if (!profile) return <RouteLoading label="Loading your client profile..." />
  if (profile.role !== 'client') return <Navigate to="/admin/cg-hub" replace />

  return <Outlet />
}

function RouteLoading({ label = 'Loading CG Dynamics...' }: { label?: string }) {
  return <div role="status" className="flex min-h-screen items-center justify-center bg-brand-bg text-sm text-brand-primary">{label}</div>
}

function ProfileError({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
      <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
        Could not load your profile: {message}
      </p>
    </div>
  )
}
