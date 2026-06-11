import { useState, useEffect, FormEvent } from 'react'
import { listProfiles, updateProfile, type Profile } from '../../lib/db/profiles'
import { listClients, type Client } from '../../lib/db/clients'

export default function UsersAdmin() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Profile | null>(null)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [profilesRes, clientsRes] = await Promise.all([listProfiles(), listClients()])
    if (profilesRes.error) setError(profilesRes.error.message)
    else setProfiles(profilesRes.data)
    if (clientsRes.error) setError(clientsRes.error.message)
    else setClients(clientsRes.data)
    setLoading(false)
  }

  async function handleSave(
    userId: string,
    updates: { role: Profile['role']; client_id: string | null; full_name: string }
  ): Promise<string | null> {
    const { error } = await updateProfile(userId, updates)
    if (error) return error.message
    setEditing(null)
    loadAll()
    return null
  }

  function clientName(clientId: string | null) {
    if (!clientId) return '—'
    return clients.find(c => c.id === clientId)?.name ?? clientId.slice(0, 8)
  }

  const roleLabel: Record<Profile['role'], string> = {
    admin: 'Admin',
    team: 'Team',
    client: 'Client',
  }

  const roleBadge: Record<Profile['role'], string> = {
    admin: 'bg-brand-accent/20 text-brand-accent',
    team: 'bg-blue-400/10 text-blue-400',
    client: 'bg-brand-muted text-brand-primary',
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Users</h1>
      </div>

      <p className="text-xs text-brand-primary mb-5">
        Users appear here after signing up. Assign roles and client links as needed.
      </p>

      {loading ? (
        <p className="text-brand-primary text-sm">Loading…</p>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : (
        <div className="bg-brand-surface border border-brand-muted rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-muted text-left">
                <th className="px-4 py-3 text-brand-primary font-medium">Name</th>
                <th className="px-4 py-3 text-brand-primary font-medium">Role</th>
                <th className="px-4 py-3 text-brand-primary font-medium">Client</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-brand-primary">
                    No users yet.
                  </td>
                </tr>
              ) : (
                profiles.map(p => (
                  <tr
                    key={p.id}
                    className="border-b border-brand-muted last:border-0 hover:bg-brand-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3 text-white">
                      {p.full_name ?? <span className="text-brand-primary italic">Unnamed</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge[p.role]}`}
                      >
                        {roleLabel[p.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-brand-primary">{clientName(p.client_id)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditing(p)}
                        className="text-xs text-brand-primary hover:text-brand-accent transition-colors"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <UserEditModal
          profile={editing}
          clients={clients}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

// ─── User edit modal ──────────────────────────────────────────────────────────

function UserEditModal({
  profile,
  clients,
  onSave,
  onClose,
}: {
  profile: Profile
  clients: Client[]
  onSave: (
    userId: string,
    updates: { role: Profile['role']; client_id: string | null; full_name: string }
  ) => Promise<string | null>
  onClose: () => void
}) {
  const [fullName, setFullName] = useState(profile.full_name ?? '')
  const [role, setRole] = useState<Profile['role']>(profile.role)
  const [clientId, setClientId] = useState<string>(profile.client_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const err = await onSave(profile.id, {
      full_name: fullName.trim() || profile.full_name ?? '',
      role,
      client_id: clientId || null,
    })
    setSaving(false)
    if (err) setError(err)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-brand-surface border border-brand-muted rounded-2xl p-6 w-full max-w-sm shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <h2 className="text-base font-semibold text-white mb-5">Edit user</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-accent mb-1.5">
              Full name
            </label>
            <input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              autoFocus
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent transition"
              placeholder="Full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-accent mb-1.5">Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as Profile['role'])}
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent transition"
            >
              <option value="client">Client</option>
              <option value="team">Team</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-accent mb-1.5">
              Client link
            </label>
            <select
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent transition"
            >
              <option value="">— None —</option>
              {clients.filter(c => c.active).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-brand-primary">Only set for client-role users.</p>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-brand-muted text-brand-primary py-2.5 rounded-lg text-sm hover:text-white hover:border-white/30 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-brand-accent text-brand-bg font-semibold py-2.5 rounded-lg text-sm hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
