/** Never render cached client data for a different signed-in client. */
export function exactClientForProfile<T extends { id: string }>(clientId: string | null | undefined, client: T | null): T | null {
  return clientId && client?.id === clientId ? client : null
}
