import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { AuthProfileError } from '../AuthProfileError'

export function RequireClient() {
  const { user, profile, profileError, loading, isPasswordRecovery } = useAuth()
  const location = useLocation()

  if (loading) return <RouteLoading />
  if (isPasswordRecovery) return <Navigate to="/reset-password" replace />
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />
  if (profileError) return <AuthProfileError />
  if (!profile) return <RouteLoading label="Loading your client profile..." />
  if (user.invited_at && profile.role === 'client' && !profile.client_id) {
    return <Navigate to="/signup" replace />
  }
  if (profile.role !== 'client') return <Navigate to="/admin/cg-hub" replace />

  return <Outlet />
}

function RouteLoading({ label = 'Loading CG Dynamics...' }: { label?: string }) {
  return <div role="status" className="flex min-h-screen items-center justify-center bg-brand-bg text-sm text-brand-primary">{label}</div>
}
