import type { MicrosoftAssigneeMapEntry, MicrosoftAssigneeResolution, MicrosoftImportPreviewItem } from './microsoftImport'

export function resolveMicrosoftAssignee(
  microsoftUserId: string,
  metadata: MicrosoftAssigneeMapEntry | undefined,
  storedMappings: Map<string, string>,
  profiles: Array<{ id: string; email: string | null; full_name: string | null }>,
): MicrosoftAssigneeResolution {
  const displayName = metadata?.displayName ?? microsoftUserId
  const mail = metadata?.mail ?? null

  const storedCgId = storedMappings.get(microsoftUserId)
  if (storedCgId) {
    const profile = profiles.find(p => p.id === storedCgId)
    if (profile) {
      return { microsoftUserId, displayName, mail, cgProfileId: profile.id, cgProfileName: profile.full_name, resolved: true, method: 'stored' }
    }
  }

  const emails = [metadata?.mail, metadata?.userPrincipalName].filter((e): e is string => Boolean(e))
  for (const email of emails) {
    const profile = profiles.find(p => p.email?.toLowerCase() === email.toLowerCase())
    if (profile) {
      return { microsoftUserId, displayName, mail, cgProfileId: profile.id, cgProfileName: profile.full_name, resolved: true, method: 'email_match' }
    }
  }

  return { microsoftUserId, displayName, mail, cgProfileId: null, cgProfileName: null, resolved: false, method: 'unresolved' }
}

export function resolvePreviewAssignees(
  items: MicrosoftImportPreviewItem[],
  assigneeMap: Record<string, MicrosoftAssigneeMapEntry>,
  storedMappings: Map<string, string>,
  profiles: Array<{ id: string; email: string | null; full_name: string | null }>,
): MicrosoftImportPreviewItem[] {
  return items.map(item => {
    if (item.assigneeMicrosoftIds.length === 0) return item
    const resolved = item.assigneeMicrosoftIds.map(msId => resolveMicrosoftAssignee(msId, assigneeMap[msId], storedMappings, profiles))
    const unresolved = resolved.filter(r => !r.resolved)
    const warnings: string[] = [...item.warnings]
    if (unresolved.length > 0) {
      warnings.push(`Microsoft assignee${unresolved.length > 1 ? 's' : ''} ${unresolved.map(r => r.displayName).join(', ')} ${unresolved.length > 1 ? 'are' : 'is'} not matched to a CG Dynamics staff member.`)
    }
    return { ...item, warnings, resolvedAssignees: resolved }
  })
}
