import path from 'node:path'

const SECRET_PATH_SEGMENTS = new Set([
  '.env', '.vercel', '.git', 'node_modules', 'dist', 'coverage',
])

const PROTECTED_PATHS = [
  /^\.github\//,
  /^dev-bridge\//,
  /^scripts\//,
  /^(?:package|package-lock)\.json$/,
  /^vercel\.json$/,
  /^(?:vite|eslint|tsconfig[^/]*)\.(?:ts|js|json)$/,
  /^supabase\/migrations\//,
  /^supabase\/functions\/_shared\/auth\.ts$/,
  /(^|\/)AGENTS\.md$/,
]

const SECRET_PATTERNS = [
  /\b(?:ghp|github_pat|ghs|ghu)_[A-Za-z0-9_]{20,}\b/g,
  /\b(?:sb_secret|sb_publishable)_[A-Za-z0-9_-]{20,}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  /((?:api[_-]?key|access[_-]?token|client[_-]?secret|service[_-]?role|password)\s*[:=]\s*)[^\s,;]+/gi,
]

export function normalizeRepoPath(input: string): string {
  const value = input.replaceAll('\\', '/').replace(/^\/+/, '')
  const normalized = path.posix.normalize(value)
  if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
    throw new Error('Path must stay inside the CG Dynamics repository.')
  }
  const segments = normalized.split('/')
  if (segments.some(segment => SECRET_PATH_SEGMENTS.has(segment) || segment.startsWith('.env'))) {
    throw new Error('That path is not available through the development bridge.')
  }
  return normalized
}

export function assertWritablePath(input: string): string {
  const normalized = normalizeRepoPath(input)
  if (PROTECTED_PATHS.some(pattern => pattern.test(normalized))) {
    throw new Error(`Protected path requires a separately reviewed change: ${normalized}`)
  }
  return normalized
}

export function assertDevelopmentBranch(branch: string): string {
  const value = branch.trim()
  if (!/^(?:feat|fix|docs|test|chore)\/[a-z0-9][a-z0-9._/-]{2,80}$/.test(value)) {
    throw new Error('Use a scoped development branch such as fix/assistant-voice-pause.')
  }
  if (value === 'main' || value === 'master' || value.startsWith('production')) {
    throw new Error('Default and production branches are protected.')
  }
  return value
}

export function redactText(input: string, maxChars = 20_000): string {
  let value = input.slice(0, maxChars)
  for (const pattern of SECRET_PATTERNS) {
    value = value.replace(pattern, (...matches: string[]) => `${matches[1] ?? ''}[REDACTED]`)
  }
  return value
}

export function assertNoSecretMaterial(input: string): void {
  if (SECRET_PATTERNS.some(pattern => {
    pattern.lastIndex = 0
    return pattern.test(input)
  })) throw new Error('Potential credential material cannot be committed through the bridge.')
}

export function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[TRUNCATED]'
  if (typeof value === 'string') return redactText(value)
  if (Array.isArray(value)) return value.slice(0, 500).map(item => redactValue(item, depth + 1))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 500).map(([key, item]) => [key, redactValue(item, depth + 1)]))
  }
  return value
}

export function boundedInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)))
}
