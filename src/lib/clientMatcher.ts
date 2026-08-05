// Generic client identity matching (PR 4).
//
// Client recognition was hardcoded: commandCentre.ts carried a CLIENT_ALIASES
// map of twelve real client names, so every new client needed a code change and
// clients absent from the map silently failed to match.
//
// Nothing here names a client. Every form is derived from the active directory,
// so a client added tomorrow matches with no deployment. The only stored data is
// `client_aliases`, which exists for spellings that CANNOT be derived — an
// external system's typo like "actio sports" — and even those live in the
// database beside the client, not in code.
//
// The second defect this closes: the suggestion badge and the actual client
// field could disagree, because the UI computed a suggestion separately from the
// value it saved. `matchClient` returns ONE object that carries both, so a
// suggestion that is not also the selected client is unrepresentable.

export interface ClientDirectoryEntry {
  id: string
  name: string
  active: boolean
  /** Non-derivable spellings from client_aliases. Optional. */
  aliases?: string[]
}

export type ClientMatchConfidence = 'exact' | 'alias' | 'distinctive' | 'shortened' | 'none'

export interface ClientMatch {
  /** Populated ONLY when confident. Never a guess. */
  clientId: string | null
  /** Always agrees with clientId — both are set together or neither is. */
  clientName: string | null
  confidence: ClientMatchConfidence
  /** Why nothing was selected, or which clients were in contention. */
  reason: string
  /** Names that tied. Non-empty means the operator must choose. */
  ambiguousBetween: string[]
  /** The text with the matched client words removed, for title cleanup. */
  remaining: string
}

// ── Normalisation ───────────────────────────────────────────────────────────

