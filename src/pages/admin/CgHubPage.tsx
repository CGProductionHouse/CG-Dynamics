import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { PremiumCard } from '../../components/ui/PremiumCard'
import { ActionButton } from '../../components/ui/Buttons'
import { Pill } from '../../components/ui/Badges'

interface HubCard {
  title: string
  description: string
  to: string | null
  external?: boolean
  status: 'Live' | 'Live external app' | 'Planned' | 'Phase 1'
  icon: ReactNode
  buttonLabel: string
}

const CARDS: HubCard[] = [
  {
    title: 'CG Assistant',
    description: 'Ask for operational help, drafts, checklists and setup support.',
    to: '/admin/assistant',
    status: 'Live',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
    buttonLabel: 'Open Assistant',
  },
  {
    title: 'CG Hours',
    description: 'Open the CG Hours system for staff time tracking and work-hour management.',
    to: 'https://cg-hours.vercel.app',
    external: true,
    status: 'Live external app',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    buttonLabel: 'Open CG Hours',
  },
  {
    title: 'Task Manager',
    description: 'CG Command Centre — daily tasks, client requests and team progress.',
    to: '/admin/command-centre',
    status: 'Phase 1',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
    buttonLabel: 'Open Command Centre',
  },
  {
    title: 'Approvals',
    description: 'Future client and staff approval workflows.',
    to: null,
    status: 'Planned',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    buttonLabel: 'Coming soon',
  },
  {
    title: 'Staff Tools',
    description: 'Internal resources, links, SOPs and operational tools.',
    to: null,
    status: 'Planned',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M11.42 15.17l-5.37 5.37a2.25 2.25 0 11-3.18-3.18l5.37-5.37m7.16-4.17l-5.37 5.37m5.37-5.37a2.25 2.25 0 113.18 3.18l-5.37 5.37m-3.18-6.36a2.25 2.25 0 113.18-3.18l5.37 5.37" />
      </svg>
    ),
    buttonLabel: 'Coming soon',
  },
]

function pillTone(status: HubCard['status']) {
  return status === 'Planned' ? 'neutral' as const : 'accent' as const
}


export default function CgHubPage() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-xs font-black uppercase tracking-[0.26em] text-brand-accent">
          CG Hub
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
          CG Hub
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-brand-primary">
          Internal tools for the team, workflows, hours, tasks and assistant support.
        </p>
      </div>

      <PremiumCard padding="sm" className="mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-primary">
          Quick Actions
        </p>
        <div className="flex flex-wrap gap-2">
          <ActionButton variant="primary" size="sm" onClick={() => navigate('/admin/assistant')}>
            Open CG Assistant
          </ActionButton>
          <ActionButton variant="outline" size="sm" onClick={() => window.open('https://cg-hours.vercel.app', '_blank', 'noopener,noreferrer')}>
            Open CG Hours
          </ActionButton>
          <ActionButton variant="ghost" size="sm" onClick={() => navigate('/admin')}>
            Back to Home
          </ActionButton>
          <ActionButton variant="ghost" size="sm" onClick={() => navigate('/admin/client-performance')}>
            Client Performance
          </ActionButton>
        </div>
      </PremiumCard>

      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map(card => (
          <PremiumCard key={card.title} padding="md">
            <div className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                  {card.icon}
                </div>
                <Pill tone={pillTone(card.status)}>{card.status}</Pill>
              </div>
              <h2 className="mt-4 text-base font-bold text-white">{card.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-brand-primary">
                {card.description}
              </p>
              <div className="mt-auto pt-5">
                {card.to ? (
                  card.external ? (
                    <a
                      href={card.to}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-brand-accent bg-brand-accent/10 px-4 py-2.5 text-sm font-semibold text-brand-accent transition-all hover:bg-brand-accent/20"
                    >
                      {card.buttonLabel}
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </a>
                  ) : (
                    <ActionButton variant="outline" onClick={() => navigate(card.to!)} fullWidth>
                      {card.buttonLabel}
                    </ActionButton>
                  )
                ) : (
                  <ActionButton variant="secondary" disabled fullWidth>
                    {card.buttonLabel}
                  </ActionButton>
                )}
              </div>
            </div>
          </PremiumCard>
        ))}
      </div>
    </div>
  )
}
