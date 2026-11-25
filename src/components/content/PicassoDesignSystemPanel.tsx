import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { isManagerRole } from '../../lib/roles'
import { listActiveClients, type ClientOption } from '../../lib/commandCentre'
import { getDesignBrandPack, saveDesignBrandPack } from '../../lib/db/designBrandPack'
import { PICASSO_CHECKS, PICASSO_VERSION, DESIGN_FORMATS, applicableCheck, brandPackReadiness, validateDesignBrandPack, type DesignBrandPack, type DesignFormat } from '../../lib/picassoDesignSystem'
import { ClientBrandPanel } from './ClientBrandPanel'
import { ActionButton } from '../ui/Buttons'

const INPUT = 'min-h-11 max-w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white'

export default function PicassoDesignSystemPanel() {
  const { profile } = useAuth()
  const manager = isManagerRole(profile?.role)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientId, setClientId] = useState('')
  const [format, setFormat] = useState<DesignFormat>('still_poster')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void listActiveClients().then(result => { if (active) { setClients(result.data ?? []); setError(result.error?.message ?? '') } }).catch(() => { if (active) setError('Could not load authorised clients.') })
    return () => { active = false }
  }, [])
  return <details className="rounded-2xl border border-brand-teal/25 bg-white/[0.02] p-4 sm:p-5">
    <summary className="cursor-pointer text-base font-bold text-white">PICASSO · Design standards and Brand Packs</summary>
    <div className="mt-4 space-y-4">
      <p className="text-sm text-white/65">Shared CG craft standards for still posters, animated posters and video. Each client supplies its own reviewed brand language. A completed checklist supports review; human approval and delivery permissions remain separate.</p>
      <div className="flex flex-wrap gap-3">
        <label className="min-w-0 text-sm text-white/70">Client<br /><select aria-label="Client" className={INPUT} value={clientId} onChange={e => setClientId(e.target.value)}><option value="">Select exact client</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="text-sm text-white/70">Format<br /><select aria-label="Format" className={INPUT} value={format} onChange={e => setFormat(e.target.value as DesignFormat)}>{DESIGN_FORMATS.map(f => <option key={f} value={f}>{f.replaceAll('_',' ')}</option>)}</select></label>
      </div>
      {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
      {clientId && <ClientPack key={clientId} clientId={clientId} manager={manager} />}
      {clientId && <ClientBrandPanel key={`profile-${clientId}`} clientId={clientId} clientName={clients.find(c => c.id === clientId)?.name ?? 'Selected client'} />}
      <p className="text-xs text-white/45">Standard v{PICASSO_VERSION} · Every applicable item needs a result, reason and evidence for the exact current artwork, caption, pack and rules. These are standards, not pre-ticked approvals.</p>
      <ol className="grid gap-3 lg:grid-cols-2">{PICASSO_CHECKS.map(check => {
        const applies = applicableCheck(check, { format, hasAudio: format !== 'still_poster', isPrint: false, stage: 'internal_review' } as Parameters<typeof applicableCheck>[1])
        return <li key={check.id} className={`min-w-0 rounded-xl border border-white/10 p-3 ${applies ? '' : 'opacity-60'}`}>
          <p className="text-xs font-bold text-brand-teal">{check.area} · {check.id.replaceAll('_',' ')}{!applies ? ' · conditional' : ''}</p>
          <p className="mt-1 text-sm leading-relaxed text-white/80">{check.instruction}</p>
          <p className="mt-2 text-xs text-white/45">Required evidence: {check.evidence}</p>
        </li>
      })}</ol>
    </div>
  </details>
}

