import { useState, useMemo } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import BrandMark from '../../components/BrandMark'

type Section = 'home' | 'client-performance' | 'cg-hub'

function getSection(pathname: string): Section {
  if (pathname === '/admin') return 'home'
  if (
    pathname.startsWith('/admin/client-performance') ||
    pathname.startsWith('/admin/clients') ||
    pathname.startsWith('/admin/reports') ||
    pathname.startsWith('/admin/integrations') ||
    pathname.startsWith('/admin/import') ||
    pathname.startsWith('/admin/manual-metrics') ||
    pathname.startsWith('/admin/published')
  ) return 'client-performance'
  if (
    pathname.startsWith('/admin/cg-hub') ||
    pathname.startsWith('/admin/planner') ||
    pathname.startsWith('/admin/assistant') ||
    pathname.startsWith('/admin/command-centre') ||
    pathname.startsWith('/admin/package-master')
  ) return 'cg-hub'
  return 'home'
}

function mainNav({ isActive }: { isActive: boolean }) {
  return `relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? 'bg-brand-accent/10 text-brand-accent shadow-sm'
      : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
  }`
}

function subNav({ isActive }: { isActive: boolean }) {
  return `relative flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
    isActive
      ? 'bg-brand-accent/8 text-brand-accent'
      : 'text-white/50 hover:text-white hover:bg-white/[0.03]'
  }`
}

function sectionLabel(label: string) {
  return (
    <p className="flex items-center gap-2 px-3 pt-5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/30">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-accent/60" />
      {label}
    </p>
  )
}

function backLink(closeMobile: () => void) {
  return (
    <NavLink
      to="/admin"
      end
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-white/40 hover:text-white transition-colors"
      onClick={closeMobile}
    >
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15.75 19.5L8.25 12l7.5-7.5" />
      </svg>
      Back to Home
    </NavLink>
  )
}

