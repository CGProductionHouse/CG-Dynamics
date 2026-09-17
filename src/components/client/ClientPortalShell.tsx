import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ClientLogo } from '../ClientLogo'
import BrandMark from '../BrandMark'
import { useAuth } from '../../contexts/AuthContext'
import type { Client } from '../../lib/db/clients'

const NAV_ITEMS = [
  { to: '/client', label: 'Overview', end: true },
  { to: '/client/plan', label: 'Plan', end: false },
  { to: '/client/performance', label: 'Performance', end: false },
  { to: '/client/approvals', label: 'Approvals', end: false },
  { to: '/client/brand-hub', label: 'Brand Hub', end: false },
] as const

export function ClientPortalShell({
  client,
  children,
}: {
  client: Client | null
  children: ReactNode
}) {
  const { signOut } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const activeItem = NAV_ITEMS.find(item => item.end
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to)) ?? NAV_ITEMS[0]

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

          <button
            type="button"
            onClick={() => void signOut()}
            className="ml-auto min-h-11 shrink-0 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs font-bold text-slate-400 transition hover:border-[#2dd4bf]/35 hover:bg-white/[0.06] hover:text-white sm:text-sm"
          >
            Sign out
          </button>
        </div>

        <div className="mx-auto px-4 pb-4 sm:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(open => !open)}
            className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.045] px-4 text-sm font-bold text-white shadow-[0_16px_45px_-35px_rgba(0,0,0,0.95)]"
            aria-expanded={mobileMenuOpen}
            aria-controls="client-mobile-navigation"
          >
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2dd4bf] shadow-[0_0_14px_rgba(45,212,191,0.8)]" />
              {activeItem.label}
            </span>
            <span aria-hidden className="text-xs text-slate-500">{mobileMenuOpen ? 'Close' : 'Menu'}</span>
          </button>
          {mobileMenuOpen && (
            <nav id="client-mobile-navigation" aria-label="Client portal mobile" className="mt-2 grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.08] bg-[#07110f]/95 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-2xl">
              {NAV_ITEMS.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
                      isActive
                        ? 'border-[#2dd4bf]/35 bg-[#2dd4bf]/10 text-white shadow-[inset_0_0_18px_rgba(45,212,191,0.05)]'
                        : 'border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-white'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
        </div>

        <nav aria-label="Client portal" className="mx-auto hidden max-w-7xl overflow-x-auto px-6 pb-4 sm:block lg:px-8">
          <div className="flex min-w-max w-fit gap-1 rounded-full border border-white/[0.08] bg-white/[0.035] p-1 shadow-[0_18px_50px_-38px_rgba(0,0,0,0.95)]">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `inline-flex min-h-10 items-center rounded-full px-4 py-2 text-sm font-bold transition ${
                    isActive
                      ? 'bg-white text-[#06110f] shadow-lg'
                      : 'text-slate-400 hover:bg-white/[0.055] hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main id="client-portal-content" className="relative z-[1] mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        {children}
      </main>
    </div>
  )
}
