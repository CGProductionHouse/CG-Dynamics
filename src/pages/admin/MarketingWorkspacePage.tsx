import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { isAdminRole, isManagerRole } from '../../lib/roles'
import { PageContainer, PageHeader } from '../../components/layout/PageShell'
import { EmptyState, LoadingState } from '../../components/ui/States'
import { ActionButton } from '../../components/ui/Buttons'
import { Pill } from '../../components/ui/Badges'
import {
  listActiveSharedSkillCards,
  listMarketingLibrarySources,
  listSkillCards,
  type MarketingLibrarySource,
  type SkillCardRecord,
  type SourceTrustTier,
} from '../../lib/marketing-library/skillCardsData'
import {
  INDUSTRY_LABELS,
  KNOWLEDGE_LAYER_LABELS,
  SKILL_STATUS_LABELS,
  SOURCE_TYPE_LABELS,
  TRUST_TIER_LABELS,
  filterMarketingSources,
  filterSkillCards,
  isUntrustedOrigin,
  skillCardIsStale,
  skillCardMissingSource,
  skillCardNeedsReview,
  sourceNeedsReview,
  sourceUrl,
  type SkillCardFilters,
  type SourceFilters,
} from '../../lib/marketing-library/knowledgeFilters'
import { REGISTRATION_MANIFEST, classifyRegistrations } from '../../lib/marketing-library/sourceRegistry'
import type { IndustryTag, KnowledgeLayer, SkillCardStatus, SourceType } from '../../types/skillCards'

// ── Marketing / Knowledge workspace (#183/#184) ──────────────────────────────
//
// ONE consolidated destination over the canonical Marketing Library data layer
// (src/lib/marketing-library/skillCardsData.ts) — no parallel data model. Staff
// can search approved shared knowledge; admins get sources, review queues and
// the repository registration inventory. Every read respects the existing RLS
// (staff → active shared cards only; sources/reviews → admin). Nothing here
// writes, approves or bypasses a boundary.

const INPUT_CLS = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-teal/50'
const today = () => new Date().toISOString().slice(0, 10)

type Section = 'library' | 'sources' | 'review' | 'registration' | 'ai'

function trustTone(tier: SourceTrustTier): 'teal' | 'amber' | 'neutral' {
  if (tier === 'tier_1_primary' || tier === 'tier_2_trusted_professional') return 'teal'
  if (tier === 'needs_review' || tier === 'tier_4_low_trust') return 'amber'
  return 'neutral'
}
function statusTone(status: SkillCardStatus): 'teal' | 'amber' | 'neutral' {
  if (status === 'active') return 'teal'
  if (status === 'deprecated') return 'neutral'
  return 'amber'
}

// ── Library (skill cards) ────────────────────────────────────────────────────

function SkillCardRow({ card }: { card: SkillCardRecord }) {
  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">{card.title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-white/60">{card.summary}</p>
        </div>
        <Pill tone={statusTone(card.status)}>{SKILL_STATUS_LABELS[card.status]}</Pill>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Pill>{card.category}</Pill>
        <span className="text-[11px] text-white/45">{KNOWLEDGE_LAYER_LABELS[card.knowledge_layer]}</span>
        {card.relevant_industries.slice(0, 3).map(ind => <span key={ind} className="text-[11px] text-white/40">{INDUSTRY_LABELS[ind]}</span>)}
        {card.client_specific && <Pill tone="amber">Client-specific</Pill>}
        {skillCardMissingSource(card) && <Pill tone="amber">No source</Pill>}
        {skillCardIsStale(card, today()) && <Pill tone="amber">Stale</Pill>}
      </div>
    </li>
  )
}

function useSkillCards(adminAllStates: boolean) {
  const [cards, setCards] = useState<SkillCardRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [migrationNeeded, setMigrationNeeded] = useState(false)
  async function load() {
    setLoading(true); setError(null)
    const result = adminAllStates ? await listSkillCards() : await listActiveSharedSkillCards()
    setMigrationNeeded(result.migrationNeeded); setError(result.error); setCards(result.data); setLoading(false)
  }
  const loadEvent = useEffectEvent(load)
  useEffect(() => { const t = window.setTimeout(() => void loadEvent(), 0); return () => window.clearTimeout(t) }, [adminAllStates])
  return { cards, loading, error, migrationNeeded, reload: load }
}

