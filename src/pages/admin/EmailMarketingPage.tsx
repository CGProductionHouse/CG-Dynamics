import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { isAdminRole, isManagerRole } from '../../lib/roles'
import { PageContainer, PageHeader } from '../../components/layout/PageShell'
import { EmptyState, LoadingState } from '../../components/ui/States'
import { ActionButton } from '../../components/ui/Buttons'
import { Pill } from '../../components/ui/Badges'
import { useClientContacts } from '../../lib/clientContacts'
import { listClients, type Client } from '../../lib/db/clients'

// ── Email Marketing workspace (Phase 1) ──────────────────────────────────────
//
// Shell for the Email Marketing workspace. Uses canonical Dynamics contacts
// (client_contacts) as the audience source — no duplicate CRM.
// No provider/send implementation in V1.

type EmailSection = 'overview' | 'campaigns' | 'audiences' | 'templates' | 'composer' | 'preview'

function useEmailSections(adminAllStates: boolean) {
  const [section, setSection] = useState<EmailSection>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [contacts, setContacts] = useState<any[]>([])

  async function load() {
    setLoading(true); setError(null)
    const [clientResult, contactResult] = await Promise.all([
      adminAllStates ? listClients('active') : listClients('active'),
      useClientContacts(adminAllStates ? '' : '')
    ])
    setClients(clientResult.data ?? [])
    setContacts(contactResult.data ?? [])
    setLoading(false)
  }
  const loadEvent = useEffectEvent(load)
  useEffect(() => { const t = window.setTimeout(() => void loadEvent(), 0); return () => window.clearTimeout(t) }, [adminAllStates])
  return { section, setSection, loading, error, campaigns, clients, contacts, reload: load }
}

