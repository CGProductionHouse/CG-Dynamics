import { useState, useEffect, useMemo } from 'react'
import type { FormEvent } from 'react'
import { listProfiles, updateProfile, type Profile } from '../../lib/db/profiles'
import { listClients, type Client } from '../../lib/db/clients'
import { roleLabel } from '../../lib/roles'

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return fallback
}

// A user is "pending setup" when they are a client with no linked client
// record yet — exactly what an admin needs to act on.
function isPending(profile: Profile) {
  return profile.role === 'client' && !profile.client_id
}

export default function UsersAdmin({ embedded = false }: { embedded?: boolean }) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Profile | null>(null)

  // Pending/unlinked users float to the top; otherwise newest first.
  const sortedProfiles = useMemo(() => {
    return [...profiles].sort((a, b) => {
      const pendingDiff = Number(isPending(b)) - Number(isPending(a))
      if (pendingDiff !== 0) return pendingDiff
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [profiles])

  const pendingCount = useMemo(() => profiles.filter(isPending).length, [profiles])

  async function loadAll(options: { silent?: boolean } = {}): Promise<string | null> {
    if (!options.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const [profilesRes, clientsRes] = await Promise.all([listProfiles(), listClients()])
      const loadError = profilesRes.error ?? clientsRes.error
      if (loadError) {
        const message = loadError.message
        setError(message)
        return message
      }
      setProfiles(profilesRes.data)
      setClients(clientsRes.data)
      setError(null)
      return null
    } catch (error) {
      const message = errorMessage(error, 'Could not load users.')
      setError(message)
      return message
    } finally {
      if (!options.silent) setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAll() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  async function handleSave(
    userId: string,
    updates: { role: Profile['role']; client_id: string | null; full_name: string | null }
  ): Promise<string | null> {
    try {
      const { data, error } = await updateProfile(userId, updates)
      if (error) return error.message
      if (data) {
        setProfiles(current => current.map(profile => profile.id === data.id ? data : profile))
      }

      void loadAll({ silent: true }).then(refreshError => {
        if (refreshError) {
          setError(`Saved, but could not refresh the users list: ${refreshError}`)
        }
      })
      return null
    } catch (error) {
      return errorMessage(error, 'Could not save user.')
    }
  }

  function clientName(clientId: string | null) {
    if (!clientId) return '-'
    return clients.find(c => c.id === clientId)?.name ?? clientId.slice(0, 8)
  }

  const roleBadge: Record<Profile['role'], string> = {
    admin: 'bg-brand-accent/20 text-brand-accent',
    manager: 'bg-cyan-400/10 text-cyan-300',
    staff: 'bg-blue-400/10 text-blue-300',
    team: 'bg-blue-400/10 text-blue-400',
    client: 'bg-brand-muted text-brand-primary',
  }

  return (
    <div className={embedded ? 'w-full' : 'w-full max-w-5xl p-4 sm:p-6 lg:p-8'}>
      <div className="mb-6 flex items-center justify-between">
        {!embedded && <h1 className="text-xl font-semibold text-white">Users</h1>}
        {embedded && <h2 className="text-xl font-semibold text-white">Users</h2>}
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
            {pendingCount} pending setup
          </span>
        )}
      </div>

      <p className="text-xs text-brand-primary mb-5">
        Users appear here after accepting an admin invitation. Assign roles and link clients as
        needed. Pending users with no linked client are highlighted and sorted to the top.
      </p>

      {loading ? (
        <p className="text-brand-primary text-sm">Loading...</p>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {sortedProfiles.length === 0 ? (
              <div className="rounded-xl border border-brand-muted bg-brand-surface px-4 py-8 text-center text-sm text-brand-primary">
                No users yet.
              </div>
            ) : (
              sortedProfiles.map(p => {
                const pending = isPending(p)
                return (
                  <article
                    key={p.id}
                    className={`rounded-xl border bg-brand-surface p-4 ${
                      pending ? 'border-amber-400/40' : 'border-brand-muted'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold text-white break-words">
                          {p.full_name ?? <span className="text-brand-primary italic">Unnamed</span>}
                        </h2>
                        <p className="mt-0.5 text-sm text-brand-primary break-all">{p.email ?? 'No email'}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${roleBadge[p.role]}`}>
                            {roleLabel(p.role)}
                          </span>
                          <StatusBadge pending={pending} />
                          <span className="text-sm text-brand-primary break-all">
                            {p.role === 'client' ? clientName(p.client_id) : 'All clients'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setEditing(p)}
                        className={`shrink-0 rounded-lg border px-3 py-2 text-sm ${
                          pending
                            ? 'border-amber-400/40 text-amber-300 hover:text-amber-200'
                            : 'border-brand-muted text-brand-primary hover:text-brand-accent'
                        }`}
                      >
                        {pending ? 'Link to client' : 'Edit'}
                      </button>
                    </div>
                  </article>
                )
              })
            )}
          </div>

          <div className="hidden bg-brand-surface border border-brand-muted rounded-xl overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-muted text-left">
                  <th className="px-4 py-3 text-brand-primary font-medium">Name</th>
                  <th className="px-4 py-3 text-brand-primary font-medium">Email</th>
                  <th className="px-4 py-3 text-brand-primary font-medium">Role</th>
                  <th className="px-4 py-3 text-brand-primary font-medium">Client</th>
                  <th className="px-4 py-3 text-brand-primary font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sortedProfiles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-brand-primary">
                      No users yet.
                    </td>
                  </tr>
                ) : (
                  sortedProfiles.map(p => {
                    const pending = isPending(p)
                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-brand-muted last:border-0 transition-colors ${
                          pending ? 'bg-amber-400/[0.06] hover:bg-amber-400/10' : 'hover:bg-brand-muted/20'
                        }`}
                      >
                        <td className="px-4 py-3 text-white">
                          {p.full_name ?? <span className="text-brand-primary italic">Unnamed</span>}
                        </td>
                        <td className="px-4 py-3 text-brand-primary break-all">{p.email ?? '-'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge[p.role]}`}
                          >
                            {roleLabel(p.role)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-brand-primary">
                          {p.role === 'client' ? clientName(p.client_id) : 'All clients'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge pending={pending} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setEditing(p)}
                            className={`text-xs transition-colors ${
                              pending
                                ? 'text-amber-300 hover:text-amber-200 font-medium'
                                : 'text-brand-primary hover:text-brand-accent'
                            }`}
                          >
                            {pending ? 'Link to client' : 'Edit'}
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
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

function StatusBadge({ pending }: { pending: boolean }) {
  if (pending) {
    return (
      <span className="inline-block rounded-full bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-300">
        Pending setup
      </span>
    )
  }
  return (
    <span className="inline-block rounded-full bg-brand-muted px-2 py-0.5 text-xs font-medium text-brand-primary">
      Active
    </span>
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
    updates: { role: Profile['role']; client_id: string | null; full_name: string | null }
  ) => Promise<string | null>
  onClose: () => void
}) {
  const [fullName, setFullName] = useState(profile.full_name ?? '')
  const [role, setRole] = useState<Profile['role']>(profile.role)
  const [clientId, setClientId] = useState<string>(profile.client_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const clientOptions = clients.filter(c => c.active || c.id === clientId)

  function handleRoleChange(nextRole: Profile['role']) {
    setRole(nextRole)
    if (nextRole !== 'client') setClientId('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    if (role === 'client' && !clientId) {
      setError('Select a client for client-role users.')
      return
    }

    setSaving(true)
    setError(null)
    let saved = false
    try {
      const err = await onSave(profile.id, {
        full_name: fullName.trim() || null,
        role,
        client_id: role === 'client' ? clientId : null,
      })
      if (err) {
        setError(err)
        return
      }
      saved = true
      onClose()
    } catch (error) {
      setError(errorMessage(error, 'Could not save user.'))
    } finally {
      if (!saved) setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={e => { if (!saving && e.target === e.currentTarget) onClose() }}
    >
      <div className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-sm overflow-y-auto rounded-xl border border-brand-muted bg-brand-surface p-5 shadow-[0_0_40px_rgba(0,0,0,0.5)] sm:p-6">
        <h2 className="text-base font-semibold text-white mb-1">Edit user</h2>
        <p className="mb-5 text-xs text-brand-primary break-all">{profile.email ?? 'No email on file'}</p>

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
              onChange={e => handleRoleChange(e.target.value as Profile['role'])}
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent transition"
            >
              <option value="client">Client</option>
              <option value="staff">Staff</option>
              {profile.role === 'team' && <option value="team">Staff (legacy team)</option>}
              <option value="manager">Manager</option>
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
              disabled={role !== 'client'}
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent transition"
            >
              <option value="">None</option>
              {clientOptions.map(c => (
                <option key={c.id} value={c.id}>
                  {c.active ? c.name : `${c.name} (inactive)`}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-brand-primary">Only set for client-role users.</p>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 border border-brand-muted text-brand-primary py-2.5 rounded-lg text-sm hover:text-white hover:border-white/30 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-brand-accent text-brand-bg font-semibold py-2.5 rounded-lg text-sm hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
