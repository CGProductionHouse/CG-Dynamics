// Names are collision guards, never cross-system identity or merge authority.
export function findClientNameConflict<T extends { id: string; name: string }>(
  clients: readonly T[], name: string, currentId?: string,
): T | undefined {
  const key = name.trim().toLowerCase()
  return clients.find(client => client.id !== currentId && client.name.trim().toLowerCase() === key)
}

export function clientSaveFailureMessage(error: { code?: string } | null, fallback: string): string {
  return error?.code === '23505'
    ? 'This client conflicts with an existing record. Edit or restore the existing client instead of adding another.'
    : fallback
}

export function parseBulkClientNames(text: string, clients: readonly { name: string; active: boolean }[]) {
  const unique: string[] = [], inListDupes: string[] = []
  const seen = new Set<string>()
  for (const name of text.split('\n').map(line => line.trim()).filter(Boolean)) {
    const key = name.toLowerCase()
    if (seen.has(key)) inListDupes.push(name)
    else { seen.add(key); unique.push(name) }
  }
  const active = new Set(clients.filter(client => client.active).map(client => client.name.trim().toLowerCase()))
  const archived = new Set(clients.filter(client => !client.active).map(client => client.name.trim().toLowerCase()))
  return {
    toAdd: unique.filter(name => !active.has(name.toLowerCase()) && !archived.has(name.toLowerCase())),
    toSkip: unique.filter(name => active.has(name.toLowerCase())),
    toRestoreInstead: unique.filter(name => archived.has(name.toLowerCase())),
    inListDupes,
  }
}
