import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import ImportMetaCsv from './ImportMetaCsv'
import ManualMetricsAdmin from './ManualMetricsAdmin'
import ImportsManagement from './ImportsManagement'

// Consolidated Import workspace: CSV import, manual summaries and import history
// in one place. Each tab renders the existing standalone page component, so the
// underlying behaviour and role handling are unchanged. The CSV import tab is
// admin-only (it writes); manual summaries and history are visible to all staff
// read-only via their own internal role checks.

type ImportTab = 'csv' | 'manual' | 'history'

export default function ImportHub() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const tabs: { key: ImportTab; label: string; adminOnly?: boolean }[] = [
    { key: 'csv', label: 'Import CSV', adminOnly: true },
    { key: 'manual', label: 'Manual summaries' },
    { key: 'history', label: 'Import history' },
  ].filter(tab => !tab.adminOnly || isAdmin) as { key: ImportTab; label: string; adminOnly?: boolean }[]

  const [tab, setTab] = useState<ImportTab>(isAdmin ? 'csv' : 'manual')

  return (
    <div>
      <div className="border-b border-brand-muted bg-brand-surface/60 px-4 pt-4 sm:px-6 lg:px-8">
        <p className="text-xs uppercase tracking-[0.22em] text-brand-primary">Import</p>
        <h1 className="mt-2 mb-4 text-xl font-semibold text-white">Import &amp; data</h1>
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

      {tab === 'csv' && isAdmin && <ImportMetaCsv />}
      {tab === 'manual' && <ManualMetricsAdmin />}
      {tab === 'history' && <ImportsManagement />}
    </div>
  )
}
