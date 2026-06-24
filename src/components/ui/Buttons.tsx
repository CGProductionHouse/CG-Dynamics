import type { ReactNode, ButtonHTMLAttributes } from 'react'

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}

export function ActionButton({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}: ActionButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center font-semibold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 focus:ring-offset-brand-bg disabled:opacity-60 disabled:cursor-not-allowed'

  const variantClasses = {
    primary: 'bg-brand-accent text-brand-bg hover:brightness-110',
    secondary: 'border border-brand-muted bg-brand-muted/50 text-brand-primary hover:text-white hover:border-white/30',
    outline: 'border border-brand-accent bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/20',
    ghost: 'text-brand-primary hover:text-white hover:bg-white/[0.05]',
    danger: 'border border-red-400/30 bg-red-400/10 text-red-300 hover:bg-red-400/20',
  }

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  const widthClass = fullWidth ? 'w-full' : ''

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>Loading…</span>
        </span>
      ) : (
        <>
          {leftIcon && <span className="mr-2">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="ml-2">{rightIcon}</span>}
        </>
      )}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  ariaLabel: string
}

export function IconButton({ children, variant = 'ghost', size = 'md', ariaLabel, className = '', ...props }: IconButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 focus:ring-offset-brand-bg'

  const variantClasses = {
    primary: 'bg-brand-accent text-brand-bg hover:brightness-110',
    secondary: 'border border-brand-muted bg-brand-muted/50 text-brand-primary hover:text-white hover:border-white/30',
    ghost: 'text-brand-primary hover:text-white hover:bg-white/[0.05]',
    danger: 'border border-red-400/30 bg-red-400/10 text-red-300 hover:bg-red-400/20',
  }

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  }

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </button>
  )
}

interface ButtonGroupProps {
  children: ReactNode
  className?: string
  vertical?: boolean
}

export function ButtonGroup({ children, className = '', vertical = false }: ButtonGroupProps) {
  return (
    <div className={`flex gap-2 ${vertical ? 'flex-col' : 'flex-wrap'} ${className}`}>
      {children}
    </div>
  )
}