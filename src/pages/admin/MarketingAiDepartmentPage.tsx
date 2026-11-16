import { Link } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { PageContainer } from '../../components/layout/PageShell'
import { fetchActiveClients, type ActiveClientOption } from '../../lib/assistant'
import { isManagerRole } from '../../lib/roles'
import {
  listArtifactApprovals,
  listArtifactHistory,
  listArtifactVersions,
  listMarketingArtifacts,
  recordMarketingDecision,
  SPECIALIST_LABELS,
  WORKFLOW_CHAIN,
  type MarketingApproval,
  type MarketingArtifact,
  type MarketingArtifactVersion,
  type MarketingSpecialist,
  type MarketingTransition,
} from '../../lib/marketingWorkflow'

// Marketing AI Department — internal staff workspace.
//
// Strategist → Copywriting → Brand Guardian → human approval. Everything here is
// an internal draft: nothing publishes, spends budget, changes client records or
// activates knowledge. The route is inside the admin shell, so client-role users
// never reach it; the underlying tables additionally have no client RLS policy.

const STATUS_TONE: Record<string, string> = {
  draft: 'border-white/15 bg-white/[0.04] text-brand-primary/80',
  in_review: 'border-amber-400/30 bg-amber-400/[0.08] text-amber-200',
  changes_requested: 'border-amber-400/30 bg-amber-400/[0.08] text-amber-200',
  rejected: 'border-red-400/30 bg-red-400/[0.08] text-red-200',
  human_approved: 'border-[#2dd4bf]/30 bg-[#2dd4bf]/[0.08] text-[#2dd4bf]',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${STATUS_TONE[status] ?? STATUS_TONE.draft}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function ContentBlock({ content }: { content: Record<string, unknown> }) {
  const entries = Object.entries(content).filter(([key]) => key !== 'evidence_ids' && key !== 'confidence')
  if (entries.length === 0) return <p className="text-xs text-brand-primary/50">No structured content.</p>
  return (
    <dl className="space-y-2">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">{key.replace(/_/g, ' ')}</dt>
          <dd className="mt-0.5 min-w-0 whitespace-pre-wrap break-words text-sm text-white">
            {typeof value === 'string' ? value : Array.isArray(value)
              ? value.map((v, i) => <div key={i}>• {typeof v === 'string' ? v : JSON.stringify(v)}</div>)
              : JSON.stringify(value, null, 2)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export default function MarketingAiDepartmentPage() {
  const { profile } = useAuth()
  const isManager = isManagerRole(profile?.role)

  const [clients, setClients] = useState<ActiveClientOption[]>([])
  const [clientId, setClientId] = useState('')

  const [artifacts, setArtifacts] = useState<MarketingArtifact[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [versions, setVersions] = useState<MarketingArtifactVersion[]>([])
  const [history, setHistory] = useState<MarketingTransition[]>([])
  const [approvals, setApprovals] = useState<MarketingApproval[]>([])
  const [compareId, setCompareId] = useState('')

  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [decisionNote, setDecisionNote] = useState('')

  const selected = useMemo(() => artifacts.find(a => a.id === selectedId) ?? null, [artifacts, selectedId])
  const currentVersion = useMemo(
    () => versions.find(v => v.version === selected?.current_version) ?? versions[0] ?? null,
    [versions, selected],
  )
  const compareVersion = useMemo(() => versions.find(v => v.id === compareId) ?? null, [versions, compareId])

  useEffect(() => {
    fetchActiveClients().then(setClients).catch(() => {})
  }, [])

  const refreshArtifacts = useCallback(async () => {
    const res = await listMarketingArtifacts(clientId || undefined)
    if (!res.error) setArtifacts((res.data ?? []) as MarketingArtifact[])
  }, [clientId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshArtifacts()
  }, [refreshArtifacts])

  const loadArtifactDetail = useCallback(async (id: string) => {
    const [v, h, a] = await Promise.all([
      listArtifactVersions(id), listArtifactHistory(id), listArtifactApprovals(id),
    ])
    if (!v.error) setVersions((v.data ?? []) as MarketingArtifactVersion[])
    if (!h.error) setHistory((h.data ?? []) as MarketingTransition[])
    if (!a.error) setApprovals((a.data ?? []) as MarketingApproval[])
  }, [])

  useEffect(() => {
    if (selectedId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadArtifactDetail(selectedId)
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVersions(() => [])
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHistory(() => [])
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setApprovals(() => [])
    }
    setCompareId('')
  }, [selectedId, loadArtifactDetail])

  async function decide(decision: 'approved' | 'rejected' | 'changes_requested' | 'returned', returnSpecialist?: MarketingSpecialist) {
    if (!selected || !currentVersion) return
    setBusy(true); setError(null); setNotice(null)
    try {
      const res = await recordMarketingDecision({
        artifactId: selected.id,
        versionId: currentVersion.id,
        decision,
        note: decisionNote.trim() || undefined,
        returnSpecialist: returnSpecialist ?? null,
      })
      if (res.error) { setError(res.error.message); return }
      setDecisionNote('')
      setNotice(`Recorded: ${decision.replace(/_/g, ' ')}.`)
      await refreshArtifacts()
      await loadArtifactDetail(selected.id)
    } finally { setBusy(false) }
  }

  return (
    <PageContainer gap={false} className="space-y-5">
      <header>
        <h1 className="text-xl font-black text-white md:text-2xl">Marketing artifact history</h1>
        <p className="mt-1 max-w-3xl text-sm text-brand-primary/65">
          Built-in AI generation has been retired. Use the CG Dynamics connector in ChatGPT or Nolan
          for client context, approved skills and supported business actions. Existing artifacts,
          versions and human decisions remain available here.
        </p>
      </header>

      <section className="rounded-2xl border border-white/10 p-4">
        <Link to="/admin/my-assistant" className="text-brand-teal underline">ChatGPT setup and personal workspace</Link>
        <label className="mt-3 block text-sm text-white">Filter saved artifacts by client
          <select value={clientId} onChange={e => { setClientId(e.target.value); setSelectedId('') }} className="ml-2 rounded bg-brand-surface p-2">
            <option value="">All active clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        {notice && <p role="status" className="mt-2 text-brand-primary">{notice}</p>}
        {error && <p role="alert" className="mt-2 text-red-300">{error}</p>}
      </section>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {/* ── Artifact list ─────────────────────────────────────────────── */}
        <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <h2 className="mb-2 text-sm font-black text-white">Artifacts</h2>
          {artifacts.length === 0 ? (
            <p className="text-xs text-brand-primary/50">No artifacts yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {artifacts.map(a => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(a.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${a.id === selectedId ? 'border-brand-teal/40 bg-brand-teal/[0.07]' : 'border-white/10 bg-white/[0.02] hover:border-white/20'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-xs font-bold text-white">{a.artifact_type.replace(/_/g, ' ')}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-brand-primary/60">{a.originating_request}</p>
                    <p className="mt-0.5 text-[10px] text-brand-primary/45">
                      v{a.current_version} · {SPECIALIST_LABELS[a.current_specialist] ?? a.current_specialist}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Detail ────────────────────────────────────────────────────── */}
        <section className="min-w-0 space-y-4">
          {!selected ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-brand-primary/50">
              Select an artifact to review its versions, evidence and approval history.
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-black text-white">{selected.artifact_type.replace(/_/g, ' ')}</h2>
                    <p className="text-[11px] text-brand-primary/60">{selected.originating_request}</p>
                  </div>
                  <StatusBadge status={selected.status} />
                </div>

                {/* Chain progress */}
                <ol className="mt-3 flex flex-wrap items-center gap-1.5">
                  {WORKFLOW_CHAIN.map((step, i) => {
                    const done = versions.some(v => v.specialist === step)
                    const active = selected.current_specialist === step
                    return (
                      <li key={step} className="flex items-center gap-1.5">
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${done ? 'border-[#2dd4bf]/30 bg-[#2dd4bf]/[0.08] text-[#2dd4bf]' : active ? 'border-amber-400/30 bg-amber-400/[0.08] text-amber-200' : 'border-white/10 text-brand-primary/45'}`}>
                          {SPECIALIST_LABELS[step]}
                        </span>
                        {i < WORKFLOW_CHAIN.length - 1 && <span className="text-brand-primary/30">→</span>}
                      </li>
                    )
                  })}
                  <span className="text-brand-primary/30">→</span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${selected.status === 'human_approved' ? 'border-[#2dd4bf]/30 bg-[#2dd4bf]/[0.08] text-[#2dd4bf]' : 'border-white/10 text-brand-primary/45'}`}>
                    Human approval
                  </span>
                </ol>

              </div>

              {/* Current version */}
              {currentVersion && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-black text-white">
                      Version {currentVersion.version} · {SPECIALIST_LABELS[currentVersion.specialist] ?? currentVersion.specialist}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-brand-primary/60">
                      {currentVersion.confidence !== null && <span className="rounded-full border border-white/10 px-2 py-0.5">confidence {(currentVersion.confidence * 100).toFixed(0)}%</span>}
                      {currentVersion.provider && <span className="rounded-full border border-white/10 px-2 py-0.5">{currentVersion.provider}{currentVersion.model ? ` · ${currentVersion.model}` : ''}</span>}
                      <span className="rounded-full border border-white/10 px-2 py-0.5">{currentVersion.evidence_card_ids.length} evidence</span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5">{new Date(currentVersion.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <ContentBlock content={currentVersion.content} />

                  {/* Version compare */}
                  {versions.length > 1 && (
                    <div className="mt-4 border-t border-white/10 pt-3">
                      <label className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">Compare with</span>
                        <select value={compareId} onChange={e => setCompareId(e.target.value)} className="rounded-lg border border-white/10 bg-[#121614] px-2 py-1 text-xs text-white">
                          <option value="">Choose a version…</option>
                          {versions.filter(v => v.id !== currentVersion.id).map(v => (
                            <option key={v.id} value={v.id}>v{v.version} · {SPECIALIST_LABELS[v.specialist] ?? v.specialist}</option>
                          ))}
                        </select>
                      </label>
                      {compareVersion && (
                        <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                          <p className="mb-1.5 text-[11px] font-bold text-brand-primary/70">
                            v{compareVersion.version} · {SPECIALIST_LABELS[compareVersion.specialist] ?? compareVersion.specialist} · {new Date(compareVersion.created_at).toLocaleString()}
                          </p>
                          <ContentBlock content={compareVersion.content} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Human decision */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h3 className="text-sm font-black text-white">Human decision</h3>
                <p className="mt-1 text-[11px] text-brand-primary/60">
                  Approving records a human sign-off against this exact version. It does not publish, spend
                  budget or change any client record.
                  {!isManager && ' Approve and reject are restricted to managers and admins.'}
                </p>
                <textarea
                  value={decisionNote}
                  onChange={e => setDecisionNote(e.target.value)}
                  rows={2}
                  placeholder="Optional note (required context for changes requested)…"
                  className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-brand-primary/40 focus:outline-none focus:ring-1 focus:ring-brand-teal"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void decide('approved')} disabled={busy || !isManager || !currentVersion || selected.status === 'human_approved'} className="rounded-full bg-[#2dd4bf] px-3 py-1.5 text-xs font-black text-black disabled:opacity-40">Approve</button>
                  <button type="button" onClick={() => void decide('rejected')} disabled={busy || !isManager || !currentVersion} className="rounded-full border border-red-400/30 px-3 py-1.5 text-xs font-bold text-red-200 disabled:opacity-40">Reject</button>
                  <button type="button" onClick={() => void decide('changes_requested')} disabled={busy || !currentVersion} className="rounded-full border border-amber-400/30 px-3 py-1.5 text-xs font-bold text-amber-200 disabled:opacity-40">Request changes</button>
                  <button type="button" onClick={() => void decide('returned', 'marketing_strategist')} disabled={busy || !currentVersion} className="rounded-full border border-white/12 px-3 py-1.5 text-xs font-bold text-brand-primary hover:text-white disabled:opacity-40">Return to Strategist</button>
                </div>
              </div>

              {/* Handoff + approval history */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h3 className="mb-2 text-sm font-black text-white">Handoff &amp; approval history</h3>
                {history.length === 0 ? (
                  <p className="text-xs text-brand-primary/50">No history yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {history.map(h => (
                      <li key={h.id} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white">{h.action.replace(/_/g, ' ')}</span>
                          <span className="text-[10px] text-brand-primary/50">{new Date(h.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-[11px] text-brand-primary/60">
                          {h.from_specialist ? `${SPECIALIST_LABELS[h.from_specialist as MarketingSpecialist] ?? h.from_specialist} → ` : ''}
                          {h.to_specialist ? SPECIALIST_LABELS[h.to_specialist as MarketingSpecialist] ?? h.to_specialist : '—'}
                        </p>
                        {h.note && <p className="mt-0.5 text-[11px] text-brand-primary/75">{h.note}</p>}
                      </li>
                    ))}
                  </ul>
                )}
                {approvals.length > 0 && (
                  <div className="mt-3 border-t border-white/10 pt-2">
                    <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-brand-primary/55">Recorded decisions</p>
                    <ul className="space-y-1">
                      {approvals.map(a => (
                        <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <span className="font-bold text-white">{a.decision.replace(/_/g, ' ')}</span>
                          <span className="text-brand-primary/50">{new Date(a.created_at).toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </PageContainer>
  )
}
