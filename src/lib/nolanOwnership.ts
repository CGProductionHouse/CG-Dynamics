import type { CommandCentreTask } from './commandCentre'
import { resolveOwnership, taskOwnershipInput } from './taskOwnership'

/** Reuse the shared ownership authority; imported names/helpers are never owners.
 * An unavailable directory is not evidence that a task is unassigned. */
export function nolanTaskOwnership(task: CommandCentreTask, directory: Map<string, string> | null) {
  if (!directory) return null
  const input = taskOwnershipInput(task)
  const ownership = resolveOwnership(input, directory)
  const ids = [...(input.assigneeUserIds ?? []), ...(input.assignedToUserId ? [input.assignedToUserId] : [])]
  if (ownership.state === 'verified' || ownership.state === 'unassigned') {
    if (ids.some(id => id && !directory.has(id))) return null
  }
  return ownership
}
export function nolanTaskOwnerLabel(task: CommandCentreTask, directory: Map<string, string> | null): string {
  const ownership = nolanTaskOwnership(task, directory)
  if (!ownership) return 'Owner profile evidence unavailable'
  if (ownership.state === 'verified') return ownership.owners.map(owner => owner.name).join(', ')
  return ownership.state === 'unassigned' ? 'Unassigned' : ownership.state === 'conflict' ? 'Assignment conflict' : 'Assignment unresolved'
}
