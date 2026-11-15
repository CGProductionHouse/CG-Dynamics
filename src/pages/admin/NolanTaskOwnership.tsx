import type { CommandCentreTask } from '../../lib/commandCentre'
import { nolanTaskOwnership } from '../../lib/nolanOwnership'

export function NolanTaskOwnership({ task, directory }: { task: CommandCentreTask; directory: Map<string, string> | null }) {
  const ownership = nolanTaskOwnership(task, directory)
  if (!ownership) return <p>Owner profile evidence unavailable. No unassigned or verified-owner conclusion is made. Check the canonical source.</p>
  return <section aria-label="Task ownership evidence">
    <p>Assignment state: {ownership.state}</p>
    {ownership.reason && <p>{ownership.reason}</p>}
    {ownership.owners.length > 0 && <p>Canonical owners: {ownership.owners.map(person => person.name).join(', ')}</p>}
    {ownership.helpers.length > 0 && <p>Recorded helpers, not owners: {ownership.helpers.join(', ')}</p>}
    {ownership.importedText && <p>Imported assignment text, not ownership proof: {ownership.importedText}</p>}
    {ownership.state !== 'verified' && <p>Review the existing source assignment. This view does not reassign or resolve conflicts.</p>}
  </section>
}
