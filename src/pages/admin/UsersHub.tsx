import { useState } from 'react'
import UsersAdmin from './UsersAdmin'
import InvitesAdmin from './InvitesAdmin'

// Consolidated Users workspace: user accounts and invites in one place. Each tab
// renders the existing standalone page component. Both are admin-only (this hub
// is mounted under RequireAdmin).

type UsersTab = 'users' | 'invites'

export default function UsersHub() {
  const [tab, setTab] = useState<UsersTab>('users')

  const tabs: { key: UsersTab; label: string }[] = [
    { key: 'users', label: 'Users' },
    { key: 'invites', label: 'Invites' },
  ]

  return (
    <div>
      <div className="border-b border-brand-muted bg-brand-surface/60 px-4 pt-4 sm:px-6 lg:px-8">
        <p className="text-xs uppercase tracking-[0.22em] text-brand-primary">Users</p>
        <h1 className="mt-2 mb-4 text-xl font-semibold text-white">Users &amp; access</h1>
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === item.key
                  ? 'bg-brand-bg text-brand-accent border border-brand-muted border-b-transparent'
                  : 'text-brand-primary hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'users' && <UsersAdmin />}
      {tab === 'invites' && <InvitesAdmin />}
    </div>
  )
}
