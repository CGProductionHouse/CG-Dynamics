import type { TiktokConnectionQueue } from './tiktok'

export function tiktokIntegrationSummary(queue: TiktokConnectionQueue | null, loading: boolean, canManage: boolean) {
  const base = { connected: false, buttonLabel: 'Manage TikTok' }
  if (!canManage) return { ...base, status: 'Manager access', description: 'Exact-client TikTok connection management is available to managers and admins.' }
  if (loading) return { ...base, status: 'Checking…', description: 'Checking the canonical TikTok client connection queue.' }
  const summary = queue?.summary
  if (!queue?.ok || !summary || !Object.values(summary).every(value => Number.isSafeInteger(value) && value >= 0)
    || summary.activeClients !== summary.eligible + summary.excluded + summary.unresolved
    || summary.eligible !== summary.connected + summary.reconnectRequired + summary.notConnected) {
    return { ...base, status: 'Unavailable', description: 'TikTok fleet connection evidence could not be verified. No disconnected or zero-count claim is inferred.' }
  }
  const connected = summary.connected > 0
  const status = connected
    ? summary.connected === summary.eligible ? 'Connected' : 'Partially connected'
    : summary.reconnectRequired > 0 ? 'Reconnect required' : 'Not connected'
  return {
    ...base, connected, status,
    description: `${summary.connected} of ${summary.eligible} eligible clients connected · ${summary.reconnectRequired} reconnect required · ${summary.notConnected} not connected. ${summary.excluded} excluded · ${summary.unresolved} held. Read-only analytics; connection counts do not prove reporting freshness.`,
  }
}
