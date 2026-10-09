import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { portalPreviewPath } from '../../lib/clientPortalPreviewPolicy'
import { ClientLogo } from '../ClientLogo'
import BrandMark from '../BrandMark'
import { useAuth } from '../../contexts/AuthContext'
import type { Client } from '../../lib/db/clients'

const NAV_ITEMS = [
  { to: '/client', label: 'Overview', end: true },
  { to: '/client/plan', label: 'Plan', end: false },
  { to: '/client/performance', label: 'Performance', end: false },
  { to: '/client/leads', label: 'Leads', end: false },
  { to: '/client/approvals', label: 'Approvals', end: false },
  { to: '/client/brand-hub', label: 'Brand Hub', end: false },
] as const
const MOBILE_PRIMARY = [NAV_ITEMS[0], NAV_ITEMS[1], NAV_ITEMS[2]]
const MOBILE_APPROVALS = NAV_ITEMS[4]
const MOBILE_MORE = [NAV_ITEMS[3], NAV_ITEMS[5]]

function MobileNavIcon({ name }: { name: 'Overview' | 'Plan' | 'Performance' | 'Approvals' | 'More' }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...common}>
    {name === 'Overview' && <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M9 21v-7h6v7" /></>}
    {name === 'Plan' && <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 15h3m-3 3h6" /></>}
    {name === 'Performance' && <><path d="M4 20V11m5 9V5m5 15v-7m5 7V8" /><path d="M2 21h20" /></>}
    {name === 'Approvals' && <><path d="M8 4h8l3 3v13H5V4z" /><path d="m8 13 3 3 5-5" /></>}
    {name === 'More' && <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>}
  </svg>
}

export function ClientPortalShell({
  client,
  children,
  previewClientId,
}: {
  client: Client | null
  children: ReactNode
  previewClientId?: string | null
}) {
  const { signOut } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const isPreview = previewClientId !== undefined
  const activePath = isPreview ? `/client/${new URLSearchParams(location.search).get('area') === 'overview' ? '' : new URLSearchParams(location.search).get('area') ?? ''}`.replace(/\/$/, '') : location.pathname
  const target = (path: string) => isPreview ? (previewClientId ? portalPreviewPath(previewClientId, path) : '/admin/client-portal-preview') : path
  const activeItem = NAV_ITEMS.find(item => item.end
    ? activePath === item.to
    : activePath.startsWith(item.to)) ?? NAV_ITEMS[0]
  const moreIsActive = MOBILE_MORE.some(item => item.to === activeItem.to)

  useEffect(() => {
    if (!mobileMenuOpen) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [mobileMenuOpen])

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#030706] text-report-text">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_8%_-4%,rgba(45,212,191,0.17),transparent_31rem),radial-gradient(circle_at_96%_12%,rgba(249,115,22,0.11),transparent_28rem),linear-gradient(180deg,#030807_0%,#040706_48%,#020403_100%)]"
      />
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#2dd4bf]/80 to-[#f97316]/70" />

      <header className="relative z-10 border-b border-white/[0.08] bg-[#030706]/80 shadow-[0_18px_60px_-44px_rgba(45,212,191,0.55)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            {client ? (
              <ClientLogo
                client={client}
                boxClassName="h-12 w-12 rounded-2xl sm:h-14 sm:w-14"
                padding="p-2"
                frameClassName="border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.10),rgba(255,255,255,0.035))] shadow-[0_18px_45px_-28px_rgba(45,212,191,0.75)]"
                textClassName="text-base font-black text-[#2dd4bf]"
              />
            ) : (
              <BrandMark compact subtitle="Client portal" />
            )}

            {client && (
              <div className="min-w-0">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.24em] text-[#2dd4bf]">CG client portal</p>
                <p className="mt-1 truncate text-base font-black tracking-[-0.02em] text-white sm:text-lg">{client.name}</p>
              </div>
            )}
          </div>

          {isPreview ? <Link to={`/admin/published${previewClientId ? `?client=${encodeURIComponent(previewClientId)}` : ''}`} className="ml-auto inline-flex min-h-11 shrink-0 items-center rounded-full border border-white/10 px-4 text-xs font-bold text-slate-300">Exit preview</Link> : <button
            type="button"
            onClick={() => void signOut()}
            className="ml-auto min-h-11 shrink-0 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs font-bold text-slate-400 transition hover:border-[#2dd4bf]/35 hover:bg-white/[0.06] hover:text-white sm:text-sm"
          >
            Sign out
          </button>}
        </div>

        <nav aria-label="Client portal" className="mx-auto hidden max-w-7xl overflow-x-auto px-6 pb-4 sm:block lg:px-8">
          <div className="flex min-w-max w-fit gap-1 rounded-full border border-white/[0.08] bg-white/[0.035] p-1 shadow-[0_18px_50px_-38px_rgba(0,0,0,0.95)]">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={target(item.to)}
                end={item.end}
                aria-current={isPreview ? (activeItem.to === item.to ? 'page' : false) : undefined}
                className={({ isActive: routeActive }) => {
                  const isActive = isPreview ? activeItem.to === item.to : routeActive
                  return (
                  `inline-flex min-h-10 items-center rounded-full px-4 py-2 text-sm font-bold transition ${
                    isActive
                      ? 'bg-white text-[#06110f] shadow-lg'
                      : 'text-slate-400 hover:bg-white/[0.055] hover:text-white'
                  }`
                  )
                }}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main id="client-portal-content" className="relative z-[1] mx-auto w-full max-w-7xl px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        {children}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#06110f]/95 shadow-[0_-18px_55px_-32px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:hidden">
        {mobileMenuOpen && <nav id="client-mobile-navigation" aria-label="More client pages" className="absolute inset-x-3 bottom-[calc(100%+0.5rem)] grid grid-cols-2 gap-2 rounded-2xl border border-white/15 bg-[#0a1815] p-3 shadow-2xl">
          {MOBILE_MORE.map(item => <NavLink key={item.to} to={target(item.to)} end={item.end}
            aria-current={isPreview ? (activeItem.to === item.to ? 'page' : false) : undefined}
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) => `flex min-h-12 items-center justify-center rounded-xl border px-3 text-sm font-bold ${(isPreview ? activeItem.to === item.to : isActive) ? 'border-[#2dd4bf]/40 bg-[#2dd4bf]/10 text-white' : 'border-white/10 bg-white/[0.04] text-slate-200'}`}>
            {item.label}
          </NavLink>)}
        </nav>}
        <nav aria-label="Client portal mobile" className="mx-auto grid max-w-xl grid-cols-5 px-1 pb-[calc(0.3rem+env(safe-area-inset-bottom))] pt-1">
          {[...MOBILE_PRIMARY, MOBILE_APPROVALS].map(item => <NavLink key={item.to} to={target(item.to)} end={item.end}
            aria-current={isPreview ? (activeItem.to === item.to ? 'page' : false) : undefined}
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[0.65rem] font-bold leading-none transition-colors ${(isPreview ? activeItem.to === item.to : isActive) ? 'bg-[#2dd4bf]/10 text-[#6ee7d8]' : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'}`}>
            <MobileNavIcon name={item.label} />{item.label}
          </NavLink>)}
          <button type="button" aria-label="More pages" aria-expanded={mobileMenuOpen} aria-controls="client-mobile-navigation"
            onClick={() => setMobileMenuOpen(open => !open)}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[0.65rem] font-bold leading-none ${moreIsActive || mobileMenuOpen ? 'bg-[#2dd4bf]/10 text-[#6ee7d8]' : 'text-slate-400'}`}>
            <MobileNavIcon name="More" />More
          </button>
        </nav>
      </div>
    </div>
  )
}
