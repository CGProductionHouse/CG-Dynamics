import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { ActionButton } from '../../components/ui/Buttons'
import { Pill } from '../../components/ui/Badges'
import { EmptyState, LoadingState } from '../../components/ui/States'
import type { ConfidenceLevel } from '../../types/skillCards'
import type { MarketingLibrarySource } from '../../lib/marketing-library/skillCardsData'
import {
  createPlatformExpert,
  createPlatformKnowledgeItem,
  createPlatformSurface,
  isKnowledgeExpired,
  isKnowledgeStale,
  listPlatformExperts,
  listPlatformKnowledgeItems,
  listPlatformSurfaces,
  updatePlatformExpert,
  updatePlatformKnowledgeItem,
  updatePlatformSurface,
  type PlatformExpert,
  type PlatformExpertInput,
  type PlatformKnowledgeItem,
  type PlatformKnowledgeItemInput,
  type PlatformKnowledgeState,
  type PlatformSurface,
  type PlatformSurfaceInput,
} from '../../lib/marketing-library/platformExpertsData'

// ── Marketing Library — Platforms tab (Platform Expert foundation) ────────────
//
// Admin surface over the phase-18b tables. Reads/writes go through
// platformExpertsData.ts only; RLS enforces access. No Assistant retrieval, no
// research automation, no experiments, no change logs, no delete — deferred.

const KNOWLEDGE_STATES: PlatformKnowledgeState[] = [
  'verified_current', 'observed_current', 'experimental', 'disputed', 'stale', 'retired',
]
const CONFIDENCE_LEVELS: ConfidenceLevel[] = ['high', 'medium', 'low', 'opinion']

const INPUT_CLS = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-teal/50'
const LABEL_CLS = 'block text-[11px] font-black uppercase tracking-[0.12em] text-white/40'

function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function keyify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function stateTone(state: PlatformKnowledgeState): 'teal' | 'amber' | 'neutral' {
  if (state === 'verified_current' || state === 'observed_current') return 'teal'
  if (state === 'experimental' || state === 'disputed') return 'amber'
  return 'neutral'
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className={LABEL_CLS}>{label}</span>
      {children}
    </label>
  )
}

type Editor =
  | { kind: 'platform'; mode: 'create' | 'edit' }
  | { kind: 'surface'; mode: 'create' | 'edit'; target?: PlatformSurface }
  | { kind: 'knowledge'; mode: 'create' | 'edit'; target?: PlatformKnowledgeItem }
  | null

// ── Platform form ─────────────────────────────────────────────────────────────

