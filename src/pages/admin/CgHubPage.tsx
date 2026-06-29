import { useNavigate } from 'react-router-dom'

const CG_HOURS_URL = 'https://cg-hours.vercel.app'

const ONE_DRIVE_LINKS = [
  {
    label: 'CG OneDrive',
    detail: 'Internal files and assets',
    href: 'https://cgproductionhouse365-my.sharepoint.com/:f:/g/personal/info_cgproductionhouse_com/IgC0gAsW73aeQq8CjNUBdEfmAUK5IYEyo8z5crwYCYmKPh0?e=dJbeui',
  },
  {
    label: 'Client OneDrive',
    detail: 'Client-shared folders',
    href: '', // TODO: add Client OneDrive URL
  },
  {
    label: 'Once-Off OneDrive',
    detail: 'Once-off project files',
    href: '', // TODO: add Once-Off OneDrive URL
  },
]

const launchItems = [
  { label: 'Planner', detail: 'Schedule and monthly content', to: '/admin/planner' },
  { label: 'Daily Tasks', detail: 'Your work list for today', to: '/admin/command-centre' },
  { label: 'Clients', detail: 'Reports, Meta, packages', to: '/admin/clients' },
  { label: 'Assistant', detail: 'Drafts and checks', to: '/admin/assistant' },
]

export default function CgHubPage() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-8">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[#f2b66f]">CG Production House</p>
        <h1 className="mt-3 font-display text-5xl font-black uppercase leading-none tracking-wide text-white sm:text-7xl">
          CG Hub
        </h1>
        <p className="mt-3 text-base text-brand-primary/78">Internal staff workspace.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-10">
        {launchItems.map(item => (
          <button
            key={item.label}
            type="button"
            onClick={() => navigate(item.to)}
            className="group min-h-28 rounded-xl border border-white/8 bg-white/[0.035] p-5 text-left transition-all hover:border-brand-teal/30 hover:bg-brand-teal/[0.06]"
          >
            <div className="flex h-full flex-col justify-between">
              <h2 className="font-display text-xl font-black uppercase tracking-wide text-white">
                {item.label}
              </h2>
              <div>
                <p className="mt-2 text-sm text-brand-primary/72">{item.detail}</p>
                <span className="mt-3 block text-sm font-bold text-[#f2b66f] group-hover:text-white">
                  Open →
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mb-6">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="font-display text-2xl font-black uppercase tracking-wide text-white">OneDrive</h2>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {ONE_DRIVE_LINKS.map(link => (
            link.href ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col justify-between rounded-xl border border-white/10 bg-white/[0.03] p-5 transition-all hover:border-brand-teal/35 hover:bg-brand-teal/[0.05]"
              >
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-teal/70">OneDrive</p>
                  <h3 className="mt-1.5 font-display text-lg font-black uppercase tracking-wide text-white">
                    {link.label}
                  </h3>
                  <p className="mt-1 text-sm text-brand-primary/65">{link.detail}</p>
                </div>
                <span className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-brand-teal/30 bg-brand-teal/[0.08] px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-brand-teal transition-colors group-hover:border-brand-teal/60 group-hover:bg-brand-teal/[0.14] group-hover:text-white">
                  Open in OneDrive
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </span>
              </a>
            ) : (
              <div
                key={link.label}
                className="flex flex-col justify-between rounded-xl border border-white/[0.06] bg-white/[0.015] p-5 opacity-60"
              >
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-primary/40">OneDrive</p>
                  <h3 className="mt-1.5 font-display text-lg font-black uppercase tracking-wide text-white/60">
                    {link.label}
                  </h3>
                  <p className="mt-1 text-sm text-brand-primary/45">{link.detail}</p>
                </div>
                <span className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-brand-primary/40">
                  Link not configured
                </span>
              </div>
            )
          ))}
        </div>
      </div>

      <div className="border-t border-white/10 pt-6">
        <div className="flex items-center gap-3">
          <a
            href={CG_HOURS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-4 py-2.5 text-sm font-bold text-brand-primary transition-all hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
          >
            <span>CG Hours</span>
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-brand-primary/70 group-hover:text-white">
              External
            </span>
            <svg className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  )
}
