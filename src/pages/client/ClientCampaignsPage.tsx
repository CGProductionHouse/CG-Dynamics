import { useEffect, useState } from 'react'
import { ClientPortalShell } from '../../components/client/ClientPortalShell'
import { useAuth } from '../../contexts/AuthContext'
import { getClient, type Client } from '../../lib/db/clients'
import { listPublishedReportsForClient, type Report } from '../../lib/db/reports'
import {
  loadGoogleAdsDashboard,
  type GoogleAdsDashboardData,
  type GoogleAdsDashboardState,
} from '../../lib/googleAdsDashboard'
import { getReportMonthFromPeriod, monthDisplayLabel, selectMonthlyReports } from '../../lib/reportPeriod'

type CampaignPageData = {
  client: Client | null
  report: Report | null
  dashboard: GoogleAdsDashboardData | null
  state: GoogleAdsDashboardState
}

const EMPTY_DATA: CampaignPageData = {
  client: null,
  report: null,
  dashboard: null,
  state: 'no-activity',
}

export default function ClientCampaignsPage() {
  const { profile } = useAuth()
  const [data, setData] = useState<CampaignPageData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true

    async function load() {
      if (!profile?.client_id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(false)
      try {
        const [clientResult, reportsResult] = await Promise.all([
          getClient(profile.client_id),
          listPublishedReportsForClient(profile.client_id),
        ])
        if (!active) return
        if (clientResult.error || reportsResult.error) throw new Error('Campaign data unavailable')

        const report = selectMonthlyReports(reportsResult.data)[0] ?? null
        const googleResult = report
          ? await loadGoogleAdsDashboard(report.id, getReportMonthFromPeriod(report))
          : { data: null, state: 'no-activity' as const, error: null }
        if (!active) return

        setData({
          client: clientResult.data,
          report,
          dashboard: googleResult.data,
          state: googleResult.state,
        })
      } catch {
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => { active = false }
  }, [profile?.client_id])

  const reportMonth = data.report ? getReportMonthFromPeriod(data.report) : null

  return (
    <ClientPortalShell client={data.client}>
      <section className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-report-accent">Paid media</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-5xl">Campaigns</h1>
        <p className="mt-4 text-base leading-7 text-report-muted">
          Verified campaign activity and the information CG uses to refine paid media.
        </p>
        {reportMonth && (
          <p className="mt-4 text-sm text-report-faint">Latest published reporting month: {monthDisplayLabel(reportMonth)}</p>
        )}
      </section>

      {loading ? (
        <CampaignMessage message="Loading campaign reporting..." />
      ) : error || data.state === 'error' ? (
        <CampaignMessage message="Campaign reporting could not be loaded right now. Please try again shortly." tone="error" />
      ) : !data.report ? (
        <CampaignMessage message="No published campaign reporting is available yet." />
      ) : data.state === 'data' && data.dashboard ? (
        <GoogleAdsCampaigns dashboard={data.dashboard} />
      ) : (
        <GoogleAdsEmptyState state={data.state} />
      )}

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <FutureCampaignCard platform="Meta Ads" />
        <FutureCampaignCard platform="TikTok Ads" />
      </section>

      <aside className="mt-10 rounded-lg border border-report-accent/15 bg-report-accent/[0.045] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-report-accent">Campaign feedback</p>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-report-muted">
          Help us improve your campaigns. Please let us know whether the leads from this campaign were valuable and relevant to your business. Your feedback helps us refine the targeting, messaging and campaign direction until we are reaching the right people.
        </p>
      </aside>
    </ClientPortalShell>
  )
}

function GoogleAdsCampaigns({ dashboard }: { dashboard: GoogleAdsDashboardData }) {
  return (
    <section className="mt-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-report-accent">Active reporting</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Google Ads</h2>
        </div>
        <p className="text-sm text-report-faint">{dashboard.campaignCount} campaign{dashboard.campaignCount === 1 ? '' : 's'}</p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Spend" value={formatSpend(dashboard)} />
        <MetricCard label="Impressions" value={formatNumber(dashboard.impressions)} />
        <MetricCard label="Clicks" value={formatNumber(dashboard.clicks)} />
        <MetricCard label="Click-through rate" value={dashboard.ctr === null ? 'Unavailable' : `${dashboard.ctr.toFixed(2)}%`} />
      </div>

      <div className="mt-6 space-y-3">
        {dashboard.campaigns.map(campaign => (
          <article
            key={`${campaign.name}-${campaign.status ?? ''}`}
            className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-5"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-semibold text-white">{campaign.name}</h3>
                <p className="mt-1 text-xs text-report-faint">
                  {[campaign.type, campaign.status].filter(Boolean).join(' / ') || 'Campaign details unavailable'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-report-muted">
                <span>{formatNumber(campaign.impressions)} impressions</span>
                <span className="text-report-faint">/</span>
                <span>{formatNumber(campaign.clicks)} clicks</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function GoogleAdsEmptyState({ state }: { state: GoogleAdsDashboardState }) {
  const message = {
    disconnected: 'Google Ads reporting is not connected for this client yet.',
    unmapped: 'Google Ads reporting has not been linked to this client yet.',
    'not-synced': 'Google Ads reporting is connected, but verified campaign data is not available yet.',
    'no-activity': 'Google Ads is connected, with no campaign activity recorded for this published report month.',
    data: 'No Google Ads campaign activity is available.',
    error: 'Campaign reporting could not be loaded right now.',
  }[state]

  return (
    <section className="mt-10 rounded-lg border border-white/[0.08] bg-white/[0.03] p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-report-accent">Google Ads</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Campaign reporting</h2>
      <p className="mt-3 text-sm leading-6 text-report-muted">{message}</p>
    </section>
  )
}

function FutureCampaignCard({ platform }: { platform: string }) {
  return (
    <article className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-report-faint">Planned integration</p>
      <h2 className="mt-2 text-lg font-semibold text-white">{platform}</h2>
      <p className="mt-2 text-sm leading-6 text-report-faint">This campaign source is not connected in the client portal yet.</p>
    </article>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-5">
      <p className="text-xs text-report-faint">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}

function CampaignMessage({ message, tone = 'normal' }: { message: string; tone?: 'normal' | 'error' }) {
  return (
    <div className={`mt-10 rounded-lg border px-5 py-6 text-sm ${
      tone === 'error'
        ? 'border-[#d8a07a]/20 bg-[#d8a07a]/[0.06] text-[#d8a07a]'
        : 'border-white/[0.08] bg-white/[0.03] text-report-muted'
    }`}>
      {message}
    </div>
  )
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-ZA').format(value)
}

function formatSpend(dashboard: GoogleAdsDashboardData): string {
  if (dashboard.spendMicros === null || !dashboard.currencyCode || dashboard.hasMixedCurrencies) {
    return 'Unavailable'
  }
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: dashboard.currencyCode,
    maximumFractionDigits: 2,
  }).format(dashboard.spendMicros / 1_000_000)
}
