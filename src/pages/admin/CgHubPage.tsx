import { useNavigate } from 'react-router-dom'

const ONE_DRIVE_URL = 'https://cgproductionhouse365-my.sharepoint.com/:f:/g/personal/info_cgproductionhouse_com/IgC0gAsW73aeQq8CjNUBdEfmAUK5IYEyo8z5crwYCYmKPh0?e=dJbeui'
const CG_HOURS_URL = 'https://cg-hours.vercel.app'

const launchItems = [
  { label: 'Planner', detail: 'Schedule and monthly content', to: '/admin/planner' },
  { label: 'Clients', detail: 'Reports, Meta, packages', to: '/admin/clients' },
  { label: 'Tasks', detail: 'Daily work list', to: '/admin/command-centre' },
  { label: 'Assistant', detail: 'Drafts and checks', to: '/admin/assistant' },
  { label: 'OneDrive', detail: 'Files and assets', href: ONE_DRIVE_URL },
  { label: 'CG Hours', detail: 'Time tracking', href: CG_HOURS_URL },
]

export default function CgHubPage() {
  const navigate = useNavigate()

  function open(item: typeof launchItems[number]) {
    if ('href' in item && item.href) {
      window.open(item.href, '_blank', 'noopener,noreferrer')
      return
    }
    if ('to' in item && item.to) navigate(item.to)
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-center px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-8">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[#f2b66f]">CG Production House</p>
        <h1 className="mt-3 font-display text-5xl font-black uppercase leading-none tracking-wide text-white sm:text-7xl">
          CG Hub
        </h1>
        <p className="mt-3 max-w-xl text-base text-brand-primary/78">
          Open the thing you need. No maze.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {launchItems.map(item => (
          <button
            key={item.label}
            type="button"
            onClick={() => open(item)}
            className="group min-h-32 rounded-xl border border-white/8 bg-white/[0.035] p-5 text-left transition-all hover:border-brand-accent/45 hover:bg-brand-accent/10"
          >
            <div className="flex h-full flex-col justify-between">
              <div>
                <h2 className="font-display text-2xl font-black uppercase tracking-wide text-white">
                  {item.label}
                </h2>
                <p className="mt-2 text-sm text-brand-primary/72">{item.detail}</p>
              </div>
              <span className="mt-5 text-sm font-bold text-[#f2b66f] group-hover:text-white">
                Open
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
