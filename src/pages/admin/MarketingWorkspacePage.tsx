import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { isAdminRole, isManagerRole } from '../../lib/roles'
import { PageContainer, PageHeader } from '../../components/layout/PageShell'
import { CARD_PADDING } from '../../lib/layout'

// ── Marketing / Knowledge workspace (parent destination) ─────────────────────
//
// One coherent Marketing/Knowledge destination that groups the previously
// separate top-level tools — the Library, Marketing AI and Skill Card Review —
// behind a single nav entry (#182). Each area keeps its own route and its own
// route-level permission guard; this page is the map into them and the landing
// spot the deeper #183/#184 workspace will grow from. No data or permissions
// change here.

interface WorkspaceArea {
  to: string
  title: string
  marker: string
  description: string
  canOpen: boolean
  lockedNote: string
}

function AreaCard({ area }: { area: WorkspaceArea }) {
  const body: ReactNode = (
    <>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-teal/10 text-sm font-black text-brand-teal">{area.marker}</span>
        <div className="min-w-0">
          <h2 className="text-base font-black text-white">{area.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-brand-primary/70">{area.canOpen ? area.description : area.lockedNote}</p>
        </div>
      </div>
      <p className={`mt-4 text-xs font-black uppercase tracking-[0.12em] ${area.canOpen ? 'text-brand-teal' : 'text-brand-primary/40'}`}>
        {area.canOpen ? 'Open →' : 'Admin only'}
      </p>
    </>
  )
  const cls = `block rounded-2xl border ${CARD_PADDING} transition-colors ${area.canOpen ? 'border-white/10 bg-white/[0.02] hover:border-brand-teal/40' : 'border-white/8 bg-white/[0.01] opacity-70'}`
  return area.canOpen ? <Link to={area.to} className={cls}>{body}</Link> : <div className={cls} aria-disabled>{body}</div>
}

export default function MarketingWorkspacePage() {
  const { profile } = useAuth()
  const isAdmin = isAdminRole(profile?.role)
  const isManager = isManagerRole(profile?.role)

  const areas: WorkspaceArea[] = [
    {
      to: '/admin/marketing-library',
      title: 'Library',
      marker: 'LB',
      description: 'Approved, searchable marketing knowledge — general principles, industry packs and client-linked notes.',
      canOpen: isAdmin,
      lockedNote: 'Approved marketing knowledge. Managed by admins.',
    },
    {
      to: '/admin/marketing-ai',
      title: 'Marketing AI',
      marker: 'AI',
      description: 'AI marketing actions grounded in approved knowledge. Drafts are saved for review, never auto-published.',
      canOpen: isManager,
      lockedNote: 'AI marketing actions. Available to managers and admins.',
    },
    {
      to: '/admin/skill-card-review',
      title: 'Skill Card Review',
      marker: 'SC',
      description: 'The draft, review, approval and retirement queue for skill cards and playbooks.',
      canOpen: isAdmin,
      lockedNote: 'Skill card review queue. Managed by admins.',
    },
  ]

  return (
    <PageContainer width="wide" className="pb-16">
      <PageHeader
        eyebrow="Marketing & Knowledge"
        title="Marketing"
        description="Trusted marketing knowledge, AI assistance and skill-card review in one place."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {areas.map(area => <AreaCard key={area.to} area={area} />)}
      </div>
    </PageContainer>
  )
}