function LibrarySection({ isAdmin }: { isAdmin: boolean }) {
  const [allStates, setAllStates] = useState(false)
  const { cards, loading, error, migrationNeeded, reload } = useSkillCards(isAdmin && allStates)
  const [filters, setFilters] = useState<SkillCardFilters>({ query: '', category: 'all', knowledgeLayer: 'all', industry: 'all', status: 'all' })
  const set = <K extends keyof SkillCardFilters>(k: K, v: SkillCardFilters[K]) => setFilters(p => ({ ...p, [k]: v }))
  const categories = useMemo(() => [...new Set(cards.map(c => c.category))].sort(), [cards])
  const filtered = useMemo(() => filterSkillCards(cards, filters, today()), [cards, filters])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-xs text-white/50">{cards.length} {isAdmin && allStates ? 'card' : 'approved shared card'}{cards.length === 1 ? '' : 's'}{isAdmin ? '' : ' you can use'}</p>
        <div className="flex items-center gap-2">
          {isAdmin && <label className="flex items-center gap-1.5 text-xs text-white/60"><input type="checkbox" className="h-3.5 w-3.5 accent-teal-400" checked={allStates} onChange={e => setAllStates(e.target.checked)} />All states</label>}
          <ActionButton size="sm" variant="secondary" onClick={() => void reload()} loading={loading}>Refresh</ActionButton>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${INPUT_CLS} min-w-[12rem] flex-1`} placeholder="Search knowledge (title, summary, principle)" value={filters.query ?? ''} onChange={e => set('query', e.target.value)} />
        <select className={`${INPUT_CLS} w-auto`} value={filters.category} onChange={e => set('category', e.target.value)}><option value="all">All categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select className={`${INPUT_CLS} w-auto`} value={filters.knowledgeLayer} onChange={e => set('knowledgeLayer', e.target.value as KnowledgeLayer | 'all')}><option value="all">All layers</option>{(Object.keys(KNOWLEDGE_LAYER_LABELS) as KnowledgeLayer[]).map(l => <option key={l} value={l}>{KNOWLEDGE_LAYER_LABELS[l]}</option>)}</select>
        <select className={`${INPUT_CLS} w-auto`} value={filters.industry} onChange={e => set('industry', e.target.value as IndustryTag | 'all')}><option value="all">All industries</option>{(Object.keys(INDUSTRY_LABELS) as IndustryTag[]).map(i => <option key={i} value={i}>{INDUSTRY_LABELS[i]}</option>)}</select>
        {isAdmin && allStates && <select className={`${INPUT_CLS} w-auto`} value={filters.status} onChange={e => set('status', e.target.value as SkillCardStatus | 'all')}><option value="all">All statuses</option>{(Object.keys(SKILL_STATUS_LABELS) as SkillCardStatus[]).map(s => <option key={s} value={s}>{SKILL_STATUS_LABELS[s]}</option>)}</select>}
      </div>
      {migrationNeeded ? <p className="rounded-lg border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-sm text-amber-100">The Marketing Library tables are not in this database yet.</p>
        : loading ? <LoadingState message="Loading knowledge…" />
        : error ? <EmptyState title="Could not load knowledge" message={error} action={<ActionButton variant="secondary" onClick={() => void reload()}>Try again</ActionButton>} />
        : cards.length === 0 ? <EmptyState title="No approved knowledge yet" message="Approved shared skill cards will appear here." />
        : filtered.length === 0 ? <EmptyState title="No knowledge matches" message="Adjust the search or filters." />
        : <ul className="grid gap-2 lg:grid-cols-2">{filtered.map(card => <SkillCardRow key={card.id} card={card} />)}</ul>}
    </div>
  )
}

// ── Sources & provenance (admin) ─────────────────────────────────────────────

function useSources() {
  const [sources, setSources] = useState<MarketingLibrarySource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [migrationNeeded, setMigrationNeeded] = useState(false)
  async function load() {
    setLoading(true); setError(null)
    const result = await listMarketingLibrarySources()
    setMigrationNeeded(result.migrationNeeded); setError(result.error); setSources(result.data); setLoading(false)
  }
  const loadEvent = useEffectEvent(load)
  useEffect(() => { const t = window.setTimeout(() => void loadEvent(), 0); return () => window.clearTimeout(t) }, [])
  return { sources, loading, error, migrationNeeded, reload: load }
}

function SourceRow({ source }: { source: MarketingLibrarySource }) {
  const url = sourceUrl(source)
  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">{source.title?.trim() || source.source_name}</p>
          <p className="mt-0.5 truncate text-xs text-white/50">{source.author_or_organisation || '—'}{source.publication_year ? ` · ${source.publication_year}` : ''}</p>
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
        {sourceNeedsReview(source) && <Pill tone="amber">Needs review</Pill>}
      </div>
    </li>
  )
}

function SourcesSection() {
  const { sources, loading, error, migrationNeeded, reload } = useSources()
  const [filters, setFilters] = useState<SourceFilters>({ query: '', sourceType: 'all', trustTier: 'all', hasUrl: false, needsReview: false })
  const set = <K extends keyof SourceFilters>(k: K, v: SourceFilters[K]) => setFilters(p => ({ ...p, [k]: v }))
  const filtered = useMemo(() => filterMarketingSources(sources, filters), [sources, filters])
  const reviewCount = useMemo(() => sources.filter(sourceNeedsReview).length, [sources])
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-xs text-white/50">{sources.length} registered source{sources.length === 1 ? '' : 's'}{reviewCount > 0 ? ` · ${reviewCount} need review` : ''}</p>
        <ActionButton size="sm" variant="secondary" onClick={() => void reload()} loading={loading}>Refresh</ActionButton>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${INPUT_CLS} min-w-[12rem] flex-1`} placeholder="Search title, author, notes" value={filters.query ?? ''} onChange={e => set('query', e.target.value)} />
        <select className={`${INPUT_CLS} w-auto`} value={filters.sourceType} onChange={e => set('sourceType', e.target.value as SourceType | 'all')}><option value="all">All types</option>{(Object.keys(SOURCE_TYPE_LABELS) as SourceType[]).map(t => <option key={t} value={t}>{SOURCE_TYPE_LABELS[t]}</option>)}</select>
        <select className={`${INPUT_CLS} w-auto`} value={filters.trustTier} onChange={e => set('trustTier', e.target.value as SourceTrustTier | 'all')}><option value="all">All trust tiers</option>{(Object.keys(TRUST_TIER_LABELS) as SourceTrustTier[]).map(t => <option key={t} value={t}>{TRUST_TIER_LABELS[t]}</option>)}</select>
        <label className="flex items-center gap-1.5 text-xs text-white/60"><input type="checkbox" className="h-3.5 w-3.5 accent-teal-400" checked={filters.hasUrl ?? false} onChange={e => set('hasUrl', e.target.checked)} />Has link</label>
        <label className="flex items-center gap-1.5 text-xs text-white/60"><input type="checkbox" className="h-3.5 w-3.5 accent-teal-400" checked={filters.needsReview ?? false} onChange={e => set('needsReview', e.target.checked)} />Needs review</label>
      </div>
      {migrationNeeded ? <p className="rounded-lg border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-sm text-amber-100">The Marketing Library tables are not in this database yet.</p>
        : loading ? <LoadingState message="Loading registered sources…" />
        : error ? <EmptyState title="Could not load sources" message={error} action={<ActionButton variant="secondary" onClick={() => void reload()}>Try again</ActionButton>} />
        : sources.length === 0 ? <EmptyState title="No sources visible" message="Registered sources are admin-managed." />
        : filtered.length === 0 ? <EmptyState title="No sources match" message="Adjust the search or filters." />
        : <ul className="grid gap-2 lg:grid-cols-2">{filtered.map(s => <SourceRow key={s.id} source={s} />)}</ul>}
    </div>
  )
}

