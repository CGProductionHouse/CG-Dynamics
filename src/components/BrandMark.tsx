import { useState } from 'react'

type BrandMarkSize = 'small' | 'auth' | 'report'

export default function BrandMark({
  subtitle,
  compact = false,
  size,
}: {
  subtitle?: string
  compact?: boolean
  size?: BrandMarkSize
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const resolvedSize: BrandMarkSize = size ?? (compact ? 'small' : 'auth')
  const iconSize = {
    small: 'h-9 w-9 rounded-lg',
    auth: 'h-12 w-12 rounded-xl',
    report: 'h-11 w-11 rounded-xl',
  }[resolvedSize]
  const textSize = resolvedSize === 'auth' ? 'text-lg' : 'text-base'

  return (
    <div className="flex items-center gap-3">
      {imageFailed ? (
        <div
          className={`flex shrink-0 items-center justify-center border border-brand-accent/30 bg-brand-accent/10 text-xs font-black tracking-tight text-brand-accent ${iconSize}`}
        >
          CG
        </div>
      ) : (
        <img
          src="/CG_App_Icon.png"
          alt="CG Dynamics"
          onError={() => setImageFailed(true)}
          className={`shrink-0 border border-brand-muted/70 bg-brand-bg object-contain ${iconSize}`}
        />
      )}
      <div className="min-w-0">
        <p className={`truncate font-semibold leading-tight text-white ${textSize}`}>CG Dynamics</p>
        {subtitle && <p className="mt-0.5 truncate text-xs text-brand-primary">{subtitle}</p>}
      </div>
    </div>
  )
}
