import type { ReactNode } from 'react'
import BrandMark from '../../components/BrandMark'

export function OnboardingShell({ children, step }: { children: ReactNode; step?: number }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#030706] text-report-text">
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(23,184,160,0.16),transparent_34%),radial-gradient(circle_at_90%_18%,rgba(193,122,73,0.12),transparent_32%)]" />
      <header className="relative z-10 border-b border-white/[0.07] bg-[#030706]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <BrandMark compact subtitle="Welcome to CG" />
          {step !== undefined && step > 0 && step < 5 && (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-report-muted">
              {step} of 4
            </span>
          )}
        </div>
      </header>
      <main className="relative z-[1] mx-auto w-full max-w-3xl px-4 py-8 pb-28 sm:px-6 sm:py-12">
        {children}
      </main>
    </div>
  )
}
