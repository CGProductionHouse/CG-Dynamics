const STEP_LABELS = ['Connect Meta', 'Link assets', 'Sync data', 'Review draft']

const steps = [
  {
    title: 'Connect Meta',
    explanation:
      'Authorise CG Dynamics to access your Facebook Business assets.',
    status: 'Not connected',
    statusColor: 'text-amber-400',
    note: 'OAuth connection will be added in the next phase.',
    content: (
      <button
        type="button"
        disabled
        className="cursor-not-allowed rounded-lg border border-brand-muted bg-brand-muted/20 px-5 py-2.5 text-sm font-semibold text-brand-primary"
      >
        Connect Meta
      </button>
    ),
  },
  {
    title: 'Link assets to clients',
    explanation:
      'Choose which Facebook Page, Instagram account and ad account belong to each CG client.',
    status: 'Waiting for Meta connection',
    statusColor: 'text-brand-primary',
    content: (
      <div className="space-y-3">
        {['CG Client', 'Facebook Page', 'Instagram Account', 'Ad Account'].map(
          field => (
            <div
              key={field}
              className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4"
            >
              <span className="w-32 text-sm text-brand-primary">{field}</span>
              <input
                type="text"
                disabled
                className="flex-1 rounded-lg border border-brand-muted bg-brand-bg/50 px-3 py-2 text-sm text-brand-primary placeholder-brand-primary/30"
                placeholder="Waiting for connection…"
              />
            </div>
          ),
        )}
      </div>
    ),
  },
  {
    title: 'Sync report data',
    explanation:
      'Pull monthly performance data and create or update a report draft.',
    status: 'Waiting for linked assets',
    statusColor: 'text-brand-primary',
    content: (
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-lg border border-brand-muted bg-brand-muted/20 px-5 py-2.5 text-sm font-semibold text-brand-primary"
        >
          Sync previous completed month
        </button>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-lg border border-brand-muted bg-brand-muted/20 px-5 py-2.5 text-sm font-semibold text-brand-primary"
        >
          Sync current month as internal draft
        </button>
      </div>
    ),
  },
  {
    title: 'Review monthly draft',
    explanation:
      'After sync, CG Dynamics will create or update a monthly report draft. Staff can add strategy, preview as client, and publish.',
    status: null,
    statusColor: null,
    content: null,
  },
]

export default function MetaIntegrationPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.22em] text-brand-primary">
          Integrations
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          Meta Business Sync
        </h1>
        <p className="mt-1 text-sm text-brand-primary">
          Connect Facebook and Instagram assets so reports can be built without
          CSV exports.
        </p>
      </div>

      {/* Horizontal step indicator */}
      <div className="mt-6 inline-flex items-center overflow-hidden rounded-xl border border-brand-muted bg-brand-surface">
        {STEP_LABELS.map((label, i) => (
          <div
            key={label}
            className={`flex items-center gap-2 px-4 py-3 ${
              i < STEP_LABELS.length - 1
                ? 'border-r border-brand-muted'
                : ''
            }`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">
              {i + 1}
            </span>
            <span className="whitespace-nowrap text-sm text-white">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Step detail cards */}
      <div className="mt-6 space-y-4 max-w-2xl">
        {steps.map((step, i) => (
          <div
            key={step.title}
            className="rounded-xl border border-brand-muted bg-brand-surface"
          >
            <div className="p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">
                    {i + 1}
                  </span>
                  <h2 className="text-sm font-semibold text-white">
                    {step.title}
                  </h2>
                </div>
                {step.status && (
                  <span
                    className={`shrink-0 text-xs font-medium ${step.statusColor}`}
                  >
                    {step.status}
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-brand-primary">
                {step.explanation}
              </p>
              {step.content && <div className="mt-4">{step.content}</div>}
              {step.note && (
                <p className="mt-3 text-xs text-brand-primary/50">
                  {step.note}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Architecture note */}
      <div className="mt-10 max-w-2xl rounded-xl border border-brand-muted bg-brand-surface/30 p-5">
        <h3 className="text-xs uppercase tracking-[0.15em] text-brand-primary/60">
          Planned safe setup
        </h3>
        <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-brand-primary/70">
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary/50">
            Meta tokens will never be stored in the frontend.
          </li>
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary/50">
            OAuth and API calls will run through Supabase Edge Functions.
          </li>
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary/50">
            Synced data will create or update draft reports only.
          </li>
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary/50">
            Reports will never auto-publish.
          </li>
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary/50">
            Current month data stays as internal draft until month-end.
          </li>
        </ul>
      </div>
    </div>
  )
}
