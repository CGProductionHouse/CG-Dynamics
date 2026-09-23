import { useEffect, useState, type ReactNode } from 'react'

type LoadingVariant = 'page' | 'report' | 'calendar'

export function ClientPortalLoadingState({
  variant = 'page',
  delayMs = 180,
}: {
  variant?: LoadingVariant
  delayMs?: number
}) {
  const [visible, setVisible] = useState(delayMs === 0)

  useEffect(() => {
    if (delayMs === 0) return
    const timer = window.setTimeout(() => setVisible(true), delayMs)
    return () => window.clearTimeout(timer)
  }, [delayMs])

  return (
    <div className="min-h-[22rem]" aria-busy="true">
      {visible && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Loading your workspace"
          className="animate-pulse space-y-5 motion-reduce:animate-none"
        >
          <span className="sr-only">Loading your workspace…</span>
          <div className={`rounded-[2rem] border border-white/[0.08] bg-white/[0.035] ${variant === 'calendar' ? 'h-36' : 'h-48 sm:h-64'}`} />
          <div className={`grid gap-4 ${variant === 'report' ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
            <SkeletonBlock />
            <SkeletonBlock />
            {variant !== 'report' && <SkeletonBlock className="sm:col-span-2 lg:col-span-1" />}
          </div>
        </div>
      )}
    </div>
  )
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`h-32 rounded-3xl border border-white/[0.08] bg-white/[0.025] ${className}`} />
}

export function ClientPortalErrorState({
  title = 'This area could not be loaded',
  message = 'Please try again shortly. Your client data remains safe.',
}: {
  title?: string
  message?: string
}) {
  return (
    <section role="alert" className="relative min-h-72 overflow-hidden rounded-[2rem] border border-[#f97316]/20 bg-[#f97316]/[0.055] px-6 py-10 shadow-2xl sm:px-9">
      <div aria-hidden className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#f97316]/10 blur-3xl" />
      <div className="relative max-w-2xl">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f6a15f]">Temporarily unavailable</p>
        <h1 className="mt-4 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">{title}</h1>
        <p className="mt-4 text-sm leading-6 text-slate-400">{message}</p>
      </div>
    </section>
  )
}

export function ClientPortalEmptyState({
  eyebrow,
  title,
  message,
  action,
}: {
  eyebrow: string
  title: string
  message: string
  action?: ReactNode
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[radial-gradient(circle_at_90%_10%,rgba(45,212,191,0.11),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] px-6 py-9 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.95)] sm:px-9 sm:py-11">
      <div className="max-w-2xl">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[#2dd4bf]">{eyebrow}</p>
        <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">{title}</h2>
        <p className="mt-4 text-sm leading-7 text-slate-400 sm:text-base">{message}</p>
        {action && <div className="mt-7">{action}</div>}
      </div>
    </section>
  )
}
