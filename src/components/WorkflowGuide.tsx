import { Link } from 'react-router-dom'

// Simple, friendly map of the reporting workflow so staff always know the next
// step. Rendered at the top of the Reports board (and reusable elsewhere).
const STEPS: { step: number; title: string; hint: string; to: string }[] = [
  { step: 1, title: 'Import data', hint: 'Upload a CSV or summary', to: '/admin/import' },
  { step: 2, title: 'Review draft', hint: 'Open the monthly draft', to: '/admin/reports' },
  { step: 3, title: 'Add strategy', hint: 'Insight & action plan', to: '/admin/reports' },
  { step: 4, title: 'View as client', hint: 'See the final report', to: '/admin/published' },
  { step: 5, title: 'Publish', hint: 'Share with the client', to: '/admin/reports' },
]

export default function WorkflowGuide() {
  return (
    <section className="mb-6 rounded-xl border border-brand-muted bg-brand-surface p-4 sm:p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-brand-accent">How it works</p>
      <h2 className="mt-1.5 text-sm font-semibold text-white">Five simple steps from data to a published client report</h2>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STEPS.map(item => (
          <li key={item.step}>
            <Link
              to={item.to}
              className="flex h-full flex-col gap-1 rounded-lg border border-brand-muted bg-brand-bg/50 p-3 transition-colors hover:border-brand-accent/50 hover:bg-brand-bg"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">
                {item.step}
              </span>
              <span className="mt-1 text-sm font-semibold text-white">{item.title}</span>
              <span className="text-xs text-brand-primary">{item.hint}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
