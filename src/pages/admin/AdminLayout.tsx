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
    pathname.startsWith('/admin/assistant') ||
    pathname.startsWith('/admin/command-centre')
  ) return 'cg-hub'
  return 'home'
}

function mainNav({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? 'bg-brand-muted text-brand-accent'
      : 'text-brand-primary hover:text-white hover:bg-brand-muted/50'
  }`
}

function subNav({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
    isActive
      ? 'bg-brand-muted/50 text-brand-accent'
      : 'text-brand-primary/60 hover:text-white hover:bg-white/[0.03]'
  }`
}

function sectionLabel(label: string) {
  return (
    <p className="px-3 pt-5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary/60">
      {label}
    </p>
  )
}

function backLink(closeMobile: () => void) {
  return (
    <NavLink
      to="/admin"
      end
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-brand-primary/40 hover:text-white transition-colors"
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
            <div className="mt-3 border-t border-brand-muted/40" />
            <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-primary/50">
              Admin
            </p>
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
        <div className="mt-3 border-t border-brand-muted/40" />
        <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-primary/50">
          Data
        </p>
        <NavLink to="/admin/import" className={subNav} onClick={close}>Imports</NavLink>
        <NavLink to="/admin/manual-metrics" className={subNav} onClick={close}>
          Manual metrics
        </NavLink>
        <div className="mt-3 border-t border-brand-muted/40" />
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
        <NavLink to="/admin/assistant" className={subNav} onClick={close}>
          CG Assistant
        </NavLink>
        <NavLink to="/admin/command-centre" className={subNav} onClick={close}>
          Command Centre
        </NavLink>
        <div className="mt-3 border-t border-brand-muted/40" />
        <a
          href="https://cg-hours.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm text-brand-primary/60 hover:text-white transition-colors"
          onClick={close}
        >
          <span>CG Hours</span>
          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>
        <p className="px-3 pt-0.5 text-[10px] text-brand-primary/40">
          External app. Opens separately.
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
            <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
              {renderNav()}
            </nav>
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

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {renderNav()}
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
