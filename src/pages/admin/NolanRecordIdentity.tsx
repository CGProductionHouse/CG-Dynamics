export function NolanRecordIdentity({ source, recordId, dueDate, dateLabel }: { source: string; recordId: string; dueDate: string | null; dateLabel: string }) {
  return <section aria-label="Canonical record identity">
    <p>Source: {source}</p>
    <p>Record ID: <code>{recordId}</code></p>
    <p>{dateLabel}: {dueDate || 'Not recorded'}</p>
    <p>Identity and source dates are tracking evidence, not delivery or approval verification.</p>
  </section>
}
