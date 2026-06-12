import type { ReactNode } from 'react'
import BrandMark from './BrandMark'

// Shared branded, mobile-friendly card used by the auth screens.
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="min-h-screen bg-brand-bg bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.1),transparent_28rem)] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm bg-brand-surface/95 border border-brand-muted rounded-xl p-6 shadow-[0_0_50px_rgba(45,212,191,0.1)] sm:p-8">
        <div className="mb-7 flex justify-center">
          <BrandMark subtitle="Client reporting portal" />
        </div>
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-brand-primary">{subtitle}</p>}
        </div>
        {children}
        {footer && <div className="mt-6 text-center text-sm text-brand-primary">{footer}</div>}
      </div>
    </div>
  )
}

export function AuthMessage({ tone, children }: { tone: 'success' | 'error' | 'info'; children: ReactNode }) {
  const styles =
    tone === 'success'
      ? 'text-brand-accent bg-brand-accent/10 border-brand-accent/20'
      : tone === 'error'
        ? 'text-red-400 bg-red-400/10 border-red-400/20'
        : 'text-amber-200 bg-amber-400/10 border-amber-400/20'
  return (
    <p role="alert" className={`rounded-lg border px-3 py-2 text-sm ${styles}`}>
      {children}
    </p>
  )
}
