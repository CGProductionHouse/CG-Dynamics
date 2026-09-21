import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  message: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
  centered?: boolean
  compact?: boolean
}

export function EmptyState({
  title,
  message,
  action,
  icon,
  className = '',
  centered = true,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`
        rounded-xl border border-white/8 bg-brand-surface/90 text-center
        ${compact ? 'px-4 py-3' : 'p-5 sm:p-6'}
        ${centered ? 'mx-auto max-w-xl' : ''}
        ${className}
      `}
    >
      {icon && (
        <div className={`${compact ? 'mb-2' : 'mb-4'} flex justify-center`}>
          <div className={`${compact ? 'h-8 w-8' : 'h-11 w-11'} flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-brand-primary/70`}>
            {icon}
          </div>
        </div>
      )}
      <h2 className={`${compact ? 'text-sm' : 'text-base sm:text-lg'} font-bold text-white`}>{title}</h2>
      <p className={`${compact ? 'mt-1 text-xs' : 'mt-2 text-sm leading-relaxed'} mx-auto max-w-md text-brand-primary/80`}>{message}</p>
      {action && <div className={compact ? 'mt-2' : 'mt-4'}>{action}</div>}
    </div>
  )
}

interface LoadingStateProps {
  message?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function LoadingState({ message = 'Loading…', className = '', size = 'md' }: LoadingStateProps) {
  const sizes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-8 ${className}`}>
      <div className={`${sizes[size]} animate-spin rounded-full border-3 border-white/10 border-t-brand-accent`} />
      {message && <p className="text-sm text-brand-primary">{message}</p>}
    </div>
  )
}

interface SkeletonProps {
  className?: string
  width?: string
  height?: string
  rounded?: boolean
}

export function Skeleton({ className = '', width = '100%', height = '1rem', rounded = true }: SkeletonProps) {
  return (
    <div
      className={`
        animate-pulse rounded bg-white/10
        ${rounded ? 'rounded-lg' : ''}
        ${className}
      `}
      style={{ width, height }}
    />
  )
}

interface SkeletonCardProps {
  className?: string
  lines?: number
}

export function SkeletonCard({ className = '', lines = 3 }: SkeletonCardProps) {
  return (
    <div className={`rounded-xl border border-white/8 bg-brand-surface p-4 sm:p-5 ${className}`}>
      <div className="h-6 w-1/4 bg-white/10 animate-pulse rounded mb-4" />
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-4 bg-white/10 animate-pulse rounded" style={{ width: `${60 + Math.random() * 30}%` }} />
        ))}
      </div>
    </div>
  )
}
