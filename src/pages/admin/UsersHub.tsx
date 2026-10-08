import { useSearchParams } from 'react-router-dom'
import UsersAdmin from './UsersAdmin'
import InvitesAdmin from './InvitesAdmin'
import ClientAccessAdmin from './ClientAccessAdmin'
import { PageContainer } from '../../components/layout/PageShell'

// Consolidated Users workspace: user accounts and invites in one place. Each tab
// renders the existing standalone page component. Both are admin-only (this hub
// is mounted under RequireAdmin).

type UsersTab = 'users' | 'invites' | 'client-access'

export default function UsersHub() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const tab: UsersTab = requestedTab === 'invites' || requestedTab === 'client-access' ? requestedTab : 'users'

  const tabs: { key: UsersTab; label: string }[] = [
    { key: 'users', label: 'Users' },
    { key: 'invites', label: 'Invites' },
    { key: 'client-access', label: 'Client Access' },
  ]

  return (
    <PageContainer width="content" gap={false}>
      <div className="mb-4 border-b border-white/10 pb-3">
        <h1 className="text-3xl font-bold tracking-tight text-white">Users</h1>
        <p className="mt-1 text-sm text-brand-primary/65">Team access, client logins and invitations.</p>
        <div className="mt-4 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.025] p-1" aria-label="User management area">
          {tabs.map(item => (
            <button
              key={item.key}
              type="button"
              aria-pressed={tab === item.key}
              onClick={() => setSearchParams({ tab: item.key })}
              className={`min-h-10 flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors sm:flex-none ${
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
      {tab === 'client-access' && <ClientAccessAdmin />}
    </PageContainer>
  )
}
