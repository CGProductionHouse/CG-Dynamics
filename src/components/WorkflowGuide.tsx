import { Link } from 'react-router-dom'

const STEPS: { step: number; title: string; hint: string; to: string }[] = [
  { step: 1, title: 'Import data', hint: 'Upload CSV or summary', to: '/admin/import' },
  { step: 2, title: 'Review draft', hint: 'Open monthly draft', to: '/admin/reports' },
  { step: 3, title: 'Add strategy', hint: 'Insight & action plan', to: '/admin/reports' },
  { step: 4, title: 'Preview as client', hint: 'See final report', to: '/admin/published' },
  { step: 5, title: 'Publish', hint: 'Share with client', to: '/admin/reports' },
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
    </div>
  )
}
