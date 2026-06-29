import { Link } from 'react-router-dom'
import { ActionButton } from '../../components/ui/Buttons'

export default function PlannerImportPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight text-white">Planner Import</h1>
        <p className="mt-1 text-sm text-white/45">Dry-run first. Review SQL before running.</p>
      </div>

      <div className="space-y-4">
        <section className="rounded-xl bg-white/[0.03] p-4">
          <h2 className="text-base font-bold text-white">Excel files</h2>
          <p className="mt-1 text-sm text-white/50">Place exports in `docs/planner-exports/`.</p>
          <ul className="mt-3 space-y-1 text-sm text-white/60">
            <li>2025 CLIENTS SCHEDULE.xlsx</li>
            <li>To Do.xlsx</li>
            <li>Client Websites.xlsx</li>
            <li>ADMIN CHECK LIST.xlsx</li>
          </ul>
        </section>

        <section className="rounded-xl bg-white/[0.03] p-4">
          <h2 className="text-base font-bold text-white">Commands</h2>
          <div className="mt-3 space-y-2 text-sm">
            <code className="block rounded-lg bg-brand-bg px-3 py-2 text-white/80">node scripts/import-planner-exports.mjs --mode dry-run</code>
            <code className="block rounded-lg bg-brand-bg px-3 py-2 text-white/80">node scripts/import-planner-exports.mjs --mode generate-sql</code>
          </div>
        </section>

        <section className="rounded-xl bg-amber-400/10 p-4">
          <h2 className="text-base font-bold text-amber-200">Review required</h2>
          <p className="mt-1 text-sm text-amber-100/80">
            Generated SQL is written to `scripts/generated/`. Do not run it until client matches and warnings are checked.
          </p>
        </section>

        <div className="flex flex-wrap gap-2">
          <Link to="/admin/planner"><ActionButton variant="outline" size="sm">Planner</ActionButton></Link>
          <Link to="/admin/package-master"><ActionButton variant="outline" size="sm">Package Master</ActionButton></Link>
          <Link to="/admin/monthly-planner"><ActionButton variant="outline" size="sm">Monthly Planner</ActionButton></Link>
        </div>
      </div>
    </div>
  )
}
