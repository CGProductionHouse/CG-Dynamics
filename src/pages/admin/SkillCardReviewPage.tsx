import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { isAdminRole } from '../../lib/roles'
import {
  activateSkillCard,
  ALL_SPECIALISTS,
  applyQueueFilters,
  EDITABLE_FIELDS,
  EMPTY_FILTERS,
  groupBy,
  loadSkillCardReviewQueue,
  PRIORITY_GROUPS,
  recommendedQueue,
  recordSkillCardReview,
  setSkillCardRouting,
  summariseReadiness,
  type EditableField,
  type QueueFilters,
  type ReviewDecision,
  type SkillCardReviewRow,
  type StatusFilter,
} from '../../lib/skillCardReview'

// Skill Card review — the human workspace for safely activating knowledge.
//
// Admin-only. Every decision is recorded with reviewer, note and timestamp, and
// activation always goes one card at a time through the database gate. There is
// no bulk-activate control anywhere on this screen by design.

const STATUS_TONE: Record<string, string> = {
  active: 'border-[#2dd4bf]/30 bg-[#2dd4bf]/[0.08] text-[#2dd4bf]',
  needs_review: 'border-amber-400/30 bg-amber-400/[0.08] text-amber-200',
  reviewed: 'border-sky-400/30 bg-sky-400/[0.08] text-sky-200',
  draft: 'border-white/15 bg-white/[0.04] text-brand-primary/70',
  deprecated: 'border-red-400/30 bg-red-400/[0.08] text-red-200',
}

const TRUST_LABEL: Record<string, string> = {
  tier_1_primary: 'Tier 1 · primary',
  tier_2_trusted_professional: 'Tier 2 · trusted professional',
  tier_3_internal_learning: 'Tier 3 · internal learning',
  tier_4_low_trust: 'Tier 4 · low trust',
  needs_review: 'Source needs review',
}

const FIELD_LABELS: Record<EditableField, string> = {
  principle: 'Principle',
  summary: 'Summary',
  why_it_matters: 'Why it matters',
  how_to_apply: 'How to apply',
  agent_instructions: 'Agent instructions',
  safe_claim: 'Safe claim',
  prohibited_overclaim: 'Prohibited overclaim',
  jurisdiction: 'Jurisdiction',
}

// Wording a reviewer should usually soften before approving.
const ABSOLUTE_WORDING = /\b(always|never|guarantee[ds]?|guaranteed|proven to|100%|all clients|every client|will increase|ensures?)\b/gi

