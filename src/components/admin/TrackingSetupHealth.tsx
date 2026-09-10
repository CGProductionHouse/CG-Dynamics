// TrackingSetupHealth.tsx — staff-facing, read-only Ads↔GA4 setup health (#335).
//
// Shows the smallest exact requirement when provider configuration is missing. It renders state
// only; it never offers an action that would change a Google Ads or GA4 setting, because every such
// change is a CA-controlled gate.

import type { TrackingSetupHealth as Health } from '../../lib/trackingSetupHealth'

const TONE: Record<string, string> = {
  ready: 'border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-300',
  attention: 'border-amber-400/25 bg-amber-400/[0.07] text-amber-300',
  'not-ready': 'border-rose-400/25 bg-rose-400/[0.07] text-rose-300',
  unknown: 'border-white/15 bg-white/[0.04] text-slate-300',
}

const READINESS_LABEL: Record<string, string> = {
  ready: 'Ready',
  attention: 'Needs attention',
  'not-ready': 'Not ready',
  unknown: 'Unknown',
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-white/[0.06] py-2 last:border-b-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  )
}

export function TrackingSetupHealthPanel({ health }: { health: Health | null }) {
  if (!health) {
    return (
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
        <h3 className="text-base font-semibold text-white">Website tracking setup</h3>
        <p className="mt-2 text-sm text-slate-400">Select a client to check tracking setup.</p>
      </section>
    )
  }

  const { observation, report, schemaNote } = health

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-white">Website tracking setup</h3>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${TONE[report.readiness] ?? TONE.unknown}`}>
          {READINESS_LABEL[report.readiness] ?? 'Unknown'}
        </span>
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        Read-only. Nothing on this panel changes a Google Ads or Analytics setting.
      </p>

      {schemaNote && (
        <p className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-slate-400">
          {schemaNote}
        </p>
      )}

      <div className="mt-4">
        <Row
          label="GA4 property"
          value={observation.ga4PropertyId ? `Mapped (${observation.ga4PropertyId})` : 'Not mapped'}
        />
        <Row label="Website domain" value={observation.websiteDomain ?? 'Not recorded'} />
        <Row
          label="CTA events configured"
          value={observation.ctaDefinitionCount === null ? 'Unavailable' : String(observation.ctaDefinitionCount)}
        />
        <Row label="Auto-tagging / GCLID" value="Not read (requires a Google Ads API call)" />
        <Row label="Final URL suffix" value="Not read (requires a Google Ads API call)" />
      </div>

      {report.findings.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {report.findings.map((finding, index) => (
            <li key={index} className="text-xs leading-5 text-slate-400">
              <span className="font-semibold uppercase tracking-[0.1em] text-slate-500">{finding.severity}</span>
              {' — '}{finding.message}
            </li>
          ))}
        </ul>
      )}

      {report.requiredGatedChanges.length > 0 && (
        <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Requires CA approval
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
            {report.requiredGatedChanges.map((change, index) => <li key={index}>{change}</li>)}
          </ul>
        </div>
      )}
    </section>
  )
}
