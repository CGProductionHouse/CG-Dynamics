import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { isManagerRole } from '../../lib/roles'
import { getMyDayContext, type MyDayContext, type MyDayItem } from '../../lib/workforceMyDay'
import {
  addBusinessDevelopmentLeadResearch,
  BUSINESS_DEVELOPMENT_STAGES,
  createBusinessDevelopmentLead,
  listBusinessDevelopmentLeadResearch,
  listMyBusinessDevelopmentLeads,
  updateBusinessDevelopmentLead,
  type BusinessDevelopmentLead,
  type BusinessDevelopmentLeadResearch,
  type BusinessDevelopmentLeadStage,
  type LeadQualification,
} from '../../lib/businessDevelopmentLeads'
import {
  getMyStaffAssistantProfile,
  isSafeChatGptProjectUrl,
  linesToPreferenceList,
  listStaffAssistantSetupHealth,
  preferenceListToLines,
  saveMyStaffAssistantProfile,
  type StaffAssistantDraft,
  type StaffAssistantProfile,
  type StaffAssistantSetupHealth,
} from '../../lib/staffAssistant'
import { ActionButton } from '../../components/ui/Buttons'
import { EmptyState, LoadingState } from '../../components/ui/States'

type Tab = 'today' | 'leads' | 'setup'

const emptyDraft: StaffAssistantDraft = {
  responsibilities: [], recurringDuties: [], workingPreferences: [], outputPreferences: [],
  leadResearchCriteria: [], repeatedCorrections: [], commonTaskTypes: [], projectName: '', projectUrl: '',
}

function formatWhen(value: string | null) {
  if (!value) return 'Not set'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not set' : date.toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })
}

