import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ClientPortalErrorState, ClientPortalLoadingState } from '../../components/client/ClientPortalStates'
import { WebsiteLeadBreakdownCard } from '../../components/website/WebsiteLeadBreakdownCard'
import { WebsiteLeadMetricsCard } from '../../components/website/WebsiteLeadMetricsCard'
import { listWebsiteLeads, saveWebsiteLeadLifecycle, type LeadLoad } from '../../lib/db/websiteLeads'
import {
  LEAD_OUTCOMES,
  LEAD_OUTCOME_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  POOR_LEAD_REASONS,
  POOR_LEAD_REASON_LABELS,
  currentReportingMonth,
  leadContactActions,
  leadOutcome,
  lifecycleForOutcome,
  monthWindow,
  validateLeadLifecycle,
  type LeadLifecycleInput,
  type LeadOutcome,
  type LeadStatus,
  type PoorLeadReason,
  type WebsiteLead,
} from '../../lib/websiteLeads'

const dateTime = (value: string) => new Intl.DateTimeFormat('en-ZA', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Johannesburg',
}).format(new Date(value))

type Filter = 'all' | LeadStatus

/** Client Lead Inbox (#405 M2B). The server pins every read and write to the signed-in client. */
export default function ClientLeadsPage() {
  return <LeadInbox />
}

/**
 * The Lead Inbox. Client mode (no clientId): the server pins reads/writes to the signed-in
 * client. Staff preview mode: staff name the exact client and see the same inbox read-only, so
 * the client's lead experience can be reviewed without impersonation and nothing is changed.
 */
