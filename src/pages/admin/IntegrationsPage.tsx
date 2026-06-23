import { useNavigate } from 'react-router-dom'

const platforms = [
  {
    id: 'meta',
    initial: 'M',
    accent: 'bg-sky-500/20 text-sky-300',
    title: 'Meta Business',
    status: 'Not connected',
    statusClass: 'text-amber-400',
    description:
      'Connect Facebook Pages and Instagram accounts to create monthly report drafts automatically.',
    buttonLabel: 'Set up Meta',
    to: '/admin/integrations/meta',
    disabled: false,
  },
  {
    id: 'tiktok',
    initial: 'T',
    accent: 'bg-brand-muted text-brand-primary',
    title: 'TikTok',
    status: 'Planned',
    statusClass: 'text-brand-primary',
    description: 'TikTok reporting sync will be added later.',
    buttonLabel: 'Coming later',
    to: null,
    disabled: true,
  },
  {
    id: 'google',
    initial: 'G',
    accent: 'bg-brand-muted text-brand-primary',
    title: 'Google Ads',
    status: 'Planned',
    statusClass: 'text-brand-primary',
    description: 'Google Ads and campaign reporting will be added later.',
    buttonLabel: 'Coming later',
    to: null,
    disabled: true,
  },
]

export default function IntegrationsPage() {
  const navigate = useNavigate()

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.22em] text-brand-primary">Integrations</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Integrations</h1>
        <p className="mt-1 text-sm text-brand-primary">
          Connect platforms to reduce manual reporting work.
        </p>
      </div>

      <div className="mt-6 max-w-3xl rounded-xl border border-brand-muted bg-gradient-to-r from-brand-surface to-brand-bg p-5">
        <p className="text-sm leading-relaxed text-brand-primary">
          <span className="font-medium text-white">Start with Meta.</span> Facebook and Instagram sync
          will reduce CSV exports and create monthly report drafts automatically.
        </p>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {platforms.map(p => (
          <div
            key={p.id}
            className="group relative flex flex-col rounded-xl border border-brand-muted bg-brand-surface"
          >
            {!p.disabled && (
              <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-xl bg-gradient-to-r from-brand-accent to-sky-400" />
            )}
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${p.accent}`}
                >
                  {p.initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-white">{p.title}</h2>
                    <span className={`shrink-0 text-xs font-medium ${p.statusClass}`}>
                      {p.status}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-brand-primary">
                    {p.description}
                  </p>
                </div>
              </div>
              <div className="mt-auto pt-5">
                <button
                  type="button"
                  onClick={() => { if (!p.disabled && p.to) navigate(p.to) }}
                  disabled={p.disabled}
                  className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                    p.disabled
                      ? 'cursor-not-allowed border border-brand-muted bg-brand-muted/20 text-brand-primary'
                      : 'border border-brand-accent bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/20 hover:shadow-[0_0_12px_-4px] hover:shadow-brand-accent/30'
                  }`}
                >
                  {p.buttonLabel}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
