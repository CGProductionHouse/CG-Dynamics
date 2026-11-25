import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveTikTokBusinessStatusCredential, type TikTokBusinessStatusCredentialConfig } from './tiktokBusinessStatusCredential.ts'
import type { TikTokBusinessReadBinding } from './tiktokBusinessPublishingStatus.ts'
import { boundedPublishingRead, readPublishingJson } from './socialPublishingRead.ts'

type Target = Omit<TikTokBusinessReadBinding, 'publishId'>
export interface TikTokBusinessRequirementsConfig extends TikTokBusinessStatusCredentialConfig { appSecret: string }
interface Options { fetch?: typeof fetch; now?: () => number; signal?: AbortSignal; readTimeoutMs?: number }
type Property = Readonly<{ type: 'domain' | 'prefix'; value: string }>
export interface TikTokBusinessPublishingRequirements {
  binding: Readonly<Target>; appId: string; checkedAt: string; canSubmit: false
  settings: Readonly<{ privacyOptions: readonly string[]; commentsDisabled: boolean; duetsDisabled: boolean; stitchesDisabled: boolean; maxVideoDurationSeconds: number }>
  verifiedProperties: readonly Property[]
}
export const TIKTOK_BUSINESS_MEDIA_MIN_TTL_SECONDS = 1800
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const PRIVACY = ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY', 'FOLLOWER_OF_CREATOR']
const DNS = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/
function fail(): never { throw new Error('TIKTOK_PUBLISHING_REQUIREMENTS_UNAVAILABLE') }
function domain(s: string): string | null {
  const lower = s.toLowerCase()
  if (!DNS.test(lower) || /(?:^|\.)(?:localhost|local|internal|lan)$/.test(lower)) return null
  return lower
}
/** Deliberately narrow HTTPS delivery profile. No redirects/DNS lookup/media
 * fetch occurs here; matching a hostname is not proof of public availability,
 * approved bytes, sufficient real URL lifetime or publication authority.
 */
function mediaUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string' || raw.length > 8192 || !/^https:\/\//i.test(raw) || /[\s\\]/.test(raw)) return null
  try {
    const url = new URL(raw), path = raw.split('?')[0].slice(raw.indexOf('://') + 3).replace(/^[^/]+/, '')
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || !domain(url.hostname)
      || /%|(?:^|\/)\.{1,2}(?:\/|$)|\/\//.test(path) || !/^\/[A-Za-z0-9_./~-]*$/.test(url.pathname)) return null
    return url
  } catch { return null }
}
function property(type: unknown, raw: unknown): Property {
  if (typeof raw !== 'string' || !raw || raw.length > 2048 || /[\s\\]/.test(raw)) fail()
  if (type === 1) {
    const host = domain(raw)
    if (!host) fail()
    return Object.freeze({ type: 'domain', value: host })
  }
  const url = mediaUrl(raw)
  if (type !== 2 || !url || url.search || !url.pathname.endsWith('/')) fail()
  return Object.freeze({ type: 'prefix', value: url.href })
}

/** PRIVATE, UNREGISTERED prerequisite reader. Existing encrypted Business store
 * and native identity/grant checks are reused. Settings use the account token;
 * app-level properties use the documented app_id/secret GET, not that token.
 * Neither the secret-bearing URL nor verification signatures are returned or
 * logged. No add/verify/delete property call, refresh, upload or publication.
 */
