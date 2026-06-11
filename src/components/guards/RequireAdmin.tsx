import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export function RequireAdmin() {
  const { user, profile, loading } = useAuth()

  if (loading) return <div className="min-h-screen bg-brand-bg" />
  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <div className="min-h-screen bg-brand-bg" />
  if (profile.role === 'client') return <Navigate to="/dashboard" replace />
  if (profile.role === 'team') return <Navigate to="/admin" replace />

  return <Outlet />
}