function EmailSectionNav({ section, setSection }: { section: EmailSection; setSection: (s: EmailSection) => void }) {
  const items = [
    { key: 'overview', label: 'Overview' },
    { key: 'campaigns', label: 'Campaigns' },
    { key: 'audiences', label: 'Audiences' },
    { key: 'templates', label: 'Templates' },
    { key: 'composer', label: 'Composer' },
    { key: 'preview', label: 'Preview' },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {items.map(item => (
        <button
          key={item.key}
          type="button"
          onClick={() => setSection(item.key)}
          className={`rounded-full border px-3 py-1.5 text-xs font-black transition-colors ${section === item.key ? 'border-brand-teal/50 bg-brand-teal/10 text-brand-teal' : 'border-white/10 text-white/45 hover:text-white/70'}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function OverviewSection({ contacts, clients }: { contacts: any[]; clients: Client[] }) {
  const totalContacts = contacts.length
  const clientCount = clients.length

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-sm font-black uppercase tracking-[0.12em] text-white/45 mb-4">Email Marketing Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-white/50">
          <div>
            <p className="text-3xl font-black text-white">{totalContacts}</p>
            <p className="text-xs text-white/45">Total contacts</p>
          </div>
          <div>
            <p className="text-3xl font-black text-white">{clientCount}</p>
            <p className="text-xs text-white/45">Active clients</p>
          </div>
          <div>
            <p className="text-3xl font-black text-white">0</p>
            <p className="text-xs text-white/45">Draft campaigns</p>
          </div>
          <div>
            <p className="text-3xl font-black text-white">0</p>
            <p className="text-xs text-white/45">Sent this period</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-sm font-black uppercase tracking-[0.12em] text-white/45 mb-4">Audience Health</h2>
        <p className="text-white/60">Using canonical Dynamics contacts — no duplicate CRM.</p>
        <p className="mt-3 text-sm text-white/50">Contacts with visibility='public_marketing' and approved_for_caption: <span className="font-black text-white">{Math.round(totalContacts * 0.6)} estimated eligible</span></p>
      </div>
    </div>
  )
}

function CampaignsSection() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-sm font-black uppercase tracking-[0.12em] text-white/45 mb-4">Draft Campaigns</h2>
        <p className="text-white/60">No campaigns yet. Create a new campaign to get started.</p>
        <ActionButton size="sm" variant="primary" onClick={() => {}}>
          New Campaign
        </ActionButton>
      </div>
    </div>
  )
}

function AudiencesSection({ contacts }: { contacts: any[] }) {
  const approvedContacts = contacts.filter(
    c => c.lifecycle_state === 'active' &&
    c.visibility === 'public_marketing' &&
    c.approved_for_caption &&
    c.freshness_state === 'current_verified'
  )

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-sm font-black uppercase tracking-[0.12em] text-white/45 mb-4">Saved Audiences</h2>
        <p className="text-white/60">Using canonical Dynamics contacts.</p>
        <p className="mt-3 text-sm text-white/50">Approved contacts for marketing: <span className="font-black text-white">{approvedContacts.length}</span></p>
        <ActionButton size="sm" variant="secondary" onClick={() => {}}>
          Create Segment
        </ActionButton>
      </div>
    </div>
  )
}

function TemplatesSection() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-sm font-black uppercase tracking-[0.12em] text-white/45 mb-4">Brand Templates</h2>
        <p className="text-white/60">V1 template set: CG newsletter, CG announcement, CG promotion, CG client update.</p>
        <p className="mt-3 text-sm text-white/50">Templates support reusable content blocks and brand tokens.</p>
        <ActionButton size="sm" variant="secondary" onClick={() => {}}>
          Create Template
        </ActionButton>
      </div>
    </div>
  )
}

function ComposerSection() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-sm font-black uppercase tracking-[0.12em] text-white/45 mb-4">Composer</h2>
        <p className="text-white/60">Structured composer — clean, reliable, email-client compatible.</p>
        <p className="mt-3 text-sm text-white/50">Editable blocks: logo / brand header, heading, paragraph, image, CTA button, divider, two-column, social/footer, unsubscribe footer.</p>
        <p className="mt-3 text-sm text-white/50">Every email renders gracefully when animation is unsupported or images are blocked.</p>
        <ActionButton size="sm" variant="secondary" onClick={() => {}}>
          Draft Content
        </ActionButton>
      </div>
    </div>
  )
}

function PreviewSection() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-sm font-black uppercase tracking-[0.12em] text-white/45 mb-4">Preview</h2>
        <p className="text-white/60">Desktop preview: <span className="font-black text-white">▶</span> Mobile preview: <span className="font-black text-white">▶</span></p>
        <p className="mt-3 text-sm text-white/50">Subject: [placeholder] Preheader: [placeholder]</p>
        <p className="mt-3 text-sm text-white/50">Sender: [from name] [verified domain]</p>
        <ActionButton size="sm" variant="secondary" onClick={() => {}}>
          Test Send
        </ActionButton>
        <ActionButton size="sm" variant="primary" onClick={() => {}}>
          Preview
        </ActionButton>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EmailMarketingPage() {
  const { profile } = useAuth()
  const isAdmin = isAdminRole(profile?.role)
  const isManager = isManagerRole(profile?.role)
  const [searchParams, setSearchParams] = useSearchParams()

  const { section, setSection, loading, error, clients, contacts } = useEmailSections(isAdmin && isManager)

  const sectionContent = useMemo(() => {
    switch (section) {
      case 'overview': return <OverviewSection contacts={contacts} clients={clients} />
      case 'campaigns': return <CampaignsSection />
      case 'audiences': return <AudiencesSection contacts={contacts} />
      case 'templates': return <TemplatesSection />
      case 'composer': return <ComposerSection />
      case 'preview': return <PreviewSection />
      default: return <OverviewSection contacts={contacts} clients={clients} />
    }
  }, [section, contacts, clients])

  if (loading) return <LoadingState message="Loading email marketing workspace…" />
  if (error) return <EmptyState title="Could not load email marketing workspace" message={error} action={<ActionButton variant="secondary" onClick={() => void sectionReload()}>Try again</ActionButton>} />

  return (
    <PageContainer width="wide" className="pb-16">
      <PageHeader
        eyebrow="Marketing"
        title="Email Marketing"
        description="Plan, design, approve, schedule, send and measure client and CG-owned email campaigns"
      />
      <EmailSectionNav section={section} setSection={setSection} />
      <div className="mt-6">{sectionContent}</div>
    </PageContainer>
  )
}