import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ActionButton } from '../ui/Buttons'
import { confirmClientPackage } from '../../lib/db/clients'
import { PACKAGE_NUMBER_FIELDS, type PackageSettings, type PackageVerificationReceipt } from '../../lib/packageAuthority'
import type { ActiveClientPackageEvidence, PackageFieldEvidence } from '../../lib/packageEvidence'

const NUMBER_LABELS: Record<(typeof PACKAGE_NUMBER_FIELDS)[number], string> = {
  professional_videos_per_month: 'Professional videos / month',
  reels_per_month: 'Reels / month',
  photo_posts_per_month: 'Photo posts / month',
  design_posters_per_month: 'Design posters / month',
  animated_posters_per_month: 'Animated posters / month',
  monthly_campaign_budget: 'Monthly campaign budget (R)',
  shoot_days_per_month: 'Shoot days / month',
  website_updates_per_month: 'Website updates / month',
}

function proposedText(evidence: PackageFieldEvidence): string {
  return evidence.state === 'proposed' && evidence.proposedValue !== null ? String(evidence.proposedValue) : ''
}

function EvidenceHint({ evidence }: { evidence: PackageFieldEvidence }) {
  const tone = evidence.state === 'conflict' ? 'text-red-300' : evidence.state === 'proposed' ? 'text-brand-teal' : 'text-amber-200'
  return (
    <div className={`mt-1 text-[11px] leading-4 ${tone}`}>
      <span className="font-bold uppercase tracking-wide">{evidence.state}</span> · {evidence.evidenceClass.replaceAll('_', ' ')} · confidence {evidence.confidence} · {evidence.note}
      {evidence.sourceReferences.length > 0 && (
        <div className="mt-0.5 break-all text-white/35">{evidence.sourceReferences.join(' · ')}</div>
      )}
    </div>
  )
}

