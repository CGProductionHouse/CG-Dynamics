import { Link } from 'react-router-dom'

// Meta sync is the main workflow. CSV import is a fallback, not a primary step.
const STEPS: { step: number; title: string; hint: string; to: string }[] = [
  { step: 1, title: 'Sync data', hint: 'Meta · Instagram & Facebook', to: '/admin/integrations/meta' },
  { step: 2, title: 'Review report', hint: 'Check draft & data', to: '/admin/reports' },
  { step: 3, title: 'Add CG action plan', hint: 'Strategy & next steps', to: '/admin/reports' },
  { step: 4, title: 'Preview & publish', hint: 'Client-ready report', to: '/admin/published' },
]

export default function WorkflowGuide() {
  return (
    <div className="mb-6 flex items-center gap-1.5 overflow-x-auto rounded-xl border border-brand-muted bg-brand-surface px-3 py-2.5">
      <span className="mr-1 shrink-0 text-[11px] font-medium uppercase tracking-[0.15em] text-brand-accent">Flow:</span>
      {STEPS.map((item) => (
        <Link
          key={item.step}
          to={item.to}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-muted bg-brand-bg/50 px-2.5 py-1.5 text-xs transition-colors hover:border-brand-accent/50 hover:bg-brand-bg"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-accent/15 text-[10px] font-semibold text-brand-accent">
            {item.step}
          </span>
          <span className="font-medium text-white">{item.title}</span>
          <span className="hidden text-brand-primary sm:inline">— {item.hint}</span>
        </Link>
      ))}
      <span className="ml-1 hidden shrink-0 text-[11px] text-brand-primary/70 lg:inline">
        CSV import available as fallback
      </span>
    </div>
  )
}
