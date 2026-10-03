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