export function PackageEvidenceReviewModal({
  evidence,
  confirmedCount,
  totalCount,
  onConfirmed,
  onClose,
}: {
  evidence: ActiveClientPackageEvidence
  confirmedCount: number
  totalCount: number
  onConfirmed: (packageSettings: PackageSettings & { verification: PackageVerificationReceipt }) => void
  onClose: () => void
}) {
  const [numbers, setNumbers] = useState<Record<(typeof PACKAGE_NUMBER_FIELDS)[number], string>>(() => Object.fromEntries(
    PACKAGE_NUMBER_FIELDS.map(field => [field, proposedText(evidence.fields[field])]),
  ) as Record<(typeof PACKAGE_NUMBER_FIELDS)[number], string>)
  const [campaign, setCampaign] = useState(proposedText(evidence.fields.campaign_management_included))
  const [other, setOther] = useState(proposedText(evidence.fields.other_agreed_deliverables))
  const [notes, setNotes] = useState(proposedText(evidence.fields.package_notes))
  const [exclusions, setExclusions] = useState(proposedText(evidence.fields.package_exclusions))
  const [evidenceNote, setEvidenceNote] = useState(`Reviewed exact Dynamics package evidence for ${evidence.clientName}.`)
  const [inferenceNote, setInferenceNote] = useState(() => [
    evidence.conflicts.length ? `Conflicts: ${evidence.conflicts.join(' ')}` : '',
    evidence.unknownFields.length ? `Initially unknown: ${evidence.unknownFields.join(', ')}.` : '',
    'Recent production cadence was treated as supporting evidence only, not contractual scope.',
  ].filter(Boolean).join(' '))
  const [sourceReferences, setSourceReferences] = useState(evidence.directSources.join('\n'))
  const [explicitConfirmation, setExplicitConfirmation] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const invalidNumbers = useMemo(() => PACKAGE_NUMBER_FIELDS.filter(field => numbers[field] !== '' && !/^\d+$/.test(numbers[field])), [numbers])
  const sourceList = sourceReferences.split('\n').map(value => value.trim()).filter(Boolean)
  const canConfirm = explicitConfirmation
    && invalidNumbers.length === 0
    && evidenceNote.trim().length >= 12
    && sourceList.length > 0

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canConfirm || saving) return
    setSaving(true)
    setError(null)
    const settings = {
      ...Object.fromEntries(PACKAGE_NUMBER_FIELDS.map(field => [field, numbers[field] === '' ? null : Number(numbers[field])])),
      campaign_management_included: campaign === '' ? null : campaign === 'true',
      other_agreed_deliverables: other.trim() || null,
      package_notes: notes.trim() || null,
      package_exclusions: exclusions.trim() || null,
    } as PackageSettings
    const result = await confirmClientPackage({
      clientId: evidence.clientId,
      settings,
      evidenceNote: evidenceNote.trim(),
      inferenceNote: inferenceNote.trim(),
      sourceReferences: sourceList,
    })
    setSaving(false)
    if (result.error || !result.data) {
      setError('The package was not confirmed. Recheck the evidence and try again.')
      return
    }
    onConfirmed(result.data.package_settings)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={`Review ${evidence.clientName} package`}>
      <form onSubmit={submit} className="mx-auto my-2 w-full max-w-5xl rounded-xl border border-brand-muted bg-brand-surface shadow-2xl sm:my-6">
        <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-white/10 bg-brand-surface/95 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-teal">Package evidence review · {confirmedCount}/{totalCount} confirmed</p>
            <h2 className="mt-1 text-xl font-bold text-white">{evidence.clientName}</h2>
          </div>
          <ActionButton type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>Close</ActionButton>
        </div>

        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {PACKAGE_NUMBER_FIELDS.map(field => (
                <label key={field} className="block rounded-lg border border-white/10 bg-brand-bg/45 p-3 text-xs font-medium text-brand-primary">
                  {NUMBER_LABELS[field]}
                  <input
                    type="number" min={0} step={1} inputMode="numeric" value={numbers[field]}
                    onChange={event => setNumbers(current => ({ ...current, [field]: event.target.value }))}
                    placeholder="Unknown"
                    className="mt-1 w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white placeholder:text-amber-200/60"
                  />
                  <EvidenceHint evidence={evidence.fields[field]} />
                </label>
              ))}
            </div>

            <label className="block rounded-lg border border-white/10 bg-brand-bg/45 p-3 text-xs font-medium text-brand-primary">
              Campaign management included
              <select value={campaign} onChange={event => setCampaign(event.target.value)} className="mt-1 w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white">
                <option value="">Unknown</option><option value="true">Yes</option><option value="false">No</option>
              </select>
              <EvidenceHint evidence={evidence.fields.campaign_management_included} />
            </label>

            {([
              ['other_agreed_deliverables', 'Other agreed deliverables', other, setOther],
              ['package_notes', 'Package notes', notes, setNotes],
              ['package_exclusions', 'Package exclusions', exclusions, setExclusions],
            ] as const).map(([field, label, value, setter]) => (
              <label key={field} className="block rounded-lg border border-white/10 bg-brand-bg/45 p-3 text-xs font-medium text-brand-primary">
                {label}
                <textarea value={value} onChange={event => setter(event.target.value)} rows={2} placeholder="Unknown / not yet evidenced" className="mt-1 w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white" />
                <EvidenceHint evidence={evidence.fields[field]} />
              </label>
            ))}
          </div>

          <aside className="space-y-4">
            <section className="rounded-lg border border-brand-teal/20 bg-brand-teal/[0.06] p-3">
              <h3 className="text-xs font-black uppercase tracking-wide text-brand-teal">Exact direct evidence</h3>
              {evidence.directSources.length ? <ul className="mt-2 space-y-1 text-xs text-white/70">{evidence.directSources.map(source => <li key={source} className="break-all">• {source}</li>)}</ul> : <p className="mt-2 text-xs text-amber-200">None found. Add a real source before confirmation.</p>}
            </section>
            <section className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <h3 className="text-xs font-black uppercase tracking-wide text-white/60">Supporting evidence only</h3>
              <p className="mt-1 text-[11px] text-white/40">Schedule history, Microsoft mirrors, guides and context can help CA review but never establish contractual scope by themselves.</p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-[11px] text-white/55">{evidence.supportingSources.slice(0, 80).map(source => <li key={source} className="break-all">• {source}</li>)}</ul>
            </section>
            {evidence.cadence.length > 0 && <section className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <h3 className="text-xs font-black uppercase tracking-wide text-white/60">Recent observed cadence</h3>
              <div className="mt-2 space-y-2">{evidence.cadence.map(month => <div key={month.month} className="text-[11px] text-white/55"><strong className="text-white/75">{month.month}</strong> · {Object.entries(month.counts).map(([key, value]) => `${key.replace('_per_month', '').replaceAll('_', ' ')} ${value}`).join(' · ') || 'no core count'} · Microsoft-mirrored {month.microsoftMirrored}</div>)}</div>
            </section>}
            <label className="block text-xs font-medium text-brand-primary">Evidence reviewed
              <textarea value={evidenceNote} onChange={event => setEvidenceNote(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white" />
            </label>
            <label className="block text-xs font-medium text-brand-primary">Conflict / uncertainty note
              <textarea value={inferenceNote} onChange={event => setInferenceNote(event.target.value)} rows={5} className="mt-1 w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white" />
            </label>
            <label className="block text-xs font-medium text-brand-primary">Exact source references (one per line)
              <textarea value={sourceReferences} onChange={event => setSourceReferences(event.target.value)} rows={6} className="mt-1 w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 font-mono text-xs text-white" />
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-3 text-sm text-white">
              <input type="checkbox" checked={explicitConfirmation} onChange={event => setExplicitConfirmation(event.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-accent" />
              I have verified every field for this exact client. Blank evidence and posting history were not treated as contractual zero or scope.
            </label>
            {invalidNumbers.length > 0 && <p className="text-xs text-red-300">Correct {invalidNumbers.length} invalid numeric field{invalidNumbers.length === 1 ? '' : 's'} before confirming.</p>}
            <p className="text-xs text-amber-200">Blank fields will be confirmed as unknown, never as zero or No.</p>
            {error && <p className="rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
            <ActionButton variant="primary" type="submit" fullWidth disabled={!canConfirm || saving} loading={saving}>Confirm exact package and open next</ActionButton>
          </aside>
        </div>
      </form>
    </div>
  )
}
