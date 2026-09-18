import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { isAdminRole, isManagerRole } from '../../lib/roles'
import { PageContainer, PageHeader } from '../../components/layout/PageShell'
import { EmptyState, LoadingState } from '../../components/ui/States'
import { ActionButton } from '../../components/ui/Buttons'
import { Pill } from '../../components/ui/Badges'

type CampaignStatus =
  | 'draft'
  | 'needs_review'
  | 'approved'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'paused'
  | 'failed'

type Campaign = {
  id: string
  name: string
  client_name: string | null
  audience_count: number
  scheduled_at: string | null
  status: CampaignStatus
  last_sent_at: string | null
  deliverability_warning: string | null
}

type AudienceHealth = {
  total_contacts: number
  active: number
  suppressed: number
  unsubscribed: number
}

type Template = {
  id: string
  name: string
  type: 'newsletter' | 'promotion' | 'announcement' | 'client_update'
}

function getStatusLabel(status: CampaignStatus): string {
  const labels: Record<CampaignStatus, string> = {
    draft: 'Draft',
    needs_review: 'Needs review',
    approved: 'Approved',
    scheduled: 'Scheduled',
    sending: 'Sending',
    sent: 'Sent',
    paused: 'Paused',
    failed: 'Failed',
  }
  return labels[status]
}

function getStatusTone(status: CampaignStatus): 'teal' | 'amber' | 'neutral' {
  if (status === 'approved' || status === 'scheduled') return 'teal'
  if (status === 'draft' || status === 'needs_review') return 'amber'
  if (status === 'sent' || status === 'failed' || status === 'paused') return 'neutral'
  return 'neutral'
}

