import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { isAdminRole, isManagerRole } from '../../lib/roles'
import { PageContainer, PageHeader } from '../../components/layout/PageShell'
import { EmptyState, LoadingState } from '../../components/ui/States'
import { ActionButton } from '../../components/ui/Buttons'
import { Pill } from '../../components/ui/Badges'
import { Drawer, DrawerOverlay, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerCloseButton, DrawerBody } from '../../components/ui/Drawer'

// ── Email Marketing workspace (Phase 1: shell + draft workflow) ─────────────────
//
// Minimal first checkpoint for #374. Establishes the Marketing → Email route
// using existing shell/Marketing patterns. Reuses canonical contacts (no
// duplicate CRM). Draft-only composer with preview; no provider/send
// implementation. Build/test only — no production SQL/data.

const INPUT_CLS = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-teal/50'

type CampaignStatus = 'draft' | 'needs_review' | 'approved' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'failed'
type Section = 'campaigns' | 'audiences' | 'templates'

const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Draft',
  needs_review: 'Needs review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  paused: 'Paused',
  failed: 'Failed',
}

function statusTone(status: CampaignStatus): 'teal' | 'amber' | 'neutral' {
  if (status === 'sent' || status === 'approved') return 'teal'
  if (status === 'scheduled' || status === 'needs_review') return 'amber'
  return 'neutral'
}

interface Campaign {
  id: string
  name: string
  client_id: string | null
  audience_id: string | null
  template_id: string | null
  status: CampaignStatus
  subject: string
  preheader: string
  send_at: string | null
  created_at: string
  updated_at: string
}

interface Audience {
  id: string
  name: string
  description: string | null
  source_type: 'contacts' | 'leads' | 'clients' | 'website' | 'saved_segment'
  filters: Record<string, unknown>
  exclusion_filters: Record<string, unknown>
  estimated_count: number
  created_at: string
  updated_at: string
}

interface Template {
  id: string
  name: string
  description: string | null
  type: 'newsletter' | 'promotion' | 'announcement' | 'client_update'
  preview_image: string | null
  content_blocks: unknown[]
  created_at: string
  updated_at: string
}

interface CampaignDraft {
  id: string
  name: string
  client_id: string | null
  subject: string
  preheader: string
  body: string
  template_id: string | null
  send_at: string | null
  isMobilePreview: boolean
}

function CampaignRow({ campaign, clientName }: { campaign: Campaign; clientName: string }) {
  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">{campaign.name}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-white/60">{campaign.subject}</p>
        </div>
        <Pill tone={statusTone(campaign.status)}>{CAMPAIGN_STATUS_LABELS[campaign.status]}</Pill>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-white/50">
        {clientName && <span>{clientName}</span>}
        <span>Send: {campaign.send_at ? new Date(campaign.send_at).toLocaleDateString('en-ZA') : '—'}</span>
        <span>Updated: {new Date(campaign.updated_at).toLocaleDateString('en-ZA')}</span>
      </div>
    </li>
  )
}

function AudienceRow({ audience }: { audience: Audience }) {
  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">{audience.name}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-white/60">{audience.description ?? 'No description'}</p>
        </div>
        <Pill>{audience.source_type.replace('_', ' ')}</Pill>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-white/50">
        <span>~{audience.estimated_count} recipients</span>
        <span>Updated: {new Date(audience.updated_at).toLocaleDateString('en-ZA')}</span>
      </div>
    </li>
  )
}

function TemplateRow({ template }: { template: Template }) {
  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">{template.name}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-white/60">{template.description ?? 'No description'}</p>
        </div>
        <Pill>{template.type}</Pill>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-white/50">
        <span>Updated: {new Date(template.updated_at).toLocaleDateString('en-ZA')}</span>
      </div>
    </li>
  )
}

function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [migrationNeeded, setMigrationNeeded] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      // TODO: Replace with actual Supabase query when tables exist
      // For Phase 1, return empty array — no production data/migration
      setCampaigns([])
      setMigrationNeeded(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load campaigns')
      setMigrationNeeded(true)
    }
    setLoading(false)
  }

  const loadEvent = useEffectEvent(load)
  useEffect(() => {
    const t = window.setTimeout(() => void loadEvent(), 0)
    return () => window.clearTimeout(t)
  }, [])

  return { campaigns, loading, error, migrationNeeded, reload: load }
}

