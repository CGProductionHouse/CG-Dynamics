import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { PageContainer } from '../../components/layout/PageShell'
import { fetchActiveClients, type ActiveClientOption } from '../../lib/assistant'
import { isManagerRole } from '../../lib/roles'
import {
  listArtifactApprovals,
  listArtifactHistory,
  listArtifactVersions,
  listCampaignOptions,
  listMarketingArtifacts,
  recordMarketingDecision,
  routeMarketingRequest,
  runMarketingSpecialist,
  SPECIALIST_LABELS,
  WORKFLOW_CHAIN,
  type MarketingApproval,
  type MarketingArtifact,
  type MarketingArtifactVersion,
  type MarketingSpecialist,
  type MarketingTransition,
  type RunResult,
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
  const [campaigns, setCampaigns] = useState<Array<{ campaign_id: string; campaign_name: string | null }>>([])
  const [campaignId, setCampaignId] = useState('')
  const [request, setRequest] = useState('')
  const [manualSpecialist, setManualSpecialist] = useState<'' | MarketingSpecialist>('')
  const [routePreview, setRoutePreview] = useState<{ specialist: MarketingSpecialist; reason: string } | null>(null)

  const [artifacts, setArtifacts] = useState<MarketingArtifact[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [versions, setVersions] = useState<MarketingArtifactVersion[]>([])
  const [history, setHistory] = useState<MarketingTransition[]>([])
  const [approvals, setApprovals] = useState<MarketingApproval[]>([])
  const [compareId, setCompareId] = useState('')

  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastRun, setLastRun] = useState<RunResult | null>(null)
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

  useEffect(() => { void refreshArtifacts() }, [refreshArtifacts])

  useEffect(() => {
    if (!clientId) { setCampaigns([]); return }
    listCampaignOptions(clientId).then(res => {
      if (!res.error) setCampaigns((res.data ?? []) as Array<{ campaign_id: string; campaign_name: string | null }>)
    }).catch(() => {})
  }, [clientId])

  const loadArtifactDetail = useCallback(async (id: string) => {
    const [v, h, a] = await Promise.all([
      listArtifactVersions(id), listArtifactHistory(id), listArtifactApprovals(id),
    ])
    if (!v.error) setVersions((v.data ?? []) as MarketingArtifactVersion[])
    if (!h.error) setHistory((h.data ?? []) as MarketingTransition[])
    if (!a.error) setApprovals((a.data ?? []) as MarketingApproval[])
  }, [])

  useEffect(() => {
    if (selectedId) void loadArtifactDetail(selectedId)
    else { setVersions([]); setHistory([]); setApprovals([]) }
    setCompareId('')
  }, [selectedId, loadArtifactDetail])

  async function previewRoute() {
    if (!request.trim()) return
    setRoutePreview(await routeMarketingRequest(request.trim()))
  }

  async function run(opts: { artifactId?: string; specialist?: MarketingSpecialist; regenerate?: boolean; changeNote?: string } = {}) {
    if (!clientId) { setError('Choose an active client first.'); return }
    setBusy(true); setError(null); setNotice(null)
    try {
      const chosenCampaign = campaigns.find(c => c.campaign_id === campaignId) ?? null
      const result = await runMarketingSpecialist({
        clientId,
        request: request.trim() || undefined,
        artifactId: opts.artifactId,
        specialist: opts.specialist ?? (manualSpecialist || undefined),
        campaignId: campaignId || null,
        campaignName: chosenCampaign?.campaign_name ?? null,
        regenerate: opts.regenerate,
        changeNote: opts.changeNote,
      })
      setLastRun(result)
      if (!result.ok) { setError(result.error ?? 'The specialist could not be run.'); return }
      if (result.insufficientEvidence) { setNotice(result.message ?? 'Not enough approved knowledge.'); return }
      setNotice(`${result.specialistName} produced version ${result.version?.version}. ${result.nextSpecialist ? `Next: ${SPECIALIST_LABELS[result.nextSpecialist]}.` : 'Ready for human approval.'}`)
      await refreshArtifacts()
      if (result.artifact) { setSelectedId(result.artifact.id); await loadArtifactDetail(result.artifact.id) }
    } finally { setBusy(false) }
  }

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
        <h1 className="text-xl font-black text-white md:text-2xl">Marketing AI Department</h1>
        <p className="mt-1 max-w-3xl text-sm text-brand-primary/65">
          Strategist → Copywriting → Brand Guardian, then human approval. Everything here is an internal
          draft built only from approved Skill Cards for the selected client. Nothing publishes, spends
          budget, changes client records or activates knowledge without an authorised human decision.
        </p>
      </header>

      {/* ── New request ─────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="text-sm font-black text-white">New request</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">Active client</span>
            <select
              value={clientId}
              onChange={e => { setClientId(e.target.value); setCampaignId(''); setSelectedId('') }}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#121614] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-teal"
            >
              <option value="">Choose a client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">Campaign (optional)</span>
            <select
              value={campaignId}
              onChange={e => setCampaignId(e.target.value)}
              disabled={campaigns.length === 0}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#121614] px-3 py-2 text-sm text-white disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-brand-teal"
            >
              <option value="">{campaigns.length === 0 ? 'No linked campaigns' : 'No specific campaign'}</option>
              {campaigns.map(c => <option key={c.campaign_id} value={c.campaign_id}>{c.campaign_name ?? c.campaign_id}</option>)}
            </select>
          </label>
        </div>
        <label className="mt-3 block">
          <span className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">What do you need?</span>
          <textarea
            value={request}
            onChange={e => { setRequest(e.target.value); setRoutePreview(null) }}
            rows={3}
            placeholder="e.g. Build a Q4 campaign strategy and launch copy for the new range"
            className="mt-1 w-full resize-y rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-brand-primary/40 focus:outline-none focus:ring-1 focus:ring-brand-teal"
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">Specialist</span>
            <select
              value={manualSpecialist}
              onChange={e => setManualSpecialist(e.target.value as '' | MarketingSpecialist)}
              className="rounded-lg border border-white/10 bg-[#121614] px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-teal"
            >
              <option value="">CG Assistant routes automatically</option>
              {Object.entries(SPECIALIST_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => void previewRoute()} disabled={!request.trim()} className="rounded-full border border-white/12 px-3 py-1.5 text-sm font-bold text-brand-primary hover:text-white disabled:opacity-40">
            Preview routing
          </button>
          <button type="button" onClick={() => void run()} disabled={busy || !clientId || !request.trim()} className="rounded-full bg-brand-teal px-4 py-1.5 text-sm font-black text-black disabled:opacity-40">
            {busy ? 'Working…' : 'Start workflow'}
          </button>
        </div>
        {routePreview && (
          <p className="mt-2 rounded-lg border border-brand-teal/25 bg-brand-teal/[0.06] px-3 py-2 text-xs text-brand-primary/85">
            Would route to <strong className="text-white">{SPECIALIST_LABELS[routePreview.specialist]}</strong> — {routePreview.reason}
          </p>
        )}
        {notice && <p className="mt-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2 text-xs text-amber-100">{notice}</p>}
        {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
        {lastRun?.insufficientEvidence && (
          <p className="mt-2 text-[11px] text-brand-primary/60">
            The Skill Card review gate is intentionally closed until cards are approved. No draft is invented in the meantime.
          </p>
        )}
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

                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void run({ artifactId: selected.id })} disabled={busy || selected.status === 'human_approved'} className="rounded-full bg-brand-teal px-3 py-1.5 text-xs font-black text-black disabled:opacity-40">
                    Hand off to next specialist
                  </button>
                  <button type="button" onClick={() => void run({ artifactId: selected.id, regenerate: true, changeNote: decisionNote.trim() || undefined })} disabled={busy || selected.status === 'human_approved'} className="rounded-full border border-white/12 px-3 py-1.5 text-xs font-bold text-brand-primary hover:text-white disabled:opacity-40">
                    Regenerate current step
                  </button>
                </div>
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
