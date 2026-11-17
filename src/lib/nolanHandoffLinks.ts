import { isSafeHttpUrl } from './videoPipelineRules'

/** Presentation-only guard for an already-recorded URL, not a fetch, approval,
 * upload or assertion that the target is accessible or belongs to this video. */
export function nolanHandoffHref(value: string | null | undefined): string | null {
  if (!isSafeHttpUrl(value)) return null
  try {
    const url = new URL(value!.trim())
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null
    return url.href
  } catch { return null }
}
