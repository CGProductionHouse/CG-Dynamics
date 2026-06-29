import type { ReactNode } from 'react'

type StatusVariant =
  | 'published'
  | 'ready-to-publish'
  | 'needs-strategy'
  | 'internal-draft'
  | 'incomplete-month'
  | 'needs-repair'
  | 'default'

const STATUS_STYLES: Record<StatusVariant, string> = {
  published: 'bg-brand-teal/18 text-[#66d0c3] border-brand-teal/30',
  'ready-to-publish': 'bg-sky-300/15 text-sky-200 border-sky-300/30',
  'needs-strategy': 'bg-amber-400/15 text-amber-300 border-amber-400/30',
  'internal-draft': 'bg-white/[0.06] text-brand-primary border-white/10',
  'incomplete-month': 'bg-white/[0.06] text-brand-primary border-white/10',
  'needs-repair': 'bg-amber-400/15 text-amber-300 border-amber-400/30',
  default: 'bg-brand-muted text-brand-primary border-brand-muted/50',
}

interface StatusBadgeProps {
  label: string
  variant?: StatusVariant
  className?: string
  size?: 'sm' | 'md'
}

export function StatusBadge({ label, variant = 'default', className = '', size = 'sm' }: StatusBadgeProps) {
  const baseClasses = 'inline-flex items-center rounded-full border px-2.5 font-medium transition-colors'
  const sizeClasses = size === 'sm' ? 'py-0.5 text-[11px]' : 'py-1 text-xs'

  return (
    <span className={`${baseClasses} ${sizeClasses} ${STATUS_STYLES[variant]} ${className}`}>
      {label}
    </span>
  )
}

export type SourceVariant = 'meta' | 'manual' | 'mixed' | 'none'

const SOURCE_STYLES: Record<SourceVariant, string> = {
  meta: 'bg-brand-teal/15 text-[#66d0c3] border-brand-teal/30',
  manual: 'bg-white/[0.06] text-brand-primary border-white/10',
  mixed: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
  none: 'bg-brand-muted/50 text-brand-primary/60 border-brand-muted/30',
}

const SOURCE_LABELS: Record<SourceVariant, string> = {
  meta: 'Meta synced',
  manual: 'Manual fallback',
  mixed: 'Mixed source',
  none: 'No data',
}

interface SourceBadgeProps {
  source: SourceVariant
  className?: string
  size?: 'sm' | 'md'
  showLabel?: boolean
  customLabel?: string
}

export function SourceBadge({
  source,
  className = '',
  size = 'sm',
  showLabel = true,
  customLabel,
}: SourceBadgeProps) {
  const baseClasses = 'inline-flex items-center rounded-full border px-2.5 font-medium transition-colors'
  const sizeClasses = size === 'sm' ? 'py-0.5 text-[11px]' : 'py-1 text-xs'

  return (
    <span className={`${baseClasses} ${sizeClasses} ${SOURCE_STYLES[source]} ${className}`}>
      {showLabel && (customLabel ?? SOURCE_LABELS[source])}
    </span>
  )
}

interface ReadinessBadgeProps {
  ready: boolean
  className?: string
  size?: 'sm' | 'md'
}

export function ReadinessBadge({ ready, className = '', size = 'sm' }: ReadinessBadgeProps) {
  const baseClasses = 'inline-flex items-center rounded-full border px-2.5 font-medium transition-colors'
  const sizeClasses = size === 'sm' ? 'py-0.5 text-[11px]' : 'py-1 text-xs'

  if (ready) {
    return (
      <span className={`${baseClasses} ${sizeClasses} bg-brand-accent/20 text-brand-accent border-brand-accent/30 ${className}`}>
        Ready for review
      </span>
    )
  }

    return (
      <span className={`${baseClasses} ${sizeClasses} bg-amber-400/15 text-amber-300 border-amber-400/30 ${className}`}>
        Needs action
      </span>
    )
}

interface PillProps {
  children: ReactNode
  tone?: 'neutral' | 'teal' | 'amber' | 'accent'
  className?: string
}

export function Pill({ children, tone = 'neutral', className = '' }: PillProps) {
  const tones = {
    neutral: 'border-white/10 bg-white/[0.06] text-brand-primary',
    teal: 'border-brand-teal/25 bg-brand-teal/12 text-[#66d0c3]',
    amber: 'border-brand-accent/25 bg-brand-accent/12 text-[#f2b66f]',
    accent: 'border-brand-accent/25 bg-brand-accent/12 text-[#f2b66f]',
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${tones[tone]} ${className}`}>
      {children}
    </span>
  )
}

interface GrowthBadgeProps {
  direction: 'up' | 'down' | 'flat' | null
  percent?: number | null
  change?: number | null
  comparisonLabel?: string | null
  className?: string
}

export function GrowthBadge({ direction, percent, change, comparisonLabel, className = '' }: GrowthBadgeProps) {
  if (!direction) {
    return <span className={`text-xs font-medium text-brand-primary ${className}`}>No comparison</span>
  }

  const up = direction === 'up'
  const down = direction === 'down'
  const tone = up ? 'text-[#2dd4bf]' : down ? 'text-[#f59e0b]' : 'text-slate-400'
  const arrow = up ? '↑' : down ? '↓' : '→'

  const value =
    percent !== null && percent !== undefined
      ? `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`
      : change !== null && change !== undefined
        ? `${change > 0 ? '+' : ''}${change}`
        : ''

  return (
    <span className={`flex flex-wrap items-baseline gap-x-2 text-sm font-bold ${tone} ${className}`}>
      <span>{arrow} {value}</span>
      {comparisonLabel && <span className="text-xs font-medium text-brand-primary">{comparisonLabel}</span>}
    </span>
  )
}
