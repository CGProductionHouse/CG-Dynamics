// Deno edge copy of src/lib/humanCreativeStandard.ts — keep in sync (guarded by tests/clientIntelligenceIntegration.test.mjs).
// Shared, cross-client human creative standard for caption/content/poster/campaign
// task packets (#248). This is the permanent CG creative-quality contract that every
// client inherits automatically, on top of the client's exact voice rules.
//
// Kept intentionally compact so task packets stay small (#241/#248 compact retrieval).
// Facts still obey provenance/freshness/claim guardrails — this governs voice, not truth.

export const DEFAULT_MAX_HASHTAGS = 5

/** The human-copy quality contract applied to every client (#248 core principle). */
export const HUMAN_CREATIVE_STANDARD: string[] = [
  'Correct facts are the floor, not the finished marketing. Write like a sharp person who knows this client, audience, platform and moment.',
  'Start from the actual content (what is in the image/video/artwork, who speaks, what happens, why the reader should care). Do not restate the artwork.',
  'Add a layer: context, a useful detail, a point of view, feeling, tension, curiosity or a reason to act.',
  'Sound human: vary sentence length, openings, rhythm and CTA. Avoid repeated templates and recurring AI phrasing.',
  'Respect the exact client voice — the same task for two clients must read observably differently.',
  'Use local language (Afrikaans/English/colloquial) only when it genuinely improves the line; never force slang or language-mixing for effect.',
  'Humour or edge only where the client and subject support it; never on sensitive or serious subject matter.',
  'Never invent facts for creativity; obey provenance, freshness and claim guardrails.',
  'Do not optimise into blandness — SEO, hashtags and CTA requirements must not flatten the writing.',
  'Published historical captions prove footer/branch/format conventions only; they are the minimum, not the creative ceiling.',
]

/** Generic AI/corporate filler to reject by default (CG anti-slop list, #248). */
export const ANTI_SLOP_PATTERNS: string[] = [
  'elevate your experience',
  'discover the difference',
  'where quality meets',
  'experience excellence',
  'your trusted partner',
  'something for everyone',
  'take it to the next level',
  'unlock the power',
  "we've got you covered",
  'the perfect choice',
  'look no further',
  'second to none',
  'one-stop shop',
  'quality you can trust',
]

/** Dynamic hashtag rule (#248): max 5 by default, chosen fresh — never a static bank dump. */
export const HASHTAG_RULES = {
  default_max: DEFAULT_MAX_HASHTAGS,
  dynamic: true,
  rules: [
    `Default maximum ${DEFAULT_MAX_HASHTAGS} hashtags unless an explicit client/platform rule supersedes it.`,
    'Choose the strongest current set for the exact client/entity, topic, product/service, location, industry and platform.',
    'Stored hashtag banks are seed/reference only — never paste the same set mechanically on every post.',
    'Never label a hashtag "trending" without reliable current evidence; otherwise choose strong evergreen/search terms.',
    'Platform-specific behaviour matters — do not blindly reuse one set across Facebook, Instagram, TikTok and LinkedIn.',
    'Hashtags must never create false claims about branches, partners, services, locations or stock.',
    'Use natural searchable wording in the caption itself; discoverability is not only hashtags.',
  ],
} as const

/** Return the anti-slop phrases present in `text` (case-insensitive). Empty = clean. */
export function flagAntiSlop(text: string): string[] {
  const lower = (text ?? '').toLowerCase()
  return ANTI_SLOP_PATTERNS.filter(pattern => lower.includes(pattern))
}
