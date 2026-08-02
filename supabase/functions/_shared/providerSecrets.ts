export type AiProviderName = 'openrouter' | 'gemini' | 'groq' | 'openai'
export type AiProviderCapability = 'text' | 'transcription'
export type ProviderSecretSource = 'canonical' | 'legacy' | 'missing'

const PROVIDER_SECRET_NAMES: Record<AiProviderName, { canonical: string; legacy?: string }> = {
  openrouter: { canonical: 'OPENROUTER_API_KEY' },
  gemini: { canonical: 'GEMINI_API_KEY' },
  groq: { canonical: 'GROQ_API_KEY', legacy: 'Grok' },
  openai: { canonical: 'OPENAI_API_KEY' },
}

export function isAiProviderName(value: string): value is AiProviderName {
  return value === 'openrouter' || value === 'gemini' || value === 'groq' || value === 'openai'
}

export function providerSupportsCapability(provider: AiProviderName, capability: AiProviderCapability): boolean {
  return capability === 'text' || provider !== 'openrouter'
}

export function providerIsOptional(provider: AiProviderName, capability: AiProviderCapability): boolean {
  if (capability === 'text') return provider !== 'openrouter'
  return provider !== 'groq'
}

export function resolveProviderSecret(provider: AiProviderName): {
  value: string | null
  source: ProviderSecretSource
} {
  const names = PROVIDER_SECRET_NAMES[provider]
  const canonical = (Deno.env.get(names.canonical) ?? '').trim()
  if (canonical) return { value: canonical, source: 'canonical' }

  const legacy = names.legacy ? (Deno.env.get(names.legacy) ?? '').trim() : ''
  if (legacy) return { value: legacy, source: 'legacy' }
  return { value: null, source: 'missing' }
}

export function configuredProviderNames(capability: AiProviderCapability, candidates?: string[]): AiProviderName[] {
  const allowed = candidates ? new Set(candidates.filter(isAiProviderName)) : null
  return (Object.keys(PROVIDER_SECRET_NAMES) as AiProviderName[])
    .filter(provider => (!allowed || allowed.has(provider)) && providerSupportsCapability(provider, capability) && resolveProviderSecret(provider).value)
}