function ItemList({ title, items }: { title: string; items: MyDayItem[] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <h2 className="text-sm font-black text-white">{title}</h2>
      {items.length === 0 ? <p className="mt-3 text-sm text-white/45">Nothing here right now.</p> : (
        <ul className="mt-3 space-y-2">
          {items.slice(0, 8).map(item => (
            <li key={`${item.source}-${item.id}`}>
              <Link to={item.href} className="block rounded-xl border border-white/10 bg-black/20 p-3 hover:border-brand-teal/35">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="font-bold text-white">{item.title}</p><p className="mt-1 text-xs text-white/45">{item.clientName ?? 'Internal'} · {item.statusLabel}</p></div>
                  <span className="shrink-0 text-xs font-bold text-brand-teal">{item.timeLabel ?? item.date ?? 'Open'}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function TodayPanel({ context }: { context: MyDayContext | null }) {
  if (!context) return <EmptyState title="No day context" message="Your live Work, Calendar and Client Schedule context could not be loaded." />
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-brand-teal/25 bg-brand-teal/[0.05] p-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-teal">{context.todayLabel}</p>
        <h2 className="mt-2 text-xl font-black text-white">{context.summary.suggestedNextAction}</h2>
        <p className="mt-2 text-sm text-white/55">{context.overdue.length} overdue · {context.dueToday.length} due today · {context.upcoming.length} upcoming</p>
        {context.summary.workloadWarning && <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">{context.summary.workloadWarning}</p>}
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        <ItemList title="Overdue" items={context.overdue} />
        <ItemList title="Today" items={context.dueToday} />
        <ItemList title="Next up" items={context.upcoming} />
      </div>
      {context.diagnostics.errors.length > 0 && <p role="alert" className="text-sm text-amber-200">Some live sources could not be loaded. Missing information is not treated as zero.</p>}
    </div>
  )
}

function LeadCard({ lead, onChanged }: { lead: BusinessDevelopmentLead; onChanged: () => Promise<void> }) {
  const [stage, setStage] = useState<BusinessDevelopmentLeadStage>(lead.stage)
  const [qualification, setQualification] = useState<LeadQualification>(lead.qualification)
  const [qualificationSummary, setQualificationSummary] = useState(lead.qualification_summary ?? '')
  const [lastAction, setLastAction] = useState(lead.last_action ?? '')
  const [nextAction, setNextAction] = useState(lead.next_action ?? '')
  const [followUp, setFollowUp] = useState(lead.follow_up_at ? lead.follow_up_at.slice(0, 16) : '')
  const [note, setNote] = useState('')
  const [research, setResearch] = useState<BusinessDevelopmentLeadResearch[]>([])
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next) {
      const result = await listBusinessDevelopmentLeadResearch(lead.id)
      if (result.error) setError(result.error.message)
      else setResearch(result.data)
    }
  }

  async function save() {
    setSaving(true); setError(null)
    const result = await updateBusinessDevelopmentLead(lead.id, {
      stage, qualification, qualification_summary: qualificationSummary,
      last_action: lastAction, last_action_at: lastAction.trim() ? new Date().toISOString() : null,
      next_action: nextAction, follow_up_at: followUp ? new Date(followUp).toISOString() : null,
    })
    if (result.error) setError(result.error.message)
    else await onChanged()
    setSaving(false)
  }

  async function addNote() {
    if (!note.trim()) return
    setSaving(true); setError(null)
    const result = await addBusinessDevelopmentLeadResearch({ leadId: lead.id, entryType: 'observation', summary: note })
    if (result.error) setError(result.error.message)
    else {
      setNote('')
      const refreshed = await listBusinessDevelopmentLeadResearch(lead.id)
      setResearch(refreshed.data)
    }
    setSaving(false)
  }

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <button type="button" onClick={() => void toggle()} className="flex min-h-11 w-full items-center justify-between gap-3 text-left">
        <div><h3 className="font-black text-white">{lead.company_name}</h3><p className="mt-1 text-xs text-white/45">{BUSINESS_DEVELOPMENT_STAGES.find(item => item.value === lead.stage)?.label} · updated {formatWhen(lead.updated_at)}</p></div>
        <span className="text-sm font-bold text-brand-teal">{open ? 'Close' : 'Open'}</span>
      </button>
      {open && <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Stage"><select value={stage} onChange={event => setStage(event.target.value as BusinessDevelopmentLeadStage)} className="input"><option value="">Choose</option>{BUSINESS_DEVELOPMENT_STAGES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
          <Field label="Qualification"><select value={qualification} onChange={event => setQualification(event.target.value as LeadQualification)} className="input"><option value="unreviewed">Unreviewed</option><option value="researching">Researching</option><option value="qualified">Qualified</option><option value="not_qualified">Not qualified</option><option value="conflicting">Conflicting</option></select></Field>
          <Field label="Last action"><input value={lastAction} onChange={event => setLastAction(event.target.value)} className="input" /></Field>
          <Field label="Next action"><input value={nextAction} onChange={event => setNextAction(event.target.value)} className="input" /></Field>
          <Field label="Follow-up"><input type="datetime-local" value={followUp} onChange={event => setFollowUp(event.target.value)} className="input" /></Field>
          <Field label="Qualification reason"><input value={qualificationSummary} onChange={event => setQualificationSummary(event.target.value)} className="input" /></Field>
        </div>
        <ActionButton onClick={() => void save()} loading={saving}>Save lead</ActionButton>
        <div><label className="text-xs font-bold text-white/60" htmlFor={`note-${lead.id}`}>Research note</label><textarea id={`note-${lead.id}`} value={note} onChange={event => setNote(event.target.value)} className="input mt-2 min-h-24" /><ActionButton className="mt-2" variant="secondary" onClick={() => void addNote()} loading={saving}>Add note</ActionButton></div>
        {research.length > 0 && <ul className="space-y-2">{research.map(item => <li key={item.id} className="rounded-lg bg-black/20 p-3 text-sm text-white/65"><p>{item.summary}</p><p className="mt-1 text-[11px] text-white/35">{item.entry_type} · {formatWhen(item.created_at)}</p></li>)}</ul>}
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      </div>}
    </article>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-bold text-white/60">{label}{children}</label>
}

function LeadsPanel({ profileId }: { profileId: string }) {
  const [leads, setLeads] = useState<BusinessDevelopmentLead[]>([])
  const [company, setCompany] = useState('')
  const [source, setSource] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submissionKey, setSubmissionKey] = useState(() => crypto.randomUUID())

  const load = useCallback(async () => {
    const result = await listMyBusinessDevelopmentLeads(profileId)
    setLoading(false)
    if (result.error) setError(result.error.message)
    else { setLeads(result.data); setError(null) }
  }, [profileId])
  useEffect(() => {
    void listMyBusinessDevelopmentLeads(profileId).then(result => {
      setLoading(false)
      if (result.error) setError(result.error.message)
      else { setLeads(result.data); setError(null) }
    })
  }, [profileId])

  async function createLead() {
    if (!company.trim()) return
    setSaving(true); setError(null)
    const result = await createBusinessDevelopmentLead({ company_name: company, source_url: source, idempotency_key: submissionKey })
    if (result.error) setError(result.error.message)
    else { setCompany(''); setSource(''); setSubmissionKey(crypto.randomUUID()); await load() }
    setSaving(false)
  }

  if (loading) return <LoadingState message="Loading your leads…" />
  return <div className="space-y-4">
    <section className="rounded-2xl border border-brand-teal/20 bg-brand-teal/[0.04] p-4">
      <h2 className="font-black text-white">Add a lead</h2><p className="mt-1 text-xs text-white/45">Start with an exact company/person identity and source. Research and next steps stay in Dynamics.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><input value={company} onChange={event => setCompany(event.target.value)} placeholder="Company or person" className="input" /><input value={source} onChange={event => setSource(event.target.value)} placeholder="Source URL (optional)" className="input" /><ActionButton onClick={() => void createLead()} loading={saving}>Add lead</ActionButton></div>
    </section>
    {leads.length === 0 ? <EmptyState title="No leads yet" message="Add the first lead here so useful research never lives only in a chat." /> : <div className="space-y-3">{leads.map(lead => <LeadCard key={lead.id} lead={lead} onChanged={load} />)}</div>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  </div>
}

function toDraft(profile: StaffAssistantProfile | null): StaffAssistantDraft {
  if (!profile) return emptyDraft
  return {
    responsibilities: profile.responsibilities, recurringDuties: profile.recurring_duties,
    workingPreferences: profile.working_preferences, outputPreferences: profile.output_preferences,
    leadResearchCriteria: profile.lead_research_criteria, repeatedCorrections: profile.repeated_corrections,
    commonTaskTypes: profile.common_task_types, projectName: profile.chatgpt_project_name ?? '', projectUrl: profile.chatgpt_project_url ?? '',
  }
}

function SetupPanel({ onLoaded }: { onLoaded: (profile: StaffAssistantProfile | null) => void }) {
  const { profile } = useAuth()
  const [assistant, setAssistant] = useState<StaffAssistantProfile | null>(null)
  const [draft, setDraft] = useState<StaffAssistantDraft>(emptyDraft)
  const [health, setHealth] = useState<StaffAssistantSetupHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([getMyStaffAssistantProfile(), isManagerRole(profile?.role) ? listStaffAssistantSetupHealth() : Promise.resolve({ data: [], error: null })]).then(([mine, team]) => {
      setLoading(false)
      if (mine.error) { setMessage(mine.error.message); return }
      setAssistant(mine.data); setDraft(toDraft(mine.data)); onLoaded(mine.data)
      if (!team.error) setHealth(team.data)
    })
  }, [onLoaded, profile?.role])

  function setLines(key: keyof StaffAssistantDraft, value: string) {
    setDraft(current => ({ ...current, [key]: linesToPreferenceList(value) }))
  }
  async function save(confirm = false) {
    if (!profile) return
    if (draft.projectUrl && !isSafeChatGptProjectUrl(draft.projectUrl)) { setMessage('Use a full https://chatgpt.com Project URL.'); return }
    setSaving(true); setMessage(null)
    const result = await saveMyStaffAssistantProfile(profile, draft, confirm)
    if (result.error) setMessage(result.error.message)
    else { setAssistant(result.data); onLoaded(result.data); setMessage(confirm ? 'Instructions marked as applied.' : 'Assistant profile saved. Copy the refreshed Instructions when ready.') }
    setSaving(false)
  }
  async function copyInstructions() {
    if (!assistant?.project_instructions) return
    await navigator.clipboard.writeText(assistant.project_instructions)
    setMessage('Project Instructions copied.')
  }

  if (loading) return <LoadingState message="Loading Assistant setup…" />
  return <div className="space-y-5">
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="ChatGPT Project name"><input className="input" value={draft.projectName} onChange={event => setDraft(current => ({ ...current, projectName: event.target.value }))} /></Field>
        <Field label="ChatGPT Project URL"><input className="input" value={draft.projectUrl} onChange={event => setDraft(current => ({ ...current, projectUrl: event.target.value }))} /></Field>
        {(['responsibilities','recurringDuties','workingPreferences','outputPreferences','leadResearchCriteria','repeatedCorrections','commonTaskTypes'] as const).map(key => <Field key={key} label={key.replace(/([A-Z])/g, ' $1')}><textarea className="input min-h-24" value={preferenceListToLines(draft[key])} onChange={event => setLines(key, event.target.value)} placeholder="One durable item per line" /></Field>)}
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><ActionButton onClick={() => void save()} loading={saving}>Save and refresh Instructions</ActionButton><ActionButton variant="secondary" onClick={() => void copyInstructions()} disabled={!assistant?.project_instructions}>Copy current Instructions</ActionButton><ActionButton variant="secondary" onClick={() => void save(true)} disabled={!assistant?.project_instructions} loading={saving}>Confirm applied</ActionButton>{draft.projectUrl && isSafeChatGptProjectUrl(draft.projectUrl) && <a href={draft.projectUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-md border border-brand-teal/30 px-4 text-sm font-bold text-brand-teal">Open ChatGPT Project</a>}</div>
      <p className="mt-3 text-xs text-white/40">Version {assistant?.instructions_version ?? 0} · refreshed {formatWhen(assistant?.instructions_refreshed_at ?? null)} · applied {formatWhen(assistant?.instructions_applied_at ?? null)}</p>
      {message && <p role="status" className="mt-3 text-sm text-brand-teal">{message}</p>}
    </section>
    {isManagerRole(profile?.role) && <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><h2 className="font-black text-white">Team Assistants</h2><p className="mt-1 text-xs text-white/45">Setup health only. Personal working context remains private.</p><ul className="mt-4 grid gap-2 sm:grid-cols-2">{health.map(item => <li key={item.profile_id} className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="font-bold text-white">{item.full_name ?? 'Unnamed staff profile'}</p><p className="mt-1 text-xs text-white/45">{item.role} · {item.setup_status.replace(/_/g, ' ')} · {item.instructions_status.replace(/_/g, ' ')}</p></li>)}</ul></section>}
  </div>
}

export default function MyAssistantPage() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('today')
  const [context, setContext] = useState<MyDayContext | null>(null)
  const [assistant, setAssistant] = useState<StaffAssistantProfile | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { void getMyDayContext(profile).then(value => { setContext(value); setLoading(false) }) }, [profile])
  if (!profile) return <EmptyState title="Staff profile required" message="Sign in with an active CG staff profile." />
  return <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-brand-teal">My Assistant</p><h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">{profile.full_name ?? 'My'} workspace</h1><p className="mt-2 max-w-2xl text-sm text-white/50">Live priorities, canonical leads and recoverable Project setup for your exact staff profile.</p></div>{assistant?.chatgpt_project_url && isSafeChatGptProjectUrl(assistant.chatgpt_project_url) && <a href={assistant.chatgpt_project_url} target="_blank" rel="noreferrer" className="rounded-md bg-brand-teal px-4 py-3 text-sm font-black text-slate-950">Open ChatGPT Project</a>}</div>
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.025] p-1" role="tablist">{(['today','leads','setup'] as const).map(item => <button key={item} role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`min-h-11 flex-1 rounded-lg px-4 text-sm font-black capitalize ${tab === item ? 'bg-brand-teal/15 text-brand-teal' : 'text-white/55 hover:text-white'}`}>{item}</button>)}</div>
    {loading && tab === 'today' ? <LoadingState message="Checking your live day…" /> : tab === 'today' ? <TodayPanel context={context} /> : tab === 'leads' ? <LeadsPanel profileId={profile.id} /> : <SetupPanel onLoaded={setAssistant} />}
  </main>
}
