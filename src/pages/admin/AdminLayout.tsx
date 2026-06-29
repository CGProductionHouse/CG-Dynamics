import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import BrandMark from '../../components/BrandMark'

const CG_HOURS_URL = 'https://cg-hours.vercel.app'

const navItems = [
  { to: '/admin/cg-hub', label: 'Hub', end: true },
  { to: '/admin/clients', label: 'Clients' },
  { to: '/admin/planner', label: 'Planner' },
  { to: '/admin/command-centre', label: 'Tasks' },
  { to: '/admin/assistant', label: 'Assistant' },
]

function navClass({ isActive }: { isActive: boolean }) {
  return `group flex items-center justify-between rounded-md px-3 py-2 text-sm font-bold transition-colors ${
    isActive
      ? 'bg-brand-accent text-black shadow-[0_10px_30px_rgba(200,121,42,0.18)]'
      : 'text-brand-primary hover:bg-white/[0.06] hover:text-white'
  }`
}

function ExternalHoursLink({ onClick }: { onClick?: () => void }) {
  return (
    <a
      href={CG_HOURS_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className="group flex items-center justify-between rounded-md px-3 py-2 text-sm font-bold text-brand-primary transition-colors hover:bg-white/[0.06] hover:text-white"
    >
      <span>CG Hours</span>
      <span className="text-xs opacity-60">↗</span>
    </a>
  )
}

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const close = () => setMobileMenuOpen(false)

  function renderNav() {
    return (
      <>
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end} className={navClass} onClick={close}>
            <span>{item.label}</span>
          </NavLink>
        ))}
        <ExternalHoursLink onClick={close} />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg md:flex">
      <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-gradient-to-r from-transparent via-brand-accent to-transparent pointer-events-none" />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <BrandMark subtitle={profile?.role ?? 'staff'} compact />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-md border border-white/12 bg-white/[0.04] px-3 py-2 text-sm font-bold text-white"
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
            className="absolute inset-0 bg-black/70"
            onClick={close}
          />
          <aside className="absolute right-0 top-0 flex h-full w-[min(20rem,86vw)] flex-col border-l border-white/10 bg-brand-surface shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <BrandMark subtitle={profile?.role ?? 'staff'} compact />
              <button
                type="button"
                onClick={close}
                className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-brand-primary hover:text-white"
              >
                Close
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">{renderNav()}</nav>
            <div className="border-t border-white/10 p-3">
              <UserBlock name={profile?.full_name ?? 'Staff user'} role={profile?.role ?? 'staff'} onSignOut={signOut} />
            </div>
          </aside>
        </div>
      )}

      <aside className="hidden w-60 shrink-0 border-r border-white/10 bg-black/72 md:flex md:flex-col">
        <div className="border-b border-white/10 px-5 py-5">
          <BrandMark subtitle={profile?.role ?? 'staff'} compact />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">{renderNav()}</nav>
        <div className="border-t border-white/10 p-3">
          <UserBlock name={profile?.full_name ?? 'Staff user'} role={profile?.role ?? 'staff'} onSignOut={signOut} />
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto pb-16 md:pb-0">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/92 backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-1 px-2 py-1.5">
          <MobileNavItem to="/admin/cg-hub" label="Hub" />
          <MobileNavItem to="/admin/clients" label="Clients" />
          <MobileNavItem to="/admin/planner" label="Planner" />
          <MobileNavItem to="/admin/command-centre" label="Tasks" />
          <MobileNavItem to="/admin/assistant" label="Assistant" />
        </div>
      </nav>
    </div>
  )
}

function UserBlock({ name, role, onSignOut }: { name: string; role: string; onSignOut: () => void }) {
  return (
    <div className="space-y-2">
      <div className="rounded-lg bg-white/[0.035] px-3 py-2">
        <p className="truncate text-sm font-bold text-white">{name}</p>
        <p className="mt-0.5 text-xs text-brand-primary/65">{role === 'admin' ? 'Admin' : 'Staff'}</p>
      </div>
      <button
        onClick={onSignOut}
        className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-brand-primary transition-colors hover:bg-white/[0.06] hover:text-white"
      >
        Sign out
      </button>
    </div>
  )
}

function MobileNavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-md px-2 py-2 text-center text-[11px] font-bold transition-colors ${
          isActive ? 'bg-brand-accent text-black' : 'text-brand-primary hover:text-white'
        }`
      }
    >
      {label}
    </NavLink>
  )
}