function useAudiences() {
  const [audiences, setAudiences] = useState<Audience[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [migrationNeeded, setMigrationNeeded] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      // TODO: Replace with actual Supabase query when tables exist
      setAudiences([])
      setMigrationNeeded(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load audiences')
      setMigrationNeeded(true)
    }
    setLoading(false)
  }

  const loadEvent = useEffectEvent(load)
  useEffect(() => {
    const t = window.setTimeout(() => void loadEvent(), 0)
    return () => window.clearTimeout(t)
  }, [])

  return { audiences, loading, error, migrationNeeded, reload: load }
}

function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [migrationNeeded, setMigrationNeeded] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      // TODO: Replace with actual Supabase query when tables exist
      setTemplates([])
      setMigrationNeeded(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load templates')
      setMigrationNeeded(true)
    }
    setLoading(false)
  }

  const loadEvent = useEffectEvent(load)
  useEffect(() => {
    const t = window.setTimeout(() => void loadEvent(), 0)
    return () => window.clearTimeout(t)
  }, [])

  return { templates, loading, error, migrationNeeded, reload: load }
}

function CampaignComposer({ onClose }: { onClose: () => void }) {
  const [isOpen, setIsOpen] = useState(true)
  const [draft, setDraft] = useState<CampaignDraft>({
    id: 'tmp',
    name: '',
    client_id: null,
    subject: '',
    preheader: '',
    body: '',
    template_id: null,
    send_at: null,
    isMobilePreview: false,
  })

  const handleSave = () => {
    onClose(draft)
    setIsOpen(false)
  }

  if (isOpen === false) return null

  return (
    <Drawer open={isOpen} onOpenChange={() => setIsOpen(false)}>
      <DrawerOverlay className="bg-black/40" />
      <DrawerContent className="w-full max-w-2xl bg-white/[5] backdrop-blur-sm">
        <DrawerHeader>
          <DrawerTitle>Create New Campaign</DrawerTitle>
          <DrawerDescription>Fill in the campaign details below</DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-white/60 mb-1 block">Campaign Name</label>
              <input
                className={`${INPUT_CLS}`}
                value={draft.name}
                onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Welcome Series"
              />
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1 block">Client</label>
              <select
                className={`${INPUT_CLS}`}
                value={draft.client_id || ''}
                onChange={e => setDraft(prev => ({ ...prev, client_id: e.target.value || null }))}
              >
                <option value="">-- Select Client --</option>
                <option value="client_1">Acme Corp</option>
                <option value="client_2">Human Auto</option>
                <option value="client_3">HMH Attorneys</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Subject</label>
            <input
              className={`${INPUT_CLS}`}
              value={draft.subject}
              onChange={e => setDraft(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="e.g. Welcome to our newsletter"
            />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Preheader</label>
            <input
              className={`${INPUT_CLS}`}
              value={draft.preheader}
              onChange={e => setDraft(prev => ({ ...prev, preheader: e.target.value }))}
              placeholder="Preview text (optional)"
            />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Email Body</label>
            <textarea
              className={`${INPUT_CLS} h-24 resize-none`}
              value={draft.body}
              onChange={e => setDraft(prev => ({ ...prev, body: e.target.value }))}
              placeholder="Write your email content here..."
            ></textarea>
          </div>
          <div className="flex items-center justify-between">
            <DrawerDescription>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="preview-mode"
                  value="desktop"
                  checked={!draft.isMobilePreview}
                  onChange={e => setDraft(prev => ({ ...prev, isMobilePreview: e.target.value === 'mobile' }))}
                  className="rounded border-white/10 hover:border-brand-teal/50"
                />
                <span className="text-sm text-white/60">Desktop</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="radio"
                  name="preview-mode"
                  value="mobile"
                  checked={draft.isMobilePreview}
                  onChange={e => setDraft(prev => ({ ...prev, isMobilePreview: e.target.value === 'mobile' }))}
                  className="rounded border-white/10 hover:border-brand-teal/50"
                />
                <span className="text-sm text-white/60">Mobile</span>
              </div>
            </DrawerDescription>
          </div>
        </DrawerBody>
        <DrawerFooter className="pt-3 border-t border-white/10">
          <button
            onClick={handleSave}
            className="rounded-full border px-4 py-2 text-sm font-black transition-colors border-brand-teal/50 bg-brand-teal/10 text-brand-teal hover:text-white"
          >
            Create Campaign
          </button>
          <DrawerCloseButton />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function CampaignsSection({ isAdmin: _isAdmin, isManager: _isManager, setSearchParams }: { isAdmin: boolean; isManager: boolean; setSearchParams: ReturnType<typeof useSearchParams>[1] }) {
  const { campaigns, loading, error, migrationNeeded, reload } = useCampaigns()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all')

  const filtered = useMemo(() => {
    return campaigns.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.subject.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [campaigns, search, statusFilter])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-xs text-white/50">{campaigns.length} campaign{campaigns.length === 1 ? '' : 's'}</p>
        <div className="flex items-center gap-2">
          <ActionButton size="sm" variant="secondary" onClick={() => void reload()} loading={loading}>Refresh</ActionButton>
          <ActionButton size="sm" onClick={() => setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('section', 'campaigns'); next.set('mode', 'create'); return next })}>New campaign</ActionButton>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${INPUT_CLS} min-w-[12rem] flex-1`} placeholder="Search campaigns" value={search} onChange={e => setSearch(e.target.value)} />
        <select className={`${INPUT_CLS} w-auto`} value={statusFilter} onChange={e => setStatusFilter(e.target.value as CampaignStatus | 'all')}>
          <option value="all">All statuses</option>
          {(Object.keys(CAMPAIGN_STATUS_LABELS) as CampaignStatus[]).map(s => <option key={s} value={s}>{CAMPAIGN_STATUS_LABELS[s]}</option>)}
        </select>
      </div>
      {migrationNeeded ? (
        <p className="rounded-lg border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-sm text-amber-100">Email Marketing tables are not in this database yet. Phase 1 is shell-only — no production migration.</p>
      ) : loading ? (
        <LoadingState message="Loading campaigns…" />
      ) : error ? (
        <EmptyState title="Could not load campaigns" message={error} action={<ActionButton variant="secondary" onClick={() => void reload()}>Try again</ActionButton>} />
      ) : campaigns.length === 0 ? (
        <EmptyState title="No campaigns yet" message="Create your first draft campaign to get started." />
      ) : filtered.length === 0 ? (
        <EmptyState title="No campaigns match" message="Adjust the search or status filter." />
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">{filtered.map(campaign => (
          <li key={campaign.id}>
            <Link to={`/admin/marketing/email/campaigns/${campaign.id}`}>
              <CampaignRow campaign={campaign} clientName="Demo Client" />
            </Link>
          </li>
        ))}</ul>
      )}
    </div>
  )
}

function AudiencesSection({ isAdmin: _isAdmin, setSearchParams }: { isAdmin: boolean; setSearchParams: ReturnType<typeof useSearchParams>[1] }) {
  const { audiences, loading, error, migrationNeeded, reload } = useAudiences()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => audiences.filter(a => a.name.toLowerCase().includes(search.toLowerCase())), [audiences, search])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-xs text-white/50">{audiences.length} audience{audiences.length === 1 ? '' : 's'}</p>
        <div className="flex items-center gap-2">
          <ActionButton size="sm" variant="secondary" onClick={() => void reload()} loading={loading}>Refresh</ActionButton>
          <ActionButton size="sm" onClick={() => setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('section', 'audiences'); next.set('mode', 'create'); return next })}>New audience</ActionButton>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${INPUT_CLS} min-w-[12rem] flex-1`} placeholder="Search audiences" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {migrationNeeded ? (
        <p className="rounded-lg border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-sm text-amber-100">Email Marketing tables are not in this database yet. Phase 1 is shell-only — no production migration.</p>
      ) : loading ? (
        <LoadingState message="Loading audiences…" />
      ) : error ? (
        <EmptyState title="Could not load audiences" message={error} action={<ActionButton variant="secondary" onClick={() => void reload()}>Try again</ActionButton>} />
      ) : audiences.length === 0 ? (
        <EmptyState title="No audiences yet" message="Create a saved segment from canonical contacts, leads, clients or website sources." />
      ) : filtered.length === 0 ? (
        <EmptyState title="No audiences match" message="Adjust the search." />
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">{filtered.map(audience => (
          <li key={audience.id}>
            <Link to={`/admin/marketing/email/audiences/${audience.id}`}>
              <AudienceRow audience={audience} />
            </Link>
          </li>
        ))}</ul>
      )}
    </div>
  )
}