/** Accents, punctuation, apostrophes, hyphens and spacing are all noise. */
export function normaliseClientText(value: string): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip accents
    .replace(/[’']/g, '')              // apostrophes join: O'Brien -> obrien
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/** Punctuation-insensitive single token, e.g. "RC-Polypipe" -> "rcpolypipe". */
function squash(value: string): string {
  return normaliseClientText(value).replace(/ /g, '')
}

// Legal suffixes and joining words. These are dropped when deriving a SHORTENED
// form, but are never dropped from the full name comparison — "Piek Group" must
// still match its own full name exactly.
const LEGAL_SUFFIXES = new Set(['pty', 'ltd', 'limited', 'cc', 'inc', 'co', 'company'])
const LEADING_WORDS = new Set(['the', 'a', 'an'])
// Words too weak to identify a client on their own. Deliberately small: removing
// every common word globally creates false matches, so this only covers words
// that carry no identity at all.
const WEAK_TOKENS = new Set([
  ...LEGAL_SUFFIXES, ...LEADING_WORDS,
  'and', 'of', 'for', 'in', 'on', 'at', 'to', 'vir', 'die', 'en',
  'group', 'holdings', 'services', 'solutions', 'trading', 'enterprises',
])

// Words that describe the WORK rather than a client. A client may legitimately
// have one in its name ("Video Kreatief"), but seeing the word alone in a task
// line must never select that client — someone writing "video design poster"
// is describing a deliverable, not naming a customer.
//
// This names no client and needs no maintenance per client: the full name still
// matches as a phrase, and a multi-word run still matches a derived form. Only
// a BARE work word is refused as a distinctive token.
const WORK_WORDS = new Set([
  'video', 'videos', 'reel', 'reels', 'bts', 'edit', 'edits', 'shoot', 'shoots',
  'audio', 'music', 'liedjie', 'photo', 'photos', 'poster', 'posters',
  'design', 'designs', 'logo', 'logos', 'menu', 'profile', 'website', 'web',
  'landing', 'page', 'shopify', 'wordpress', 'content', 'guide', 'guideline',
  'caption', 'captions', 'posting', 'plan', 'report', 'reports', 'request',
  'requests', 'change', 'changes', 'campaign', 'strategy', 'admin', 'asap',
  'urgent', 'next', 'month', 'week', 'day', 'quiz', 'night', 'new', 'update',
  'updates', 'social', 'socials', 'post', 'posts', 'shorts', 'story', 'stories',
])

function tokens(value: string): string[] {
  return normaliseClientText(value).split(' ').filter(Boolean)
}

/** Meaningful tokens: identity-bearing words only. */
function meaningfulTokens(value: string): string[] {
  return tokens(value).filter(token => token.length > 1 && !WEAK_TOKENS.has(token))
}

/**
 * The forms a client may legitimately be written as, all derived.
 *
 * - the full name, squashed (punctuation-insensitive)
 * - the full name without a harmless leading word ("The Staffy" -> "staffy")
 * - the full name without legal suffixes
 * - any stored non-derivable alias
 */
function derivedForms(entry: ClientDirectoryEntry): string[] {
  const forms = new Set<string>()
  const all = tokens(entry.name)

  forms.add(squash(entry.name))

  if (all.length > 1 && LEADING_WORDS.has(all[0])) forms.add(all.slice(1).join(''))

  const withoutSuffix = all.filter(token => !LEGAL_SUFFIXES.has(token))
  if (withoutSuffix.length > 0) forms.add(withoutSuffix.join(''))

  for (const alias of entry.aliases ?? []) {
    const squashed = squash(alias)
    if (squashed) forms.add(squashed)
  }

  return [...forms].filter(Boolean)
}

function activeOnly(directory: ClientDirectoryEntry[]): ClientDirectoryEntry[] {
  return directory.filter(entry => entry.active && entry.name?.trim())
}

/**
 * Which clients own each meaningful token.
 *
 * A token owned by exactly one active client identifies that client. A token
 * owned by several — "supa" across two Supa Quick branches — identifies nobody
 * and must never auto-select.
 */
function buildTokenIndex(directory: ClientDirectoryEntry[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>()
  for (const entry of activeOnly(directory)) {
    const sources = [entry.name, ...(entry.aliases ?? [])]
    for (const source of sources) {
      for (const token of meaningfulTokens(source)) {
        const owners = index.get(token) ?? new Set<string>()
        owners.add(entry.id)
        index.set(token, owners)
      }
    }
  }
  return index
}

function stripMatched(text: string, matchedTokens: string[]): string {
  let out = text
  for (const token of matchedTokens) {
    out = out.replace(new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), ' ')
  }
  return out.replace(/\s+/g, ' ').trim()
}

function noMatch(text: string, reason: string, ambiguousBetween: string[] = []): ClientMatch {
  return { clientId: null, clientName: null, confidence: 'none', reason, ambiguousBetween, remaining: text }
}

/**
 * Match a client from free text against the ACTIVE directory.
 *
 * Selects only when the answer is unique. Ambiguity, weak words and inactive
 * clients all return no selection with a reason, so the operator chooses rather
 * than the app guessing.
 */
export function matchClient(text: string, directory: ClientDirectoryEntry[]): ClientMatch {
  const active = activeOnly(directory)
  if (!text?.trim() || active.length === 0) return noMatch(text ?? '', 'No text to match.')

  const normalised = normaliseClientText(text)
  const textTokens = tokens(text)

  // 1. A full name (or a stored alias) appearing as a phrase in the text.
  //     ALL matches are collected before choosing. Returning on the first hit
  //     let "toyota and psg joint shoot" silently select PSG while Toyota
  //     Bloemfontein was named in the very same line.
  const phraseHits = new Map<string, { entry: ClientDirectoryEntry; phrase: string; isAlias: boolean }>()
  for (const entry of active) {
    for (const source of [entry.name, ...(entry.aliases ?? [])]) {
      const phrase = normaliseClientText(source)
      if (!phrase) continue
      const pattern = new RegExp(`(^|\\s)${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`)
      if (!pattern.test(normalised)) continue
      const existing = phraseHits.get(entry.id)
      // Keep the longest matching phrase for a client, so "Supa Quick BFN"
      // beats a shorter overlap within the same client.
      if (!existing || phrase.length > existing.phrase.length) {
        phraseHits.set(entry.id, { entry, phrase, isAlias: normaliseClientText(entry.name) !== phrase })
      }
    }
  }
  // Distinctive tokens: a word owned by exactly one active client.
  const tokenIndex = buildTokenIndex(active)
  const tokenCandidates = new Map<string, string[]>()
  const sharedTokenOwners = new Set<string>()
  for (const token of new Set(textTokens)) {
    // A bare work word never identifies a client, even when exactly one client
    // happens to carry it in their name.
    if (token.length <= 1 || WEAK_TOKENS.has(token) || WORK_WORDS.has(token)) continue
    const owners = tokenIndex.get(token)
    if (!owners) continue
    if (owners.size > 1) {
      // A meaningful word shared by several clients decides nothing, but the
      // operator still needs to know WHICH clients were in contention.
      for (const id of owners) sharedTokenOwners.add(id)
      continue
    }
    const ownerId = [...owners][0]
    tokenCandidates.set(ownerId, [...(tokenCandidates.get(ownerId) ?? []), token])
  }

  // Derived forms matched against runs of ADJACENT TOKENS, never a raw substring
  // of the whole text. A plain `includes` would let a three-letter client such
  // as "TBS" match inside an unrelated word.
  const runs = new Set<string>()
  for (let from = 0; from < textTokens.length; from++) {
    let run = ''
    for (let to = from; to < textTokens.length && to < from + 5; to++) {
      run += textTokens[to]
      runs.add(run)
    }
  }
  const formCandidates = new Set<string>()
  for (const entry of active) {
    for (const form of derivedForms(entry)) {
      if (form && runs.has(form)) formCandidates.add(entry.id)
    }
  }

  // ── One decision from every signal ────────────────────────────────────────
  // Deciding on the first signal that fired is what let "toyota and psg joint
  // shoot" select PSG while Toyota Bloemfontein was named in the same line.
  const allCandidates = new Set<string>([
    ...phraseHits.keys(), ...formCandidates, ...tokenCandidates.keys(),
  ])

  if (allCandidates.size > 1) {
    // One client's name may sit INSIDE another's ("Supa Quick" within "Supa
    // Quick BFN"). That is containment, not a real conflict.
    const hits = [...phraseHits.values()].sort((a, b) => b.phrase.length - a.phrase.length)
    if (hits.length === allCandidates.size && hits.length > 1) {
      const longest = hits[0]
      if (hits.slice(1).every(h => longest.phrase.includes(h.phrase))) {
        return {
          clientId: longest.entry.id,
          clientName: longest.entry.name,
          confidence: longest.isAlias ? 'alias' : 'exact',
          reason: '',
          ambiguousBetween: [],
          remaining: stripMatched(text, longest.phrase.split(' ')),
        }
      }
    }
    const names = active.filter(c => allCandidates.has(c.id)).map(c => c.name).sort()
    return noMatch(text, `Text names more than one active client: ${names.join(', ')}.`, names)
  }

  if (allCandidates.size === 1) {
    const id = [...allCandidates][0]
    const entry = active.find(c => c.id === id) as ClientDirectoryEntry
    const phrase = phraseHits.get(id)
    if (phrase) {
      return {
        clientId: entry.id,
        clientName: entry.name,
        confidence: phrase.isAlias ? 'alias' : 'exact',
        reason: '',
        ambiguousBetween: [],
        remaining: stripMatched(text, phrase.phrase.split(' ')),
      }
    }
    return {
      clientId: entry.id,
      clientName: entry.name,
      confidence: formCandidates.has(id) ? 'shortened' : 'distinctive',
      reason: '',
      ambiguousBetween: [],
      remaining: stripMatched(text, tokenCandidates.get(id) ?? meaningfulTokens(entry.name)),
    }
  }

  if (sharedTokenOwners.size > 1) {
    const names = active.filter(c => sharedTokenOwners.has(c.id)).map(c => c.name).sort()
    return noMatch(text, `Text matches more than one active client: ${names.join(', ')}.`, names)
  }

  return noMatch(text, 'No active client recognised in this text.')
}

/**
 * The single source of truth for what the UI shows AND what it saves.
 *
 * A suggestion badge that disagrees with the selected client is impossible by
 * construction: both read these fields. `showSuggestion` is only ever true when
 * `clientId` is populated.
 */
export function clientSelection(match: ClientMatch) {
  const selected = match.clientId !== null && match.clientName !== null
  return {
    clientId: selected ? match.clientId : null,
    clientName: selected ? match.clientName : null,
    showSuggestion: selected,
    suggestionLabel: selected ? match.clientName : null,
    needsManualSelection: !selected,
    reason: match.reason,
    ambiguousBetween: match.ambiguousBetween,
  }
}
