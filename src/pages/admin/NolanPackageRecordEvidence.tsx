import type { ActiveClientPackageEvidence } from '../../lib/packageEvidence'

function References({ values }: { values: string[] }) {
  // Source references are audit text, not verified destinations or instructions.
  const references = [...new Set(values.filter(value => value.trim()))]
  return references.length ? <ul>{references.map(value => <li key={value}>{value}</li>)}</ul> : <p>No source references recorded.</p>
}

export function NolanPackageRecordEvidence({ client }: { client: ActiveClientPackageEvidence }) {
  return <div>
    <strong>{client.clientName}</strong>: {client.confirmed ? 'Recorded package confirmation' : 'Unverified package'} · {client.conflicts.length} conflicts · {client.unknownFields.length} unknown fields
    <details><summary>View recorded allowance evidence</summary>
      <p>Exact Dynamics client ID: {client.clientId}</p>
      <p>Evidence below is recorded package authority, not payment, historical entitlement, published usage or approval to change the package.</p>
      <ul>{Object.entries(client.fields).map(([field, value]) => <li key={field}>
        <strong>{field.replaceAll('_', ' ')}</strong>: {value.proposedValue === null ? 'Unknown' : String(value.proposedValue)} ({value.state})
        <details><summary>Source evidence for {field.replaceAll('_', ' ')}</summary>
          <p>Evidence class: {value.evidenceClass.replaceAll('_', ' ')} · Confidence: {value.confidence}</p>
          <p>{value.note || 'No evidence note recorded.'}</p>
          <References values={value.sourceReferences} />
        </details>
      </li>)}</ul>
      <h4>Conflicts</h4>{client.conflicts.length ? <ul>{client.conflicts.map((value, index) => <li key={index}>{value}</li>)}</ul> : <p>No conflicts reported by this reader; not an independent reconciliation.</p>}
      <h4>Unknown fields</h4>{client.unknownFields.length ? <ul>{client.unknownFields.map(field => <li key={field}>{field.replaceAll('_', ' ')}</li>)}</ul> : <p>No unknown fields reported by this reader.</p>}
      <h4>Direct source references</h4><References values={client.directSources} />
      <h4>Supporting context only</h4><References values={client.supportingSources} />
      <p>Supporting context is not a confirmed allowance. References have not been opened or independently verified by this view.</p>
    </details>
  </div>
}
