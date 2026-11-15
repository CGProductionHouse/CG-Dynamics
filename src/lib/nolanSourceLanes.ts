import { nolanTaskOwnership } from './nolanOwnership'
import { isVerifiedOwner } from './taskOwnership'
import type { CommandCentreTask } from './commandCentre'
import { isOperationallyCompletedStatus } from './taskLifecycle'

// Only classify app work by an exact existing source link. Names in prose are
// not authoritative identities and never create implied app/project mappings.
export const NOLAN_APP_REPOSITORIES = [
  'CGProductionHouse/CG-Dynamics',
  'CGProductionHouse/CG-Hours',
  'CGProductionHouse/cg-pay',
  'CGProductionHouse/cg-website-editor',
] as const
export function linkedAppRepository(task: Pick<CommandCentreTask, 'notes' | 'whatsapp_source_text'>): string | null {
  const links = `${task.notes ?? ''}\n${task.whatsapp_source_text ?? ''}`.match(/https:\/\/github\.com\/[^\s<>"')]+/gi) ?? []
  const matches = new Set<string>()
  for (const link of links) {
    try {
      const url = new URL(link)
      const repository = url.pathname.split('/').filter(Boolean).slice(0, 2).join('/')
      const match = NOLAN_APP_REPOSITORIES.find(known => known.toLowerCase() === repository.toLowerCase())
      if (match) matches.add(match)
    } catch { /* untrusted malformed source URLs never establish identity */ }
  }
  return matches.size === 1 ? [...matches][0] : null
}

export type NolanTaskLane = 'work' | 'ownership' | 'needs' | 'special' | 'done' | 'apps' | 'editor'
export function taskInNolanLane(task: CommandCentreTask, lane: NolanTaskLane, viewerId?: string, directory: Map<string, string> | null = null): boolean {
  const complete = isOperationallyCompletedStatus(task)
  if (lane === 'done') return complete
  if (complete) return false
  if (lane === 'needs' || lane === 'ownership') {
    const ownership = nolanTaskOwnership(task, directory)
    return !!ownership && (lane === 'needs' ? isVerifiedOwner(ownership, viewerId) : ownership.state !== 'verified')
  }
  if (lane === 'special') return task.bucket === 'Once-off' || task.bucket === 'CG Socials'
  if (lane === 'editor') return linkedAppRepository(task) === 'CGProductionHouse/cg-website-editor'
  if (lane === 'apps') return linkedAppRepository(task) !== null
  return true
}
