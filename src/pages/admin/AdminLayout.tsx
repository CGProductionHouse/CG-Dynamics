import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import BrandMark from '../../components/BrandMark'

function navClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? 'bg-brand-muted text-brand-accent'
      : 'text-brand-primary hover:text-white hover:bg-brand-muted/50'
  }`
}

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  function renderNavItems() {
    return (
      <>
      <NavLink to="/admin" end className={navClass} onClick={() => setMobileMenuOpen(false)}>
        Home
      </NavLink>
      <NavLink to="/admin/client-performance" className={navClass} onClick={() => setMobileMenuOpen(false)}>
        Client Performance
      </NavLink>
      <NavLink to="/admin/cg-hub" className={navClass} onClick={() => setMobileMenuOpen(false)}>
        CG Hub
      </NavLink>
      <NavLink to="/admin/assistant" className={navClass} onClick={() => setMobileMenuOpen(false)}>
        CG Assistant
      </NavLink>
      <NavLink to="/admin/integrations" end className={navClass} onClick={() => setMobileMenuOpen(false)}>
        Integrations
      </NavLink>
      {profile?.role === 'admin' && (
        <NavLink to="/admin/users" className={navClass} onClick={() => setMobileMenuOpen(false)}>
          Users
        </NavLink>
      )}

      {/* View as client — kept accessible but less prominent */}
      <NavLink
        to="/admin/published"
        className={({ isActive }) =>
          `mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            isActive
              ? 'text-brand-accent'
              : 'text-brand-primary/60 hover:text-brand-primary'
          }`
        }
        onClick={() => setMobileMenuOpen(false)}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        View as client
      </NavLink>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg md:flex">
      <header className="sticky top-0 z-40 border-b border-brand-muted bg-brand-surface md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <BrandMark subtitle={profile?.role ?? 'staff'} compact />
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-lg border border-brand-muted px-3 py-2 text-sm font-semibold text-brand-primary hover:text-white"
          >
            Menu
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-[min(20rem,86vw)] flex-col bg-brand-surface border-l border-brand-muted shadow-[0_0_40px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-brand-muted">
              <BrandMark subtitle={profile?.role ?? 'staff'} compact />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg border border-brand-muted px-3 py-2 text-sm text-brand-primary hover:text-white"
              >
                Close
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">{renderNavItems()}</nav>
            <div className="p-3 border-t border-brand-muted space-y-1">
              <p className="px-3 py-2 text-xs font-medium text-white truncate">
                {profile?.full_name ?? 'Staff user'}
              </p>
              <button
                onClick={signOut}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-brand-primary hover:text-white hover:bg-brand-muted/50 transition-colors"
              >
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      <aside className="hidden w-56 shrink-0 bg-brand-surface border-r border-brand-muted md:flex md:flex-col">
        <div className="px-5 py-4 border-b border-brand-muted">
          <BrandMark subtitle={profile?.role ?? 'staff'} compact />
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {renderNavItems()}
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

      <main className="min-w-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
