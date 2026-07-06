import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { isManagerRole } from '../../lib/roles'

export function RequireManager() {
  const { user, profile, profileError, loading, isPasswordRecovery } = useAuth()

  if (loading) return <div className="min-h-screen bg-brand-bg" />
  if (isPasswordRecovery) return <Navigate to="/reset-password" replace />
  if (!user) return <Navigate to="/login" replace />
  if (profileError) return <ProfileError message={profileError} />
  if (!profile) return <div className="min-h-screen bg-brand-bg" />
  if (profile.role === 'client') return <Navigate to="/dashboard" replace />
  if (!isManagerRole(profile.role)) return <AccessDenied />

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

function AccessDenied() {
  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
      <div className="max-w-md rounded-xl border border-white/10 bg-brand-surface p-6 text-center shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-accent">Manager only</p>
        <h1 className="mt-2 text-xl font-semibold text-white">You do not have access to this workspace.</h1>
        <p className="mt-2 text-sm text-brand-primary">
          This area is reserved for managers and admins.
        </p>
      </div>
    </div>
  )
}