export function LeadInbox({ clientId = null, preview = null }: { clientId?: string | null; preview?: { clientName: string } | null }) {
  const readOnly = preview !== null
  const fetchLeads = useCallback(() => (clientId ? listWebsiteLeads(clientId) : listWebsiteLeads()), [clientId])
  const [load, setLoad] = useState<LeadLoad<WebsiteLead[]> | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const month = currentReportingMonth()
  const period = monthWindow(month)

  const refresh = useCallback(async () => {
    const value = await fetchLeads()
    setLoad(value)
    return value
  }, [fetchLeads])

  useEffect(() => {
    let active = true
    void fetchLeads().then((value) => { if (active) setLoad(value) })
    return () => { active = false }
  }, [fetchLeads])

  const leads = useMemo(() => load?.state === 'ready' ? load.data : [], [load])
  const visible = filter === 'all' ? leads : leads.filter((lead) => lead.status === filter)
  const selected = leads.find((lead) => lead.enquiryId === selectedId) ?? null

  if (!load) return <ClientPortalLoadingState />
  if (load.state === 'error') return <ClientPortalErrorState title="Your leads could not be loaded" message={load.message} />
  if (load.state === 'unavailable') {
    return <Intro preview={preview}>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">Website lead tracking has not been switched on for your account yet. Once your website form is connected, every enquiry will appear here.</p>
    </Intro>
  }

  return <div className="space-y-6">
    <Intro preview={preview}>
      {period && <WebsiteLeadMetricsCard clientId={clientId} from={period.from} to={period.to} title="This month" />}
      {period && <WebsiteLeadBreakdownCard clientId={clientId} from={period.from} to={period.to} />}
    </Intro>

    {leads.length === 0
      ? <section className="rounded-[2rem] border border-white/[0.08] bg-white/[0.035] px-6 py-10 text-sm text-slate-400">No website enquiries yet. New enquiries from your website form will appear here.</section>
      : <section className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-400">Show
              <select className="mt-1 block w-full rounded-xl border border-white/15 bg-[#0d1a1a] px-3 py-2 text-sm normal-case tracking-normal text-white" value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
                <option value="all">All leads ({leads.length})</option>
                {LEAD_STATUSES.map((status) => <option key={status} value={status}>{LEAD_STATUS_LABELS[status]} ({leads.filter((lead) => lead.status === status).length})</option>)}
              </select>
            </label>
            <ul className="space-y-2" aria-label="Website leads">
              {visible.map((lead) => <li key={lead.enquiryId}>
                <button type="button" onClick={() => setSelectedId(lead.enquiryId)} aria-current={lead.enquiryId === selectedId}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${lead.enquiryId === selectedId ? 'border-brand-accent/60 bg-brand-accent/10' : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'}`}>
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate font-bold text-white">{lead.contactName ?? lead.contactEmail ?? lead.contactPhone ?? 'Website enquiry'}</span>
                    <StatusBadge status={lead.status} />
                  </span>
                  <span className="mt-1 block text-xs text-slate-400">{dateTime(lead.acceptedAt)}{lead.quality ? ` · ${lead.quality === 'good' ? 'Good lead' : 'Poor lead'}` : ''}</span>
                </button>
              </li>)}
              {visible.length === 0 && <li className="text-sm text-slate-400">No leads with this status.</li>}
            </ul>
          </div>
          {selected
            ? <LeadDetail key={selected.enquiryId} lead={selected} onSaved={refresh} readOnly={readOnly} />
            : <p className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-sm text-slate-400">{readOnly ? 'Select a lead to see what the client sees.' : 'Select a lead to see the enquiry and update its progress.'}</p>}
        </section>}
  </div>
}

function Intro({ children, preview = null }: { children?: ReactNode; preview?: { clientName: string } | null }) {
  return <section className="rounded-[2rem] border border-white/[0.08] bg-white/[0.035] px-6 py-8 sm:px-9">
    {preview && <p role="note" className="mb-5 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-xs font-semibold text-amber-100">Staff preview of {preview.clientName}&apos;s Lead Inbox · read-only, nothing can be changed here.</p>}
    <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-accent">Website</p>
    <h1 className="mt-3 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">Leads</h1>
    {children}
  </section>
}

function StatusBadge({ status }: { status: LeadStatus }) {
  return <span className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider text-slate-300">{LEAD_STATUS_LABELS[status]}</span>
}

function LeadDetail({ lead, onSaved, readOnly = false }: { lead: WebsiteLead; onSaved: () => Promise<unknown>; readOnly?: boolean }) {
  const [outcome, setOutcome] = useState<LeadOutcome>(leadOutcome(lead.status, lead.quality) ?? 'new')
  const [poorReason, setPoorReason] = useState<PoorLeadReason | null>(lead.poorReason)
  const [poorNote, setPoorNote] = useState<string | null>(lead.poorNote)
  const draft: LeadLifecycleInput = lifecycleForOutcome(outcome, poorReason, poorNote)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const actions = leadContactActions(lead)
  const validation = validateLeadLifecycle(draft)

  const save = () => {
    setSaving(true)
    setMessage(null)
    void saveWebsiteLeadLifecycle(lead.enquiryId, draft)
      .then(async () => { await onSaved(); setMessage({ tone: 'ok', text: 'Lead updated.' }) })
      .catch((error: unknown) => setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'The lead could not be updated.' }))
      .finally(() => setSaving(false))
  }

  return <article className="rounded-[2rem] border border-white/[0.08] bg-white/[0.035] p-6" aria-label="Lead detail">
    <h2 className="text-2xl font-black text-white">{lead.contactName ?? 'Website enquiry'}</h2>
    <p className="mt-1 text-xs text-slate-400">Received {dateTime(lead.acceptedAt)} · Reference {lead.receiptId.slice(0, 8)}</p>

    {readOnly
      ? <div className="mt-4 flex flex-wrap gap-2" aria-label="Contact actions (preview)">
          {[actions.call && 'Call', actions.whatsapp && 'WhatsApp', actions.email && 'Email'].filter(Boolean).map((label) => <span key={String(label)} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-slate-400">{label}</span>)}
          {!actions.call && !actions.whatsapp && !actions.email && <p className="text-sm text-slate-400">No contact details were supplied.</p>}
        </div>
      : <div className="mt-4 flex flex-wrap gap-2">
      {actions.call && <a className="rounded-xl bg-brand-accent px-4 py-2 text-sm font-bold text-brand-bg" href={actions.call}>Call</a>}
      {actions.whatsapp && <a className="rounded-xl border border-white/20 px-4 py-2 text-sm font-bold text-white" href={actions.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
      {actions.email && <a className="rounded-xl border border-white/20 px-4 py-2 text-sm font-bold text-white" href={actions.email}>Email</a>}
      {!actions.call && !actions.whatsapp && !actions.email && <p className="text-sm text-slate-400">No contact details were supplied.</p>}
    </div>}

    <dl className="mt-5 space-y-3 text-sm">
      {lead.fields.map((field) => <div key={field.key}>
        <dt className="text-xs font-bold uppercase tracking-widest text-slate-400">{field.label}</dt>
        <dd className="mt-1 whitespace-pre-wrap break-words text-white">{typeof field.value === 'boolean' ? (field.value ? 'Yes' : 'No') : field.value}</dd>
      </div>)}
    </dl>

    {(lead.attribution.landing_path || lead.attribution.utm_source) && <p className="mt-4 text-xs text-slate-500">
      Came from {lead.attribution.utm_source ?? 'direct/unknown'}{lead.attribution.landing_path ? ` · page ${lead.attribution.landing_path}` : ''}
    </p>}

    {readOnly
      ? <p className="mt-6 border-t border-white/10 pt-5 text-sm text-slate-300">
          Lead progress: <span className="font-bold text-white">{LEAD_OUTCOME_LABELS[leadOutcome(lead.status, lead.quality) ?? 'new']}</span>
          {lead.poorReason && <> · {POOR_LEAD_REASON_LABELS[lead.poorReason]}</>}
        </p>
      : <fieldset className="mt-6 space-y-4 border-t border-white/10 pt-5" disabled={saving}>
      <legend className="sr-only">Lead progress</legend>
      <label className="block text-xs font-bold uppercase tracking-widest text-slate-400">Lead progress
        <select className="mt-1 block w-full rounded-xl border border-white/15 bg-[#0d1a1a] px-3 py-2 text-sm normal-case tracking-normal text-white" value={outcome}
          onChange={(event) => setOutcome(event.target.value as LeadOutcome)}>
          {LEAD_OUTCOMES.map((value) => <option key={value} value={value}>{LEAD_OUTCOME_LABELS[value]}</option>)}
        </select>
      </label>
      {draft.quality === 'poor' && <>
        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400">Why is this a poor lead? (required)
          <select className="mt-1 block w-full rounded-xl border border-white/15 bg-[#0d1a1a] px-3 py-2 text-sm normal-case tracking-normal text-white" value={poorReason ?? ''}
            onChange={(event) => setPoorReason((event.target.value || null) as PoorLeadReason | null)}>
            <option value="">Choose a reason</option>
            {POOR_LEAD_REASONS.map((reason) => <option key={reason} value={reason}>{POOR_LEAD_REASON_LABELS[reason]}</option>)}
          </select>
        </label>
        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400">Note{draft.poorReason === 'other' ? ' (required)' : ' (optional)'}
          <textarea maxLength={500} rows={2} className="mt-1 block w-full rounded-xl border border-white/15 bg-[#0d1a1a] px-3 py-2 text-sm normal-case tracking-normal text-white" value={poorNote ?? ''}
            onChange={(event) => setPoorNote(event.target.value)} />
        </label>
      </>}
      {validation && <p className="text-sm text-amber-200">{validation}</p>}
      {message && <p role="status" className={`text-sm ${message.tone === 'ok' ? 'text-emerald-300' : 'text-amber-200'}`}>{message.text}</p>}
      <button type="button" onClick={save} disabled={saving || Boolean(validation)} className="rounded-xl bg-brand-accent px-5 py-2 text-sm font-bold text-brand-bg disabled:opacity-50">
        {saving ? 'Saving…' : 'Save progress'}
      </button>
    </fieldset>}
  </article>
}
