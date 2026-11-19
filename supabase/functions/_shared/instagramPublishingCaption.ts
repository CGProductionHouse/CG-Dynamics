export type InstagramCaptionBlocker = 'INSTAGRAM_CAPTION_INVALID' | 'INSTAGRAM_CAPTION_TOO_LONG' | 'INSTAGRAM_HASHTAG_LIMIT' | 'INSTAGRAM_MENTION_LIMIT'

/** Deterministic, conservative single-photo text profile. Meta documents 2200
 * characters /30 hashtags /20 @ tags; its Unicode counting/tokenization is not
 * specified. This pilot bounds UTF-16 units and lexical tag occurrences, never
 * normalizes, truncates, removes duplicate tags or rewrites approved text.
 * Existing accepted receipts must remain readable without NEW-post admission.
 */
export function instagramCaptionBlocker(value: unknown): InstagramCaptionBlocker | null {
  if (typeof value !== 'string' || !value.length) return 'INSTAGRAM_CAPTION_INVALID'
  if (value.length > 2200) return 'INSTAGRAM_CAPTION_TOO_LONG'
  if (!value.trim() || value.includes('\0')) return 'INSTAGRAM_CAPTION_INVALID'
  // URLSearchParams/TextEncoder replace unpaired surrogates. Reject rather than
  // letting transport change the immutable approved caption during encoding.
  for (let p = 0; p < value.length; p++) {
    const c = value.charCodeAt(p)
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = value.charCodeAt(++p)
      if (!(next >= 0xdc00 && next <= 0xdfff)) return 'INSTAGRAM_CAPTION_INVALID'
    } else if (c >= 0xdc00 && c <= 0xdfff) return 'INSTAGRAM_CAPTION_INVALID'
  }
  if ((value.match(/#[\p{L}\p{M}\p{N}_]+/gu)?.length ?? 0) > 30) return 'INSTAGRAM_HASHTAG_LIMIT'
  // Email local parts are not standalone @mentions. Do not strip the email or
  // count its domain as an extra account tag in a normal business caption.
  if ((value.match(/(?<![\p{L}\p{M}\p{N}_@])@[a-zA-Z0-9_][a-zA-Z0-9_.]*/gu)?.length ?? 0) > 20) return 'INSTAGRAM_MENTION_LIMIT'
  return null
}

export function requireInstagramPublishingCaption(value: unknown): void {
  const blocker = instagramCaptionBlocker(value)
  if (blocker) throw new Error(blocker)
}
