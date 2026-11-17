import { useState, type ReactNode } from 'react'
import { nolanNotePreview } from '../../lib/nolanMasterPresentation'

const PAGE_SIZE = 12

export function NolanSourceNote({ note }: { note: string | null | undefined }) {
  const preview = nolanNotePreview(note)
  return <><p className="nolan-note-preview">{preview.text || 'No source note recorded.'}</p>
    {preview.truncated && <p>Truncated source excerpt (up to 600 characters), not a verified next action. Full notes remain in the authoritative workspace linked below.</p>}</>
}

/** Receives the complete filtered snapshot; only the current page mounts cards. */
export function NolanPagedRecords<T>({ rows, renderRow, empty }: { rows: T[]; renderRow: (row: T) => ReactNode; empty: ReactNode }) {
  const [requestedPage, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const page = Math.min(requestedPage, pages - 1)
  const start = page * PAGE_SIZE
  return <><nav className="toolbar" aria-label="Workbook record pages">
    <button className="refresh-data" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous records</button>
    <span role="status">Showing {rows.length ? start + 1 : 0}–{Math.min(start + PAGE_SIZE, rows.length)} of {rows.length} · Page {page + 1} of {pages}</span>
    <button className="refresh-data" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next records</button>
  </nav><div className="grid list">{rows.slice(start, start + PAGE_SIZE).map(renderRow)}{rows.length === 0 && empty}</div></>
}
