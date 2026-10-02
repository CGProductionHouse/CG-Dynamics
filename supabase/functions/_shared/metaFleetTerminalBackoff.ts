import { classifyError, isTransientMetaRequestAbort } from './meta.ts'
import { metaRateLimitScope } from './metaRateLimit.ts'

// Match the existing failed-platform checkpoint backoff (one hour), not the
// six-hour verified-data window. Never extend this on a scheduler read.
export const META_TERMINAL_ACCESS_COOLDOWN_MS = 60 * 60_000

export interface MetaFleetFailure {
  id: string
  batch_id: string
  asset_id: string | null
  client_id: string
  month: string
  status: string
  error: string | null
  facebook_sync_state: string | null
  instagram_sync_state: string | null
  finished_at: string | null
  cooldown_until: string | null
  meta_sync_batches: { summary: { via?: string } | null } | Array<{ summary: { via?: string } | null }> | null
}

export interface MetaFleetTarget {
  id: string
  client_id: string
  updated_at: string | null
  facebook_page_id: string | null
  instagram_account_id: string | null
  meta_asset_sync_checkpoints?: Array<{
    client_id?: string
    platform: string
    last_successful_at?: string | null
    last_attempted_at?: string | null
    last_status?: string | null
  }>
}

export interface MetaTerminalAccessBlock {
  platform: 'facebook' | 'instagram'
  itemId: string
  batchId: string
  failedAt: string
  retryAt: string
  blocker: string
}

function permissionFailure(message: string): boolean {
  // Reuse the connector's canonical classification, never blanket-match any
  // HTTP 400/403, unsupported metric or malformed/schema/configuration error.
  if (metaRateLimitScope(message) || isTransientMetaRequestAbort(message)) return false
  const code = message.match(/\bcode:\s*(\d+)\b/i)?.[1] ?? null
  return classifyError({ code, subcode: null, message, type: null, trace: null }) === 'permission_blocked'
    || /^(Facebook|Instagram) account facts are permission blocked\./.test(message)
    || message.replace(/^Error: /, '') === 'Meta did not grant a Page token for this mapped Page. Reconnect with the required Page access.'
    || message === 'Facebook page token unavailable for linked page. Relink Meta or verify page access.'
}

/** Read-only scheduling evidence, NOT a successful checkpoint or fact update. */
export function metaTerminalAccessBlocks(
  target: MetaFleetTarget,
  month: string,
  failures: MetaFleetFailure[],
  now: string,
  connectionRecoveredAt: string | null = null,
): MetaTerminalAccessBlock[] {
  const nowMs = Date.parse(now)
  if (!Number.isFinite(nowMs)) return []
  const blocks: MetaTerminalAccessBlock[] = []
  for (const platform of ['facebook', 'instagram'] as const) {
    if (!target[platform === 'facebook' ? 'facebook_page_id' : 'instagram_account_id']) continue
    const exact = failures.filter(item => item.asset_id === target.id && item.client_id === target.client_id
      && item.month === month && item.status === 'failed' && item.batch_id
      && (Array.isArray(item.meta_sync_batches)
        ? item.meta_sync_batches.length === 1 && item.meta_sync_batches[0]?.summary?.via === 'fleet_freshness'
        : item.meta_sync_batches?.summary?.via === 'fleet_freshness')
      && Number.isFinite(Date.parse(item.finished_at ?? '')))
      .sort((a, b) => Date.parse(b.finished_at!) - Date.parse(a.finished_at!) || b.id.localeCompare(a.id))
    // Only the latest exact failure is authority. An old terminal failure must
    // not override a newer transient outcome or completed platform stage.
    const item = exact[0]
    if (!item?.error || !permissionFailure(item.error)) continue
    const message = item.error.replace(/^Error: /, '')
    const preflight = message.startsWith('Mapped Page access failed (')
      || message.startsWith('Meta did not grant a Page token for this mapped Page.')
    const state = item[`${platform}_sync_state`]
    if (state === 'complete' || state === 'not_applicable') continue
    // Page preflight is shared by the Page-linked stages, before either can
    // checkpoint. Other failures require the exact failed platform and prefix.
    if (!(preflight && target.facebook_page_id && state === 'pending')
      && !(state === 'failed' && message.startsWith(platform === 'facebook' ? 'Facebook ' : 'Instagram '))) continue
    const failedMs = Date.parse(item.finished_at!)
    if (failedMs > nowMs || nowMs >= failedMs + META_TERMINAL_ACCESS_COOLDOWN_MS) continue
    const checkpoint = target.meta_asset_sync_checkpoints?.find(c => c.platform === platform
      && (c.client_id == null || c.client_id === target.client_id))
    // Successful/new checkpoint, an explicitly changed mapping, or a genuine
    // re-connect receipt can supersede old failure history. Token-validation
    // reads/connection.updated_at alone are NOT proof of access recovery.
    if ([target.updated_at, connectionRecoveredAt, checkpoint?.last_successful_at,
      checkpoint?.last_status === 'complete' ? checkpoint.last_attempted_at : null]
      .some(value => value != null && Date.parse(value) > failedMs && Date.parse(value) <= nowMs)) continue
    const recordedCooldown = Date.parse(item.cooldown_until ?? '')
    const retryMs = Math.min(failedMs + META_TERMINAL_ACCESS_COOLDOWN_MS,
      Number.isFinite(recordedCooldown) && recordedCooldown > failedMs ? recordedCooldown : Infinity)
    if (nowMs >= retryMs) continue
    blocks.push({ platform, itemId: item.id, batchId: item.batch_id, failedAt: item.finished_at!,
      retryAt: new Date(retryMs).toISOString(),
      blocker: 'Meta permission/access blocked. Owner access or re-consent is required; automatic retry is temporarily paused.' })
  }
  return blocks
}
