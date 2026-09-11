// The Content Run's exact OneDrive production month folder (#224).
//
// One folder per run: Clients / <Client> / Videos / <YYYY> / <YYYY_MM_MON>, linked by durable
// Graph ids. No per-video folders, and nothing here renames, moves or deletes anything — the
// only write action creates a missing canonical year/month folder after an explicit click.
//
// The check is deliberately on demand: OneDrive is a separate CA-gated rollout, so opening a run
// never fires a request for it.
import { useState } from 'react'
import { ActionButton } from '../ui/Buttons'
import {
  createAndLinkRunMonthFolder,
  getRunOneDriveStatus,
  linkRunMonthFolder,
  listOneDriveClientFolders,
  mapOneDriveClientFolder,
  type OneDriveClientFolderOption,
  type RunOneDriveStatus,
} from '../../lib/contentRunOneDrive'
import type { ContentRun } from '../../lib/contentWorkflow'

const CONNECTION_MESSAGE: Record<string, string> = {
  not_configured: 'OneDrive is not connected to CG Dynamics yet. Production folders can be linked once that setup is complete.',
  needs_consent: 'OneDrive needs its one-time sign-in before folders can be linked.',
  connected: '',
}

const VERIFICATION_MESSAGE: Record<string, string> = {
  verified: 'Folder confirmed in OneDrive.',
  identity_mismatch: 'The linked folder no longer matches. Re-link it before uploading.',
  unavailable: 'OneDrive did not return this folder just now.',
  not_checked: '',
}

export default function ContentRunOneDriveCard({ run }: { run: ContentRun }) {
  const [status, setStatus] = useState<RunOneDriveStatus | null>(null)
  const [folders, setFolders] = useState<OneDriveClientFolderOption[] | null>(null)
  const [suggestedItemId, setSuggestedItemId] = useState<string | null>(null)
  const [chosenFolderId, setChosenFolderId] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [createNeeded, setCreateNeeded] = useState<'year' | 'month' | null>(null)

  async function check() {
    setBusy('status'); setError(null); setNotice(null); setCreateNeeded(null)
    const result = await getRunOneDriveStatus(run.id)
    setBusy(null)
    if (result.error || !result.data) { setError(result.error ?? 'No response.'); return }
    setStatus(result.data)
  }

  async function loadFolders() {
    setBusy('folders'); setError(null)
    const result = await listOneDriveClientFolders(run.id)
    setBusy(null)
    if (result.error || !result.data) { setError(result.error ?? 'No response.'); return }
    setFolders(result.data.folders)
    setSuggestedItemId(result.data.suggestedItemId)
    setChosenFolderId(result.data.suggestedItemId ?? '')
  }

  async function mapFolder() {
    if (!chosenFolderId) { setError('Choose this client\'s OneDrive folder first.'); return }
    setBusy('map'); setError(null)
    const result = await mapOneDriveClientFolder(run.id, chosenFolderId)
    setBusy(null)
    if (result.error) { setError(result.error); return }
    setFolders(null)
    setNotice(`Client folder mapped: ${result.data?.folderName ?? ''}`)
    await check()
  }

  async function link(create: boolean) {
    setBusy('link'); setError(null); setNotice(null)
    const result = create ? await createAndLinkRunMonthFolder(run.id) : await linkRunMonthFolder(run.id)
    setBusy(null)
    if (result.error || !result.data) { setError(result.error ?? 'No response.'); return }
    if (result.data.status === 'create_required') {
      setCreateNeeded(result.data.missing)
      setNotice(`${result.data.expected.path} does not exist yet.`)
      return
    }
    setCreateNeeded(null)
    setNotice(result.data.created.length > 0 ? `Created ${result.data.created.join(' / ')} and linked the run.` : 'Month folder linked.')
    await check()
  }

  const connectionMessage = status ? CONNECTION_MESSAGE[status.connection] : ''
  const verificationMessage = status ? VERIFICATION_MESSAGE[status.verification] : ''

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-teal">Production folder</p>
          <p className="mt-1 text-xs leading-relaxed text-white/50">
            The exact OneDrive month folder for this run's footage. One folder per run — videos are not given their own folders.
          </p>
        </div>
        <ActionButton size="sm" variant="secondary" loading={busy === 'status'} onClick={() => void check()}>
          {status ? 'Re-check' : 'Check production folder'}
        </ActionButton>
      </div>

      {error && <p className="mt-3 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200">{error}</p>}
      {notice && <p className="mt-3 rounded-lg border border-brand-teal/25 bg-brand-teal/[0.07] px-3 py-2 text-xs text-brand-teal">{notice}</p>}

      {status && (
        <div className="mt-3 space-y-2 text-xs text-white/60">
          {status.expected ? (
            <p className="break-all font-mono text-[11px] text-white/45">
              {status.expected.path}
              {status.monthBasis === 'run_date' && <span className="ml-1 font-sans text-white/35">(from the shoot date)</span>}
            </p>
          ) : (
            <p className="text-amber-200/80">Set the guideline coverage month or the run date to know which month folder this run belongs to.</p>
          )}

          {connectionMessage && <p className="text-amber-200/80">{connectionMessage}</p>}

          {status.runFolder ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-300/25 bg-emerald-300/[0.08] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200">Linked</span>
              <span className="font-mono text-[11px] text-white/60">{status.runFolder.name}</span>
              {status.runFolder.webUrl && (
                <a className="text-[11px] font-bold text-brand-teal underline" href={status.runFolder.webUrl} target="_blank" rel="noreferrer">Open in OneDrive</a>
              )}
              {verificationMessage && <span className={status.verification === 'verified' ? 'text-[11px] text-white/40' : 'text-[11px] text-amber-200/80'}>{verificationMessage}</span>}
            </div>
          ) : (
            <p className="text-white/45">No month folder linked to this run yet.</p>
          )}

          {status.connection === 'connected' && status.canManage && (
            <div className="space-y-2 pt-1">
              {!status.clientMapping ? (
                folders ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <select className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white" value={chosenFolderId} onChange={event => setChosenFolderId(event.target.value)}>
                      <option value="">Choose this client's OneDrive folder…</option>
                      {folders.map(folder => (
                        <option key={folder.id} value={folder.id}>{folder.name}{folder.id === suggestedItemId ? ' (name matches this client)' : ''}</option>
                      ))}
                    </select>
                    <ActionButton size="sm" loading={busy === 'map'} onClick={() => void mapFolder()}>Map client folder</ActionButton>
                  </div>
                ) : (
                  <ActionButton size="sm" variant="secondary" loading={busy === 'folders'} onClick={() => void loadFolders()}>Choose this client's OneDrive folder</ActionButton>
                )
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <ActionButton size="sm" loading={busy === 'link'} onClick={() => void link(false)}>
                    {status.runFolder ? 'Re-link month folder' : 'Link month folder'}
                  </ActionButton>
                  {createNeeded && (
                    <ActionButton size="sm" variant="secondary" loading={busy === 'link'} onClick={() => void link(true)}>
                      Create {createNeeded === 'year' ? 'year and month' : 'month'} folder, then link
                    </ActionButton>
                  )}
                </div>
              )}
            </div>
          )}

          {status.connection === 'connected' && !status.canManage && (
            <p className="text-white/40">An admin links production folders.</p>
          )}
        </div>
      )}
    </section>
  )
}
