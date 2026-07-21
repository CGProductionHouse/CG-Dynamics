import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { ActionButton } from '../../components/ui/Buttons'
import { Pill } from '../../components/ui/Badges'
import { EmptyState, LoadingState } from '../../components/ui/States'
import type {
  ConfidenceLevel,
  EvidenceLabel,
  IndustryTag,
  KnowledgeLayer,
  RelevantAgent,
  SkillCardStatus,
  SourceType,
} from '../../types/skillCards'
import {
  createMarketingLibrarySource,
  createSkillCard,
  listMarketingLibrarySources,
  listSkillCards,
  updateMarketingLibrarySource,
  updateSkillCard,
  type MarketingLibrarySource,
  type MarketingLibrarySourceInput,
  type SkillCardInput,
  type SkillCardRecord,
  type SourceTrustTier,
} from '../../lib/marketing-library/skillCardsData'

// ── Marketing Library (AI Workforce) — admin-only foundation screen ───────────
//
// First usable admin surface over the phase-18a tables. Reads and writes go
// through skillCardsData.ts only; RLS enforces admin access. No Assistant
// retrieval, no review history, no delete, no seeding — that stays for later
// phases per docs/CORE_PRINCIPLES.md (Skill Cards remain untrusted until
// reviewed; AI-generated output is never treated as a trusted source).

type Tab = 'cards' | 'sources'
type PaneMode = 'view' | 'edit' | 'create'

const STATUS_OPTIONS: SkillCardStatus[] = ['draft', 'needs_review', 'reviewed', 'active', 'deprecated']
const KNOWLEDGE_LAYERS: KnowledgeLayer[] = [
  'universal_principle', 'south_african_market', 'industry_specific', 'active_client_specific', 'internal_learning',
]
const SOURCE_TYPES: SourceType[] = [
  'book', 'research_paper', 'official_documentation', 'market_report', 'internal_campaign_data',
  'client_interview', 'staff_observation', 'professional_source', 'other', 'ai_generated', 'unsourced_blog',
]
const CONFIDENCE_LEVELS: ConfidenceLevel[] = ['high', 'medium', 'low', 'opinion']
const EVIDENCE_LABELS: EvidenceLabel[] = [
  'proven_principle', 'platform_rule', 'market_observation', 'internal_learning', 'client_opinion', 'hypothesis',
]
const TRUST_TIERS: SourceTrustTier[] = [
  'tier_1_primary', 'tier_2_trusted_professional', 'tier_3_internal_learning', 'tier_4_low_trust', 'needs_review',
]

const INPUT_CLS = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-teal/50'
const LABEL_CLS = 'block text-[11px] font-black uppercase tracking-[0.12em] text-white/40'

function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function linesToArray(value: string): string[] {
  return value.split('\n').map(line => line.trim()).filter(Boolean)
}

function csvToArray(value: string): string[] {
  return value.split(',').map(part => part.trim()).filter(Boolean)
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className={LABEL_CLS}>{label}</span>
      {children}
    </label>
  )
}

// ── Skill Card form ───────────────────────────────────────────────────────────

interface CardFormState {
  title: string
  slug: string
  slugTouched: boolean
  category: string
  subcategory: string
  status: SkillCardStatus
  knowledge_layer: KnowledgeLayer
  source_id: string
  source_type: SourceType
  confidence_level: ConfidenceLevel
  evidence_label: EvidenceLabel
  principle: string
  summary: string
  why_it_matters: string
  how_to_apply: string
  examples: string
  mistakes_to_avoid: string
  agent_instructions: string
  relevant_industries: string
  relevant_agents: string
  related_card_ids: string
  client_specific: boolean
  active_client_id: string
  notes: string
  owner: string
  last_reviewed: string
}

function emptyCardForm(): CardFormState {
  return {
    title: '', slug: '', slugTouched: false, category: '', subcategory: '',
    status: 'draft', knowledge_layer: 'universal_principle', source_id: '', source_type: 'professional_source',
    confidence_level: 'low', evidence_label: 'hypothesis', principle: '', summary: '', why_it_matters: '',
    how_to_apply: '', examples: '', mistakes_to_avoid: '', agent_instructions: '',
    relevant_industries: '', relevant_agents: '', related_card_ids: '',
    client_specific: false, active_client_id: '', notes: '', owner: '', last_reviewed: '',
  }
}

