import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useOptionalClientPortal } from '../../components/client/ClientPortalContext'
import { supabase } from '../../lib/supabase'
import { projectCalendarPostAssets } from './projection'
import { LibraryAssetRow } from './ClientPortalLibrary'
import type { ClientPortalLibraryAsset } from './types'

/** Lazy exact-ID read, never a title lookup or a link to a private drive folder. */
export function ClientCalendarPostFiles({ postKey, month }: { postKey: string; month: string }) {
  const { profile } = useAuth()
  const previewClientId = useOptionalClientPortal()?.previewClientId
  const clientId = previewClientId ?? profile?.client_id
  return <ScopedPostFiles key={`${clientId}:${month}:${postKey}`} clientId={clientId} postKey={postKey} month={month} />
}

function ScopedPostFiles({ clientId, postKey, month }: { clientId: string | null | undefined; postKey: string; month: string }) {
  const [open, setOpen] = useState(false)
  const [assets, setAssets] = useState<ClientPortalLibraryAsset[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!open) return
    let active = true
    async function load() {
      if (!clientId || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !/^post-[a-f0-9]{16}$/.test(postKey)) {
        if (active) setFailed(true)
        return
      }
      try {
        const { data, error } = await supabase.rpc('client_portal_post_assets', { p_client_id: clientId, p_month: `${month}-01`, p_post_key: postKey })
        const projected = error ? null : projectCalendarPostAssets(data, month)
        if (active) { setAssets(projected); setFailed(projected === null) }
      } catch { if (active) setFailed(true) }
    }
    void load()
    return () => { active = false }
  }, [clientId, month, postKey, open, retry])
  return <div className="mt-2">
    <button type="button" aria-expanded={open} onClick={() => { if (!open) { setAssets(null); setFailed(false) } setOpen(!open) }} className="min-h-10 rounded-lg border border-white/10 px-2 text-left text-xs font-semibold text-report-accent">{open ? 'Hide published files' : 'View published files'}</button>
    {open && <div className="mt-2 min-w-0 rounded-xl border border-white/10 p-3">
      {failed ? <div role="alert" className="text-xs text-report-muted">Published files are unavailable right now. <button type="button" className="min-h-10 underline" onClick={() => { setFailed(false); setAssets(null); setRetry(value => value + 1) }}>Try again</button></div>
        : assets === null ? <p role="status" className="text-xs text-report-muted">Loading published files…</p>
          : assets.length === 0 ? <p className="text-xs text-report-muted">No published file is linked to this post yet.</p>
            : <><p className="text-xs text-report-muted">Exact linked final files (up to 24).</p>{assets.map(asset => <LibraryAssetRow key={asset.id} asset={asset} compact />)}</>}
    </div>}
  </div>
}
