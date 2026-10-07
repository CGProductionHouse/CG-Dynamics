interface Props {
  objective: string | null
  hook: string | null
  notes: string | null
}

/** Staff-only readback of the existing draft fields. Never re-certifies sources. */
export default function SavedDirectorContext({ objective, hook, notes }: Props) {
  const fields = [
    ['Saved objective', objective],
    ['Saved hook', hook],
    ['Saved angle, confirmation questions and source notes', notes],
  ].filter((field): field is [string, string] => typeof field[1] === 'string' && Boolean(field[1].trim()))
  if (fields.length === 0) return null

  return (
    <details className="mt-3 min-w-0 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <summary className="cursor-pointer text-xs font-bold text-brand-teal">Saved creative context</summary>
      <p className="mt-2 text-[11px] leading-relaxed text-white/45">
        Draft context saved with this video, not a new recommendation. Source notes
        describe the evidence at that time; current approval, source validity and
        client facts still need checking before use.
      </p>
      <dl className="mt-3 space-y-3">
        {fields.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-white/40">{label}</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-white/70 [overflow-wrap:anywhere]">{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