// ── Review queues (admin) ────────────────────────────────────────────────────

function ReviewSection() {
  const { cards, loading, error, migrationNeeded } = useSkillCards(true)
  const queues = useMemo(() => ({
    needsReview: cards.filter(skillCardNeedsReview),
    stale: cards.filter(c => skillCardIsStale(c, today())),
    missingSource: cards.filter(skillCardMissingSource),
  }), [cards])
  return (
    <div className="space-y-4">
      <p className="text-xs text-white/50">Triage queues over the canonical skill-card review lifecycle. Actions (approve, request changes, deprecate, activate) run in the review workspace.</p>
      {migrationNeeded ? <p className="rounded-lg border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-sm text-amber-100">The Marketing Library tables are not in this database yet.</p>
        : loading ? <LoadingState message="Loading review queues…" />
        : error ? <EmptyState title="Could not load review queues" message={error} />
        : (
        <div className="grid gap-3 sm:grid-cols-3">
          {([
            ['Needs review', queues.needsReview, 'Draft or needs-review cards awaiting a decision.'],
            ['Stale / expiring', queues.stale, 'Past their scheduled review date — re-verify before trusting.'],
            ['Missing source', queues.missingSource, 'No linked source — cannot be activated (phase-18c gate).'],
          ] as const).map(([label, list, note]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-black uppercase tracking-[0.12em] text-white/45">{label}</h3>
                <span className={`text-lg font-black ${list.length > 0 ? 'text-amber-300' : 'text-white/30'}`}>{list.length}</span>
              </div>
              <p className="mt-1 text-[11px] text-white/40">{note}</p>
              <ul className="mt-2 space-y-1">
                {list.slice(0, 6).map(c => <li key={c.id} className="truncate text-xs text-white/70">{c.title}</li>)}
                {list.length === 0 && <li className="text-xs text-white/30">Nothing here.</li>}
              </ul>
            </div>
          ))}
        </div>
      )}
      <Link to="/admin/skill-card-review" className="inline-flex items-center gap-1.5 rounded-lg border border-brand-teal/25 bg-brand-teal/[0.08] px-3 py-1.5 text-xs font-bold text-brand-teal hover:border-brand-teal/50">Open review & activation workspace →</Link>
    </div>
  )
}

