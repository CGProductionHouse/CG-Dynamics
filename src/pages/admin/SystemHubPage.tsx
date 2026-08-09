import { Link } from 'react-router-dom'
import { PageContainer, PageHeader } from '../../components/layout/PageShell'
import { CARD_PADDING } from '../../lib/layout'

// ── System (admin diagnostics hub) ───────────────────────────────────────────
//
// Diagnostics and low-level health tools are grouped here, out of the daily
// navigation (#182). Admin-only by route guard. Each tool keeps its own route;
// this page is the grouped entry point so System Health and AI usage health no
// longer sit in the primary menu as separate destinations.

interface SystemTool {
  to: string
  title: string
  marker: string
  description: string
}

const TOOLS: SystemTool[] = [
  {
    to: '/admin/import-health',
    title: 'System Health',
    marker: 'SH',
    description: 'Import, sync and reconciliation health — sources, failures and recovery controls.',
  },
  {
    to: '/admin/ai-health',
    title: 'AI Usage Health',
    marker: 'AI',
    description: 'AI provider usage, quota and error diagnostics across CG Dynamics.',
  },
  {
    to: '/admin/microsoft-import',
    title: 'Microsoft Sync',
    marker: 'MS',
    description: 'Planner and Outlook reconciliation diagnostics. Setup lives under Integrations.',
  },
]

export default function SystemHubPage() {
  return (
    <PageContainer width="wide" className="pb-16">
      <PageHeader
        eyebrow="Admin & System"
        title="System"
        description="Diagnostics and health tools for admins. Kept out of daily navigation."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map(tool => (
          <Link key={tool.to} to={tool.to} className={`block rounded-2xl border border-white/10 bg-white/[0.02] ${CARD_PADDING} transition-colors hover:border-brand-teal/40`}>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-teal/10 text-sm font-black text-brand-teal">{tool.marker}</span>
              <div className="min-w-0">
                <h2 className="text-base font-black text-white">{tool.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-brand-primary/70">{tool.description}</p>
              </div>
            </div>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.12em] text-brand-teal">Open →</p>
          </Link>
        ))}
      </div>
    </PageContainer>
  )
}