const closeIcon = (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const section = useMemo(() => getSection(location.pathname), [location.pathname])
  const isAdmin = profile?.role === 'admin'
  const close = () => setMobileMenuOpen(false)

  function renderHomeNav() {
    return (
      <>
        <NavLink to="/admin" end className={mainNav} onClick={close}>Home</NavLink>
        <NavLink to="/admin/client-performance" className={mainNav} onClick={close}>
          Client Performance
        </NavLink>
        <NavLink to="/admin/cg-hub" className={mainNav} onClick={close}>
          CG Hub
        </NavLink>
        {isAdmin && (
          <>
            <div className="mt-3 border-t border-brand-muted/30" />
            {sectionLabel('Admin')}
            <NavLink to="/admin/users" className={mainNav} onClick={close}>Users</NavLink>
            <NavLink to="/admin/invites" className={mainNav} onClick={close}>Invites</NavLink>
          </>
        )}
      </>
    )
  }

  function renderClientPerformanceNav() {
    return (
      <>
        {backLink(close)}
        {sectionLabel('Client Performance')}
        <NavLink to="/admin/client-performance" end className={subNav} onClick={close}>
          Overview
        </NavLink>
        <NavLink to="/admin/clients" className={subNav} onClick={close}>Clients</NavLink>
        <NavLink to="/admin/reports" className={subNav} onClick={close}>Reports</NavLink>
        <NavLink to="/admin/integrations" end className={subNav} onClick={close}>Integrations</NavLink>
        <div className="mt-3 border-t border-brand-muted/30" />
        {sectionLabel('Data')}
        <NavLink to="/admin/import" className={subNav} onClick={close}>Imports</NavLink>
        <NavLink to="/admin/manual-metrics" className={subNav} onClick={close}>
          Manual metrics
        </NavLink>
        <div className="mt-3 border-t border-brand-muted/30" />
        <NavLink
          to="/admin/published"
          className={subNav}
          onClick={close}
        >
          {closeIcon}
          View as client
        </NavLink>
      </>
    )
  }

  function renderCgHubNav() {
    return (
      <>
        {backLink(close)}
        {sectionLabel('CG Hub')}
        <NavLink to="/admin/cg-hub" end className={subNav} onClick={close}>Overview</NavLink>
        <NavLink to="/admin/planner" className={subNav} onClick={close}>
          Planner
        </NavLink>
        <NavLink to="/admin/package-master" className={subNav} onClick={close}>
          Package Master
        </NavLink>
        <NavLink to="/admin/command-centre" className={subNav} onClick={close}>
          Command Centre
        </NavLink>
        <NavLink to="/admin/assistant" className={subNav} onClick={close}>
          CG Assistant
        </NavLink>
        <div className="mt-3 border-t border-brand-muted/30" />
        <a
          href="https://cg-hours.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white transition-colors"
          onClick={close}
        >
          <span>CG Hours</span>
          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>
        <p className="px-3 pt-0.5 text-[10px] text-white/30">
          External app
        </p>
      </>
    )
  }

  function renderNav() {
    if (section === 'client-performance') return renderClientPerformanceNav()
    if (section === 'cg-hub') return renderCgHubNav()
    return renderHomeNav()
  }

  return (
    <div className="min-h-screen bg-brand-bg md:flex">
      <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-gradient-to-r from-transparent via-brand-accent/60 to-transparent pointer-events-none" />
      <header className="sticky top-0 z-40 border-b border-brand-muted/50 bg-brand-surface/95 backdrop-blur-sm md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <BrandMark subtitle={profile?.role ?? 'staff'} compact />
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-lg border border-brand-muted/60 px-3.5 py-2 text-sm font-semibold text-white/70 hover:text-white transition-colors"
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
          <aside className="absolute right-0 top-0 flex h-full w-[min(20rem,86vw)] flex-col bg-brand-surface border-l border-brand-muted/50 shadow-2xl">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-brand-muted/50">
              <BrandMark subtitle={profile?.role ?? 'staff'} compact />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg border border-brand-muted/60 px-3 py-2 text-sm text-brand-primary hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
              {renderNav()}
            </nav>
            <div className="px-3 py-3 border-t border-brand-muted/50 space-y-1.5">
              <div className="px-3 py-1.5">
                <p className="text-sm font-medium text-white truncate">
                  {profile?.full_name ?? 'Staff user'}
                </p>
                <p className="text-xs text-brand-primary/50 mt-0.5">
                  {profile?.role === 'admin' ? 'Admin' : 'Staff'}
                </p>
              </div>
              <button
                onClick={signOut}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-brand-primary hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      <aside className="hidden w-56 shrink-0 bg-brand-surface border-r border-brand-muted/50 md:flex md:flex-col">
        <div className="px-5 py-4 border-b border-brand-muted/50">
          <BrandMark subtitle={profile?.role ?? 'staff'} compact />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {renderNav()}
        </nav>

        <div className="px-3 py-3 border-t border-brand-muted/50 space-y-1.5">
          <div className="px-3 py-1.5">
            <p className="text-sm font-medium text-white truncate">
              {profile?.full_name ?? 'Staff user'}
            </p>
            <p className="text-xs text-white/40 mt-0.5">
              {profile?.role === 'admin' ? 'Admin' : 'Staff'}
            </p>
          </div>
          <button
            onClick={signOut}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto pb-16 md:pb-0">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-muted/50 bg-brand-surface/95 backdrop-blur-sm md:hidden">
        <div className="flex items-center justify-around px-2 py-1">
          <MobileNavItem to="/admin" label="Today" exact>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </MobileNavItem>
          <MobileNavItem to="/admin/command-centre" label="Tasks">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
          </MobileNavItem>
          <MobileNavItem to="/admin/assistant" label="Assistant">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
          </MobileNavItem>
          <MobileNavItem to="/admin/cg-hub" label="Hub">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </MobileNavItem>
        </div>
      </nav>
    </div>
  )
}

function MobileNavItem({ to, label, exact, children }: {
  to: string
  label: string
  exact?: boolean
  children: React.ReactNode
}) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 rounded-lg px-4 py-2 text-[11px] font-medium transition-colors ${
          isActive
            ? 'text-brand-accent'
            : 'text-white/50 hover:text-white'
        }`
      }
    >
      {children}
      <span>{label}</span>
    </NavLink>
  )
}
