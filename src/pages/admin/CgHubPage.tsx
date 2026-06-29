import { Link } from 'react-router-dom'

const HUBS = [
  {
    title: 'CG Assistant',
    description: 'Role-aware operational help, drafts, and diagnostics.',
    to: '/admin/assistant',
    status: 'Live',
    accent: true,
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
  },
  {
    title: 'Tasks',
    description: 'Task management — coming soon.',
    to: '',
    status: 'Coming soon',
    accent: false,
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
  },
  {
    title: 'CG Hours',
    description: 'Time and hours tracking — coming soon.',
    to: '',
    status: 'Coming soon',
    accent: false,
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Approvals',
    description: 'Approval queues and workflows — coming soon.',
    to: '',
    status: 'Coming soon',
    accent: false,
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    title: 'Staff tools',
    description: 'Admin tools, invites, and team management — coming soon.',
    to: '',
    status: 'Coming soon',
    accent: false,
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M11.42 15.17l-5.37 5.37a2.25 2.25 0 11-3.18-3.18l5.37-5.37m7.16-4.17l-5.37 5.37m5.37-5.37a2.25 2.25 0 113.18 3.18l-5.37 5.37m-3.18-6.36a2.25 2.25 0 113.18-3.18l5.37 5.37" />
      </svg>
    ),
  },
]

export default function CgHubPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-xs font-black uppercase tracking-[0.26em] text-brand-accent">
          CG Hub
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
          Internal Tools
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-brand-primary">
          CG Assistant, tasks, staff tools, and operations.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {HUBS.map((hub) => {
          const isClickable = hub.to
          const content = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                  {hub.icon}
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                    hub.accent
                      ? 'border-brand-accent/30 bg-brand-accent/10 text-brand-accent'
                      : 'border-brand-muted bg-brand-muted/30 text-brand-primary'
                  }`}
                >
                  {hub.status}
                </span>
              </div>
              <h2 className="mt-4 text-base font-bold text-white">{hub.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-brand-primary">
                {hub.description}
              </p>
            </>
          )

          const cardClasses =
            'flex flex-col rounded-2xl border border-brand-muted bg-brand-surface p-5 transition-all duration-200 ' +
            (isClickable
              ? 'hover:border-brand-accent/30 hover:bg-white/[0.03] hover:-translate-y-0.5 group cursor-pointer'
              : 'opacity-70')

          return isClickable ? (
            <Link key={hub.title} to={hub.to} className={cardClasses}>
              {content}
            </Link>
          ) : (
            <div key={hub.title} className={cardClasses}>
              {content}
            </div>
          )
        })}
      </div>
    </div>
  )
}