export async function readTikTokBusinessPublishingRequirements(sb: SupabaseClient, input: Readonly<Target>, configuration: TikTokBusinessRequirementsConfig,
  settings: Options = {}): Promise<TikTokBusinessPublishingRequirements> {
  if (!object(input)) fail()
  const target = Object.freeze({ clientId: input.clientId, connectionId: input.connectionId, accountId: input.accountId, route: input.route })
  const config = Object.freeze({ ...configuration }), options = Object.freeze({ ...settings })
  const now = options.now ?? Date.now, fetcher = options.fetch ?? fetch
  if (typeof config.appSecret !== 'string' || !config.appSecret || config.appSecret.length > 4096 || /\s/.test(config.appSecret)) fail()
  try {
    return await boundedPublishingRead(async signal => {
      const start = now()
      const checkpoint = () => { const time = now(); if (signal.aborted || !Number.isFinite(time) || time < start || time - start >= 60_000) fail(); return time }
      checkpoint()
      const optionsForRead = { ...options, signal }
      const first = await resolveTikTokBusinessStatusCredential(sb, target, config, optionsForRead)
      checkpoint()
      async function get(path: string, fields: Record<string, string>, useAccountToken: boolean) {
        checkpoint()
        const url = new URL(`https://business-api.tiktok.com/open_api/v1.3/${path}`)
        url.search = new URLSearchParams(fields).toString()
        const headers: Record<string, string> = { Accept: 'application/json' }
        if (useAccountToken) headers['Access-Token'] = first.accessToken
        const response = await fetcher(url.href, { method: 'GET', headers, redirect: 'error', signal })
        const value = await readPublishingJson(response, signal, { maxBytes: 262_144, invalid: () => new Error('TIKTOK_PUBLISHING_REQUIREMENTS_UNAVAILABLE'), aborted: () => new Error('TIKTOK_PUBLISHING_REQUIREMENTS_UNAVAILABLE') })
        checkpoint()
        if (!object(value) || value.code !== 0 || !object(value.data)) fail()
        return value.data
      }
      const native = await get('business/video/settings/', { business_id: target.accountId }, true)
      const privacy = native.privacy_level_options
      if (!Array.isArray(privacy) || privacy.length < 1 || privacy.length > PRIVACY.length || new Set(privacy).size !== privacy.length
        || privacy.some(p => typeof p !== 'string' || !PRIVACY.includes(p))
        || ['comment_disabled', 'duet_disabled', 'stitch_disabled'].some(k => typeof native[k] !== 'boolean')
        || !Number.isSafeInteger(native.max_video_post_duration_sec) || (native.max_video_post_duration_sec as number) < 3
        || (native.max_video_post_duration_sec as number) > 86_400) fail()
      // Despite its historical title, the current documented request is APP
      // scoped, with no advertiser_id/business_id/access-token parameter.
      const inventory = await get('business/property/list/', { app_id: config.appId, secret: config.appSecret }, false)
      if (Object.keys(inventory).join(',') !== 'url_property_info_list' || !Array.isArray(inventory.url_property_info_list)
        || inventory.url_property_info_list.length > 128) fail()
      const properties: Property[] = [], seen = new Set<string>()
      for (const row of inventory.url_property_info_list) {
        if (!object(row) || ![1, 2].includes(row.property_type as number) || ![0, 1, 2].includes(row.property_status as number)) fail()
        const value = property(row.property_type, row.url), key = `${value.type}:${value.value}`
        if (seen.has(key)) fail()
        seen.add(key)
        if (row.property_status === 1) properties.push(value)
        // signature/file_name deliberately ignored; they are not caller rights.
      }
      const last = await resolveTikTokBusinessStatusCredential(sb, target, config, optionsForRead)
      const checked = checkpoint()
      if (last.accessToken !== first.accessToken || last.tokenValidUntil !== first.tokenValidUntil
        || JSON.stringify(last.grantedScopes) !== JSON.stringify(first.grantedScopes)) fail()
      return Object.freeze({ binding: target, appId: config.appId, checkedAt: new Date(checked).toISOString(), canSubmit: false as const,
        settings: Object.freeze({ privacyOptions: Object.freeze([...privacy]), commentsDisabled: native.comment_disabled as boolean,
          duetsDisabled: native.duet_disabled as boolean, stitchesDisabled: native.stitch_disabled as boolean, maxVideoDurationSeconds: native.max_video_post_duration_sec as number }),
        verifiedProperties: Object.freeze(properties) })
    }, { milliseconds: options.readTimeoutMs, upstream: options.signal, error: () => new Error('TIKTOK_PUBLISHING_REQUIREMENTS_UNAVAILABLE') })
  } catch { return fail() }
}

/** Metadata blockers only, NOT media verification or a publish capability.
 * The lifetime is declared by a FUTURE private delivery adapter. This function
 * cannot establish actual expiry/availability/bytes, rights or account approval.
 */
export function checkTikTokDeliveryUrlMetadata(requirements: Readonly<TikTokBusinessPublishingRequirements>, target: Readonly<Target>, raw: string, expiresAt: string,
  now = Date.now()): { blockers: string[]; canSubmit: false } {
  const unavailable = () => ({ blockers: ['TIKTOK_FRESH_EXACT_REQUIREMENTS_REQUIRED'], canSubmit: false as const })
  if (!object(requirements) || !object(target) || !object(requirements.binding) || !object(requirements.settings) || !Array.isArray(requirements.settings.privacyOptions)
    || requirements.settings.privacyOptions.length < 1 || requirements.settings.privacyOptions.length > PRIVACY.length
    || requirements.settings.privacyOptions.some(p => typeof p !== 'string' || !PRIVACY.includes(p))
    || typeof requirements.appId !== 'string' || !/^\d{1,128}$/.test(requirements.appId)
    || !Array.isArray(requirements.verifiedProperties) || requirements.verifiedProperties.length > 128) return unavailable()
  try {
    for (const p of requirements.verifiedProperties) {
      if (!object(p) || typeof p.type !== 'string' || !['domain', 'prefix'].includes(p.type) || property(p.type === 'domain' ? 1 : 2, p.value).value !== p.value) return unavailable()
    }
  } catch { return unavailable() }
  const iso = (v: string) => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(v) ? Date.parse(v) : NaN
  const blockers: string[] = [], checked = iso(requirements.checkedAt), url = mediaUrl(raw), expires = iso(expiresAt)
  if (!Number.isFinite(now) || !Number.isFinite(checked) || checked > now || now - checked > 60_000 || requirements.canSubmit !== false
    || ['clientId', 'connectionId', 'accountId', 'route'].some(k => requirements.binding[k as keyof Target] !== target[k as keyof Target])) blockers.push('TIKTOK_FRESH_EXACT_REQUIREMENTS_REQUIRED')
  if (!requirements.settings.privacyOptions.includes('PUBLIC_TO_EVERYONE')) blockers.push('TIKTOK_PUBLIC_VIDEO_PRIVACY_UNAVAILABLE')
  if (!url || url.pathname === '/') blockers.push('TIKTOK_HTTPS_MEDIA_URL_REQUIRED')
  else if (!requirements.verifiedProperties.some(p => p.type === 'domain'
    ? url.hostname === p.value || url.hostname.endsWith(`.${p.value}`)
    : url.href.startsWith(p.value))) blockers.push('TIKTOK_VERIFIED_URL_PROPERTY_REQUIRED')
  if (!Number.isFinite(expires) || expires - now < TIKTOK_BUSINESS_MEDIA_MIN_TTL_SECONDS * 1000) blockers.push('TIKTOK_MEDIA_URL_LIFETIME_REQUIRED')
  return { blockers, canSubmit: false }
}