function TemplatesSection({ isAdmin: _isAdmin, setSearchParams }: { isAdmin: boolean; setSearchParams: ReturnType<typeof useSearchParams>[1] }) {
  const { templates, loading, error, migrationNeeded, reload } = useTemplates()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase())), [templates, search])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-xs text-white/50">{templates.length} template{templates.length === 1 ? '' : 's'}</p>
        <div className="flex items-center gap-2">
          <ActionButton size="sm" variant="secondary" onClick={() => void reload()} loading={loading}>Refresh</ActionButton>
          <ActionButton size="sm" onClick={() => setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('section', 'templates'); next.set('mode', 'create'); return next })}>New template</ActionButton>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${INPUT_CLS} min-w-[12rem] flex-1`} placeholder="Search templates" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {migrationNeeded ? (
        <p className="rounded-lg border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-sm text-amber-100">Email Marketing tables are not in this database yet. Phase 1 is shell-only — no production migration.</p>
      ) : loading ? (
        <LoadingState message="Loading templates…" />
      ) : error ? (
        <EmptyState title="Could not load templates" message={error} action={<ActionButton variant="secondary" onClick={() => void reload()}>Try again</ActionButton>} />
      ) : templates.length === 0 ? (
        <EmptyState title="No templates yet" message="Create a branded email template (Newsletter, Promotion, Announcement, Client Update)." />
      ) : filtered.length === 0 ? (
        <EmptyState title="No templates match" message="Adjust the search." />
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">{filtered.map(template => (
          <li key={template.id}>
            <Link to={`/admin/marketing/email/templates/${template.id}`}>
              <TemplateRow template={template} />
            </Link>
          </li>
        ))}</ul>
      )}
    </div>
  )
}

export default function EmailMarketingPage() {
  const { profile } = useAuth()
  const isAdmin = isAdminRole(profile?.role)
  const isManager = isManagerRole(profile?.role)
  const [searchParams, setSearchParams] = useSearchParams()

  const requested = searchParams.get('section') as Section | null
  const section: Section = tabs.some(t => t.key === requested) ? (requested as Section) : 'campaigns'
  const mode = searchParams.get('mode') as 'create' | null

  const [draft, setDraft] = useState<CampaignDraft | null>(mode === 'create' ? {
    id: 'tmp',
    name: '',
    client_id: null,
    subject: '',
    preheader: '',
    body: '',
    template_id: null,
    send_at: null,
    isMobilePreview: false,
  } : null)

  const composerRef = useRef<HTMLDivElement>(null)

  const tabs = useMemo(() => {
    const list: Array<{ key: Section; label: string }> = [
      { key: 'campaigns', label: 'Campaigns' },
      { key: 'audiences', label: 'Audiences' },
      { key: 'templates', label: 'Templates' },
    ]
    return list
  }, [])

  const handleCreateCampaign = () => {
    setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('section', 'campaigns'); next.set('mode', 'create'); return next })
  }

  return (
    <PageContainer width="wide" className="pb-16">
      <PageHeader
        eyebrow="Marketing → Email"
        title="Email Marketing"
        description="Plan, design, approve and measure email campaigns. Phase 1: draft workflow only — no external sends."
      />
      <div className="flex flex-wrap gap-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('section', tab.key); next.delete('mode'); return next })}
            className={`rounded-full border px-4 py-2 text-sm font-black transition-colors ${section === tab.key ? 'border-brand-teal/50 bg-brand-teal/10 text-brand-teal' : 'border-white/10 text-white/45 hover:text-white/70'}`}
          >
            {tab.label}
          </button>
        ))}
        {mode === 'create' && (
          <ActionButton
            size="sm"
            variant="secondary"
            onClick={() => setSearchParams(prev => { const next = new URLSearchParams(prev); next.delete('section'); next.delete('mode'); return next })}
            style={{ marginLeft: '8px' }}
          >
            Cancel
          </ActionButton>
        )}
      </div>

      {section === 'campaigns' && <CampaignsSection isAdmin={isAdmin} isManager={isManager} setSearchParams={setSearchParams} />}
      {section === 'audiences' && <AudiencesSection isAdmin={isAdmin} setSearchParams={setSearchParams} />}
      {section === 'templates' && <TemplatesSection isAdmin={isAdmin} setSearchParams={setSearchParams} />}
      {mode === 'create' && <CampaignComposer onClose={draft => setSearchParams(prev => { const next = new URLSearchParams(prev); next.delete('section'); next.delete('mode'); return next })} />}

    </PageContainer>
  )
}