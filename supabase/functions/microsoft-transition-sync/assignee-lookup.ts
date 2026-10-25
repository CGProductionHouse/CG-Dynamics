export interface MicrosoftAssigneeMetadata {
  displayName: string
  mail: string | null
  userPrincipalName: string | null
}

export interface GraphAssigneeBatchRequest {
  id: string
  method: 'GET'
  url: string
}

export interface GraphAssigneeBatchItem {
  id: string
  status: number
  body?: {
    id?: unknown
    displayName?: unknown
    mail?: unknown
    userPrincipalName?: unknown
  }
}

export function buildAssigneeBatchRequests(microsoftUserIds: string[]): {
  requests: GraphAssigneeBatchRequest[]
  sourceIdByRequestId: Map<string, string>
} {
  const sourceIdByRequestId = new Map<string, string>()
  const requests = microsoftUserIds.map((microsoftUserId, index) => {
    const requestId = `assignee-${index + 1}`
    sourceIdByRequestId.set(requestId, microsoftUserId)
    return {
      id: requestId,
      method: 'GET' as const,
      url: `/users/${encodeURIComponent(microsoftUserId)}?$select=id,displayName,mail,userPrincipalName`,
    }
  })
  return { requests, sourceIdByRequestId }
}

export function correlateAssigneeBatchResponses(
  responses: unknown,
  sourceIdByRequestId: Map<string, string>,
): {
  assignees: Record<string, MicrosoftAssigneeMetadata>
  unresolvedSourceIds: string[]
} {
  const assignees: Record<string, MicrosoftAssigneeMetadata> = {}
  const resolvedSourceIds = new Set<string>()
  const matches = new Map<string, GraphAssigneeBatchItem[]>()

  // Graph correlation IDs are case-insensitive. Source identities are retained
  // exactly; duplicate correlations cannot silently choose a staff member.
  for (const response of Array.isArray(responses) ? responses : []) {
    if (!response || typeof response.id !== 'string') continue
    const requestId = response.id.toLowerCase()
    if (!sourceIdByRequestId.has(requestId)) continue
    matches.set(requestId, [...(matches.get(requestId) ?? []), response])
  }
  for (const [requestId, sourceId] of sourceIdByRequestId) {
    const rows = matches.get(requestId) ?? []
    if (rows.length !== 1) continue
    const response = rows[0]
    const body = response.body
    if (response.status !== 200 || !body || Array.isArray(body) || body.id !== sourceId
      || typeof body.displayName !== 'string' || !body.displayName.trim()
      || (body.mail != null && typeof body.mail !== 'string')
      || (body.userPrincipalName != null && typeof body.userPrincipalName !== 'string')) continue
    assignees[sourceId] = {
      displayName: body.displayName,
      mail: body.mail ?? null,
      userPrincipalName: body.userPrincipalName ?? null,
    }
    resolvedSourceIds.add(sourceId)
  }

  return {
    assignees,
    unresolvedSourceIds: [...sourceIdByRequestId.values()].filter(sourceId => !resolvedSourceIds.has(sourceId)),
  }
}
