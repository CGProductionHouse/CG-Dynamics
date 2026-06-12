export default function BrandMark({
  subtitle,
  compact = false,
}: {
  subtitle?: string
  compact?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex shrink-0 items-center justify-center rounded-xl border border-brand-accent/30 bg-brand-accent/10 font-black tracking-tight text-brand-accent shadow-[0_0_30px_rgba(45,212,191,0.12)] ${
          compact ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm'
        }`}
      >
        CG
      </div>
      <div className="min-w-0">
        <p className="truncate text-base font-semibold leading-tight text-white">CG Dynamics</p>
        {subtitle && <p className="mt-0.5 truncate text-xs text-brand-primary">{subtitle}</p>}
      </div>
    </div>
  )
}
