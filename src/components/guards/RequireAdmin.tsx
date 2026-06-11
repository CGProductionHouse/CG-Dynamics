import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export function RequireAdmin() {
  const { user, profile, profileError, loading } = useAuth()

  if (loading) return <div className="min-h-screen bg-brand-bg" />
  if (!user) return <Navigate to="/login" replace />
  if (profileError) return <ProfileError message={profileError} />
  if (!profile) return <div className="min-h-screen bg-brand-bg" />
  if (profile.role === 'client') return <Navigate to="/dashboard" replace />
  if (profile.role === 'team') return <Navigate to="/admin" replace />

  return <Outlet />
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
