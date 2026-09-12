// WebsiteAfterTheClick.tsx — client-facing "Website after the click" section (#335).
//
// Renders the ONE canonical projection from lib/websiteAfterClick. Admin Preview renders
// ClientReportView, which renders this component, so admin and client cannot diverge.
//
// Mobile-first. Every number can be "Unavailable" and no path renders a fabricated zero.

import {
  ctaStatusLabel,
  formatEngagementRate,
  formatWebsiteMetric,
  formatWebsitePercent,
  type WebsiteAfterClickProjection,
} from '../../lib/websiteAfterClick'

function providerBadge(provider: 'google-ads' | 'ga4'): string {
  return provider === 'google-ads' ? 'Google Ads' : 'Website analytics'
}

function FunnelRow({
  label, value, provider, unavailableReason,
}: {
  label: string
  value: number | null
  provider: 'google-ads' | 'ga4'
  unavailableReason: string | null
}) {
  return (
    <li className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-medium text-white">{label}</p>
        <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-report-faint">
          {providerBadge(provider)}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
        {value === null ? 'Unavailable' : formatWebsiteMetric(value)}
      </p>
      {unavailableReason && (
        <p className="mt-2 text-xs leading-5 text-report-faint">{unavailableReason}</p>
      )}
    </li>
  )
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-report-faint">{label}</p>
      <p className="mt-1.5 text-lg font-semibold text-white">{value}</p>
      {note && <p className="mt-1 text-xs leading-5 text-report-faint">{note}</p>}
    </div>
  )
}

export function WebsiteAfterTheClick({
  projection,
  compact = false,
}: {
  projection: WebsiteAfterClickProjection
  compact?: boolean
}) {
  const { state, funnel, ctas, landingPages } = projection
  const hasData = state === 'data'

  return (
    <section className="rounded-[1.75rem] border border-white/[0.08] bg-white/[0.02] p-5 sm:p-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-report-faint">After the click</p>
        <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-white sm:text-2xl">
          Website after the click
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-report-muted">
          What visitors did on the website after clicking these ads. Ad clicks are counted by Google
          Ads; website sessions are counted separately by your website analytics.
        </p>
      </header>

      {!hasData && projection.message && (
        <p className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm leading-relaxed text-report-muted">
          {projection.message}
        </p>
      )}

      {/* Ads stages remain truthful even when GA4 is unavailable. */}
      <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {funnel.map(stage => (
          <FunnelRow
            key={stage.key}
            label={stage.label}
            value={stage.value}
            provider={stage.provider}
            unavailableReason={stage.unavailableReason}
          />
        ))}
      </ol>

      {projection.varianceNote && (
        <p className="mt-4 text-xs leading-5 text-report-faint">{projection.varianceNote}</p>
      )}
      {projection.periodAlignment.note && (
        <p className="mt-2 text-xs leading-5 text-report-faint">{projection.periodAlignment.note}</p>
      )}

      {hasData && (
        <div className="mt-7 grid grid-cols-2 gap-x-5 gap-y-5 border-y border-white/[0.07] py-6 sm:grid-cols-4">
          <Metric label="Sessions" value={formatWebsiteMetric(projection.sessions)} />
          <Metric label="People reached" value={formatWebsiteMetric(projection.activeUsers)} />
          <Metric label="Engaged sessions" value={formatWebsiteMetric(projection.engagedSessions)} />
          <Metric label="Engagement rate" value={formatEngagementRate(projection.engagementRate)} />
        </div>
      )}

      {hasData && !compact && landingPages.length > 0 && (
        <div className="mt-7">
          <h4 className="text-sm font-semibold text-white">Where visitors landed</h4>
          <div className="mt-3 -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[24rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] text-[0.68rem] uppercase tracking-[0.14em] text-report-faint">
                  <th scope="col" className="py-2 pr-4 font-semibold">Landing page</th>
                  <th scope="col" className="py-2 pr-4 text-right font-semibold">Sessions</th>
                  <th scope="col" className="py-2 text-right font-semibold">Engaged</th>
                </tr>
              </thead>
              <tbody>
                {landingPages.map(page => (
                  <tr key={page.path} className="border-b border-white/[0.05]">
                    <td className="py-2.5 pr-4 text-report-muted break-all">{page.path}</td>
                    <td className="py-2.5 pr-4 text-right text-white">{formatWebsiteMetric(page.sessions)}</td>
                    <td className="py-2.5 text-right text-white">{formatWebsiteMetric(page.engagedSessions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {ctas.length > 0 && (
        <div className="mt-7">
          <h4 className="text-sm font-semibold text-white">Enquiries and key actions</h4>
          <p className="mt-1.5 text-xs leading-5 text-report-faint">
            Only actions your website actually measures are shown as a number. Anything not yet
            measured is marked so it is never mistaken for zero enquiries.
          </p>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {ctas.map(cta => (
              <li
                key={cta.key}
                className="flex items-baseline justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3"
              >
                <span className="text-sm text-report-muted">{cta.label}</span>
                <span
                  className={
                    cta.availability === 'tracked'
                      ? 'text-base font-semibold text-white'
                      : 'text-xs font-semibold uppercase tracking-[0.1em] text-report-faint'
                  }
                >
                  {ctaStatusLabel(cta)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasData && projection.conversionRate !== null && (
        <p className="mt-6 text-sm text-report-muted">
          <span className="font-semibold text-white">{formatWebsitePercent(projection.conversionRate)}</span>
          {' '}of website sessions from these ads produced a measured key action.
        </p>
      )}

      <footer className="mt-7 space-y-1 border-t border-white/[0.07] pt-5 text-xs leading-5 text-report-faint">
        {projection.dataThroughDate && <p>Website data complete through {projection.dataThroughDate}.</p>}
        {projection.propertyTimeZone && <p>Website analytics timezone: {projection.propertyTimeZone}.</p>}
        {projection.unsupportedFields.length > 0 && (
          <p>
            Some measurements are not available from this website analytics setup:{' '}
            {projection.unsupportedFields.join(', ')}.
          </p>
        )}
      </footer>
    </section>
  )
}
