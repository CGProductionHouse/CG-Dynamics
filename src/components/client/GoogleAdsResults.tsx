import type {
  GoogleAdsDashboardData,
  GoogleAdsNativeSettings,
  GoogleAdsReportCampaign,
} from '../../lib/googleAdsDashboard'

function formatNumber(value: number | null): string {
  return value === null
    ? 'Unavailable'
    : new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 2 }).format(value)
}

function formatPercent(value: number | null): string {
  return value === null ? 'Unavailable' : `${value.toFixed(2)}%`
}

function formatMoney(micros: number | null, currency: string | null): string {
  if (micros === null || !currency) return 'Unavailable'
  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(micros / 1_000_000)
  } catch {
    return 'Unavailable'
  }
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Unavailable'
    : date.toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })
}

function providerLabel(value: string | null): string {
  if (!value) return 'Unavailable'
  return value.toLowerCase().replaceAll('_', ' ').replace(/^./, character => character.toUpperCase())
}

function formatTrend(current: number, previous: number, suffix = ''): string {
  if (previous === 0) return current === 0 ? `0${suffix}` : 'Unavailable'
  const change = (current - previous) / previous * 100
  return `${change > 0 ? '+' : ''}${change.toFixed(1)}%${suffix}`
}

function googleAdsBudgetLabel(
  campaign: Pick<GoogleAdsReportCampaign, 'nativeSettings' | 'currencyCode'>,
): string {
  const settings = campaign.nativeSettings
  if (!settings || !campaign.currencyCode || settings.budgetStatus === 'REMOVED') return 'Unavailable'
  const value = settings.budgetPeriod === 'DAILY'
    ? settings.budgetAmountMicros
    : settings.budgetPeriod === 'CUSTOM_PERIOD'
      ? settings.budgetTotalAmountMicros
      : null
  if (value === null) return 'Unavailable'
  const cadence = settings.budgetPeriod === 'DAILY' ? 'average daily' : 'campaign total'
  const sharing = settings.budgetShared === true
    ? ` · shared${settings.budgetReferenceCount && settings.budgetReferenceCount > 1 ? ` by ${settings.budgetReferenceCount} campaigns` : ''}`
    : ''
  return `${formatMoney(value, campaign.currencyCode)} ${cadence}${sharing}`
}

function budgetContext(settings: GoogleAdsNativeSettings | null): string {
  if (!settings) return 'Budget settings have not been synced yet.'
  if (settings.budgetPeriod === 'DAILY') {
    return 'Google Ads average daily budget; it is not a fixed cap for this reporting period.'
  }
  if (settings.budgetPeriod === 'CUSTOM_PERIOD') {
    return 'Google Ads campaign-total budget. The setting is shown separately from period spend.'
  }
  return 'Budget period is unavailable, so no pacing percentage is inferred.'
}

function MetricCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-report-faint">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>
      {note && <p className="mt-2 text-xs leading-5 text-report-faint">{note}</p>}
    </article>
  )
}

function CampaignResult({ campaign }: { campaign: GoogleAdsReportCampaign }) {
  const settings = campaign.nativeSettings
  const reasons = settings?.primaryStatusReasons ?? []
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#071311] p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{campaign.name}</h3>
          <p className="mt-1 text-sm text-report-muted">
            {providerLabel(campaign.type)} · Campaign {providerLabel(campaign.status)}
            {settings?.primaryStatus ? ` · Serving ${providerLabel(settings.primaryStatus)}` : ''}
          </p>
        </div>
        <span className="w-fit rounded-full border border-report-accent/20 bg-report-accent/[0.07] px-3 py-1 text-xs font-semibold text-report-accent">
          {googleAdsBudgetLabel(campaign)}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 border-y border-white/[0.07] py-5 sm:grid-cols-4">
        <CampaignMetric label="Spend" value={formatMoney(campaign.spendMicros, campaign.currencyCode)} />
        <CampaignMetric label="Impressions" value={formatNumber(campaign.impressions)} />
        <CampaignMetric label="Clicks" value={formatNumber(campaign.clicks)} />
        <CampaignMetric label="CTR" value={formatPercent(campaign.ctr)} />
        <CampaignMetric label="Avg CPC" value={formatMoney(campaign.averageCpcMicros, campaign.currencyCode)} />
        <CampaignMetric label="Conversions" value={formatNumber(campaign.conversions)} />
        <CampaignMetric label="Conversion rate" value={formatPercent(campaign.conversionRate)} />
        <CampaignMetric label="Cost / conversion" value={formatMoney(campaign.costPerConversionMicros, campaign.currencyCode)} />
        <CampaignMetric label="Configured value" value={formatNumber(campaign.conversionValue)} />
      </div>

      <div className="mt-4 space-y-1 text-xs leading-5 text-report-faint">
        <p>{budgetContext(settings)}</p>
        <p>
          Recorded activity: {campaign.firstActivity && campaign.lastActivity
            ? `${campaign.firstActivity} to ${campaign.lastActivity}`
            : 'No activity dates available'}.
        </p>
        <p>
          Settings observed: {formatDateTime(settings?.observedAt ?? null)}. Current settings do not prove the historical budget for earlier dates.
        </p>
        {settings?.startDate && <p>Campaign dates: {settings.startDate} to {settings.endDate ?? 'no end date'}.</p>}
        {settings?.biddingStrategyType && <p>Bid strategy: {providerLabel(settings.biddingStrategyType)}.</p>}
        {reasons.length > 0 && <p>Serving context: {reasons.map(providerLabel).join(', ')}.</p>}
      </div>
    </article>
  )
}

function CampaignMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-report-faint">{label}</p>
      <p className="mt-1 text-sm font-semibold text-report-text">{value}</p>
    </div>
  )
}

/** Canonical Google Ads presentation shared by admin preview, Performance and Campaigns. */
export function GoogleAdsResults({
  dashboard,
  compact = false,
}: {
  dashboard: GoogleAdsDashboardData
  compact?: boolean
}) {
  const metrics = [
    { label: 'Spend', value: formatMoney(dashboard.spendMicros, dashboard.currencyCode), note: 'Actual Google Ads cost in this period.' },
    { label: 'Impressions', value: formatNumber(dashboard.impressions) },
    { label: 'Clicks', value: formatNumber(dashboard.clicks) },
    { label: 'CTR', value: formatPercent(dashboard.ctr) },
    { label: 'Avg CPC', value: formatMoney(dashboard.averageCpcMicros, dashboard.currencyCode) },
    { label: 'Conversions', value: formatNumber(dashboard.conversions), note: 'Google Ads Conversions column.' },
    { label: 'Conversion rate', value: formatPercent(dashboard.conversionRate), note: 'Conversions divided by provider-reported ad interactions.' },
    { label: 'Cost / conversion', value: formatMoney(dashboard.costPerConversionMicros, dashboard.currencyCode) },
    { label: 'Configured conversion value', value: formatNumber(dashboard.conversionValue), note: 'Unitless until conversion-action value configuration is verified.' },
  ]
  const visibleMetrics = compact ? metrics.slice(0, 4) : metrics
  const projectionLabel = dashboard.daysRemaining === 0 ? 'Final period spend' : 'Projected month-end spend'

  return (
    <section className={compact ? 'space-y-5' : 'my-8 space-y-7'} aria-label="Google Ads results">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {!compact && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-report-accent">Paid search</p>}
          <h2 className={`${compact ? 'text-xl' : 'mt-2 text-2xl'} font-semibold text-white`}>Google Ads performance</h2>
          <p className="mt-2 text-sm text-report-muted">
            {dashboard.periodStart} to {dashboard.periodEnd} · {dashboard.timeZone ?? 'Timezone unavailable'} · {dashboard.currencyCode ?? 'Currency unavailable'}
          </p>
        </div>
        <div className="text-left text-xs leading-5 text-report-faint sm:text-right">
          <p>{dashboard.campaignCount} campaign{dashboard.campaignCount === 1 ? '' : 's'}</p>
          <p>Last complete period sync: {formatDateTime(dashboard.lastSyncedAt)}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {visibleMetrics.map(metric => <MetricCard key={metric.label} {...metric} />)}
      </div>

      {!compact && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Client-approved monthly target"
            value={formatMoney(dashboard.monthlyTargetMicros, dashboard.targetCurrencyCode)}
            note="CG planning target; separate from every Google provider budget."
          />
          <MetricCard label="Spend to target" value={formatPercent(dashboard.spendToTargetPercent)} />
          <MetricCard
            label="Days remaining"
            value={dashboard.daysRemaining === null ? 'Unavailable' : formatNumber(dashboard.daysRemaining)}
            note={`Data through ${dashboard.dataThroughDate ?? 'unavailable'}.`}
          />
          <MetricCard
            label={projectionLabel}
            value={formatMoney(dashboard.projectedMonthEndSpendMicros, dashboard.currencyCode)}
            note={dashboard.daysRemaining === 0 ? 'Actual completed-period spend.' : 'Calendar-day run rate through the latest synced date; not a guarantee.'}
          />
        </div>
      )}

      <p className="text-xs leading-5 text-report-faint">
        No automatic month-on-month judgement is shown. Comparisons require explicit equivalent periods and meaningful campaign states.
      </p>

      {!compact && (
        <>
          <div className="rounded-xl border border-report-accent/15 bg-report-accent/[0.045] px-4 py-3 text-xs leading-5 text-report-muted">
            Conversions and configured conversion value follow Google Ads conversion-action settings. Value is not shown as revenue or account currency until that configuration is verified.
          </div>
          {dashboard.sevenDayTrend && (
            <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6" aria-label="Equal-window seven-day trends">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-report-accent">Equal-window trend</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">Latest 7 days vs previous 7 days</h3>
                </div>
                <p className="text-xs text-report-faint">
                  {dashboard.sevenDayTrend.current.startDate} to {dashboard.sevenDayTrend.current.endDate} vs {dashboard.sevenDayTrend.previous.startDate} to {dashboard.sevenDayTrend.previous.endDate}
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <MetricCard label="Spend trend" value={formatTrend(dashboard.sevenDayTrend.current.spendMicros, dashboard.sevenDayTrend.previous.spendMicros)} />
                <MetricCard label="Click trend" value={formatTrend(dashboard.sevenDayTrend.current.clicks, dashboard.sevenDayTrend.previous.clicks)} />
                <MetricCard label="Conversion trend" value={formatTrend(dashboard.sevenDayTrend.current.conversions, dashboard.sevenDayTrend.previous.conversions)} />
              </div>
              <p className="mt-3 text-xs leading-5 text-report-faint">Both windows contain seven calendar days and use the same canonical daily metrics. No unequal-period MoM inference is used.</p>
            </section>
          )}
          <div className="space-y-4">
            {dashboard.campaigns.map((campaign, index) => (
              <CampaignResult key={`${campaign.campaignId}-${index}`} campaign={campaign} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
