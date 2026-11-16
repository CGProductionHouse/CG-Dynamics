import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { listClientPortalAccess } from '../../lib/clientPortalAccess'
import { copyClientLoginMessage } from '../../lib/clientLoginMessage'

export function CopyClientLoginButton({ clientId }: { clientId: string }) {
  const { profile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  async function copy() {
    if (busy || profile?.role !== 'admin') return
    setBusy(true)
    setStatus(null)
    setFailed(false)
    try {
      await copyClientLoginMessage(clientId, listClientPortalAccess)
      setStatus('Login message copied — paste it into your client chat.')
    } catch (error) {
      setFailed(true)
      setStatus(error instanceof Error ? error.message : 'Could not copy the login message. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (profile?.role !== 'admin') return null
  return (
    <div className="min-w-0 max-w-full text-left">
      <button type="button" disabled={busy} onClick={() => void copy()} className="min-h-11 rounded-lg border border-brand-teal/40 bg-brand-teal/10 px-3 py-2 text-xs font-bold text-brand-teal transition hover:bg-brand-teal/20 disabled:opacity-50">
        {busy ? 'Preparing login message…' : 'Copy login message'}
      </button>
      <p className="mt-1 max-w-64 text-xs text-brand-primary/70">Link, username and issued starter password. Custom passwords cannot be retrieved.</p>
      {status && <p role={failed ? 'alert' : 'status'} className="mt-1 max-w-64 text-xs text-brand-primary">{status}</p>}
      {failed && <Link className="mt-1 inline-block text-xs font-bold text-brand-teal underline" to={`/admin/users?tab=client-access&client=${encodeURIComponent(clientId)}`}>Manage client access</Link>}
    </div>
  )
}
