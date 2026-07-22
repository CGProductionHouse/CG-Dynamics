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

function populateAssignmentPayload(
  item: MicrosoftImportPreviewItem,
  resolved: MicrosoftAssigneeResolution[],
): MicrosoftImportPreviewItem {
  if (!item.proposedPayload) return item
  const resolvedList = resolved.filter(r => r.resolved)
  if (resolvedList.length === 0) return item

  const primary = resolvedList[0]
  const helpers = resolvedList.slice(1).map(r => r.cgProfileName ?? r.displayName).filter((n): n is string => Boolean(n))

  if (item.proposedPayload.destination === 'planner') {
    return {
      ...item,
      proposedPayload: {
        ...item.proposedPayload,
        assigned_to_name: primary.cgProfileName ?? primary.displayName,
        helper_names: helpers.length > 0 ? helpers : null,
      },
    }
  }
  if (item.proposedPayload.destination === 'client_schedule') {
    return {
      ...item,
      proposedPayload: {
        ...item.proposedPayload,
        assigned_to_user_id: primary.cgProfileId,
        assigned_to_name: primary.cgProfileName ?? primary.displayName,
        helper_names: helpers.length > 0 ? helpers : null,
      },
    }
  }
  return item
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
    const withResolutions = { ...item, warnings, resolvedAssignees: resolved }

    if (unresolved.length > 0) {
      const names = unresolved.map(r => r.displayName).join(', ')
      warnings.push(`Microsoft assignee${unresolved.length > 1 ? 's' : ''} ${names} ${unresolved.length > 1 ? 'are' : 'is'} not matched to a CG Dynamics staff member.`)
      return {
        ...withResolutions,
        warnings,
        previewStatus: 'conflict' as const,
        reconciliationAction: 'conflict' as const,
        conflictCode: 'unresolved_assignee' as const,
        conflictReason: `One or more Microsoft assignees (${names}) could not be matched to a CG Dynamics staff member. Resolve manually and update the mapping table before applying.`,
      }
    }

    return populateAssignmentPayload(withResolutions, resolved)
  })
}