function cardToForm(card: SkillCardRecord): CardFormState {
  return {
    title: card.title, slug: card.slug, slugTouched: true, category: card.category,
    subcategory: card.subcategory ?? '', status: card.status, knowledge_layer: card.knowledge_layer,
    source_id: card.source_id ?? '', source_type: card.source_type, confidence_level: card.confidence_level,
    evidence_label: card.evidence_label, principle: card.principle, summary: card.summary,
    why_it_matters: card.why_it_matters ?? '',
    how_to_apply: card.how_to_apply.join('\n'), examples: card.examples.join('\n'),
    mistakes_to_avoid: card.mistakes_to_avoid.join('\n'), agent_instructions: card.agent_instructions.join('\n'),
    relevant_industries: card.relevant_industries.join(', '), relevant_agents: card.relevant_agents.join(', '),
    related_card_ids: card.related_card_ids.join(', '),
    client_specific: card.client_specific, active_client_id: card.active_client_id ?? '',
    notes: card.notes ?? '', owner: card.owner ?? '', last_reviewed: card.last_reviewed ?? '',
  }
}

function formToCardInput(form: CardFormState): SkillCardInput {
  return {
    title: form.title.trim(),
    slug: (form.slug || slugify(form.title)).trim(),
    category: form.category.trim(),
    subcategory: form.subcategory.trim() || null,
    status: form.status,
    knowledge_layer: form.knowledge_layer,
    source_id: form.source_id || null,
    source_type: form.source_type,
    confidence_level: form.confidence_level,
    evidence_label: form.evidence_label,
    principle: form.principle.trim(),
    summary: form.summary.trim(),
    why_it_matters: form.why_it_matters.trim() || null,
    how_to_apply: linesToArray(form.how_to_apply),
    examples: linesToArray(form.examples),
    mistakes_to_avoid: linesToArray(form.mistakes_to_avoid),
    agent_instructions: linesToArray(form.agent_instructions),
    relevant_industries: csvToArray(form.relevant_industries) as IndustryTag[],
    relevant_agents: csvToArray(form.relevant_agents) as RelevantAgent[],
    related_card_ids: csvToArray(form.related_card_ids),
    client_specific: form.client_specific,
    active_client_id: form.client_specific ? (form.active_client_id.trim() || null) : null,
    notes: form.notes.trim() || null,
    owner: form.owner.trim() || null,
    last_reviewed: form.last_reviewed || null,
  }
}