export default function EmailMarketingPage() {
  const { profile } = useAuth()
  const isAdmin = isAdminRole(profile?.role)
  const isManager = isManagerRole(profile?.role)
  const [searchParams, setSearchParams] = useSearchParams()

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [audienceHealth, setAudienceHealth] = useState<AudienceHealth | null>(null)

  const today = () => new Date().toISOString().slice(0, 10)

  async function loadCampaigns() {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setCampaigns(data as Campaign[])
    } catch (err: any) {
      setError(err.message || 'Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }

  async function loadAudienceHealth() {
    try {
      const { data, error } = await supabase
        .from('email_audiences')
        .select('*')
        .maybeSingle()
      if (error) throw error
      setAudienceHealth(data as AudienceHealth)
    } catch (err: any) {
      setError(err.message || 'Failed to load audience health')
    }
  }

  useEffect(() => {
    void loadCampaigns()
    void loadAudienceHealth()
  }, [])

  const emptyStateMessage = campaigns.length === 0 && !loading
    ? 'No campaigns yet. Create your first campaign to get started.'
    : loading
      ? 'Loading campaigns…'
      : error
        ? `Could not load campaigns: ${error}`
        : 'No campaigns found'

  return (
    <PageContainer width="wide" className="pb-16">
      <PageHeader
        eyebrow="Email Marketing"
        title="Email Marketing"
        description="Plan, design, approve, schedule, and measure client and CG-owned email campaigns."
      />
      <div className="flex flex-col sm:flex-row gap-4 mt-6">
        <ActionButton
          size="lg"
          variant="primary"
          onClick={() => setSearchParams(prev => {
            const next = new URLSearchParams(prev)
            next.set('action', 'new')
            return next
          })}
          disabled={loading}
        >
          {loading ? 'Creating campaign…' : 'New campaign'}
        </ActionButton>

        {isAdmin && (
          <ActionButton
            size="lg"
            variant="secondary"
            onClick={() => setSearchParams(prev => {
              const next = new URLSearchParams(prev)
              next.set('action', 'admin')
              return next
            })}
          >
            Admin
          </ActionButton>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
          <h3 className="text-sm font-black uppercase tracking-[0.12em] text-white/45 mb-3">Draft campaigns</h3>
          {loading ? (
            <LoadingState message="Loading draft campaigns…" />
          ) : error ? (
            <EmptyState
              title="Could not load draft campaigns"
              message={error}
              action={<ActionButton variant="secondary" onClick={() => void loadCampaigns()}>Try again</ActionButton>}
            />
          ) : campaigns.length === 0 ? (
            <EmptyState
              title="No draft campaigns"
              message="Create your first campaign. No drafts are stored until you save a campaign."
            />
          ) : (
            <ul className="space-y-2">
              {campaigns
                .filter(c => c.status === 'draft' || c.status === 'needs_review')
                .map((campaign) => {
                  return (
                    <li key={campaign.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">{campaign.name}</p>
                          <p className="mt-0.5 text-xs text-white/40">
                            {campaign.client_name ?? 'No client context'} · {getStatusLabel(campaign.status)}
                          </p>
                        </div>
                        <Pill tone={getStatusTone(campaign.status)}>{getStatusLabel(campaign.status)}</Pill>
                        <Pill tone="amber">{campaign.audience_count} recipients</Pill>
                      </div>
                      {campaign.deliverability_warning && (
                        <p className="mt-1 text-xs text-amber-200/80">{campaign.deliverability_warning}</p>
                      )}
                    </li>
                  )
                })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
          <h3 className="text-sm font-black uppercase tracking-[0.12em] text-white/45 mb-3">Scheduled campaigns</h3>
          {loading ? (
            <LoadingState message="Loading scheduled campaigns…" />
          ) : error ? (
            <EmptyState
              title="Could not load scheduled campaigns"
              message={error}
              action={<ActionButton variant="secondary" onClick={() => void loadCampaigns()}>Try again</ActionButton>}
            />
          ) : campaigns.length === 0 ? (
            <EmptyState title="No scheduled campaigns" message="No campaigns are currently scheduled." />
          ) : (
            <ul className="space-y-2">
              {campaigns
                .filter(c => c.status === 'scheduled')
                .map((campaign) => {
                  return (
                    <li key={campaign.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">{campaign.name}</p>
                          <p className="mt-0.5 text-xs text-white/40">
                            Scheduled: {campaign.scheduled_at ?? 'TBD'} · {getStatusLabel(campaign.status)}
                          </p>
                        </div>
                        <Pill tone={getStatusTone(campaign.status)}>{getStatusLabel(campaign.status)}</Pill>
                        <Pill tone="amber">{campaign.audience_count} recipients</Pill>
                      </div>
                    </li>
                  )
                })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
          <h3 className="text-sm font-black uppercase tracking-[0.12em] text-white/45 mb-3">Recently sent</h3>
          {loading ? (
            <LoadingState message="Loading recently sent campaigns…" />
          ) : error ? (
            <EmptyState
              title="Could not load recently sent campaigns"
              message={error}
              action={<ActionButton variant="secondary" onClick={() => void loadCampaigns()}>Try again</ActionButton>}
            />
          ) : campaigns.length === 0 ? (
            <EmptyState title="No sent campaigns" message="No campaigns have been sent yet." />
          ) : (
            <ul className="space-y-2">
              {campaigns
                .filter(c => c.status === 'sent')
                .slice(0, 5)
                .map((campaign) => {
                  return (
                    <li key={campaign.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">{campaign.name}</p>
                          <p className="mt-0.5 text-xs text-white/40">
                            Sent {new Date(campaign.last_sent_at).toLocaleDateString('en-ZA')} · {getStatusLabel(campaign.status)}
                          </p>
                        </div>
                        <Pill tone={getStatusTone(campaign.status)}>{getStatusLabel(campaign.status)}</Pill>
                      </div>
                    </li>
                  )
                })}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
        <h3 className="text-sm font-black uppercase tracking-[0.12em] text-white/45 mb-3">Audience health</h3>
        {loading || !audienceHealth ? (
          <LoadingState message="Loading audience health…" />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.08em] text-white/40">Total contacts</p>
              <p className="text-2xl font-black text-white">{audienceHealth.total_contacts}</p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.08em] text-white/40">Active</p>
              <p className="text-2xl font-black text-teal-400">{audienceHealth.active}</p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.08em] text-white/40">Suppressed</p>
              <p className="text-2xl font-black text-amber-300">{audienceHealth.suppressed}</p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.08em] text-white/40">Unsubscribed</p>
              <p className="text-2xl font-black text-red-300">{audienceHealth.unsubscribed}</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
    </PageContainer>
  )
}