export type MetaRateLimitScope = 'item' | 'batch'

export function metaRateLimitScope(message: string): MetaRateLimitScope | null {
  const code = message.match(/(?:code:\s*|Graph code\s*)(4|17|32|341|613)\b/i)?.[1]
  if (code === '32') return 'item'
  if (code) return 'batch'
  if (/HTTP 429|rate.?limit|request limit reached/i.test(message)) {
    return /\bpage\b/i.test(message) ? 'item' : 'batch'
  }
  return null
}
