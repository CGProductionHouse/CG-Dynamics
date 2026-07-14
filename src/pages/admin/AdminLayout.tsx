import { useState } from 'react'
import { NavLink, Link, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import BrandMark from '../../components/BrandMark'
import { isAdminRole, isManagerRole, roleLabel } from '../../lib/roles'

type Zone = 'dynamics' | 'hub'
type NavAccess = 'staff' | 'manager' | 'admin'
type NavItem = { to: string; label: string; end?: boolean; access?: NavAccess }

const CG_HOURS_URL = 'https://cg-hours.vercel.app'

const dynamicsNav: NavItem[] = [
  { to: '/admin/client-performance', label: 'Performance Dashboard' },
  { to: '/admin/clients', label: 'Clients' },
  { to: '/admin/client-dashboard', label: 'Client Dashboard' },
  { to: '/admin/client-calendar', label: 'Content Calendar' },
  { to: '/admin/integrations', label: 'Meta / Integrations', access: 'manager' },
]

const hubNav: NavItem[] = [
  { to: '/admin/cg-hub', label: 'Hub', end: true },
  { to: '/admin/my-day', label: 'My Day' },
  { to: '/admin/planner', label: 'Planner' },
  { to: '/admin/cg-calendar', label: 'CG Calendar' },
  { to: '/admin/client-schedule', label: 'Client Schedule' },
  { to: '/admin/clients', label: 'Clients' },
  { to: '/admin/command-centre', label: 'Daily Tasks' },
  { to: '/admin/assistant', label: 'Assistant' },
  { to: '/admin/users', label: 'Users', access: 'admin' },
  { to: '/admin/invites', label: 'Invites', access: 'admin' },
  { to: '/admin/microsoft-import', label: 'Microsoft Import', access: 'admin' },
]

function navClass({ isActive }: { isActive: boolean }) {
  return `group relative flex items-center justify-between rounded-md px-3 py-2 md:py-1.5 text-sm font-bold transition-colors ${
    isActive
      ? 'bg-white/[0.07] text-white shadow-[inset_3px_0_0_rgba(45,212,191,0.75)]'
      : 'text-brand-primary hover:bg-white/[0.05] hover:text-white'
  }`
}

function ExternalHoursLink({ onClick }: { onClick?: () => void }) {
  return (
    <a
      href={CG_HOURS_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className="group flex items-center justify-between rounded-md px-3 py-2 md:py-1.5 text-sm font-bold text-brand-primary transition-colors hover:bg-white/[0.05] hover:text-white"
    >
      <span>CG Hours</span>
      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-brand-primary/80 group-hover:border-white/20 group-hover:text-white">
        Ext
      </span>
    </a>
  )
}

function ZoneSwitcher({ zone, onChange }: { zone: Zone; onChange: (z: Zone) => void }) {
  return (
    <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
      <button
        type="button"
        onClick={() => onChange('dynamics')}
        className={`flex-1 rounded-md px-2 py-1.5 text-xs font-black uppercase tracking-[0.08em] transition-colors ${
          zone === 'dynamics'
            ? 'bg-white/[0.09] text-white shadow-[0_0_0_1px_rgba(45,212,191,0.35)]'
            : 'text-brand-primary/60 hover:text-brand-primary'
        }`}
      >
        Performance
      </button>
      <button
        type="button"
        onClick={() => onChange('hub')}
        className={`flex-1 rounded-md px-2 py-1.5 text-xs font-black uppercase tracking-[0.08em] transition-colors ${
          zone === 'hub'
            ? 'bg-white/[0.09] text-white shadow-[0_0_0_1px_rgba(45,212,191,0.35)]'
            : 'text-brand-primary/60 hover:text-brand-primary'
        }`}
      >
        Hub
      </button>
    </div>
  )
}

function NavSection({ label }: { label: string }) {
  return (
    <p className="mb-1 mt-3 md:mt-2 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary/40">
      {label}
    </p>
  )
}

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [zone, setZone] = useState<Zone>(() => {
    try {
      return (localStorage.getItem('cg-zone') as Zone) ?? 'hub'
    } catch {
      return 'dynamics'
    }
  })

  const currentRole = profile?.role ?? 'team'
  const close = () => setMobileMenuOpen(false)

  function switchZone(z: Zone) {
    setZone(z)
    try { localStorage.setItem('cg-zone', z) } catch { /* ignore */ }
  }

  function canShow(item: NavItem) {
    if (item.access === 'admin') return isAdminRole(currentRole)
    if (item.access === 'manager') return isManagerRole(currentRole)
    return true
  }

  function renderNav() {
    if (zone === 'dynamics') {
      return (
        <>
          <NavSection label="Performance" />
          {dynamicsNav.filter(canShow).map(item => (
            <NavLink key={item.to} to={item.to} className={navClass} onClick={close}>
              <span>{item.label}</span>
            </NavLink>
          ))}
          <Link
            to="/admin/cg-hub"
            onClick={() => { switchZone('hub'); close() }}
            className="mt-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-brand-primary/50 transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            <span>Back to Hub</span>
          </Link>
        </>
      )
    }

    return (
      <>
        <NavSection label="CG Hub" />
        {hubNav.filter(canShow).map(item => (
          <NavLink key={item.to} to={item.to} end={item.end} className={navClass} onClick={close}>
            <span>{item.label}</span>
          </NavLink>
        ))}
        <ExternalHoursLink onClick={close} />
      </>
    )
  }

  const dynamicsMobileItems: NavItem[] = [
    { to: '/admin/client-performance', label: 'Perf' },
    { to: '/admin/clients', label: 'Clients' },
    { to: '/admin/client-dashboard', label: 'Dash' },
    { to: '/admin/client-calendar', label: 'Calendar' },
    { to: '/admin/integrations', label: 'Meta', access: 'manager' },
  ]
  const hubMobileItems: NavItem[] = [
    { to: '/admin/cg-hub', label: 'Hub' },
    { to: '/admin/my-day', label: 'My Day' },
    { to: '/admin/planner', label: 'Planner' },
    { to: '/admin/cg-calendar', label: 'Calendar' },
    { to: '/admin/assistant', label: 'Assist' },
  ]
  const mobileItems = (zone === 'dynamics' ? dynamicsMobileItems : hubMobileItems).filter(canShow)
  const displayRole = roleLabel(profile?.role)

  return (
    <div className="min-h-screen bg-brand-bg md:flex md:h-screen md:overflow-hidden">
      <div className="fixed inset-x-0 top-0 z-50 h-px bg-gradient-to-r from-transparent via-brand-teal/70 to-transparent pointer-events-none" />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <BrandMark subtitle={displayRole} compact />
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
              <BrandMark subtitle={displayRole} compact />
              <button
                type="button"
                onClick={close}
                className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-brand-primary hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="border-b border-white/10 p-3 md:p-2.5">
              <ZoneSwitcher zone={zone} onChange={switchZone} />
            </div>
            <nav className="flex-1 space-y-1 md:space-y-0.5 overflow-y-auto p-3 md:p-2.5">{renderNav()}</nav>
            <div className="border-t border-white/10 p-3 md:p-2.5">
              <UserBlock name={profile?.full_name ?? 'Staff user'} role={displayRole} onSignOut={signOut} />
            </div>
          </aside>
        </div>
      )}

      <aside className="hidden w-60 shrink-0 border-r border-white/10 bg-black/72 md:flex md:h-screen md:flex-col">
        <div className="border-b border-white/10 px-5 py-4">
          <BrandMark subtitle={displayRole} compact />
        </div>
        <div className="border-b border-white/10 p-3 md:p-2.5">
          <ZoneSwitcher zone={zone} onChange={switchZone} />
        </div>
        <nav className="flex-1 space-y-1 md:space-y-0.5 overflow-y-auto p-3 md:p-2.5">{renderNav()}</nav>
        <div className="border-t border-white/10 p-3 md:p-2.5">
          <UserBlock name={profile?.full_name ?? 'Staff user'} role={displayRole} onSignOut={signOut} />
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto pb-16 md:h-screen md:pb-0">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/92 backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-1 px-2 py-1.5">
          {mobileItems.map(item => (
            <MobileNavItem key={item.to} to={item.to} label={item.label} />
          ))}
        </div>
      </nav>
    </div>
  )
}

function UserBlock({ name, role, onSignOut }: { name: string; role: string; onSignOut: () => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 rounded-lg bg-white/[0.035] px-3 py-2">
        <p className="min-w-0 truncate text-sm font-bold text-white">{name}</p>
        <p className="shrink-0 text-xs text-brand-primary/65">{role}</p>
      </div>
      <button
        onClick={onSignOut}
        className="w-full rounded-md px-3 py-2 md:py-1.5 text-left text-sm font-semibold text-brand-primary transition-colors hover:bg-white/[0.06] hover:text-white"
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
        `rounded-md px-2 py-2.5 text-center text-[11px] font-bold transition-colors ${
          isActive ? 'bg-white/[0.08] text-white shadow-[inset_0_2px_0_rgba(45,212,191,0.85)]' : 'text-brand-primary hover:text-white'
        }`
      }
    >
      {label}
    </NavLink>
  )
}
