import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export function RequireStaff() {
  const { user, profile, loading } = useAuth()

  if (loading) return <div className="min-h-screen bg-brand-bg" />
  if (!user) return <Navigate to="/login" replace />
  // Profile still loading after sign-in
  if (!profile) return <div className="min-h-screen bg-brand-bg" />
  if (profile.role === 'client') return <Navigate to="/dashboard" replace />

  return <Outlet />
}
