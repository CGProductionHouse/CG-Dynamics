import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import BrandMark from '../../components/BrandMark'
import { roleLabel } from '../../lib/roles'
import { primaryNavItems, adminNavItems, canShowNavItem, isNavItemActive, type NavItem } from './adminNavigation'
import { GlobalAssistantComposer } from '../../components/assistant/GlobalAssistantComposer'

const CG_HOURS_URL = 'https://cg-hours.vercel.app'

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return `${parts[0]?.[0] ?? ''}${parts.length > 1 ? parts.at(-1)?.[0] ?? '' : ''}`.toUpperCase()
}

function NavSection({ label, collapsed = false }: { label: string; collapsed?: boolean }) {
  return (
    <p className={`${collapsed ? 'sr-only' : 'mb-1 mt-3 px-3'} text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary/40`}>
      {label}
    </p>
  )
}

function NavigationLink({ item, active, collapsed = false, onClick }: { item: NavItem; active: boolean; collapsed?: boolean; onClick?: () => void }) {
  return (
    <Link
      to={item.to}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={`group relative flex min-h-10 items-center rounded-md px-3 text-sm font-bold transition-colors ${collapsed ? 'justify-center' : 'justify-between'} ${
        active
          ? 'bg-white/[0.07] text-white shadow-[inset_3px_0_0_rgba(45,212,191,0.75)]'
          : 'text-brand-primary hover:bg-white/[0.05] hover:text-white'
      }`}
    >
      {collapsed ? <span className="text-[11px] font-black tracking-tight">{item.marker}</span> : <span>{item.label}</span>}
    </Link>
  )
}

