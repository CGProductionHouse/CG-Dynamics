import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { isAdminRole, isManagerRole } from '../../lib/roles'
import { PageContainer, PageHeader } from '../../components/layout/PageShell'
import { EmptyState, LoadingState } from '../../components/ui/States'
import { ActionButton } from '../../components/ui/Buttons'
import { Pill } from '../../components/ui/Badges'
import { CARD_PADDING } from '../../lib/layout'
import {
  SOURCE_TYPE_LABELS,
  TRUST_TIER_LABELS,
  filterMarketingSources,
  isUntrustedOrigin,
  listMarketingSources,
  sourceNeedsReview,
  sourceUrl,
  type MarketingSource,
  type SourceFilters,
  type SourceType,
  type TrustTier,
} from '../../lib/marketingLibrary'

// ── Marketing / Knowledge workspace ──────────────────────────────────────────
//
// One Marketing/Knowledge destination that groups the Library, Marketing AI and
// Skill Card Review areas (#182/#183) AND surfaces the live registered sources
// with search, filters and provenance (#184) — read-only, admin-scoped to match
// the RLS on marketing_library_sources. Each area keeps its own route and guard;
// this page is the consolidated home the deeper workspace grows from.

const INPUT_CLS = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-teal/50'

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

// ── Live registered sources ──────────────────────────────────────────────────

function trustTone(tier: TrustTier): 'teal' | 'amber' | 'neutral' {
  if (tier === 'tier_1_primary' || tier === 'tier_2_trusted_professional') return 'teal'
  if (tier === 'needs_review' || tier === 'tier_4_low_trust') return 'amber'
  return 'neutral'
}

function SourceRow({ source }: { source: MarketingSource }) {
  const url = sourceUrl(source)
  const needsReview = sourceNeedsReview(source)
  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">{source.title?.trim() || source.source_name}</p>
          <p className="mt-0.5 truncate text-xs text-white/50">
            {source.author_or_organisation || '—'}
            {source.publication_year ? ` · ${source.publication_year}` : ''}
            {source.country ? ` · ${source.country}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Pill tone={trustTone(source.trust_tier)}>{TRUST_TIER_LABELS[source.trust_tier]}</Pill>
          {url && <a href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-brand-teal hover:text-white">Open source →</a>}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Pill>{SOURCE_TYPE_LABELS[source.source_type]}</Pill>
        {source.commercial_use && source.commercial_use !== 'unknown' && <span className="text-[11px] text-white/45">commercial: {source.commercial_use}</span>}
        {source.ingestion_status && <span className="text-[11px] text-white/40">{source.ingestion_status}</span>}
        {isUntrustedOrigin(source) && <Pill tone="amber">Origin not trusted</Pill>}
        {needsReview && <Pill tone="amber">Needs review</Pill>}
      </div>
    </li>
  )
}

function SourcesSection() {
  const [sources, setSources] = useState<MarketingSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [migrationNeeded, setMigrationNeeded] = useState(false)
  const [filters, setFilters] = useState<SourceFilters>({ query: '', sourceType: 'all', trustTier: 'all', commercialUse: 'all', hasUrl: false, needsReview: false })
  const set = <K extends keyof SourceFilters>(key: K, value: SourceFilters[K]) => setFilters(prev => ({ ...prev, [key]: value }))

  async function load() {
    setLoading(true); setError(null)
    const result = await listMarketingSources()
    setMigrationNeeded(result.migrationNeeded)
    setError(result.error)
    setSources(result.data)
    setLoading(false)
  }
  const loadEvent = useEffectEvent(load)
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadEvent() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const filtered = useMemo(() => filterMarketingSources(sources, filters), [sources, filters])
  const reviewCount = useMemo(() => sources.filter(sourceNeedsReview).length, [sources])

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-black uppercase tracking-[0.12em] text-brand-teal">Sources & provenance</h2>
          <p className="mt-1 text-xs text-white/50">{sources.length} registered source{sources.length === 1 ? '' : 's'}{reviewCount > 0 ? ` · ${reviewCount} need review` : ''}</p>
        </div>
        <ActionButton size="sm" variant="secondary" onClick={() => void load()} loading={loading}>Refresh</ActionButton>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input className={`${INPUT_CLS} min-w-[12rem] flex-1`} placeholder="Search title, author, notes" value={filters.query ?? ''} onChange={e => set('query', e.target.value)} />
        <select className={`${INPUT_CLS} w-auto`} value={filters.sourceType} onChange={e => set('sourceType', e.target.value as SourceType | 'all')}>
          <option value="all">All types</option>
          {(Object.keys(SOURCE_TYPE_LABELS) as SourceType[]).map(t => <option key={t} value={t}>{SOURCE_TYPE_LABELS[t]}</option>)}
        </select>
        <select className={`${INPUT_CLS} w-auto`} value={filters.trustTier} onChange={e => set('trustTier', e.target.value as TrustTier | 'all')}>
          <option value="all">All trust tiers</option>
          {(Object.keys(TRUST_TIER_LABELS) as TrustTier[]).map(t => <option key={t} value={t}>{TRUST_TIER_LABELS[t]}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-white/60"><input type="checkbox" className="h-3.5 w-3.5 accent-teal-400" checked={filters.hasUrl ?? false} onChange={e => set('hasUrl', e.target.checked)} />Has link</label>
        <label className="flex items-center gap-1.5 text-xs text-white/60"><input type="checkbox" className="h-3.5 w-3.5 accent-teal-400" checked={filters.needsReview ?? false} onChange={e => set('needsReview', e.target.checked)} />Needs review</label>
      </div>

      {migrationNeeded ? (
        <p className="rounded-lg border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-sm text-amber-100">The Marketing Library tables are not in this database yet.</p>
      ) : loading ? (
        <LoadingState message="Loading registered sources…" />
      ) : error ? (
        <EmptyState title="Could not load sources" message={error} action={<ActionButton variant="secondary" onClick={() => void load()}>Try again</ActionButton>} />
      ) : sources.length === 0 ? (
        <EmptyState title="No sources visible" message="Registered sources are admin-managed. If you expect sources here, check your access." />
      ) : filtered.length === 0 ? (
        <EmptyState title="No sources match" message="Adjust the search or filters." />
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">{filtered.map(source => <SourceRow key={source.id} source={source} />)}</ul>
      )}
    </section>
  )
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
      {isAdmin && <SourcesSection />}
    </PageContainer>
  )
}
