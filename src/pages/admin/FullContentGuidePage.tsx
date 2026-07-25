import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingState } from '../../components/ui/States'
import { useAuth } from '../../contexts/AuthContext'
import { listActiveClients, type ClientOption } from '../../lib/commandCentre'
import {
  listContentGuidelineDocuments,
  type ContentGuidelineDocument,
} from '../../lib/contentWorkflow'
import { monthDisplayLabel } from '../../lib/reportPeriod'
import ContentGuidelineDocumentEditor from './ContentGuidelineDocumentEditor'

export default function FullContentGuidePage() {
  const { profile } = useAuth()
  const [clients, setClients] = useState<ClientOption[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [documents, setDocuments] = useState<ContentGuidelineDocument[]>([])
  const [selectedGuidelineId, setSelectedGuidelineId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void listActiveClients().then(result => {
      if (result.data) setClients(result.data)
    })
  }, [])

  async function loadDocuments() {
    if (!selectedClientId) {
      setDocuments([])
      setSelectedGuidelineId(null)
      return
    }
    setLoading(true)
    setError(null)
    const result = await listContentGuidelineDocuments({
      clientId: selectedClientId,
      month: `${selectedMonth}-01`,
    })
    setLoading(false)
    if (result.migrationNeeded) {
      setError('The Content Guideline document migration has not been applied yet.')
      setDocuments([])
      return
    }
    if (result.error) {
      setError(result.error)
      setDocuments([])
      return
    }
    setDocuments(result.data)
    setSelectedGuidelineId(current =>
      current && result.data.some(document => document.guideline.id === current)
        ? current
        : (result.data[0]?.guideline.id ?? null),
    )
  }

  const loadDocumentsEvent = useEffectEvent(loadDocuments)
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDocumentsEvent() }, 0)
    return () => window.clearTimeout(timer)
  }, [selectedClientId, selectedMonth])

  const selectedDocument = useMemo(
    () => documents.find(document => document.guideline.id === selectedGuidelineId) ?? null,
    [documents, selectedGuidelineId],
  )
  const client = clients.find(candidate => candidate.id === selectedClientId)

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 sm:px-6 sm:pt-8">
      <header className="overflow-hidden rounded-3xl border border-brand-teal/20 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.18),transparent_38%),linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015))] p-5 sm:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-teal">Content production</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">Content Guideline</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-brand-primary/70 sm:text-base">
          One document per Content Run, containing every video in filming order with its name and complete script.
        </p>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="text-xs text-white/45">
          Client
          <select value={selectedClientId ?? ''} onChange={event => setSelectedClientId(event.target.value || null)} className="mt-1 block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white">
            <option value="">Select a client</option>
            {clients.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-white/45">
          Month
          <input type="month" value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} className="mt-1 block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white" />
        </label>
      </section>

      {error && <p className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm text-red-100">{error}</p>}

      {!selectedClientId ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.025] p-8 text-center text-sm text-white/50">Select a client and month.</div>
      ) : loading ? (
        <LoadingState message="Loading Content Guidelines..." />
      ) : documents.length === 0 ? (
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-8 text-center">
          <p className="text-sm text-white/50">No Content Guideline exists for {client?.name ?? 'this client'} in {monthDisplayLabel(selectedMonth)}.</p>
          <p className="mt-3 text-xs text-white/35">Open the relevant Content Run and create its one guideline document there.</p>
          <Link to="/admin/content-workflow?tab=runs" className="mt-4 inline-flex rounded-lg border border-brand-teal/30 px-3 py-2 text-xs font-bold text-brand-teal hover:text-white">Open Content Runs</Link>
        </section>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-2">
            <p className="px-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/40">{client?.name} | {monthDisplayLabel(selectedMonth)}</p>
            {documents.map(document => (
              <button key={document.guideline.id} type="button" onClick={() => setSelectedGuidelineId(document.guideline.id)} className={`w-full rounded-xl border p-3 text-left ${selectedGuidelineId === document.guideline.id ? 'border-brand-teal/45 bg-brand-teal/[0.07]' : 'border-white/10 bg-white/[0.025]'}`}>
                <p className="text-sm font-black text-white">{document.run.name}</p>
                <p className="mt-1 text-xs text-white/45">{document.run.run_date ?? 'Filming date not set'} | {document.videos.length} video{document.videos.length === 1 ? '' : 's'}</p>
                <p className={`mt-2 text-[10px] font-black uppercase tracking-wider ${document.guideline.client_published_at ? 'text-emerald-200' : 'text-white/35'}`}>{document.guideline.client_published_at ? 'Published' : 'Draft'}</p>
              </button>
            ))}
          </aside>

          {selectedDocument && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Link to={selectedDocument.run.calendar_event_id ? `/admin/content-workflow?tab=runs&event=${selectedDocument.run.calendar_event_id}` : `/admin/content-workflow?tab=runs&run=${selectedDocument.run.id}`} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-white/60 hover:text-white">Open Content Run</Link>
              </div>
              <ContentGuidelineDocumentEditor
                guideline={selectedDocument.guideline}
                run={selectedDocument.run}
                videos={selectedDocument.videos}
                currentUserId={profile?.id}
                onChanged={loadDocuments}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
