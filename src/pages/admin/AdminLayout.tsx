import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

function navClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? 'bg-brand-muted text-brand-accent'
      : 'text-brand-primary hover:text-white hover:bg-brand-muted/50'
  }`
}

export default function AdminLayout() {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-brand-bg flex">
      <aside className="w-56 shrink-0 bg-brand-surface border-r border-brand-muted flex flex-col">
        <div className="px-5 py-4 border-b border-brand-muted">
          <p className="text-brand-accent font-bold text-base leading-tight">CG Dynamics</p>
          <p className="text-xs text-brand-primary mt-0.5 capitalize">{profile?.role ?? 'staff'}</p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          <NavLink to="/admin" end className={navClass}>
            Clients
          </NavLink>
          {profile?.role === 'admin' && (
            <NavLink to="/admin/users" className={navClass}>
              Users
            </NavLink>
          )}
        </nav>

        <div className="p-3 border-t border-brand-muted space-y-0.5">
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-white truncate">
              {profile?.full_name ?? 'Staff user'}
            </p>
          </div>
          <button
            onClick={signOut}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-brand-primary hover:text-white hover:bg-brand-muted/50 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