// ── #184 registration inventory (admin) ──────────────────────────────────────

const REGISTRATION_FAMILY_LABELS: Record<string, string> = {
  campaign_case: 'Campaign case', book: 'Book', research_paper: 'Research paper',
  official_documentation: 'Official docs', professional_source: 'Professional source', container: 'Pack container',
}

function RegistrationSection() {
  const { sources, loading, error, migrationNeeded } = useSources()
  const classification = useMemo(() => classifyRegistrations(REGISTRATION_MANIFEST, sources), [sources])
  const [showContainers, setShowContainers] = useState(false)
  const unregistered = useMemo(
    () => classification.unregistered.filter(c => showContainers || c.kind === 'cited_source'),
    [classification, showContainers],
  )
  return (
    <div className="space-y-3">
      <p className="text-xs text-white/50">
        Distinct <span className="font-bold text-white/70">cited sources</span> extracted from the reusable research packs (#184) — campaign cases, books, official platform docs and research, deduped by canonical URL. The reviewed idempotent migration <code className="rounded bg-black/40 px-1 text-[11px] text-amber-100">supabase/phase-28a-marketing-library-repo-source-registration.sql</code> registers them as reference-only (needs-review, <span className="font-bold text-white/70">bibliographic_only</span> rights, no full text, no auto-approval). Not yet applied.
      </p>
      {migrationNeeded ? <p className="rounded-lg border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-sm text-amber-100">The Marketing Library tables are not in this database yet.</p>
        : loading ? <LoadingState message="Classifying cited sources…" />
        : error ? <EmptyState title="Could not classify sources" message={error} />
        : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {([
              ['Cited sources', classification.counts.citedSources],
              ['Pack containers', classification.counts.containers],
              ['Already registered', classification.counts.registered],
              ['Eligible to register', classification.counts.unregistered],
            ] as const).map(([label, n]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-sm font-black uppercase tracking-[0.12em] text-white/45">{label}</p>
                <p className="mt-1 text-2xl font-black text-white">{n}</p>
              </div>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-white/60"><input type="checkbox" className="h-3.5 w-3.5 accent-teal-400" checked={showContainers} onChange={e => setShowContainers(e.target.checked)} />Include pack container references</label>
          <ul className="grid gap-2 lg:grid-cols-2">
            {unregistered.map(c => (
              <li key={c.sourceIdentifier} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-bold text-white">{c.title}{c.author ? <span className="font-normal text-white/50"> — {c.author}</span> : null}</p>
                  <Pill tone={c.kind === 'container' ? 'neutral' : 'amber'}>{c.kind === 'container' ? 'Container' : 'Eligible'}</Pill>
                </div>
                <p className="mt-0.5 truncate font-mono text-[11px] text-white/45">{c.sourceIdentifier}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Pill>{REGISTRATION_FAMILY_LABELS[c.family] ?? c.family}</Pill>
                  {c.canonicalUrl && <a href={c.canonicalUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-brand-teal hover:text-white">Open source →</a>}
                  <span className="text-[11px] text-white/40">reference only · needs review</span>
                  {c.citedIn[0] && <span className="truncate text-[11px] text-white/35">cited in {c.citedIn[0].replace('docs/ai-workforce/', '')}{c.citedIn.length > 1 ? ` +${c.citedIn.length - 1}` : ''}</span>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function AiSection() {
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-white/70">Marketing AI runs specialist workflows grounded only in <span className="font-bold text-white">approved</span> knowledge — evidence cards are attached to every version, and a run stops with an insufficient-evidence message rather than inventing Library truth. AI output is saved as a draft for human review, never auto-approved.</p>
      <Link to="/admin/marketing-ai" className="inline-flex items-center gap-1.5 rounded-lg border border-brand-teal/25 bg-brand-teal/[0.08] px-3 py-1.5 text-sm font-bold text-brand-teal hover:border-brand-teal/50">Open Marketing AI workspace →</Link>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MarketingWorkspacePage() {
  const { profile } = useAuth()
  const isAdmin = isAdminRole(profile?.role)
  const isManager = isManagerRole(profile?.role)
  const [searchParams, setSearchParams] = useSearchParams()

  const tabs = useMemo(() => {
    const list: Array<{ key: Section; label: string }> = [{ key: 'library', label: 'Library' }]
    if (isManager) list.push({ key: 'ai', label: 'AI' })
    if (isAdmin) list.push({ key: 'review', label: 'Review' }, { key: 'sources', label: 'Sources' }, { key: 'registration', label: 'Registration' })
    return list
  }, [isAdmin, isManager])

  const requested = searchParams.get('section') as Section | null
  const section: Section = tabs.some(t => t.key === requested) ? (requested as Section) : 'library'

  return (
    <PageContainer width="wide" className="pb-16">
      <PageHeader
        eyebrow="Marketing & Knowledge"
        title="Marketing"
        description="Search trusted marketing knowledge, review it, and use it in AI — one workspace."
      />
      <div className="flex flex-wrap gap-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('section', tab.key); return next })}
            className={`rounded-full border px-4 py-2 text-sm font-black transition-colors ${section === tab.key ? 'border-brand-teal/50 bg-brand-teal/10 text-brand-teal' : 'border-white/10 text-white/45 hover:text-white/70'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {section === 'library' && <LibrarySection isAdmin={isAdmin} />}
      {section === 'ai' && isManager && <AiSection />}
      {section === 'review' && isAdmin && <ReviewSection />}
      {section === 'sources' && isAdmin && <SourcesSection />}
      {section === 'registration' && isAdmin && <RegistrationSection />}
    </PageContainer>
  )
}