function ExternalHoursLink({ collapsed = false, onClick }: { collapsed?: boolean; onClick?: () => void }) {
  return (
    <a
      href={CG_HOURS_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      aria-label={collapsed ? 'CG Hours, external' : undefined}
      title={collapsed ? 'CG Hours, external' : undefined}
      className={`group flex min-h-10 items-center rounded-md px-3 text-sm font-bold text-brand-primary transition-colors hover:bg-white/[0.05] hover:text-white ${collapsed ? 'justify-center' : 'justify-between'}`}
    >
      <span>{collapsed ? 'CH' : 'CG Hours'}</span>
      {!collapsed && <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-brand-primary/80 group-hover:border-white/20 group-hover:text-white">Ext</span>}
    </a>
  )
}

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)
  const currentRole = profile?.role ?? 'team'
  const displayRole = roleLabel(profile?.role)
  const primaryItems = primaryNavItems.filter(item => canShowNavItem(item, currentRole))
  const adminItems = adminNavItems.filter(item => canShowNavItem(item, currentRole))
  const closeMobile = () => setMobileMenuOpen(false)

  function renderNav(collapsed = false, onClick?: () => void) {
    return (
      <>
        <NavSection label="Daily work" collapsed={collapsed} />
        {primaryItems.map(item => <NavigationLink key={item.to} item={item} active={isNavItemActive(location.pathname, item)} collapsed={collapsed} onClick={onClick} />)}
        <div className={`${collapsed ? 'my-2' : 'mt-2'} border-t border-white/10 pt-2`}>
          <ExternalHoursLink collapsed={collapsed} onClick={onClick} />
        </div>
        {adminItems.length > 0 && (
          <div className="mt-3 border-t border-white/10 pt-1" data-testid="admin-navigation">
            <NavSection label="Admin" collapsed={collapsed} />
            {adminItems.map(item => <NavigationLink key={item.to} item={item} active={isNavItemActive(location.pathname, item)} collapsed={collapsed} onClick={onClick} />)}
          </div>
        )}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg md:flex md:h-screen md:overflow-hidden">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-px bg-gradient-to-r from-transparent via-brand-teal/70 to-transparent" />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <BrandMark subtitle={displayRole} compact />
          <button type="button" onClick={() => setMobileMenuOpen(true)} className="min-h-11 rounded-md border border-white/12 bg-white/[0.04] px-3 text-sm font-bold text-white" aria-expanded={mobileMenuOpen} aria-controls="staff-mobile-navigation">
            Menu
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/70" onClick={closeMobile} />
          <aside id="staff-mobile-navigation" className="absolute right-0 top-0 flex h-full w-[min(21rem,88vw)] max-w-full flex-col border-l border-white/10 bg-brand-surface shadow-2xl" aria-label="Staff navigation">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <BrandMark subtitle={displayRole} compact />
              <button type="button" onClick={closeMobile} className="min-h-11 rounded-md border border-white/10 px-3 text-sm font-semibold text-brand-primary hover:text-white">Close</button>
            </div>
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-3">{renderNav(false, closeMobile)}</nav>
            <div className="border-t border-white/10 p-3">
              <UserBlock name={profile?.full_name ?? 'Staff user'} role={displayRole} onSignOut={signOut} />
            </div>
          </aside>
        </div>
      )}

      <aside className={`${desktopCollapsed ? 'w-20' : 'w-60'} hidden shrink-0 border-r border-white/10 bg-black/72 transition-[width] md:flex md:h-screen md:flex-col`} aria-label="Staff navigation">
        <div className={`flex items-center border-b border-white/10 py-4 ${desktopCollapsed ? 'flex-col justify-center gap-2 px-2' : 'justify-between gap-2 px-4'}`}>
          {desktopCollapsed ? <div className="w-9 overflow-hidden" title="CG Dynamics"><BrandMark subtitle="" compact /></div> : <BrandMark subtitle={displayRole} compact />}
          <button type="button" onClick={() => setDesktopCollapsed(value => !value)} className="min-h-9 min-w-9 rounded-md border border-white/10 px-2 text-xs font-black text-brand-primary hover:text-white" aria-label={desktopCollapsed ? 'Expand navigation' : 'Collapse navigation'} title={desktopCollapsed ? 'Expand navigation' : 'Collapse navigation'}>
            {desktopCollapsed ? '>' : '<'}
          </button>
        </div>
        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-2.5">{renderNav(desktopCollapsed)}</nav>
        <div className="border-t border-white/10 p-2.5">
          <UserBlock name={profile?.full_name ?? 'Staff user'} role={displayRole} onSignOut={signOut} collapsed={desktopCollapsed} />
        </div>
      </aside>

      {/* Extra bottom padding clears the fixed mobile nav AND the docked
          assistant composer so page content is never hidden behind them. */}
      <main className="min-w-0 flex-1 overflow-auto pb-36 md:h-screen md:pb-24">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 overflow-x-auto overscroll-x-contain border-t border-white/10 bg-black/92 backdrop-blur md:hidden" aria-label="Primary mobile navigation">
        <div className="flex min-w-max gap-1 px-2 py-1.5">
          {primaryItems.map(item => <MobileNavItem key={item.to} item={item} active={isNavItemActive(location.pathname, item)} />)}
        </div>
      </nav>

      <GlobalAssistantComposer />
    </div>
  )
}

function UserBlock({ name, role, onSignOut, collapsed = false }: { name: string; role: string; onSignOut: () => void; collapsed?: boolean }) {
  if (collapsed) {
    return (
      <div className="space-y-1.5 text-center" title={`${name}, ${role}`}>
        <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-brand-teal/10 text-xs font-black text-brand-teal" aria-label={`${name}, ${role}`}>{initials(name)}</div>
        <button onClick={onSignOut} className="min-h-9 w-full rounded-md text-xs font-black text-brand-primary hover:bg-white/[0.06] hover:text-white" aria-label="Sign out" title="Sign out">X</button>
      </div>
    )
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 rounded-lg bg-white/[0.035] px-3 py-2">
        <p className="min-w-0 truncate text-sm font-bold text-white">{name}</p>
        <p className="shrink-0 text-xs text-brand-primary/65">{role}</p>
      </div>
      <button onClick={onSignOut} className="min-h-10 w-full rounded-md px-3 text-left text-sm font-semibold text-brand-primary transition-colors hover:bg-white/[0.06] hover:text-white">Sign out</button>
    </div>
  )
}

function MobileNavItem({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={`min-w-[4.5rem] rounded-md px-2 py-2.5 text-center text-[11px] font-bold transition-colors ${active ? 'bg-white/[0.08] text-white shadow-[inset_0_2px_0_rgba(45,212,191,0.85)]' : 'text-brand-primary hover:text-white'}`}
    >
      {item.shortLabel}
    </Link>
  )
}
