export interface DirectoryEntry { id: string; name: string }
export interface EntityCandidate { id: string; name: string; confidence: number }
export type ResolutionStatus = 'resolved' | 'ambiguous' | 'unresolved'
export interface EntityResolution {
  id: string | null
  name: string | null
  status: ResolutionStatus
  candidates: EntityCandidate[]
}

export function normaliseEntityName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function consonantKey(value: string): string {
  return normaliseEntityName(value).replace(/[aeiouy]/g, '').replace(/(.)\1+/g, '$1')
}

function levenshtein(a: string, b: string): number {
  if (!a) return b.length
  if (!b) return a.length
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const saved = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = saved
    }
  }
  return row[b.length]
}

export function entityNameSimilarity(a: string, b: string): number {
  const left = normaliseEntityName(a)
  const right = normaliseEntityName(b)
  if (!left || !right) return 0
  if (left === right) return 1
  if (Math.min(left.length, right.length) >= 5 && (left.includes(right) || right.includes(left))) return 0.92
  const edit = 1 - levenshtein(left, right) / Math.max(left.length, right.length)
  const leftSound = consonantKey(left)
  const rightSound = consonantKey(right)
  const sound = leftSound.length >= 3 && leftSound === rightSound ? 0.88 : 0
  return Math.max(edit, sound)
}

function entityWords(value: string): string[] {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .split(/[^a-z0-9]+/).filter(Boolean)
}

export function entityMentionedInText(entityName: string, text: string): boolean {
  const targetWords = entityWords(entityName)
  const textWords = entityWords(text)
  if (!targetWords.length || !textWords.length) return false
  if (normaliseEntityName(text).includes(normaliseEntityName(entityName))) return true
  const minimumWindow = Math.max(1, targetWords.length - 1)
  const maximumWindow = Math.min(textWords.length, targetWords.length + 1)
  for (let size = minimumWindow; size <= maximumWindow; size += 1) {
    for (let start = 0; start + size <= textWords.length; start += 1) {
      if (entityNameSimilarity(entityName, textWords.slice(start, start + size).join(' ')) >= 0.78) return true
    }
  }
  return false
}

export function resolveDirectoryEntity(raw: unknown, entries: DirectoryEntry[], preferredId?: string | null): EntityResolution {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) return { id: null, name: null, status: 'unresolved', candidates: [] }
  const ranked = entries
    .map(entry => ({ ...entry, confidence: entityNameSimilarity(value, entry.name) + (preferredId === entry.id ? 0.03 : 0) }))
    .sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name))
  const top = ranked[0]
  const second = ranked[1]
  if (top && top.confidence >= 0.78 && (!second || top.confidence - second.confidence >= 0.1)) {
    return { id: top.id, name: top.name, status: 'resolved', candidates: [top] }
  }
  const candidates = ranked.filter(entry => entry.confidence >= 0.52).slice(0, 2)
  return { id: null, name: value, status: candidates.length ? 'ambiguous' : 'unresolved', candidates }
}
