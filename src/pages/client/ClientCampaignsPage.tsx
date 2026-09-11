import { useEffect, useMemo, useState } from 'react'
import { ClientPortalShell } from '../../components/client/ClientPortalShell'
import { GoogleAdsResults } from '../../components/client/GoogleAdsResults'
import { useAuth } from '../../contexts/AuthContext'
import { getClient, type Client } from '../../lib/db/clients'
import { listClientPublishedReports, type ClientReport } from '../../lib/db/reports'
import {
  loadGoogleAdsDashboard,
  type GoogleAdsDashboardData,
  type GoogleAdsDashboardState,
} from '../../lib/googleAdsDashboard'
import { getReportMonthFromPeriod, monthDisplayLabel, selectMonthlyReports } from '../../lib/reportPeriod'
import { readStrategyData } from '../../lib/strategyEngine'

type CampaignPageData = {
  client: Client | null
  report: ClientReport | null
  dashboard: GoogleAdsDashboardData | null
  state: GoogleAdsDashboardState
}
const EMPTY_DATA: CampaignPageData = {
  client: null,
  report: null,
  dashboard: null,
  state: 'no-activity',
}

function reportMonth(report: ClientReport): string {
  return getReportMonthFromPeriod(report)
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
          listClientPublishedReports(),
        ])
        if (!active) return
        if (clientResult.error || reportsResult.error) throw new Error('Campaign data unavailable')

        const report = selectMonthlyReports(reportsResult.data)[0] ?? null
        const googleResult = report
          ? await loadGoogleAdsDashboard(report.id, reportMonth(report))
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

  const trackingMonth = data.report ? reportMonth(data.report) : null

  return (
    <ClientPortalShell client={data.client}>
      <section className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-report-accent">Paid media</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-5xl">Campaigns</h1>
        <p className="mt-4 text-base leading-7 text-report-muted">
          Verified campaign activity and the information CG uses to refine paid media.
        </p>
        {trackingMonth && (
          <p className="mt-4 text-sm text-report-faint">Campaign reporting month: {monthDisplayLabel(trackingMonth)}</p>
        )}
      </section>

      {loading ? (
        <CampaignMessage message="Loading campaign reporting..." />
      ) : error || data.state === 'error' ? (
        <CampaignMessage message="Campaign reporting could not be loaded right now. Please try again shortly." tone="error" />
      ) : !data.report ? (
        <CampaignMessage message="No published campaign reporting is available yet." />
      ) : data.state === 'data' && data.dashboard ? (
        <GoogleAdsResults dashboard={data.dashboard} />
      ) : (
        <GoogleAdsEmptyState state={data.state} />
      )}

      <CampaignStrategyDirection report={data.report} />

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

function CampaignStrategyDirection({ report }: { report: ClientReport | null }) {
  const strategy = useMemo(() => readStrategyData(report?.strategy_data), [report])
  const hasContent = strategy.strategyGoingForward || strategy.clientDirection.length > 0 || strategy.actionPlan.campaign_recommendation.enabled
  if (!hasContent) return null

  return (
    <section className="mt-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-report-accent">CG review &amp; optimisation direction</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Strategy for paid media</h2>
      <div className="mt-4 space-y-4">
        {strategy.strategyGoingForward && (
          <div className="rounded-lg border border-report-accent/10 bg-report-accent/[0.04] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-report-faint">Going forward</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-report-text">{strategy.strategyGoingForward}</p>
          </div>
        )}
        {strategy.clientDirection.length > 0 && (
          <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-report-faint">Campaign direction</p>
            <ul className="mt-3 space-y-2">
              {strategy.clientDirection.map((direction, index) => (
                <li key={index} className="flex items-start gap-3 text-sm text-report-muted">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-report-accent" />
                  {direction}
                </li>
              ))}
            </ul>
          </div>
        )}
        {strategy.actionPlan.campaign_recommendation.enabled && (
          <div className="rounded-lg border border-brand-teal/10 bg-brand-teal/[0.04] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-report-faint">Next campaign recommendation</p>
            {strategy.actionPlan.campaign_recommendation.items.length > 0 && (
              <ul className="mt-3 space-y-2">
                {strategy.actionPlan.campaign_recommendation.items.map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-sm text-report-muted">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-teal" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
            {strategy.actionPlan.campaign_recommendation.notes && (
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-report-text">
                {strategy.actionPlan.campaign_recommendation.notes}
              </p>
            )}
          </div>
        )}
      </div>
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
