import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { ClientLogo } from '../ClientLogo'
import BrandMark from '../BrandMark'
import { useAuth } from '../../contexts/AuthContext'
import type { Client } from '../../lib/db/clients'

const NAV_ITEMS = [
  { to: '/client', label: 'Overview', end: true },
  { to: '/client/performance', label: 'Performance', end: false },
  { to: '/client/campaigns', label: 'Campaigns', end: false },
  { to: '/client/content-calendar', label: 'Content calendar', end: false },
] as const

export function ClientPortalShell({
  client,
  children,
}: {
  client: Client | null
  children: ReactNode
}) {
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#030706] text-report-text">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(23,184,160,0.12),transparent_34%),radial-gradient(circle_at_88%_18%,rgba(193,122,73,0.08),transparent_30%)]"
      />

      <header className="relative z-10 border-b border-white/[0.07] bg-[#030706]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          {client ? (
            <ClientLogo
              client={client}
              boxClassName="h-11 w-11 rounded-lg"
              padding="p-1.5"
              frameClassName="border border-white/10 bg-white/[0.04]"
              textClassName="text-sm font-semibold text-report-accent"
            />
          ) : (
            <BrandMark compact subtitle="Client portal" />
          )}

          {client && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white sm:text-base">{client.name}</p>
              <p className="text-xs text-report-faint">CG Dynamics client portal</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => void signOut()}
            className="ml-auto shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-report-muted transition hover:border-report-accent/40 hover:text-white sm:text-sm"
          >
            Sign out
          </button>
        </div>

        <nav aria-label="Client portal" className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-max gap-1">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-report-accent text-white'
                      : 'border-transparent text-report-faint hover:text-report-muted'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="relative z-[1] mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {children}
      </main>
    </div>
  )
}