function SkillCardForm({
  initial, sources, saving, error, onCancel, onSubmit,
}: {
  initial: CardFormState
  sources: MarketingLibrarySource[]
  saving: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (input: SkillCardInput) => void
}) {
  const [form, setForm] = useState<CardFormState>(initial)
  const set = <K extends keyof CardFormState>(key: K, value: CardFormState[K]) => setForm(prev => ({ ...prev, [key]: value }))
  const effectiveSlug = form.slug || slugify(form.title)
  const missingRequired = !form.title.trim() || !form.category.trim() || !form.principle.trim() || !form.summary.trim()

  return (
    <form
      className="space-y-4"
      onSubmit={event => { event.preventDefault(); if (!missingRequired) onSubmit(formToCardInput(form)) }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title *">
          <input
            className={INPUT_CLS}
            value={form.title}
            onChange={event => setForm(prev => ({
              ...prev,
              title: event.target.value,
              slug: prev.slugTouched ? prev.slug : slugify(event.target.value),
            }))}
            placeholder="e.g. Hook in the first three seconds"
          />
        </Field>
        <Field label="Slug (auto from title, editable)">
          <input
            className={INPUT_CLS}
            value={effectiveSlug}
            onChange={event => setForm(prev => ({ ...prev, slug: event.target.value, slugTouched: true }))}
            placeholder="hook-in-first-three-seconds"
          />
        </Field>
        <Field label="Category *">
          <input className={INPUT_CLS} value={form.category} onChange={event => set('category', event.target.value)} placeholder="e.g. Copywriting" />
        </Field>
        <Field label="Subcategory">
          <input className={INPUT_CLS} value={form.subcategory} onChange={event => set('subcategory', event.target.value)} />
        </Field>
        <Field label="Status">
          <select className={INPUT_CLS} value={form.status} onChange={event => set('status', event.target.value as SkillCardStatus)}>
            {STATUS_OPTIONS.map(option => <option key={option} value={option}>{humanize(option)}</option>)}
          </select>
        </Field>
        <Field label="Knowledge layer">
          <select className={INPUT_CLS} value={form.knowledge_layer} onChange={event => set('knowledge_layer', event.target.value as KnowledgeLayer)}>
            {KNOWLEDGE_LAYERS.map(option => <option key={option} value={option}>{humanize(option)}</option>)}
          </select>
        </Field>
        <Field label="Linked source">
          <select
            className={INPUT_CLS}
            value={form.source_id}
            onChange={event => {
              const picked = sources.find(source => source.id === event.target.value)
              setForm(prev => ({ ...prev, source_id: event.target.value, source_type: picked ? picked.source_type : prev.source_type }))
            }}
          >
            <option value="">No linked source</option>
            {sources.map(source => <option key={source.id} value={source.id}>{source.source_name}</option>)}
          </select>
        </Field>
        <Field label="Source type">
          <select className={INPUT_CLS} value={form.source_type} onChange={event => set('source_type', event.target.value as SourceType)}>
            {SOURCE_TYPES.map(option => <option key={option} value={option}>{humanize(option)}</option>)}
          </select>
        </Field>
        <Field label="Confidence level">
          <select className={INPUT_CLS} value={form.confidence_level} onChange={event => set('confidence_level', event.target.value as ConfidenceLevel)}>
            {CONFIDENCE_LEVELS.map(option => <option key={option} value={option}>{humanize(option)}</option>)}
          </select>
        </Field>
        <Field label="Evidence label">
          <select className={INPUT_CLS} value={form.evidence_label} onChange={event => set('evidence_label', event.target.value as EvidenceLabel)}>
            {EVIDENCE_LABELS.map(option => <option key={option} value={option}>{humanize(option)}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Principle *">
        <textarea className={`${INPUT_CLS} min-h-[64px]`} value={form.principle} onChange={event => set('principle', event.target.value)} />
      </Field>
      <Field label="Summary *">
        <textarea className={`${INPUT_CLS} min-h-[64px]`} value={form.summary} onChange={event => set('summary', event.target.value)} />
      </Field>
      <Field label="Why it matters">
        <textarea className={`${INPUT_CLS} min-h-[56px]`} value={form.why_it_matters} onChange={event => set('why_it_matters', event.target.value)} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="How to apply (one per line)">
          <textarea className={`${INPUT_CLS} min-h-[88px]`} value={form.how_to_apply} onChange={event => set('how_to_apply', event.target.value)} />
        </Field>
        <Field label="Examples (one per line)">
          <textarea className={`${INPUT_CLS} min-h-[88px]`} value={form.examples} onChange={event => set('examples', event.target.value)} />
        </Field>
        <Field label="Mistakes to avoid (one per line)">
          <textarea className={`${INPUT_CLS} min-h-[88px]`} value={form.mistakes_to_avoid} onChange={event => set('mistakes_to_avoid', event.target.value)} />
        </Field>
        <Field label="Agent instructions (one per line)">
          <textarea className={`${INPUT_CLS} min-h-[88px]`} value={form.agent_instructions} onChange={event => set('agent_instructions', event.target.value)} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Relevant industries (comma-separated)">
          <input className={INPUT_CLS} value={form.relevant_industries} onChange={event => set('relevant_industries', event.target.value)} placeholder="real_estate, retail" />
        </Field>
        <Field label="Relevant agents (comma-separated)">
          <input className={INPUT_CLS} value={form.relevant_agents} onChange={event => set('relevant_agents', event.target.value)} placeholder="copywriting_agent" />
        </Field>
        <Field label="Related card IDs (comma-separated)">
          <input className={INPUT_CLS} value={form.related_card_ids} onChange={event => set('related_card_ids', event.target.value)} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Owner">
          <input className={INPUT_CLS} value={form.owner} onChange={event => set('owner', event.target.value)} />
        </Field>
        <Field label="Last reviewed">
          <input type="date" className={INPUT_CLS} value={form.last_reviewed} onChange={event => set('last_reviewed', event.target.value)} />
        </Field>
        <div className="space-y-1.5">
          <span className={LABEL_CLS}>Client-specific</span>
          <label className="flex items-center gap-2 pt-1.5 text-sm text-white/70">
            <input type="checkbox" className="h-4 w-4 accent-teal-400" checked={form.client_specific} onChange={event => set('client_specific', event.target.checked)} />
            Scoped to one active client
          </label>
        </div>
      </div>

      {form.client_specific && (
        <Field label="Active client ID (required for client-specific cards)">
          <input className={INPUT_CLS} value={form.active_client_id} onChange={event => set('active_client_id', event.target.value)} placeholder="clients.id UUID" />
        </Field>
      )}

      <Field label="Notes">
        <textarea className={`${INPUT_CLS} min-h-[56px]`} value={form.notes} onChange={event => set('notes', event.target.value)} />
      </Field>

      {error && <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
      {form.client_specific && !form.active_client_id.trim() && (
        <p className="text-xs text-amber-200/80">A client-specific card must have an active client ID before it can save.</p>
      )}

      <div className="flex items-center gap-3">
        <ActionButton type="submit" loading={saving} disabled={missingRequired || (form.client_specific && !form.active_client_id.trim())}>
          Save card
        </ActionButton>
        <ActionButton type="button" variant="ghost" onClick={onCancel}>Cancel</ActionButton>
      </div>
    </form>
  )
}

function SkillCardDetail({ card, sources, onEdit }: { card: SkillCardRecord; sources: MarketingLibrarySource[]; onEdit: () => void }) {
  const linkedSource = sources.find(source => source.id === card.source_id) ?? null
  const list = (label: string, values: string[]) => values.length > 0 && (
    <div>
      <p className={LABEL_CLS}>{label}</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-white/75">{values.map(value => <li key={value}>{value}</li>)}</ul>
    </div>
  )
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-brand-teal/80">{card.category}{card.subcategory ? ` · ${card.subcategory}` : ''}</p>
          <h2 className="mt-1 break-words text-xl font-black text-white">{card.title}</h2>
          <p className="mt-1 text-xs text-white/40">{card.slug}</p>
        </div>
        <ActionButton size="sm" variant="secondary" onClick={onEdit}>Edit</ActionButton>
      </div>

      <div className="flex flex-wrap gap-2">
        <Pill tone={card.status === 'active' ? 'teal' : 'neutral'}>{humanize(card.status)}</Pill>
        <Pill>{humanize(card.knowledge_layer)}</Pill>
        <Pill tone="amber">{humanize(card.confidence_level)}</Pill>
        <Pill>{humanize(card.evidence_label)}</Pill>
        {card.client_specific && <Pill tone="amber">Client-specific</Pill>}
      </div>

      <div>
        <p className={LABEL_CLS}>Principle</p>
        <p className="mt-1 text-sm leading-relaxed text-white/85">{card.principle}</p>
      </div>
      <div>
        <p className={LABEL_CLS}>Summary</p>
        <p className="mt-1 text-sm leading-relaxed text-white/75">{card.summary}</p>
      </div>
      {card.why_it_matters && (
        <div>
          <p className={LABEL_CLS}>Why it matters</p>
          <p className="mt-1 text-sm leading-relaxed text-white/75">{card.why_it_matters}</p>
        </div>
      )}
      {list('How to apply', card.how_to_apply)}
      {list('Examples', card.examples)}
      {list('Mistakes to avoid', card.mistakes_to_avoid)}
      {list('Agent instructions', card.agent_instructions)}

      <div className="grid gap-3 text-xs text-white/55 sm:grid-cols-2">
        <p><span className="text-white/35">Source type:</span> {humanize(card.source_type)}</p>
        <p><span className="text-white/35">Linked source:</span> {linkedSource ? linkedSource.source_name : 'None'}</p>
        {card.relevant_industries.length > 0 && <p><span className="text-white/35">Industries:</span> {card.relevant_industries.join(', ')}</p>}
        {card.relevant_agents.length > 0 && <p><span className="text-white/35">Agents:</span> {card.relevant_agents.join(', ')}</p>}
        {card.owner && <p><span className="text-white/35">Owner:</span> {card.owner}</p>}
        {card.last_reviewed && <p><span className="text-white/35">Last reviewed:</span> {card.last_reviewed}</p>}
      </div>
      {card.notes && <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60">{card.notes}</p>}
    </div>
  )
}

// ── Source form ───────────────────────────────────────────────────────────────

interface SourceFormState {
  source_type: SourceType
  source_name: string
  author_or_organisation: string
  title: string
  publication_year: string
  chapter_or_section: string
  page_or_url: string
  trust_tier: SourceTrustTier
  notes: string
}

function emptySourceForm(): SourceFormState {
  return {
    source_type: 'professional_source', source_name: '', author_or_organisation: '', title: '',
    publication_year: '', chapter_or_section: '', page_or_url: '', trust_tier: 'needs_review', notes: '',
  }
}

function sourceToForm(source: MarketingLibrarySource): SourceFormState {
  return {
    source_type: source.source_type, source_name: source.source_name,
    author_or_organisation: source.author_or_organisation ?? '', title: source.title ?? '',
    publication_year: source.publication_year != null ? String(source.publication_year) : '',
    chapter_or_section: source.chapter_or_section ?? '', page_or_url: source.page_or_url ?? '',
    trust_tier: source.trust_tier, notes: source.notes ?? '',
  }
}

function formToSourceInput(form: SourceFormState): MarketingLibrarySourceInput {
  const year = Number(form.publication_year)
  return {
    source_type: form.source_type,
    source_name: form.source_name.trim(),
    author_or_organisation: form.author_or_organisation.trim() || null,
    title: form.title.trim() || null,
    publication_year: form.publication_year.trim() && Number.isFinite(year) ? year : null,
    chapter_or_section: form.chapter_or_section.trim() || null,
    page_or_url: form.page_or_url.trim() || null,
    trust_tier: form.trust_tier,
    notes: form.notes.trim() || null,
  }
}

function SourceForm({
  initial, saving, error, onCancel, onSubmit,
}: {
  initial: SourceFormState
  saving: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (input: MarketingLibrarySourceInput) => void
}) {
  const [form, setForm] = useState<SourceFormState>(initial)
  const set = <K extends keyof SourceFormState>(key: K, value: SourceFormState[K]) => setForm(prev => ({ ...prev, [key]: value }))
  const missingRequired = !form.source_name.trim()

  return (
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (!missingRequired) onSubmit(formToSourceInput(form)) }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Source name *">
          <input className={INPUT_CLS} value={form.source_name} onChange={event => set('source_name', event.target.value)} placeholder="e.g. Building a StoryBrand" />
        </Field>
        <Field label="Source type">
          <select className={INPUT_CLS} value={form.source_type} onChange={event => set('source_type', event.target.value as SourceType)}>
            {SOURCE_TYPES.map(option => <option key={option} value={option}>{humanize(option)}</option>)}
          </select>
        </Field>
        <Field label="Author / organisation">
          <input className={INPUT_CLS} value={form.author_or_organisation} onChange={event => set('author_or_organisation', event.target.value)} />
        </Field>
        <Field label="Title">
          <input className={INPUT_CLS} value={form.title} onChange={event => set('title', event.target.value)} />
        </Field>
        <Field label="Publication year">
          <input className={INPUT_CLS} inputMode="numeric" value={form.publication_year} onChange={event => set('publication_year', event.target.value)} placeholder="2017" />
        </Field>
        <Field label="Trust tier">
          <select className={INPUT_CLS} value={form.trust_tier} onChange={event => set('trust_tier', event.target.value as SourceTrustTier)}>
            {TRUST_TIERS.map(option => <option key={option} value={option}>{humanize(option)}</option>)}
          </select>
        </Field>
        <Field label="Chapter / section">
          <input className={INPUT_CLS} value={form.chapter_or_section} onChange={event => set('chapter_or_section', event.target.value)} />
        </Field>
        <Field label="Page or URL">
          <input className={INPUT_CLS} value={form.page_or_url} onChange={event => set('page_or_url', event.target.value)} />
        </Field>
      </div>
      <Field label="Notes">
        <textarea className={`${INPUT_CLS} min-h-[64px]`} value={form.notes} onChange={event => set('notes', event.target.value)} />
      </Field>

      {error && <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
      <div className="flex items-center gap-3">
        <ActionButton type="submit" loading={saving} disabled={missingRequired}>Save source</ActionButton>
        <ActionButton type="button" variant="ghost" onClick={onCancel}>Cancel</ActionButton>
      </div>
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MarketingLibraryPage() {
  const [tab, setTab] = useState<Tab>('cards')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [migrationNeeded, setMigrationNeeded] = useState(false)

  const [cards, setCards] = useState<SkillCardRecord[]>([])
  const [sources, setSources] = useState<MarketingLibrarySource[]>([])

  // Skill Cards tab state
  const [cardSearch, setCardSearch] = useState('')
  const [cardStatusFilter, setCardStatusFilter] = useState<SkillCardStatus | 'all'>('all')
  const [cardLayerFilter, setCardLayerFilter] = useState<KnowledgeLayer | 'all'>('all')
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [cardMode, setCardMode] = useState<PaneMode>('view')
  const [cardSaving, setCardSaving] = useState(false)
  const [cardError, setCardError] = useState<string | null>(null)

  // Sources tab state
  const [sourceSearch, setSourceSearch] = useState('')
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [sourceMode, setSourceMode] = useState<PaneMode>('view')
  const [sourceSaving, setSourceSaving] = useState(false)
  const [sourceError, setSourceError] = useState<string | null>(null)

  async function loadAll() {
    setLoading(true)
    setLoadError(null)
    const [cardResult, sourceResult] = await Promise.all([listSkillCards(), listMarketingLibrarySources()])
    if (cardResult.migrationNeeded || sourceResult.migrationNeeded) {
      setMigrationNeeded(true)
      setCards([])
      setSources([])
      setLoading(false)
      return
    }
    setMigrationNeeded(false)
    if (cardResult.error) setLoadError(cardResult.error)
    else if (sourceResult.error) setLoadError(sourceResult.error)
    setCards(cardResult.data)
    setSources(sourceResult.data)
    setLoading(false)
  }

  // Defer the initial load out of the synchronous effect body (repo pattern:
  // useEffectEvent + a 0ms timer) so it does not trip set-state-in-effect.
  const loadAllEvent = useEffectEvent(loadAll)
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAllEvent() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const filteredCards = useMemo(() => {
    const query = cardSearch.trim().toLowerCase()
    return cards.filter(card => {
      if (cardStatusFilter !== 'all' && card.status !== cardStatusFilter) return false
      if (cardLayerFilter !== 'all' && card.knowledge_layer !== cardLayerFilter) return false
      if (!query) return true
      return [card.title, card.slug, card.category, card.principle].some(field => field.toLowerCase().includes(query))
    })
  }, [cards, cardSearch, cardStatusFilter, cardLayerFilter])

  const filteredSources = useMemo(() => {
    const query = sourceSearch.trim().toLowerCase()
    if (!query) return sources
    return sources.filter(source =>
      [source.source_name, source.author_or_organisation ?? '', source.title ?? '', source.source_type].some(field =>
        field.toLowerCase().includes(query)))
  }, [sources, sourceSearch])

  const selectedCard = cards.find(card => card.id === selectedCardId) ?? null
  const selectedSource = sources.find(source => source.id === selectedSourceId) ?? null

  async function submitCard(input: SkillCardInput) {
    setCardSaving(true)
    setCardError(null)
    const response = cardMode === 'create'
      ? await createSkillCard(input)
      : await updateSkillCard(selectedCardId as string, input)
    setCardSaving(false)
    if (response.error) { setCardError(response.error); return }
    if (response.migrationNeeded) { setMigrationNeeded(true); return }
    await loadAll()
    if (response.data) setSelectedCardId(response.data.id)
    setCardMode('view')
  }

  async function submitSource(input: MarketingLibrarySourceInput) {
    setSourceSaving(true)
    setSourceError(null)
    const response = sourceMode === 'create'
      ? await createMarketingLibrarySource(input)
      : await updateMarketingLibrarySource(selectedSourceId as string, input)
    setSourceSaving(false)
    if (response.error) { setSourceError(response.error); return }
    if (response.migrationNeeded) { setMigrationNeeded(true); return }
    await loadAll()
    if (response.data) setSelectedSourceId(response.data.id)
    setSourceMode('view')
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-5 sm:px-6 sm:pt-8">
      <header className="overflow-hidden rounded-3xl border border-brand-teal/20 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.14),transparent_40%),linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] p-5 sm:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-teal">AI Workforce</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Marketing Library</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-primary/75">
          Trusted marketing knowledge for future specialist agents. Skill Cards stay untrusted until reviewed, and
          AI-generated output is never treated as a source. Admin-only.
        </p>
      </header>

      {!migrationNeeded && (
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => setTab('cards')}
            className={`rounded-full border px-4 py-2 text-sm font-black transition-colors ${tab === 'cards' ? 'border-brand-teal/50 bg-brand-teal/10 text-brand-teal' : 'border-white/10 text-white/45 hover:text-white/70'}`}
          >
            Skill Cards {cards.length > 0 && <span className="opacity-60">{cards.length}</span>}
          </button>
          <button
            type="button"
            onClick={() => setTab('sources')}
            className={`rounded-full border px-4 py-2 text-sm font-black transition-colors ${tab === 'sources' ? 'border-brand-teal/50 bg-brand-teal/10 text-brand-teal' : 'border-white/10 text-white/45 hover:text-white/70'}`}
          >
            Sources {sources.length > 0 && <span className="opacity-60">{sources.length}</span>}
          </button>
        </div>
      )}

      {migrationNeeded ? (
        <div className="mt-6 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-5 sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/70">Migration required</p>
          <h2 className="mt-2 text-xl font-black text-white">The Marketing Library tables are not in the database yet</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">
            Review and apply <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs text-amber-100">supabase/phase-18a-marketing-library-foundation.sql</code> in
            the Supabase SQL editor. Until then no Skill Cards or sources can be read or written. No production SQL is run from this screen.
          </p>
        </div>
      ) : loading ? (
        <LoadingState className="mt-8" message="Loading Marketing Library…" />
      ) : loadError ? (
        <EmptyState
          className="mt-8"
          title="Could not load the Marketing Library"
          message={loadError}
          action={<ActionButton variant="secondary" onClick={() => void loadAll()}>Try again</ActionButton>}
        />
      ) : tab === 'cards' ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={`${INPUT_CLS} flex-1`}
                placeholder="Search title, slug, category, principle"
                value={cardSearch}
                onChange={event => setCardSearch(event.target.value)}
              />
              <ActionButton size="sm" onClick={() => { setCardMode('create'); setSelectedCardId(null); setCardError(null) }}>New card</ActionButton>
            </div>
            <div className="flex flex-wrap gap-2">
              <select className={`${INPUT_CLS} w-auto`} value={cardStatusFilter} onChange={event => setCardStatusFilter(event.target.value as SkillCardStatus | 'all')}>
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map(option => <option key={option} value={option}>{humanize(option)}</option>)}
              </select>
              <select className={`${INPUT_CLS} w-auto`} value={cardLayerFilter} onChange={event => setCardLayerFilter(event.target.value as KnowledgeLayer | 'all')}>
                <option value="all">All layers</option>
                {KNOWLEDGE_LAYERS.map(option => <option key={option} value={option}>{humanize(option)}</option>)}
              </select>
            </div>

            {filteredCards.length === 0 ? (
              <EmptyState
                title={cards.length === 0 ? 'No Skill Cards yet' : 'No cards match your filters'}
                message={cards.length === 0 ? 'Create the first Skill Card to start the library.' : 'Adjust the search, status or layer filters.'}
              />
            ) : (
              <ul className="space-y-2">
                {filteredCards.map(card => (
                  <li key={card.id}>
                    <button
                      type="button"
                      onClick={() => { setSelectedCardId(card.id); setCardMode('view') }}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedCardId === card.id && cardMode !== 'create' ? 'border-brand-teal/45 bg-brand-teal/[0.07]' : 'border-white/10 bg-white/[0.025] hover:border-white/20'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 break-words text-sm font-black text-white">{card.title}</p>
                        <Pill tone={card.status === 'active' ? 'teal' : 'neutral'}>{humanize(card.status)}</Pill>
                      </div>
                      <p className="mt-1 text-xs text-white/45">{card.category} · {humanize(card.knowledge_layer)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
            {cardMode === 'create' ? (
              <>
                <h2 className="mb-4 text-lg font-black text-white">New Skill Card</h2>
                <SkillCardForm initial={emptyCardForm()} sources={sources} saving={cardSaving} error={cardError} onCancel={() => setCardMode('view')} onSubmit={submitCard} />
              </>
            ) : cardMode === 'edit' && selectedCard ? (
              <>
                <h2 className="mb-4 text-lg font-black text-white">Edit Skill Card</h2>
                <SkillCardForm initial={cardToForm(selectedCard)} sources={sources} saving={cardSaving} error={cardError} onCancel={() => setCardMode('view')} onSubmit={submitCard} />
              </>
            ) : selectedCard ? (
              <SkillCardDetail card={selectedCard} sources={sources} onEdit={() => { setCardMode('edit'); setCardError(null) }} />
            ) : (
              <EmptyState title="Select a Skill Card" message="Choose a card from the list to see its detail, or create a new one." />
            )}
          </section>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={`${INPUT_CLS} flex-1`}
                placeholder="Search sources"
                value={sourceSearch}
                onChange={event => setSourceSearch(event.target.value)}
              />
              <ActionButton size="sm" onClick={() => { setSourceMode('create'); setSelectedSourceId(null); setSourceError(null) }}>New source</ActionButton>
            </div>

            {filteredSources.length === 0 ? (
              <EmptyState
                title={sources.length === 0 ? 'No sources yet' : 'No sources match your search'}
                message={sources.length === 0 ? 'Add the first source record. AI-generated output is not a trusted source.' : 'Try a different search.'}
              />
            ) : (
              <ul className="space-y-2">
                {filteredSources.map(source => (
                  <li key={source.id}>
                    <button
                      type="button"
                      onClick={() => { setSelectedSourceId(source.id); setSourceMode('view') }}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedSourceId === source.id && sourceMode !== 'create' ? 'border-brand-teal/45 bg-brand-teal/[0.07]' : 'border-white/10 bg-white/[0.025] hover:border-white/20'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 break-words text-sm font-black text-white">{source.source_name}</p>
                        <Pill tone={source.trust_tier === 'tier_1_primary' ? 'teal' : source.trust_tier === 'tier_4_low_trust' ? 'amber' : 'neutral'}>{humanize(source.trust_tier)}</Pill>
                      </div>
                      <p className="mt-1 text-xs text-white/45">{humanize(source.source_type)}{source.author_or_organisation ? ` · ${source.author_or_organisation}` : ''}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
            {sourceMode === 'create' ? (
              <>
                <h2 className="mb-4 text-lg font-black text-white">New source</h2>
                <SourceForm initial={emptySourceForm()} saving={sourceSaving} error={sourceError} onCancel={() => setSourceMode('view')} onSubmit={submitSource} />
              </>
            ) : sourceMode === 'edit' && selectedSource ? (
              <>
                <h2 className="mb-4 text-lg font-black text-white">Edit source</h2>
                <SourceForm initial={sourceToForm(selectedSource)} saving={sourceSaving} error={sourceError} onCancel={() => setSourceMode('view')} onSubmit={submitSource} />
              </>
            ) : selectedSource ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-brand-teal/80">{humanize(selectedSource.source_type)}</p>
                    <h2 className="mt-1 break-words text-xl font-black text-white">{selectedSource.source_name}</h2>
                  </div>
                  <ActionButton size="sm" variant="secondary" onClick={() => { setSourceMode('edit'); setSourceError(null) }}>Edit</ActionButton>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pill tone={selectedSource.trust_tier === 'tier_1_primary' ? 'teal' : 'neutral'}>{humanize(selectedSource.trust_tier)}</Pill>
                </div>
                <div className="grid gap-3 text-sm text-white/70 sm:grid-cols-2">
                  {selectedSource.author_or_organisation && <p><span className="text-white/35">Author / org:</span> {selectedSource.author_or_organisation}</p>}
                  {selectedSource.title && <p><span className="text-white/35">Title:</span> {selectedSource.title}</p>}
                  {selectedSource.publication_year != null && <p><span className="text-white/35">Year:</span> {selectedSource.publication_year}</p>}
                  {selectedSource.chapter_or_section && <p><span className="text-white/35">Chapter / section:</span> {selectedSource.chapter_or_section}</p>}
                  {selectedSource.page_or_url && <p className="break-words"><span className="text-white/35">Page / URL:</span> {selectedSource.page_or_url}</p>}
                </div>
                {selectedSource.notes && <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60">{selectedSource.notes}</p>}
              </div>
            ) : (
              <EmptyState title="Select a source" message="Choose a source from the list to see its detail, or add a new one." />
            )}
          </section>
        </div>
      )}
    </div>
  )
}
