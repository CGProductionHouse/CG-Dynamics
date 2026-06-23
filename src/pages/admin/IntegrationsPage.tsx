import { useNavigate } from 'react-router-dom'

const integrations = [
  {
    title: 'Meta Business',
    status: 'Not connected',
    statusColor: 'text-yellow-400',
    description:
      'Connect Facebook Pages and Instagram accounts to create monthly report drafts automatically.',
    buttonLabel: 'Set up Meta',
    buttonTo: '/admin/integrations/meta',
    disabled: false,
  },
  {
    title: 'TikTok',
    status: 'Planned',
    statusColor: 'text-brand-primary',
    description:
      'TikTok reporting sync will be added later.',
    buttonLabel: 'Coming later',
    disabled: true,
  },
  {
    title: 'Google Ads',
    status: 'Planned',
    statusColor: 'text-brand-primary',
    description:
      'Google Ads and campaign reporting will be added later.',
    buttonLabel: 'Coming later',
    disabled: true,
  },
]

export default function IntegrationsPage() {
  const navigate = useNavigate()

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.22em] text-brand-primary">Integrations</p>
        <h1 className="mt-2 text-xl font-semibold text-white">Integrations</h1>
        <p className="mt-1 text-sm text-brand-primary">
          Connect external platforms to reduce manual reporting work.
        </p>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map(item => (
          <div
            key={item.title}
            className="flex flex-col rounded-xl border border-brand-muted bg-brand-surface p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-white">{item.title}</h2>
              <span className={`shrink-0 text-xs font-medium ${item.statusColor}`}>
                {item.status}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-brand-primary">
              {item.description}
            </p>
            <div className="mt-auto pt-5">
              <button
                type="button"
                onClick={() => {
                  if (!item.disabled && item.buttonTo) navigate(item.buttonTo)
                }}
                disabled={item.disabled}
                className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  item.disabled
                    ? 'cursor-not-allowed border border-brand-muted bg-brand-muted/20 text-brand-primary'
                    : 'border border-brand-accent bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/20'
                }`}
              >
                {item.buttonLabel}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
