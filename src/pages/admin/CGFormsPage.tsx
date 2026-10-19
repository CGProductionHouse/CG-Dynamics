import { useEffect, useState } from 'react'
import { listClients, type Client } from '../../lib/db/clients'
import { supabase } from '../../lib/supabase'

type Submission = {
  receipt_id: string
  purpose: 'application' | 'booking_request'
  accepted_at: string
  website_editor_website_id: string
  contact: Record<string, unknown>
  fields: { key: string; label: string; value: unknown }[]
  delivery_states: { state: string; updated_at: string }[]
}
type Subscriber = {
  endpoint_id: string
  website_editor_website_id: string
  normalized_email: string
  status: 'subscribed' | 'unsubscribed'
  consent_at: string
  consent_receipt_id: string
}

function show(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value === null || value === undefined) return ''
  return JSON.stringify(value)
}

function when(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

/** Private owner/admin view. Server RPCs enforce this role and exact client scope. */
export default function CGFormsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [tab, setTab] = useState<'submissions' | 'subscribers'>('submissions')
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    void listClients('active').then(({ data, error: loadError }) => {
      if (!active) return
      if (loadError) setError('Clients could not be loaded.')
      else setClients(data)
    }).catch(() => { if (active) setError('Clients could not be loaded.') })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!clientId) return
    let active = true
    void Promise.all([
      supabase.rpc('cg_form_submissions', { p_client_id: clientId, p_limit: 50 }),
      supabase.rpc('cg_form_subscribers', { p_client_id: clientId, p_limit: 100 }),
    ]).then(([inbox, list]) => {
      if (!active) return
      if (inbox.error || list.error) setError('CG Forms could not be loaded. Check the admin access and migration state.')
      else {
        setSubmissions((inbox.data ?? []) as Submission[])
        setSubscribers((list.data ?? []) as Subscriber[])
      }
    }).catch(() => { if (active) setError('CG Forms could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [clientId, refresh])

  async function unsubscribe(item: Subscriber) {
    if (!clientId || item.status !== 'subscribed') return
    if (!window.confirm(`Unsubscribe ${item.normalized_email} from this website list?`)) return
    const { data, error: updateError } = await supabase.rpc('cg_form_unsubscribe', {
      p_client_id: clientId, p_endpoint_id: item.endpoint_id, p_email: item.normalized_email,
    })
    if (updateError || data !== true) setError('The subscriber was not changed. Refresh and check the list.')
    else { setLoading(true); setRefresh(value => value + 1) }
  }

  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 text-white sm:px-6">
    <div>
      <h1 className="text-2xl font-black">CG Forms</h1>
      <p className="mt-2 max-w-2xl text-sm text-brand-primary/75">Applications, studio booking requests and consent backed subscribers for CG websites. Sales enquiries remain in the Lead Inbox.</p>
    </div>
    <label className="block max-w-sm text-sm font-semibold">Client
      <select className="mt-2 w-full rounded-lg border border-white/20 bg-[#14222a] px-3 py-3 text-white" value={clientId}
        onChange={event => { setClientId(event.target.value); setSubmissions([]); setSubscribers([]); setLoading(Boolean(event.target.value)); setError('') }}>
        <option value="">Select a client</option>
        {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
      </select>
    </label>
    {clientId && <>
      <div className="flex gap-2" role="tablist" aria-label="CG Forms records">
        {(['submissions', 'subscribers'] as const).map(value =>
          <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}
            className={`rounded-lg border px-4 py-2 text-sm font-bold capitalize ${tab === value ? 'border-teal-300 bg-teal-300/15 text-teal-100' : 'border-white/20 text-brand-primary/75'}`}>
            {value}
          </button>)}
      </div>
      {loading && <p role="status" className="text-sm text-brand-primary/75">Loading CG Forms…</p>}
      {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
      {!loading && !error && tab === 'submissions' && <section className="space-y-4" aria-label="Form submissions">
        {submissions.length === 0 && <p className="text-sm text-brand-primary/75">No applications or studio booking requests for this client.</p>}
        {submissions.map(item => <article key={item.receipt_id} className="rounded-xl border border-white/15 bg-white/[0.04] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-lg font-bold">{item.purpose === 'application' ? 'Job application' : 'Studio booking request'}</h2>
              <p className="mt-1 text-xs text-brand-primary/65">Received {when(item.accepted_at)} · Reference {item.receipt_id.slice(0, 8).toUpperCase()}</p></div>
            <span className="rounded-full border border-white/15 px-3 py-1 text-xs">{item.delivery_states.map(state => state.state).join(', ') || 'Stored'}</span>
          </div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            {item.fields.filter(field => show(field.value)).map(field => <div key={field.key} className="min-w-0">
              <dt className="text-xs font-semibold text-brand-primary/65">{field.label}</dt>
              <dd className="mt-1 break-words text-sm text-white">{show(field.value)}</dd>
            </div>)}
          </dl>
        </article>)}
      </section>}
      {!loading && !error && tab === 'subscribers' && <section className="space-y-3" aria-label="Subscribers">
        {subscribers.length === 0 && <p className="text-sm text-brand-primary/75">No subscribers for this client.</p>}
        {subscribers.map(item => <article key={`${item.endpoint_id}:${item.normalized_email}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/[0.04] p-5">
          <div className="min-w-0"><p className="break-all font-semibold">{item.normalized_email}</p>
            <p className="mt-1 text-xs text-brand-primary/65">{item.status} · Consent {when(item.consent_at)} · Reference {item.consent_receipt_id.slice(0, 8).toUpperCase()}</p></div>
          {item.status === 'subscribed' && <button type="button" onClick={() => void unsubscribe(item)}
            className="rounded-lg border border-white/25 px-4 py-2 text-sm font-bold hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-300">Unsubscribe</button>}
        </article>)}
      </section>}
    </>}
    {!clientId && !error && <p className="text-sm text-brand-primary/75">Select a client to view their CG Forms records.</p>}
  </main>
}
