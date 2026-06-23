const steps = [
  {
    title: 'Connect Meta Business',
    status: 'Not connected',
    statusColor: 'text-yellow-400',
    note: 'OAuth connection will be added in the next phase.',
    content: (
      <button
        type="button"
        disabled
        className="rounded-lg border border-brand-muted bg-brand-muted/20 px-4 py-2 text-sm font-semibold text-brand-primary cursor-not-allowed"
      >
        Connect Meta
      </button>
    ),
  },
  {
    title: 'Link assets to clients',
    status: 'Waiting for Meta connection',
    statusColor: 'text-brand-primary',
    content: (
      <div className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <span className="w-32 text-sm text-brand-primary">CG Client</span>
          <input
            type="text"
            disabled
            className="flex-1 rounded-lg border border-brand-muted bg-brand-muted/10 px-3 py-2 text-sm text-brand-primary placeholder-brand-primary/40"
            placeholder="Waiting for connection…"
          />
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <span className="w-32 text-sm text-brand-primary">Facebook Page</span>
          <input
            type="text"
            disabled
            className="flex-1 rounded-lg border border-brand-muted bg-brand-muted/10 px-3 py-2 text-sm text-brand-primary placeholder-brand-primary/40"
            placeholder="Waiting for connection…"
          />
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <span className="w-32 text-sm text-brand-primary">Instagram Account</span>
          <input
            type="text"
            disabled
            className="flex-1 rounded-lg border border-brand-muted bg-brand-muted/10 px-3 py-2 text-sm text-brand-primary placeholder-brand-primary/40"
            placeholder="Waiting for connection…"
          />
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <span className="w-32 text-sm text-brand-primary">Ad Account</span>
          <input
            type="text"
            disabled
            className="flex-1 rounded-lg border border-brand-muted bg-brand-muted/10 px-3 py-2 text-sm text-brand-primary placeholder-brand-primary/40"
            placeholder="Waiting for connection…"
          />
        </div>
      </div>
    ),
  },
  {
    title: 'Sync reporting data',
    status: 'Waiting for linked assets',
    statusColor: 'text-brand-primary',
    content: (
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled
          className="rounded-lg border border-brand-muted bg-brand-muted/20 px-4 py-2 text-sm font-semibold text-brand-primary cursor-not-allowed"
        >
          Sync previous completed month
        </button>
        <button
          type="button"
          disabled
          className="rounded-lg border border-brand-muted bg-brand-muted/20 px-4 py-2 text-sm font-semibold text-brand-primary cursor-not-allowed"
        >
          Sync current month as internal draft
        </button>
      </div>
    ),
  },
  {
    title: 'Review report draft',
    status: null,
    statusColor: null,
    content: (
      <p className="text-sm leading-relaxed text-brand-primary">
        After sync, CG Dynamics will create or update a monthly report draft. Staff can add strategy,
        preview as client, and publish.
      </p>
    ),
  },
]

export default function MetaIntegrationPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.22em] text-brand-primary">Integrations</p>
        <h1 className="mt-2 text-xl font-semibold text-white">Meta Business Sync</h1>
        <p className="mt-1 text-sm text-brand-primary">
          Connect Meta assets to CG Dynamics so reports can be built without CSV exports.
        </p>
      </div>

      <div className="mt-8 space-y-6 max-w-2xl">
        {steps.map((step, i) => (
          <div
            key={step.title}
            className="rounded-xl border border-brand-muted bg-brand-surface p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">
                <span className="mr-1.5 text-brand-primary">Step {i + 1}.</span>
                {step.title}
              </h2>
              {step.status && (
                <span className={`shrink-0 text-xs font-medium ${step.statusColor}`}>
                  {step.status}
                </span>
              )}
            </div>
            <div className="mt-4">{step.content}</div>
            {step.note && (
              <p className="mt-3 text-xs text-brand-primary/60">{step.note}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-10 max-w-2xl rounded-xl border border-brand-muted bg-brand-surface/40 p-5">
        <h3 className="text-xs uppercase tracking-[0.22em] text-brand-primary">
          Architecture note
        </h3>
        <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-brand-primary">
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary">
            Meta tokens will never be stored in the frontend.
          </li>
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary">
            OAuth and API calls will run through Supabase Edge Functions.
          </li>
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary">
            Synced data will create or update draft reports only.
          </li>
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary">
            Reports will never auto-publish.
          </li>
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary">
            Current month data will stay as an internal draft until month-end.
          </li>
        </ul>
      </div>
    </div>
  )
}
