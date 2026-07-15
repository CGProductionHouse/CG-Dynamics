import { useSearchParams } from 'react-router-dom'
import UsersAdmin from './UsersAdmin'
import InvitesAdmin from './InvitesAdmin'

// Consolidated Users workspace: user accounts and invites in one place. Each tab
// renders the existing standalone page component. Both are admin-only (this hub
// is mounted under RequireAdmin).

type UsersTab = 'users' | 'invites'

export default function UsersHub() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: UsersTab = searchParams.get('tab') === 'invites' ? 'invites' : 'users'

  const tabs: { key: UsersTab; label: string }[] = [
    { key: 'users', label: 'Users' },
    { key: 'invites', label: 'Invites' },
  ]

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-5 rounded-2xl border border-white/10 bg-brand-surface/60 p-4 sm:p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-accent">Administration</p>
        <h1 className="mt-2 text-3xl font-black text-white">Team</h1>
        <p className="mt-1 text-sm text-brand-primary/65">Manage workforce access, client users and invitations.</p>
        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/20 p-1">
          {tabs.map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSearchParams({ tab: item.key })}
              className={`rounded-lg px-4 py-3 text-sm font-bold transition-colors ${
                tab === item.key
                  ? 'bg-brand-accent text-black'
                  : 'text-brand-primary hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'users' && <UsersAdmin embedded />}
      {tab === 'invites' && <InvitesAdmin embedded />}
    </div>
  )
}
