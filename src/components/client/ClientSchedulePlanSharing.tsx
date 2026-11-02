import { useEffect, useRef, useState } from 'react'
import calendarIcon from '../../assets/lucide/calendar-days.svg'
import { ActionButton } from '../ui/Buttons'
import { PublicationConfirmation } from '../ui/PublicationConfirmation'
import { planDateIsShared, planSharingRows, readSchedulePlanRows, setSchedulePlanSharing, type SchedulePlanRow } from '../../lib/clientScheduleSharing'

/** Publication belongs to the existing schedule editor, never the client preview. */
export function ClientSchedulePlanSharing({ clientId, clientName, month }: { clientId: string; clientName: string; month: string }) {
  const [rows, setRows] = useState<SchedulePlanRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<{ visible: boolean; rows: SchedulePlanRow[] } | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(false)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    let cancelled = false
    readSchedulePlanRows(clientId, month).then(data => { if (!cancelled) { setRows(data); setError(null) } })
      .catch(() => { if (!cancelled) { setRows(null); setError('Plan sharing is unavailable. Refresh to check.') } })
    return () => { cancelled = true; mounted.current = false }
  }, [clientId, month, refresh])

  const shared = rows?.filter(planDateIsShared).length ?? 0
  async function confirm() {
    if (!confirmation || busy) return false
    setBusy(true)
    try {
      await setSchedulePlanSharing(clientId, month, confirmation.visible, confirmation.rows)
      const fresh = await readSchedulePlanRows(clientId, month)
      const byId = new Map(fresh.map(row => [row.id, row]))
      if (!confirmation.rows.every(row => {
        const actual = byId.get(row.id)
        return actual && (confirmation.visible ? planDateIsShared(actual) && actual.scheduled_date === row.scheduled_date : actual.client_plan_shared_date === null)
      })) throw new Error('Read-back mismatch')
      if (mounted.current) { setRows(fresh); setError(null) }
      return true
    } catch {
      if (mounted.current) { setRows(null); setConfirmation(null); setError('Sharing could not be verified. Refresh to check before making another change.') }
      return false
    } finally { if (mounted.current) setBusy(false) }
  }

  return <section aria-label="Client plan sharing" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
    <div className="flex items-center gap-3"><img src={calendarIcon} alt="" className="h-5 w-5 opacity-70" /><div>
      <p className="text-sm font-bold text-white">Client posting plan</p>
      <p role={error ? 'alert' : 'status'} className="text-xs text-brand-primary/70">{error ?? (rows ? `${shared} date${shared === 1 ? '' : 's'} shared · ${clientName}` : 'Checking shared dates…')}</p>
    </div></div>
    <div className="flex flex-wrap gap-2">
      {error ? <ActionButton variant="secondary" onClick={() => { setRows(null); setError(null); setRefresh(value => value + 1) }}>Refresh sharing</ActionButton> : rows && <>
        <ActionButton disabled={busy || !planSharingRows(rows, month, true).length} onClick={() => setConfirmation({ visible: true, rows: planSharingRows(rows, month, true) })}>Share planned dates</ActionButton>
        {planSharingRows(rows, month, false).length > 0 && <ActionButton variant="secondary" disabled={busy} onClick={() => setConfirmation({ visible: false, rows: planSharingRows(rows, month, false) })}>Hide shared dates</ActionButton>}
      </>}
    </div>
    {confirmation && <PublicationConfirmation title={`${confirmation.visible ? 'Share' : 'Hide'} planned dates?`}
      description={`${clientName} · ${month}: ${confirmation.rows.length} date${confirmation.rows.length === 1 ? '' : 's'}. ${confirmation.visible ? confirmation.rows.map(row => row.scheduled_date).sort().join(', ') + '. Clients will see planned dates and format labels only. Content approval and posting stay unchanged.' : 'Remove these planned dates from the client calendar. Previously sent, approved or posted content stays visible.'}`}
      confirmLabel={confirmation.visible ? 'Share planned dates' : 'Hide planned dates'} onConfirm={confirm} onCancel={() => setConfirmation(null)} />}
  </section>
}