function overconfidentPhrases(row: SkillCardReviewRow): string[] {
  const text = [row.principle, row.summary, row.safe_claim, row.how_to_apply, row.agent_instructions]
    .filter(Boolean).join(' ')
  return [...new Set((text.match(ABSOLUTE_WORDING) ?? []).map(m => m.toLowerCase()))]
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${STATUS_TONE[status] ?? STATUS_TONE.draft}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${tone ?? 'border-white/10 bg-white/[0.03]'}`}>
      <p className="text-lg font-black leading-none text-white">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-brand-primary/60">{label}</p>
    </div>
  )
}

export default function SkillCardReviewPage() {
  const { profile } = useAuth()
  const isAdmin = isAdminRole(profile?.role)

  const [rows, setRows] = useState<SkillCardReviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [filters, setFilters] = useState<QueueFilters>(EMPTY_FILTERS)
  const [openId, setOpenId] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [edits, setEdits] = useState<Partial<Record<EditableField, string>>>({})
  const [routing, setRouting] = useState<string[] | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await loadSkillCardReviewQueue()
    if (res.error) setError(res.error.message)
    else { setRows((res.data ?? []) as SkillCardReviewRow[]); setError(null) }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const summary = useMemo(() => summariseReadiness(rows), [rows])
  const filtered = useMemo(() => applyQueueFilters(rows, filters), [rows, filters])
  const recommended = useMemo(() => recommendedQueue(rows), [rows])
  const open = useMemo(() => rows.find(r => r.id === openId) ?? null, [rows, openId])

  const specialists = useMemo(
    () => [...new Set(rows.flatMap(r => r.resolved_agents))].sort(),
    [rows],
  )
  const trustTiers = useMemo(
    () => [...new Set(rows.map(r => r.source_trust_tier ?? '(none)'))].sort(),
    [rows],
  )
  const grouped = useMemo(
    () => groupBy(filtered, r => `${r.priority_group}|${r.category ?? 'Uncategorised'}`),
    [filtered],
  )

  useEffect(() => { setNote(''); setEdits({}); setRouting(null) }, [openId])

  async function saveRouting() {
    if (!open || !routing || busy) return
    setBusy(true); setError(null); setNotice(null)
    try {
      const res = await setSkillCardRouting({ cardId: open.id, agents: routing, note: note.trim() || undefined })
      if (res.error) { setError(res.error.message); return }
      setNotice(`Routing updated for "${open.title}".`)
      setRouting(null)
      await load()
    } finally { setBusy(false) }
  }

  async function decide(decision: ReviewDecision) {
    if (!open || busy) return
    setBusy(true); setError(null); setNotice(null)
    try {
      const res = await recordSkillCardReview({ cardId: open.id, decision, note: note.trim() || undefined, edits })
      if (res.error) { setError(res.error.message); return }
      setNotice(`Recorded "${decision.replace(/_/g, ' ')}" on "${open.title}".`)
      setNote(''); setEdits({})
      await load()
    } finally { setBusy(false) }
  }

  async function activate() {
    if (!open || busy) return
    setBusy(true); setError(null); setNotice(null)
    try {
      const res = await activateSkillCard(open.id)
      if (res.error) { setError(res.error.message); return }
      setNotice(`"${open.title}" is now active and available to its specialists.`)
      await load()
    } finally { setBusy(false) }
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4 text-sm text-amber-100">
          Skill Card review is restricted to admins. Ask an admin to review and activate knowledge.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-black text-white md:text-2xl">Skill Card review</h1>
        <p className="mt-1 max-w-3xl text-sm text-brand-primary/65">
          Review knowledge before it reaches the AI specialists. Cards only go live one at a time,
          after an approved review — nothing is bulk-activated, and the database gate has the final say.
        </p>
      </header>

      {/* ── Readiness summary ─────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <SummaryTile label="Total cards" value={summary.total} />
        <SummaryTile label="Active" value={summary.active} tone="border-[#2dd4bf]/25 bg-[#2dd4bf]/[0.06]" />
        <SummaryTile label="Needs review" value={summary.needsReview} tone="border-amber-400/25 bg-amber-400/[0.06]" />
        <SummaryTile label="Ready to activate" value={summary.readyToActivate} tone="border-[#2dd4bf]/25 bg-[#2dd4bf]/[0.06]" />
        <SummaryTile label="No source" value={summary.blockedMissingSource} />
        <SummaryTile label="No approved review" value={summary.blockedMissingApprovedReview} />
        <SummaryTile label="No review date" value={summary.blockedMissingLastReviewed} />
        <SummaryTile label="Unsafe trust tier" value={summary.blockedUnsafeTrust} />
      </section>

      {notice && <p className="rounded-lg border border-[#2dd4bf]/25 bg-[#2dd4bf]/[0.07] px-3 py-2 text-xs text-[#2dd4bf]">{notice}</p>}
      {error && <p className="rounded-lg border border-red-400/25 bg-red-400/[0.07] px-3 py-2 text-xs text-red-200">{error}</p>}

      {/* ── Recommended first review ──────────────────────────────────────── */}
      {recommended.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-sm font-black text-white">Recommended first review</h2>
          <p className="mt-0.5 text-[11px] text-brand-primary/60">
            Suggested order only — nothing here is approved automatically. Safety cards first, then
            universal principles, then verified client-specific limits.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {recommended.map(r => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(r.id)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${r.id === openId ? 'border-brand-teal/50 bg-brand-teal/[0.10] text-white' : 'border-white/12 text-brand-primary/80 hover:text-white'}`}
                  title={PRIORITY_GROUPS[r.priority_group]?.hint}
                >
                  <span className="mr-1 text-brand-primary/45">{r.priority_group}</span>{r.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <section className="flex flex-wrap items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        {([
          ['all', 'All'], ['needs_review', 'Needs review'], ['activation_blocked', 'Activation blocked'],
          ['ready_to_activate', 'Ready to activate'], ['active', 'Active'], ['client_specific', 'Client-specific'],
        ] as Array<[StatusFilter, string]>).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilters(f => ({ ...f, status: value }))}
            className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${filters.status === value ? 'border-brand-teal/50 bg-brand-teal/[0.10] text-white' : 'border-white/12 text-brand-primary/75 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
        <select
          value={filters.specialist}
          onChange={e => setFilters(f => ({ ...f, specialist: e.target.value }))}
          className="rounded-lg border border-white/10 bg-[#121614] px-2 py-1 text-xs text-white"
          aria-label="Filter by specialist"
        >
          <option value="">Any specialist</option>
          {specialists.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select
          value={filters.trust}
          onChange={e => setFilters(f => ({ ...f, trust: e.target.value }))}
          className="rounded-lg border border-white/10 bg-[#121614] px-2 py-1 text-xs text-white"
          aria-label="Filter by source trust"
        >
          <option value="">Any source trust</option>
          {trustTiers.map(t => <option key={t} value={t}>{TRUST_LABEL[t] ?? t}</option>)}
        </select>
        <select
          value={filters.expiry}
          onChange={e => setFilters(f => ({ ...f, expiry: e.target.value }))}
          className="rounded-lg border border-white/10 bg-[#121614] px-2 py-1 text-xs text-white"
          aria-label="Filter by expiry"
        >
          <option value="">Any expiry</option>
          <option value="expired">Expired</option>
          <option value="expiring_90">Expiring in 90 days</option>
          <option value="none">No expiry set</option>
        </select>
        <input
          value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          placeholder="Search title or claim…"
          className="min-w-[10rem] flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white placeholder:text-brand-primary/40"
        />
        <span className="text-[11px] text-brand-primary/50">{filtered.length} of {rows.length}</span>
      </section>

      <div className="grid gap-4 xl:grid-cols-[22rem_1fr]">
        {/* ── Grouped list ────────────────────────────────────────────────── */}
        <section className="space-y-3">
          {loading && <p className="text-xs text-brand-primary/50">Loading…</p>}
          {!loading && filtered.length === 0 && <p className="text-xs text-brand-primary/50">No cards match these filters.</p>}
          {[...grouped.entries()].map(([key, list]) => {
            const [group, category] = key.split('|')
            const meta = PRIORITY_GROUPS[Number(group)]
            return (
              <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-2">
                  <p className="text-xs font-black text-white">{category}</p>
                  <p className="text-[10px] text-brand-primary/55">{meta?.label} · {list.length} card{list.length === 1 ? '' : 's'}</p>
                </div>
                <ul className="space-y-1.5">
                  {list.map(r => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setOpenId(r.id)}
                        className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${r.id === openId ? 'border-brand-teal/40 bg-brand-teal/[0.07]' : 'border-white/10 bg-white/[0.02] hover:border-white/20'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="min-w-0 text-xs font-bold text-white">{r.title}</span>
                          <StatusPill status={r.status} />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {r.ready_to_activate && <span className="rounded-full border border-[#2dd4bf]/30 px-1.5 py-0.5 text-[9px] font-bold text-[#2dd4bf]">ready</span>}
                          {r.blockers.length > 0 && r.status !== 'active' && <span className="rounded-full border border-amber-400/25 px-1.5 py-0.5 text-[9px] font-bold text-amber-200">{r.blockers.length} blocker{r.blockers.length === 1 ? '' : 's'}</span>}
                          {r.client_specific && <span className="rounded-full border border-white/12 px-1.5 py-0.5 text-[9px] font-bold text-brand-primary/70">client</span>}
                          {r.unrecognised_agents.length > 0 && <span className="rounded-full border border-red-400/30 px-1.5 py-0.5 text-[9px] font-bold text-red-200">unknown agent key</span>}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </section>

        {/* ── Card detail ─────────────────────────────────────────────────── */}
        <section>
          {!open ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-brand-primary/50">
              Choose a card to review its source, claim safety and routing.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-base font-black text-white">{open.title}</h2>
                    <p className="text-[11px] text-brand-primary/55">{open.category}{open.subcategory ? ` · ${open.subcategory}` : ''} · {open.slug}</p>
                  </div>
                  <StatusPill status={open.status} />
                </div>

                {/* Why it cannot activate */}
                {open.status !== 'active' && (
                  open.blockers.length > 0 ? (
                    <div className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-3">
                      <p className="text-[11px] font-black uppercase tracking-wide text-amber-200">Cannot activate yet</p>
                      <ul className="mt-1 space-y-0.5">
                        {open.blockers.map(b => <li key={b} className="text-xs text-amber-100">• {b}</li>)}
                      </ul>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-lg border border-[#2dd4bf]/25 bg-[#2dd4bf]/[0.06] p-3 text-xs text-[#2dd4bf]">
                      All activation requirements are met. Activating puts this card in front of its specialists.
                    </div>
                  )
                )}

                {/* Provenance + safety */}
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div><dt className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">Source</dt>
                    <dd className="text-xs text-white">{open.source_name ?? <span className="text-amber-200">No linked source</span>}</dd></div>
                  <div><dt className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">Trust tier</dt>
                    <dd className="text-xs text-white">{open.source_trust_tier ? (TRUST_LABEL[open.source_trust_tier] ?? open.source_trust_tier) : '—'}</dd></div>
                  <div><dt className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">Evidence label</dt>
                    <dd className="text-xs text-white">{open.evidence_label ?? '—'} · confidence {open.confidence_level ?? '—'}</dd></div>
                  <div><dt className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">Knowledge layer</dt>
                    <dd className="text-xs text-white">{open.knowledge_layer ?? '—'}</dd></div>
                  <div><dt className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">Jurisdiction</dt>
                    <dd className="text-xs text-white">{open.jurisdiction ?? '—'}</dd></div>
                  <div><dt className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">Review expiry</dt>
                    <dd className="text-xs text-white">{open.review_expires_at ? new Date(open.review_expires_at).toLocaleDateString() : 'none set'}</dd></div>
                  <div><dt className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">Last reviewed</dt>
                    <dd className="text-xs text-white">{open.last_reviewed ? new Date(open.last_reviewed).toLocaleString() : 'never'}</dd></div>
                  <div><dt className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">Reviews recorded</dt>
                    <dd className="text-xs text-white">{open.review_count} ({open.approved_review_count} approved)</dd></div>
                </dl>

                {/* Routing preview */}
                <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">Who will receive this</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {open.resolved_agents.length === 0
                      ? <span className="text-xs text-amber-200">No recognised specialist — this card would reach nobody.</span>
                      : open.resolved_agents.map(a => (
                        <span key={a} className="rounded-full border border-white/12 px-2 py-0.5 text-[10px] font-bold text-brand-primary/80">{a.replace(/_/g, ' ')}</span>
                      ))}
                  </div>
                  {open.unrecognised_agents.length > 0 && (
                    <p className="mt-1.5 text-[11px] text-red-200">
                      Unrecognised agent key{open.unrecognised_agents.length === 1 ? '' : 's'}: {open.unrecognised_agents.join(', ')} — fix before activating.
                    </p>
                  )}
                  <div className="mt-2 border-t border-white/10 pt-2">
                    <p className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">Change routing</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {ALL_SPECIALISTS.map(sp => {
                        const current = routing ?? open.resolved_agents
                        const on = current.includes(sp)
                        return (
                          <button
                            key={sp}
                            type="button"
                            onClick={() => {
                              const base = routing ?? open.resolved_agents
                              setRouting(on ? base.filter(x => x !== sp) : [...base, sp])
                            }}
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold transition-colors ${on ? 'border-brand-teal/50 bg-brand-teal/[0.10] text-white' : 'border-white/12 text-brand-primary/60 hover:text-white'}`}
                          >
                            {sp.replace(/_/g, ' ')}
                          </button>
                        )
                      })}
                    </div>
                    {routing && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <button type="button" onClick={() => void saveRouting()} disabled={busy || routing.length === 0} className="rounded-full bg-brand-teal px-3 py-1 text-[11px] font-black text-black disabled:opacity-40">Save routing</button>
                        <button type="button" onClick={() => setRouting(null)} className="text-[11px] font-bold text-brand-primary/60 hover:text-white">Cancel</button>
                        {routing.length === 0 && <span className="text-[11px] text-amber-200">A card must reach at least one specialist.</span>}
                      </div>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] text-brand-primary/60">
                    {open.client_specific
                      ? <>Client-specific: only <strong className="text-white">{open.active_client_name ?? 'no client assigned'}</strong>{open.active_client_is_active === false && <span className="text-amber-200"> (client is not active)</span>}.</>
                      : <>Shared across clients{open.relevant_industries?.length ? ` · industries: ${open.relevant_industries.join(', ')}` : ''}.</>}
                  </p>
                </div>
              </div>

              {/* Wording review */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h3 className="text-sm font-black text-white">Wording</h3>
                {overconfidentPhrases(open).length > 0 && (
                  <p className="mt-1 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-2.5 py-1.5 text-[11px] text-amber-100">
                    Absolute wording found: <strong>{overconfidentPhrases(open).join(', ')}</strong>. Soften before approving.
                  </p>
                )}
                <div className="mt-2 space-y-2">
                  {EDITABLE_FIELDS.map(field => {
                    const current = edits[field] ?? (open[field] ?? '')
                    return (
                      <label key={field} className="block">
                        <span className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">{FIELD_LABELS[field]}</span>
                        <textarea
                          value={current}
                          onChange={e => setEdits(prev => ({ ...prev, [field]: e.target.value }))}
                          rows={field === 'principle' || field === 'summary' ? 2 : 1}
                          className="mt-0.5 w-full resize-y rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-teal"
                        />
                      </label>
                    )
                  })}
                </div>
                {Object.keys(edits).length > 0 && (
                  <p className="mt-1.5 text-[11px] text-brand-primary/60">
                    {Object.keys(edits).length} field(s) edited. Edits are saved with your next decision.
                  </p>
                )}
              </div>

              {/* Decision */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h3 className="text-sm font-black text-white">Decision</h3>
                <p className="mt-0.5 text-[11px] text-brand-primary/60">
                  Your name and the time are recorded with every decision. Approving does not activate —
                  activation is a separate, deliberate step per card.
                </p>
                {open.latest_review_status && (
                  <p className="mt-1.5 text-[11px] text-brand-primary/55">
                    Last: <strong className="text-white">{open.latest_review_status.replace(/_/g, ' ')}</strong>
                    {open.latest_review_by ? ` by ${open.latest_review_by}` : ''}
                    {open.latest_reviewed_at ? ` · ${new Date(open.latest_reviewed_at).toLocaleString()}` : ''}
                    {open.latest_review_notes ? ` — ${open.latest_review_notes}` : ''}
                  </p>
                )}
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  placeholder="Reviewer note (what you checked, what you changed)…"
                  className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-brand-primary/40 focus:outline-none focus:ring-1 focus:ring-brand-teal"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void decide('approved')} disabled={busy} className="rounded-full bg-brand-teal px-3 py-1.5 text-xs font-black text-black disabled:opacity-40">Approve</button>
                  <button type="button" onClick={() => void decide('changes_requested')} disabled={busy} className="rounded-full border border-amber-400/30 px-3 py-1.5 text-xs font-bold text-amber-200 disabled:opacity-40">Request changes</button>
                  <button type="button" onClick={() => void decide('rejected')} disabled={busy} className="rounded-full border border-red-400/30 px-3 py-1.5 text-xs font-bold text-red-200 disabled:opacity-40">Reject</button>
                  <button type="button" onClick={() => void decide('deprecated')} disabled={busy} className="rounded-full border border-white/12 px-3 py-1.5 text-xs font-bold text-brand-primary hover:text-white disabled:opacity-40">Deprecate</button>
                  <button
                    type="button"
                    onClick={() => void activate()}
                    disabled={busy || !open.ready_to_activate}
                    title={open.ready_to_activate ? 'Activate this one card' : 'Resolve the blockers above first'}
                    className="rounded-full bg-[#2dd4bf] px-3 py-1.5 text-xs font-black text-black disabled:opacity-40"
                  >
                    Activate this card
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
