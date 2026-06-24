import type { ReactNode } from 'react'

interface PremiumCardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  border?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function PremiumCard({
  children,
  className = '',
  hover = false,
  border = true,
  padding = 'md',
}: PremiumCardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-3 sm:p-4',
    md: 'p-4 sm:p-5 lg:p-6',
    lg: 'p-6 sm:p-8',
  }

  return (
    <article
      className={`
        rounded-2xl
        bg-brand-surface
        ${border ? 'border border-brand-muted' : ''}
        ${paddingClasses[padding]}
        ${hover ? 'transition-all duration-200 hover:border-brand-accent/30 hover:bg-white/[0.03]' : ''}
        ${className}
      `}
    >
      {children}
    </article>
  )
}

interface PremiumCardHeaderProps {
  title: string
  subtitle?: string
  eyebrow?: string
  action?: ReactNode
  className?: string
}

export function PremiumCardHeader({
  title,
  subtitle,
  eyebrow,
  action,
  className = '',
}: PremiumCardHeaderProps) {
  return (
    <div className={`mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between ${className}`}>
      <div>
        {eyebrow && (
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-accent">{eyebrow}</p>
        )}
        <h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-brand-primary">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 mt-2 sm:mt-0">{action}</div>}
    </div>
  )
}

interface SectionHeaderProps {
  eyebrow: string
  title: string
  subtitle?: string
  className?: string
}

export function SectionHeader({ eyebrow, title, subtitle, className = '' }: SectionHeaderProps) {
  return (
    <div className={`mb-5 ${className}`}>
      <p className="text-xs font-black uppercase tracking-[0.26em] text-brand-accent">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white sm:text-3xl">{title}</h2>
      {subtitle && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-brand-primary">{subtitle}</p>}
    </div>
  )
}

interface CardGridProps {
  children: ReactNode
  columns?: 1 | 2 | 3 | 4
  gap?: number
  className?: string
}

export function CardGrid({ children, columns = 2, gap = 4, className = '' }: CardGridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <div className={`${gridCols[columns]} gap-${gap} ${className}`}>
      {children}
    </div>
  )
}