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
        Clients
      </NavLink>
      {profile?.role === 'admin' && (
        <NavLink to="/admin/users" className={navClass} onClick={() => setMobileMenuOpen(false)}>
          Users
        </NavLink>
      )}
      {profile?.role === 'admin' && (
        <NavLink to="/admin/invites" className={navClass} onClick={() => setMobileMenuOpen(false)}>
          Invites
        </NavLink>
      )}
      {profile?.role === 'admin' && (
        <NavLink to="/admin/import" className={navClass} onClick={() => setMobileMenuOpen(false)}>
          Import CSV
        </NavLink>
      )}
      <NavLink to="/admin/imports" className={navClass} onClick={() => setMobileMenuOpen(false)}>
        Imports
      </NavLink>
      <NavLink to="/admin/reports" className={navClass} onClick={() => setMobileMenuOpen(false)}>
        Reports
      </NavLink>
      <NavLink to="/admin/manual-metrics" className={navClass} onClick={() => setMobileMenuOpen(false)}>
        Manual metrics
      </NavLink>
      <NavLink to="/admin/published" className={navClass} onClick={() => setMobileMenuOpen(false)}>
        Published / Client preview
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
