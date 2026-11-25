import { useEffect, useId, useRef, type ReactNode } from 'react'

/** Small-screen actions use one dismissible layer, never expand a list row. */
export function ActionSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = dialogRef.current
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog?.showModal()
    return () => {
      dialog?.close()
      document.body.style.overflow = overflow
      if (returnFocus?.isConnected) returnFocus.focus()
    }
  }, [])
  return <dialog ref={dialogRef} aria-labelledby={titleId} aria-modal="true"
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}
    className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-2xl border border-white/15 bg-brand-surface p-0 text-white shadow-2xl backdrop:bg-black/75 sm:inset-0 sm:m-auto sm:w-[calc(100%-2rem)] sm:max-w-md sm:rounded-2xl">
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-brand-surface px-4 py-3">
      <h2 id={titleId} className="min-w-0 break-words text-base font-semibold">{title}</h2>
      <button type="button" onClick={onClose} aria-label={`Close ${title}`} className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold text-brand-teal hover:bg-white/5">Close</button>
    </div>
    <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
  </dialog>
}