function ClientPack({ clientId, manager }: { clientId: string; manager: boolean }) {
  const [pack, setPack] = useState<DesignBrandPack | null>(null)
  const [candidate, setCandidate] = useState<DesignBrandPack | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | undefined>()
  const [scopeKey, setScopeKey] = useState('')
  const [message, setMessage] = useState('Loading Brand Pack…')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    void getDesignBrandPack(clientId).then(result => {
      if (!active) return
      setPack(result.pack); setUpdatedAt(result.updatedAt)
      setMessage(result.error ?? (result.pack ? '' : 'No structured Brand Pack yet. Discovery notes alone do not clear production.'))
      setScopeKey('')
    }).catch(() => { if (active) setMessage('Brand Pack could not be verified. Production remains on hold.') })
    return () => { active = false }
  }, [clientId, revision])
  const readiness = brandPackReadiness(pack, clientId, scopeKey, new Date().toISOString())
  async function importPack(file: File | undefined) {
    setCandidate(null)
    if (!file) return
    if (file.size > 200_000) { setMessage('Use a compact pack under 200 KB; actual media and licensed fonts stay in OneDrive.'); return }
    try {
      const value: unknown = JSON.parse(await file.text())
      const problems = validateDesignBrandPack(value, clientId)
      if (problems.length) { setMessage(problems.join('\n')); return }
      const next = value as DesignBrandPack
      if (pack && next.revision === pack.revision) { setMessage('A replacement needs a new revision. Preserve the previous OneDrive pack and source files.'); return }
      setCandidate(next); setMessage(`Ready to save ${next.revision} (${next.status}); ${next.scopes.map(s => s.name).join(', ')}. This does not approve any artwork.`)
    } catch { setMessage('Invalid Brand Pack JSON. Nothing was saved.') }
  }
  async function save() {
    if (!candidate || !updatedAt) return
    setBusy(true)
    try {
      const result = await saveDesignBrandPack(clientId, candidate, updatedAt)
      if (result.error) { setMessage(result.error); return }
      setCandidate(null); setRevision(r => r + 1)
    } catch { setMessage('Save could not be confirmed. Reload and inspect before retrying; do not overwrite an uncertain save.') }
    finally { setBusy(false) }
  }
  return <section className="space-y-3 rounded-xl border border-white/10 p-4" aria-label="Structured Brand Pack">
    <h3 className="font-bold text-white">Exact-client Brand Pack</h3>
    {message && <p className="whitespace-pre-line break-words text-sm text-amber-100" role="status">{message}</p>}
    {pack && <>
      <p className="text-sm text-white/70">Revision {pack.revision} · {pack.status} · review due {pack.reviewDue}</p>
      <label className="block text-sm text-white/70">Brand scope<br /><select aria-label="Brand scope" className={INPUT} value={scopeKey} onChange={e => setScopeKey(e.target.value)}><option value="">Select explicit scope</option>{(validateDesignBrandPack(pack, clientId).length ? [] : pack.scopes).map(s => <option key={s.key} value={s.key}>{s.name}</option>)}</select></label>
      <p className={`text-sm ${readiness.status === 'ready' ? 'text-brand-teal' : 'text-amber-100'}`}>{readiness.status === 'ready' ? 'Brand Pack ready for this scope. Complete the artwork checks before delivery.' : `Hold: ${readiness.problems.join(' ')}`}</p>
      {readiness.scope && <dl className="grid gap-2 text-sm text-white/75 sm:grid-cols-2">
        <div><dt className="font-bold">Fonts</dt><dd>{readiness.scope.fonts.map(f => `${f.family} ${f.weights.join('/')}`).join(', ')}</dd></div>
        <div><dt className="font-bold">Colours and roles</dt><dd>{readiness.scope.colours.map(c => `${c.hex}: ${c.roles}`).join('; ')}</dd></div>
        <div className="sm:col-span-2"><dt className="font-bold">Visual language</dt><dd className="whitespace-pre-line">{Object.entries(readiness.scope.visualLanguage).map(([k,v]) => `${k}: ${v}`).join('\n')}</dd></div>
      </dl>}
    </>}
    {manager && updatedAt && <div className="space-y-2 border-t border-white/10 pt-3">
      <p className="text-xs text-white/55">Managers may import a versioned pack prepared from verified assets and reviewed evidence. Use a new revision and preserve its OneDrive history. Saving metadata is not creative approval.</p>
      <label className="block text-sm text-white/70">Import Brand Pack JSON<input className="mt-2 block w-full text-sm" type="file" accept="application/json,.json" onChange={e => void importPack(e.target.files?.[0])} /></label>
      {candidate && <ActionButton size="sm" loading={busy} onClick={() => void save()}>Save Brand Pack revision {candidate.revision}</ActionButton>}
    </div>}
  </section>
}
