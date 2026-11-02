import { useEffect, useId, useRef, useState } from 'react'
import { ActionButton } from './Buttons'

/** Explicit publication consent in the app, without a blocking JS alert. */
export function PublicationConfirmation({ title, description, confirmLabel, onConfirm, onCancel }: {
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => Promise<boolean>
  onCancel: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const pending = useRef(false)
  const mounted = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    mounted.current = true
    dialog?.showModal()
    return () => {
      mounted.current = false
      dialog?.close()
      if (returnFocus?.isConnected) returnFocus.focus()
    }
  }, [])

  async function confirm() {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError(null)
    try {
      const saved = await onConfirm()
      if (!mounted.current) return
      if (saved) onCancel()
      else setError('Could not confirm this change. Check its status before trying again.')
    } catch {
      if (mounted.current) setError('Could not confirm this change. Check its status before trying again.')
    } finally {
      pending.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return <dialog
    ref={dialogRef}
    aria-labelledby={titleId}
    aria-describedby={descriptionId}
    aria-modal="true"
    onCancel={event => { event.preventDefault(); if (!pending.current) onCancel() }}
    className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-brand-surface p-5 text-white shadow-2xl backdrop:bg-black/70 sm:p-6"
  >
    <h2 id={titleId} className="text-xl font-bold tracking-tight">{title}</h2>
    <p id={descriptionId} className="mt-3 text-sm leading-6 text-brand-primary">{description}</p>
    {error && <p role="alert" className="mt-4 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
      <ActionButton variant="secondary" disabled={busy} onClick={onCancel}>Cancel</ActionButton>
      <ActionButton loading={busy} disabled={busy} onClick={() => void confirm()}>{confirmLabel}</ActionButton>
    </div>
  </dialog>
}
