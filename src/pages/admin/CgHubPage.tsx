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
    title: 'CG Planner',
    description: 'Boards, package schedules, milestone tracking and approval workflows.',
    to: '/admin/planner',
    status: 'Live',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192" />
      </svg>
    ),
    buttonLabel: 'Open Planner',
  },
  {
    title: 'Package Master',
    description: 'Set up client packages, deliverables and monthly templates.',
    to: '/admin/package-master',
    status: 'Live',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
    buttonLabel: 'Open Package Master',
  },
  {
    title: 'Monthly Planner',
    description: 'Track monthly package deliverables, totals and progress.',
    to: '/admin/monthly-planner',
    status: 'Live',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5m-15 12h13.5A1.5 1.5 0 0020.25 18.75V7.5A1.5 1.5 0 0018.75 6H5.25A1.5 1.5 0 003.75 7.5v11.25A1.5 1.5 0 005.25 20.25z" />
      </svg>
    ),
    buttonLabel: 'Open Monthly Planner',
  },
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
    title: 'Command Centre',
    description: 'Daily tasks, client requests and team progress.',
    to: '/admin/command-centre',
    status: 'Live',
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
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-accent/80">
          CG Hub
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
          CG Hub
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-brand-primary/70">
          Internal tools for the team, workflows, hours, tasks and assistant support.
        </p>
        <div className="mt-6 h-px bg-gradient-to-r from-brand-accent/30 via-brand-accent/10 to-transparent" />
      </div>

      <PremiumCard padding="sm" className="mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-primary/70">
          Quick Actions
        </p>
        <div className="flex flex-wrap gap-2">
          <ActionButton variant="primary" size="sm" onClick={() => navigate('/admin/planner')}>
            Open Planner
          </ActionButton>
          <ActionButton variant="outline" size="sm" onClick={() => navigate('/admin/monthly-planner')}>
            Monthly Planner
          </ActionButton>
          <ActionButton variant="outline" size="sm" onClick={() => navigate('/admin/assistant')}>
            CG Assistant
          </ActionButton>
          <ActionButton variant="ghost" size="sm" onClick={() => navigate('/admin/command-centre')}>
            Command Centre
          </ActionButton>
          <ActionButton variant="ghost" size="sm" onClick={() => window.open('https://cg-hours.vercel.app', '_blank', 'noopener,noreferrer')}>
            CG Hours
          </ActionButton>
        </div>
      </PremiumCard>

      <PremiumCard padding="sm" className="mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-primary/70">
          OneDrive Resources
        </p>
        <div className="flex flex-col gap-2">
          <a
            href="https://cgproductionhouse365-my.sharepoint.com/:f:/g/personal/info_cgproductionhouse_com/IgC0gAsW73aeQq8CjNUBdEfmAUK5IYEyo8z5crwYCYmKPh0?e=dJbeui"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-lg border border-brand-muted/40 px-3.5 py-2.5 text-sm text-brand-primary transition-colors hover:text-white hover:border-brand-accent/30"
          >
            <svg className="h-4 w-4 shrink-0 text-brand-accent/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
            </svg>
            <span>CG OneDrive</span>
          </a>
          <a
            href="https://1drv.ms/f/c/a2ac9fe4b255f52f/IgAv9VWy5J-sIICibQAAAAAAAXsqhpnxBLjESAlwfFtYXMU?e=CrP1U9"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-lg border border-brand-muted/40 px-3.5 py-2.5 text-sm text-brand-primary transition-colors hover:text-white hover:border-brand-accent/30"
          >
            <svg className="h-4 w-4 shrink-0 text-brand-accent/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            <span>Client OneDrive</span>
          </a>
          <a
            href="https://1drv.ms/f/c/a2ac9fe4b255f52f/IgDJNIFpROWtQ48o2oS4u2TJAY7XcLW0gmxEomsaK2CWt_c?e=XqGVzu"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-lg border border-brand-muted/40 px-3.5 py-2.5 text-sm text-brand-primary transition-colors hover:text-white hover:border-brand-accent/30"
          >
            <svg className="h-4 w-4 shrink-0 text-brand-accent/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <span>Once-Off OneDrive</span>
          </a>
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
