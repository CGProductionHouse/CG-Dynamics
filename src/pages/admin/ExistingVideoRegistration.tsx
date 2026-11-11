import { useState } from 'react'
import { ActionButton } from '../../components/ui/Buttons'
import type { ClientOption } from '../../lib/commandCentre'
import { EXISTING_VIDEO_EVIDENCE, validateExistingVideo, type ExistingVideoInput, type registerExistingVideoWith } from '../../lib/existingVideoRegistration'
import { INPUT_CLS, LABEL_CLS } from './contentGuidelineHelpers'

export interface ExistingVideoRegistrationProps {
  clients: ClientOption[]
  onRegister: (input: ExistingVideoInput) => ReturnType<typeof registerExistingVideoWith>
  onOpen: (id: string) => void
  onSaved: (id: string) => Promise<void>
}

const EMPTY: ExistingVideoInput = {
  clientId: '', clientName: '', month: '', title: '', identity: '', filename: '', sha256: '',
  revision: '', editorName: '', mediaUrl: '', evidenceUrl: '', evidence: '', evidenceKind: 'private_edit',
}

export default function ExistingVideoRegistration({ clients, onRegister, onOpen, onSaved }: ExistingVideoRegistrationProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ExistingVideoInput>({ ...EMPTY })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matches, setMatches] = useState<Awaited<ReturnType<typeof registerExistingVideoWith>>['matches']>([])
  const [confirmed, setConfirmed] = useState(false)
  const [success, setSuccess] = useState(false)
  const set = <K extends keyof ExistingVideoInput>(key: K, value: ExistingVideoInput[K]) => {
    setForm(previous => ({ ...previous, [key]: value }))
    setError(null); setMatches([]); setConfirmed(false); setSuccess(false)
  }

  async function submit() {
    if (busy || !confirmed) return
    const invalid = validateExistingVideo(form)
    if (invalid) { setError(invalid); return }
    setBusy(true); setError(null); setMatches([])
    try {
      const result = await onRegister(form)
      if (result.error || !result.data) { setError(result.error ?? 'No saved record was returned.'); setMatches(result.matches); return }
      setSuccess(true)
      await onSaved(result.data.id)
    } catch {
      setError('Registration or refresh failed. Reload the pipeline and check for this film before retrying.')
    } finally { setBusy(false) }
  }

  const field = (key: Exclude<keyof ExistingVideoInput, 'evidenceKind' | 'clientId' | 'clientName'>, label: string, type = 'text', placeholder = '') => (
    <label className="block min-w-0 space-y-1.5"><span className={LABEL_CLS}>{label}</span>
      <input required type={type} className={INPUT_CLS} value={form[key]} onChange={event => set(key, event.target.value)} placeholder={placeholder} />
    </label>
  )

  return <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-black text-white">Already edited?</h2><p className="text-sm text-white/60">Track an existing film without creating a shoot or posting slot.</p></div>
      <ActionButton variant="secondary" size="sm" disabled={busy} onClick={() => setOpen(value => !value)}>{open ? 'Close registration' : 'Register existing film'}</ActionButton>
    </div>
    {open && <form className="mt-4 space-y-4" onSubmit={event => { event.preventDefault(); void submit() }}>
      <fieldset disabled={busy || success} className="space-y-4 disabled:opacity-60">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5"><span className={LABEL_CLS}>Client</span>
            <select required className={INPUT_CLS} value={form.clientId} onChange={event => {
              const client = clients.find(row => row.id === event.target.value)
              setForm(previous => ({ ...previous, clientId: client?.id ?? '', clientName: client?.name ?? '' })); setConfirmed(false); setError(null); setMatches([])
            }}><option value="">Select exact client</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
          </label>
          {field('month', 'Intended release month', 'text', 'YYYY-MM')}
          {field('title', 'Film title')}
          {field('editorName', 'Responsible editor', 'text', 'Nolan MSI / Nolan Studio PC / staff name')}
        </div>
        {field('identity', 'Stable film identity — no revision or extension', 'text', '2026_12_CLIENT_VIDEO_01_CONCEPT')}
        <p className="text-xs text-white/55">Use the established identity. A protected revision belongs to the same film. Source month and release month may differ.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('filename', 'Exact MP4 filename')}{field('revision', 'Current revision')}
        </div>
        {field('sha256', 'Exact revision SHA-256')}
        {field('mediaUrl', 'Private media / package link', 'url')}
        <label className="block space-y-1.5"><span className={LABEL_CLS}>Evidence supports</span>
          <select className={INPUT_CLS} value={form.evidenceKind} onChange={event => set('evidenceKind', event.target.value as ExistingVideoInput['evidenceKind'])}>
            {Object.entries(EXISTING_VIDEO_EVIDENCE).map(([value, entry]) => <option key={value} value={value}>{entry.label}</option>)}
          </select>
        </label>
        {field('evidenceUrl', 'Evidence reference link', 'url')}
        <label className="block space-y-1.5"><span className={LABEL_CLS}>Evidence, date and authority</span><textarea required className={`${INPUT_CLS} min-h-[90px]`} value={form.evidence} onChange={event => set('evidence', event.target.value)} /></label>
        <p className="text-xs text-white/55">Owner approval is not client approval. A filename, export or delivery tick does not prove approval or posting. Rejected and withdrawn studies remain historical; do not register them as current films.</p>
        {form.filename && <div className="min-w-0 rounded-lg border border-brand-teal/25 p-3 text-sm text-white/85">
          <p className="font-bold">Confirm exact attachment</p><p className="break-all">{form.filename}</p>
          <p className="mt-1">{form.clientName || 'Select client'} · {form.month || 'Choose month'} · {form.revision || 'Choose revision'}</p>
          <p>{EXISTING_VIDEO_EVIDENCE[form.evidenceKind].label}</p>
        </div>}
        <label className="flex items-start gap-3 text-sm text-white/80"><input type="checkbox" className="mt-1" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I checked this client’s saved history and current ownership. These links and this state describe the exact existing film.</label>
        <ActionButton type="submit" loading={busy} disabled={!confirmed || Boolean(validateExistingVideo(form))}>Save existing film</ActionButton>
      </fieldset>
      {error && <p role="alert" className="break-words text-sm text-amber-200">{error}</p>}
      {matches.map(row => <div key={row.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 p-3 text-sm text-white/80">
        <span className="min-w-0 break-words">{row.title} · {row.month?.slice(0, 7) ?? 'Month unbound'} · {row.status === 'archived' ? 'Archived history — retain' : 'Existing record'}</span>
        {row.status !== 'archived' && <ActionButton size="sm" type="button" variant="secondary" onClick={() => { onOpen(row.id); setOpen(false) }}>Open existing film</ActionButton>}
      </div>)}
      {success && <p role="status" className="text-sm text-emerald-200">Existing film saved and read back. No shoot, posting slot or public publication was created.</p>}
      {success && <ActionButton type="button" variant="secondary" onClick={() => { setForm({ ...EMPTY }); setConfirmed(false); setSuccess(false); setError(null); setMatches([]) }}>Register another film</ActionButton>}
    </form>}
  </section>
}
