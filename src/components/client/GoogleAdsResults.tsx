import {
  isGoogleAdsTrendComparable,
} from '../../lib/googleAdsDashboard'
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

function providerLabel(value: string | null): string | null {
  if (!value) return null
  return value.toLowerCase().replaceAll('_', ' ').replace(/^./, character => character.toUpperCase())
}

function formatTrend(current: number, previous: number, suffix = ''): string {
  if (previous === 0) return current === 0 ? `0${suffix}` : 'Unavailable'
  const change = (current - previous) / previous * 100
  return `${change > 0 ? '+' : ''}${change.toFixed(1)}%${suffix}`
}

function googleAdsBudgetLabel(
  campaign: Pick<GoogleAdsReportCampaign, 'nativeSettings' | 'currencyCode'>,
): string | null {
  const settings = campaign.nativeSettings
  if (!settings || !campaign.currencyCode || settings.budgetStatus === 'REMOVED') return null
  const value = settings.budgetPeriod === 'DAILY'
    ? settings.budgetAmountMicros
    : settings.budgetPeriod === 'CUSTOM_PERIOD'
      ? settings.budgetTotalAmountMicros
      : null
  if (value === null) return null
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
  const budgetLabel = googleAdsBudgetLabel(campaign)
  const metrics = [
    { label: 'Spend', value: formatMoney(campaign.spendMicros, campaign.currencyCode) },
    { label: 'Impressions', value: formatNumber(campaign.impressions) },
    { label: 'Clicks', value: formatNumber(campaign.clicks) },
    { label: 'CTR', value: formatPercent(campaign.ctr) },
    { label: 'Avg CPC', value: formatMoney(campaign.averageCpcMicros, campaign.currencyCode) },
    { label: 'Conversions', value: formatNumber(campaign.conversions) },
    { label: 'Conversion rate', value: formatPercent(campaign.conversionRate) },
    { label: 'Cost / conversion', value: formatMoney(campaign.costPerConversionMicros, campaign.currencyCode) },
  ].filter(metric => metric.value !== 'Unavailable')

  const typeLabel = providerLabel(campaign.type)
  const statusLabel = providerLabel(campaign.status)
  const primaryStatusLabel = settings?.primaryStatus ? providerLabel(settings.primaryStatus) : null
  const statusParts = [
    typeLabel,
    statusLabel ? `Campaign ${statusLabel}` : null,
    primaryStatusLabel ? `Serving ${primaryStatusLabel}` : null,
  ].filter((part): part is string => part !== null)

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#071311] p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{campaign.name}</h3>
          {statusParts.length > 0 && (
            <p className="mt-1 text-sm text-report-muted">{statusParts.join(' · ')}</p>
          )}
        </div>
        {budgetLabel && (
          <span className="w-fit rounded-full border border-report-accent/20 bg-report-accent/[0.07] px-3 py-1 text-xs font-semibold text-report-accent">
            {budgetLabel}
          </span>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 border-y border-white/[0.07] py-5 sm:grid-cols-4">
        {metrics.map(metric => <CampaignMetric key={metric.label} {...metric} />)}
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
  ].filter(metric => metric.value !== 'Unavailable')
  const visibleMetrics = compact ? metrics.slice(0, 4) : metrics

  const hasTarget = dashboard.monthlyTargetMicros !== null && dashboard.targetCurrencyCode !== null
  const daysKnown = dashboard.daysRemaining !== null
  const showProjection = daysKnown && dashboard.daysRemaining !== 0 && dashboard.projectedMonthEndSpendMicros !== null
  const trendComparable = !compact && isGoogleAdsTrendComparable(dashboard.sevenDayTrend)

  const contextCards: { label: string; value: string; note?: string }[] = []
  if (hasTarget) {
    contextCards.push({
      label: 'Client-approved monthly target',
      value: formatMoney(dashboard.monthlyTargetMicros, dashboard.targetCurrencyCode),
      note: 'CG planning target; separate from every Google provider budget.',
    })
    if (dashboard.spendToTargetPercent !== null) {
      contextCards.push({ label: 'Spend to target', value: formatPercent(dashboard.spendToTargetPercent) })
    }
  }
  if (showProjection) {
    contextCards.push({
      label: 'Days remaining',
      value: formatNumber(dashboard.daysRemaining),
      note: `Data through ${dashboard.dataThroughDate ?? 'unavailable'}.`,
    })
    contextCards.push({
      label: 'Projected month-end spend',
      value: formatMoney(dashboard.projectedMonthEndSpendMicros, dashboard.currencyCode),
      note: 'Calendar-day run rate through the latest synced date; not a guarantee.',
    })
  }

  const setupNotes: string[] = []
  // Monthly targets are only meaningful for live/in-progress periods.
  if (!hasTarget && !(daysKnown && dashboard.daysRemaining === 0)) {
    setupNotes.push('No client-approved monthly target is set for this period.')
  }
  if (daysKnown && dashboard.daysRemaining === 0) {
    setupNotes.push(`Completed period. Data through ${dashboard.dataThroughDate ?? 'unavailable'}.`)
  }

  const metaParts = [
    `${dashboard.periodStart} to ${dashboard.periodEnd}`,
    dashboard.timeZone,
    dashboard.currencyCode,
  ].filter((part): part is string => Boolean(part))
  const syncLine = dashboard.lastSyncedAt ? `Last successful sync: ${formatDateTime(dashboard.lastSyncedAt)}` : null

  return (
    <section className={compact ? 'space-y-5' : 'my-8 space-y-7'} aria-label="Google Ads results">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {!compact && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-report-accent">Paid search</p>}
          <h2 className={`${compact ? 'text-xl' : 'mt-2 text-2xl'} font-semibold text-white`}>Google Ads performance</h2>
          <p className="mt-2 text-sm text-report-muted">{metaParts.join(' · ')}</p>
        </div>
        <div className="text-left text-xs leading-5 text-report-faint sm:text-right">
          <p>{dashboard.campaignCount} campaign{dashboard.campaignCount === 1 ? '' : 's'}</p>
          {syncLine && <p>{syncLine}</p>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {visibleMetrics.map(metric => <MetricCard key={metric.label} {...metric} />)}
      </div>

      {!compact && (
        <div className="space-y-4">
          {contextCards.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {contextCards.map(card => <MetricCard key={card.label} {...card} />)}
            </div>
          )}

          {setupNotes.length > 0 && (
            <div className="space-y-1">
              {setupNotes.map(note => (
                <p key={note} className="text-xs leading-5 text-report-faint">{note}</p>
              ))}
            </div>
          )}

          <p className="text-xs leading-5 text-report-faint">
            No automatic month-on-month judgement is shown. Comparisons require explicit equivalent periods and meaningful campaign states.
          </p>

          <div className="rounded-xl border border-report-accent/15 bg-report-accent/[0.045] px-4 py-3 text-xs leading-5 text-report-muted">
            Conversions follow the Google Ads conversion-action settings configured for this account. Conversion value is not shown as revenue or account currency until that configuration is verified.
          </div>

          {trendComparable && dashboard.sevenDayTrend && (
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
        </div>
      )}
    </section>
  )
}
