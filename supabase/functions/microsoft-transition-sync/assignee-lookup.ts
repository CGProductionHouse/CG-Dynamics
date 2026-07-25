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
    displayName?: string
    mail?: string
    userPrincipalName?: string
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
      url: `/users/${encodeURIComponent(microsoftUserId)}?$select=displayName,mail,userPrincipalName`,
    }
  })
  return { requests, sourceIdByRequestId }
}

export function correlateAssigneeBatchResponses(
  responses: GraphAssigneeBatchItem[],
  sourceIdByRequestId: Map<string, string>,
): {
  assignees: Record<string, MicrosoftAssigneeMetadata>
  unresolvedSourceIds: string[]
} {
  const assignees: Record<string, MicrosoftAssigneeMetadata> = {}
  const resolvedSourceIds = new Set<string>()

  for (const response of responses) {
    const sourceId = sourceIdByRequestId.get(response.id)
    if (!sourceId || response.status !== 200 || !response.body) continue
    assignees[sourceId] = {
      displayName: response.body.displayName ?? 'Unknown',
      mail: response.body.mail ?? null,
      userPrincipalName: response.body.userPrincipalName ?? null,
    }
    resolvedSourceIds.add(sourceId)
  }

  return {
    assignees,
    unresolvedSourceIds: [...sourceIdByRequestId.values()].filter(sourceId => !resolvedSourceIds.has(sourceId)),
  }
}