function PlatformForm({
  initial, saving, error, onCancel, onSubmit,
}: {
  initial: PlatformExpert | null
  saving: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (input: PlatformExpertInput) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(initial))
  const [active, setActive] = useState(initial?.active ?? true)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const effectiveSlug = slug || slugify(name)

  return (
    <form
      className="space-y-4"
      onSubmit={event => {
        event.preventDefault()
        if (name.trim() && effectiveSlug) onSubmit({ name: name.trim(), slug: effectiveSlug, active, notes: notes.trim() || null })
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Platform name *">
          <input className={INPUT_CLS} value={name} onChange={event => { setName(event.target.value); if (!slugTouched) setSlug(slugify(event.target.value)) }} />
        </Field>
        <Field label="Slug (auto, editable)">
          <input className={INPUT_CLS} value={effectiveSlug} onChange={event => { setSlug(event.target.value); setSlugTouched(true) }} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" className="h-4 w-4 accent-teal-400" checked={active} onChange={event => setActive(event.target.checked)} />
        Active
      </label>
      <Field label="Notes">
        <textarea className={`${INPUT_CLS} min-h-[56px]`} value={notes} onChange={event => setNotes(event.target.value)} />
      </Field>
      {error && <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
      <div className="flex items-center gap-3">
        <ActionButton type="submit" loading={saving} disabled={!name.trim()}>Save platform</ActionButton>
        <ActionButton type="button" variant="ghost" onClick={onCancel}>Cancel</ActionButton>
      </div>
    </form>
  )
}

// ── Surface form ──────────────────────────────────────────────────────────────

function SurfaceForm({
  initial, saving, error, onCancel, onSubmit,
}: {
  initial: PlatformSurface | null
  saving: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (input: Omit<PlatformSurfaceInput, 'platform_expert_id'>) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [surfaceKey, setSurfaceKey] = useState(initial?.surface_key ?? '')
  const [keyTouched, setKeyTouched] = useState(Boolean(initial))
  const [userIntent, setUserIntent] = useState(initial?.user_intent ?? '')
  const [active, setActive] = useState(initial?.active ?? true)
  const effectiveKey = surfaceKey || keyify(name)

  return (
    <form
      className="space-y-4"
      onSubmit={event => {
        event.preventDefault()
        if (name.trim() && effectiveKey) onSubmit({ name: name.trim(), surface_key: effectiveKey, user_intent: userIntent.trim() || null, active })
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Surface name *">
          <input className={INPUT_CLS} value={name} onChange={event => { setName(event.target.value); if (!keyTouched) setSurfaceKey(keyify(event.target.value)) }} placeholder="Feed, Reels, Stories, Search" />
        </Field>
        <Field label="Surface key (auto, editable)">
          <input className={INPUT_CLS} value={effectiveKey} onChange={event => { setSurfaceKey(event.target.value); setKeyTouched(true) }} />
        </Field>
      </div>
      <Field label="User intent">
        <textarea className={`${INPUT_CLS} min-h-[56px]`} value={userIntent} onChange={event => setUserIntent(event.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" className="h-4 w-4 accent-teal-400" checked={active} onChange={event => setActive(event.target.checked)} />
        Active
      </label>
      {error && <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
      <div className="flex items-center gap-3">
        <ActionButton type="submit" loading={saving} disabled={!name.trim()}>Save surface</ActionButton>
        <ActionButton type="button" variant="ghost" onClick={onCancel}>Cancel</ActionButton>
      </div>
    </form>
  )
}

// ── Knowledge item form ───────────────────────────────────────────────────────

interface KnowledgeFormState {
  title: string
  principle: string
  application: string
  limitations: string
  knowledge_state: PlatformKnowledgeState
  confidence: ConfidenceLevel
  territory: string
  surface_id: string
  source_id: string
  researched_at: string
  last_verified_at: string
  expires_at: string
  notes: string
}

function knowledgeInitial(item: PlatformKnowledgeItem | null): KnowledgeFormState {
  return {
    title: item?.title ?? '', principle: item?.principle ?? '', application: item?.application ?? '',
    limitations: item?.limitations ?? '', knowledge_state: item?.knowledge_state ?? 'experimental',
    confidence: item?.confidence ?? 'low', territory: item?.territory ?? '',
    surface_id: item?.surface_id ?? '', source_id: item?.source_id ?? '',
    researched_at: item?.researched_at ?? '', last_verified_at: item?.last_verified_at ?? '',
    expires_at: item?.expires_at ?? '', notes: item?.notes ?? '',
  }
}

function KnowledgeForm({
  initial, surfaces, sources, saving, error, onCancel, onSubmit,
}: {
  initial: PlatformKnowledgeItem | null
  surfaces: PlatformSurface[]
  sources: MarketingLibrarySource[]
  saving: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (input: Omit<PlatformKnowledgeItemInput, 'platform_expert_id'>) => void
}) {
  const [form, setForm] = useState<KnowledgeFormState>(knowledgeInitial(initial))
  const set = <K extends keyof KnowledgeFormState>(key: K, value: KnowledgeFormState[K]) => setForm(prev => ({ ...prev, [key]: value }))
  const missingRequired = !form.title.trim() || !form.principle.trim()

  return (
    <form
      className="space-y-4"
      onSubmit={event => {
        event.preventDefault()
        if (missingRequired) return
        onSubmit({
          title: form.title.trim(),
          principle: form.principle.trim(),
          application: form.application.trim() || null,
          limitations: form.limitations.trim() || null,
          knowledge_state: form.knowledge_state,
          confidence: form.confidence,
          territory: form.territory.trim() || null,
          surface_id: form.surface_id || null,
          source_id: form.source_id || null,
          researched_at: form.researched_at || null,
          last_verified_at: form.last_verified_at || null,
          expires_at: form.expires_at || null,
          notes: form.notes.trim() || null,
        })
      }}
    >
      <Field label="Title *">
        <input className={INPUT_CLS} value={form.title} onChange={event => set('title', event.target.value)} />
      </Field>
      <Field label="Principle *">
        <textarea className={`${INPUT_CLS} min-h-[64px]`} value={form.principle} onChange={event => set('principle', event.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Application">
          <textarea className={`${INPUT_CLS} min-h-[64px]`} value={form.application} onChange={event => set('application', event.target.value)} />
        </Field>
        <Field label="Limitations / misuse warning">
          <textarea className={`${INPUT_CLS} min-h-[64px]`} value={form.limitations} onChange={event => set('limitations', event.target.value)} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Knowledge state">
          <select className={INPUT_CLS} value={form.knowledge_state} onChange={event => set('knowledge_state', event.target.value as PlatformKnowledgeState)}>
            {KNOWLEDGE_STATES.map(option => <option key={option} value={option}>{humanize(option)}</option>)}
          </select>
        </Field>
        <Field label="Confidence">
          <select className={INPUT_CLS} value={form.confidence} onChange={event => set('confidence', event.target.value as ConfidenceLevel)}>
            {CONFIDENCE_LEVELS.map(option => <option key={option} value={option}>{humanize(option)}</option>)}
          </select>
        </Field>
        <Field label="Territory / country">
          <input className={INPUT_CLS} value={form.territory} onChange={event => set('territory', event.target.value)} placeholder="e.g. ZA or Global" />
        </Field>
        <Field label="Surface">
          <select className={INPUT_CLS} value={form.surface_id} onChange={event => set('surface_id', event.target.value)}>
            <option value="">No specific surface</option>
            {surfaces.map(surface => <option key={surface.id} value={surface.id}>{surface.name}</option>)}
          </select>
        </Field>
        <Field label="Linked source">
          <select className={INPUT_CLS} value={form.source_id} onChange={event => set('source_id', event.target.value)}>
            <option value="">No linked source</option>
            {sources.map(source => <option key={source.id} value={source.id}>{source.source_name}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Researched">
          <input type="date" className={INPUT_CLS} value={form.researched_at} onChange={event => set('researched_at', event.target.value)} />
        </Field>
        <Field label="Last verified">
          <input type="date" className={INPUT_CLS} value={form.last_verified_at} onChange={event => set('last_verified_at', event.target.value)} />
        </Field>
        <Field label="Expires">
          <input type="date" className={INPUT_CLS} value={form.expires_at} onChange={event => set('expires_at', event.target.value)} />
        </Field>
      </div>
      <Field label="Notes">
        <textarea className={`${INPUT_CLS} min-h-[56px]`} value={form.notes} onChange={event => set('notes', event.target.value)} />
      </Field>
      {error && <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
      <div className="flex items-center gap-3">
        <ActionButton type="submit" loading={saving} disabled={missingRequired}>Save knowledge item</ActionButton>
        <ActionButton type="button" variant="ghost" onClick={onCancel}>Cancel</ActionButton>
      </div>
    </form>
  )
}

// ── Knowledge item detail card ────────────────────────────────────────────────

function KnowledgeCard({
  item, surfaces, sources, onEdit,
}: {
  item: PlatformKnowledgeItem
  surfaces: PlatformSurface[]
  sources: MarketingLibrarySource[]
  onEdit: () => void
}) {
  const expired = isKnowledgeExpired(item)
  const stale = isKnowledgeStale(item)
  const surface = surfaces.find(entry => entry.id === item.surface_id) ?? null
  const source = sources.find(entry => entry.id === item.source_id) ?? null
  return (
    <article className={`rounded-xl border p-4 ${stale ? 'border-red-400/25 bg-red-400/[0.05]' : 'border-white/10 bg-white/[0.025]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="break-words text-sm font-black text-white">{item.title}</h4>
          {surface && <p className="mt-0.5 text-[11px] text-white/45">{surface.name}</p>}
        </div>
        <button type="button" onClick={onEdit} className="shrink-0 text-xs font-bold text-brand-teal hover:text-white">Edit</button>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-white/75">{item.principle}</p>
      {item.application && <p className="mt-2 text-xs leading-relaxed text-white/55"><span className="text-white/35">Apply: </span>{item.application}</p>}
      {item.limitations && <p className="mt-2 text-xs leading-relaxed text-amber-100/70"><span className="text-white/35">Limits: </span>{item.limitations}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Pill tone={stateTone(item.knowledge_state)}>{humanize(item.knowledge_state)}</Pill>
        <Pill>{humanize(item.confidence)} confidence</Pill>
        {item.territory && <Pill>{item.territory}</Pill>}
        {stale && item.knowledge_state !== 'stale' && item.knowledge_state !== 'retired' && <Pill tone="amber">Stale</Pill>}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/45">
        <span>{item.last_verified_at ? `Verified ${item.last_verified_at}` : 'Not verified'}</span>
        <span className={expired ? 'font-bold text-red-300' : ''}>
          {item.expires_at ? (expired ? `Expired ${item.expires_at}` : `Expires ${item.expires_at}`) : 'No expiry'}
        </span>
        {source && <span>Source: {source.source_name}</span>}
      </div>
    </article>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function MarketingLibraryPlatformsTab({ sources }: { sources: MarketingLibrarySource[] }) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [migrationNeeded, setMigrationNeeded] = useState(false)

  const [platforms, setPlatforms] = useState<PlatformExpert[]>([])
  const [surfaces, setSurfaces] = useState<PlatformSurface[]>([])
  const [knowledge, setKnowledge] = useState<PlatformKnowledgeItem[]>([])
  const [selectedPlatformId, setSelectedPlatformId] = useState<string | null>(null)

  const [editor, setEditor] = useState<Editor>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function loadAll() {
    setLoading(true)
    setLoadError(null)
    const [platformResult, surfaceResult, knowledgeResult] = await Promise.all([
      listPlatformExperts(), listPlatformSurfaces(), listPlatformKnowledgeItems(),
    ])
    if (platformResult.migrationNeeded || surfaceResult.migrationNeeded || knowledgeResult.migrationNeeded) {
      setMigrationNeeded(true)
      setLoading(false)
      return
    }
    setMigrationNeeded(false)
    setLoadError(platformResult.error ?? surfaceResult.error ?? knowledgeResult.error)
    setPlatforms(platformResult.data)
    setSurfaces(surfaceResult.data)
    setKnowledge(knowledgeResult.data)
    setSelectedPlatformId(prev => prev ?? platformResult.data[0]?.id ?? null)
    setLoading(false)
  }

  const loadAllEvent = useEffectEvent(loadAll)
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAllEvent() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const selectedPlatform = platforms.find(platform => platform.id === selectedPlatformId) ?? null
  const platformSurfaces = useMemo(
    () => surfaces.filter(surface => surface.platform_expert_id === selectedPlatformId),
    [surfaces, selectedPlatformId],
  )
  const platformKnowledge = useMemo(
    () => knowledge.filter(item => item.platform_expert_id === selectedPlatformId),
    [knowledge, selectedPlatformId],
  )

  async function afterMutation(migration: boolean, error: string | null): Promise<boolean> {
    if (migration) { setMigrationNeeded(true); return false }
    if (error) { setSaveError(error); return false }
    await loadAll()
    setEditor(null)
    return true
  }

  async function submitPlatform(input: PlatformExpertInput) {
    setSaving(true); setSaveError(null)
    const response = editor?.kind === 'platform' && editor.mode === 'edit' && selectedPlatform
      ? await updatePlatformExpert(selectedPlatform.id, input)
      : await createPlatformExpert(input)
    setSaving(false)
    const ok = await afterMutation(response.migrationNeeded, response.error)
    if (ok && response.data) setSelectedPlatformId(response.data.id)
  }

  async function submitSurface(input: Omit<PlatformSurfaceInput, 'platform_expert_id'>) {
    if (!selectedPlatformId) return
    setSaving(true); setSaveError(null)
    const target = editor?.kind === 'surface' ? editor.target : undefined
    const response = target
      ? await updatePlatformSurface(target.id, input)
      : await createPlatformSurface({ ...input, platform_expert_id: selectedPlatformId })
    setSaving(false)
    await afterMutation(response.migrationNeeded, response.error)
  }

  async function submitKnowledge(input: Omit<PlatformKnowledgeItemInput, 'platform_expert_id'>) {
    if (!selectedPlatformId) return
    setSaving(true); setSaveError(null)
    const target = editor?.kind === 'knowledge' ? editor.target : undefined
    const response = target
      ? await updatePlatformKnowledgeItem(target.id, input)
      : await createPlatformKnowledgeItem({ ...input, platform_expert_id: selectedPlatformId })
    setSaving(false)
    await afterMutation(response.migrationNeeded, response.error)
  }

  function openEditor(next: Editor) { setSaveError(null); setEditor(next) }

  if (migrationNeeded) {
    return (
      <div className="mt-6 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-5 sm:p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/70">Migration required</p>
        <h2 className="mt-2 text-xl font-black text-white">The Platform Expert tables are not in the database yet</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">
          Review and apply <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs text-amber-100">supabase/phase-18b-platform-expert-foundation.sql</code> in
          the Supabase SQL editor. Until then no platforms, surfaces or knowledge can be read or written. No production SQL is run from this screen.
        </p>
      </div>
    )
  }

  if (loading) return <LoadingState className="mt-8" message="Loading Platform Experts…" />
  if (loadError) {
    return (
      <EmptyState
        className="mt-8"
        title="Could not load Platform Experts"
        message={loadError}
        action={<ActionButton variant="secondary" onClick={() => void loadAll()}>Try again</ActionButton>}
      />
    )
  }

  const isPlatformForm = editor?.kind === 'platform'
  const isSurfaceForm = editor?.kind === 'surface'
  const isKnowledgeForm = editor?.kind === 'knowledge'

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)]">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-black uppercase tracking-[0.12em] text-white/45">Platforms</h2>
          <ActionButton size="sm" onClick={() => openEditor({ kind: 'platform', mode: 'create' })}>New</ActionButton>
        </div>
        {platforms.length === 0 ? (
          <EmptyState title="No platforms yet" message="Create the first Platform Expert shell." />
        ) : (
          <ul className="space-y-2">
            {platforms.map(platform => (
              <li key={platform.id}>
                <button
                  type="button"
                  onClick={() => { setSelectedPlatformId(platform.id); setEditor(null) }}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedPlatformId === platform.id ? 'border-brand-teal/45 bg-brand-teal/[0.07]' : 'border-white/10 bg-white/[0.025] hover:border-white/20'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-black text-white">{platform.name}</p>
                    <Pill tone={platform.active ? 'teal' : 'neutral'}>{platform.active ? 'Active' : 'Inactive'}</Pill>
                  </div>
                  <p className="mt-1 text-xs text-white/40">{platform.slug}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
        {isPlatformForm ? (
          <>
            <h3 className="mb-4 text-lg font-black text-white">{editor?.mode === 'edit' ? 'Edit platform' : 'New platform'}</h3>
            <PlatformForm initial={editor?.mode === 'edit' ? selectedPlatform : null} saving={saving} error={saveError} onCancel={() => setEditor(null)} onSubmit={submitPlatform} />
          </>
        ) : isSurfaceForm ? (
          <>
            <h3 className="mb-4 text-lg font-black text-white">{editor?.target ? 'Edit surface' : 'New surface'}</h3>
            <SurfaceForm initial={editor?.kind === 'surface' ? editor.target ?? null : null} saving={saving} error={saveError} onCancel={() => setEditor(null)} onSubmit={submitSurface} />
          </>
        ) : isKnowledgeForm ? (
          <>
            <h3 className="mb-4 text-lg font-black text-white">{editor?.target ? 'Edit knowledge item' : 'New knowledge item'}</h3>
            <KnowledgeForm
              initial={editor?.kind === 'knowledge' ? editor.target ?? null : null}
              surfaces={platformSurfaces}
              sources={sources}
              saving={saving}
              error={saveError}
              onCancel={() => setEditor(null)}
              onSubmit={submitKnowledge}
            />
          </>
        ) : !selectedPlatform ? (
          <EmptyState title="Select a platform" message="Choose a platform to see its surfaces and knowledge, or create a new one." />
        ) : (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-brand-teal/80">Platform Expert</p>
                <h2 className="mt-1 break-words text-xl font-black text-white">{selectedPlatform.name}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Pill tone={selectedPlatform.active ? 'teal' : 'neutral'}>{selectedPlatform.active ? 'Active' : 'Inactive'}</Pill>
                  <span className="text-xs text-white/40">{selectedPlatform.slug}</span>
                </div>
              </div>
              <ActionButton size="sm" variant="secondary" onClick={() => openEditor({ kind: 'platform', mode: 'edit' })}>Edit</ActionButton>
            </div>
            {selectedPlatform.notes && <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60">{selectedPlatform.notes}</p>}

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-black uppercase tracking-[0.12em] text-white/45">Surfaces</h3>
                <ActionButton size="sm" variant="secondary" onClick={() => openEditor({ kind: 'surface', mode: 'create' })}>New surface</ActionButton>
              </div>
              {platformSurfaces.length === 0 ? (
                <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-white/40">No surfaces yet (e.g. Feed, Reels, Stories, Search).</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {platformSurfaces.map(surface => (
                    <button
                      key={surface.id}
                      type="button"
                      onClick={() => openEditor({ kind: 'surface', mode: 'edit', target: surface })}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${surface.active ? 'border-white/12 bg-white/[0.04] text-white/80 hover:border-brand-teal/40' : 'border-white/10 bg-white/[0.02] text-white/40'}`}
                    >
                      {surface.name}{!surface.active && ' · inactive'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-black uppercase tracking-[0.12em] text-white/45">Knowledge</h3>
                <ActionButton size="sm" onClick={() => openEditor({ kind: 'knowledge', mode: 'create' })}>New knowledge item</ActionButton>
              </div>
              {platformKnowledge.length === 0 ? (
                <EmptyState title="No knowledge items yet" message="Add verified platform knowledge. Never seed unverified platform rules." />
              ) : (
                <div className="space-y-3">
                  {platformKnowledge.map(item => (
                    <KnowledgeCard
                      key={item.id}
                      item={item}
                      surfaces={platformSurfaces}
                      sources={sources}
                      onEdit={() => openEditor({ kind: 'knowledge', mode: 'edit', target: item })}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
