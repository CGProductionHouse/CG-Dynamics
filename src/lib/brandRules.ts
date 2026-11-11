// ── Client brand rules — pure helpers (no I/O) ────────────────────────────────
//
// Shared by the data layer (src/lib/db/clientBrand.ts) and the staff-only
// brand panel on the Video Pipeline. No Supabase import, so the rules are
// unit-tested in tests/brandRules.test.mjs.

export type BrandRulePriority = 'must' | 'should'

export type BrandRuleCategory =
  | 'copy' | 'type' | 'colour' | 'logo' | 'layout'
  | 'motion' | 'audio' | 'devices' | 'backgrounds' | 'delivery'

export const BRAND_RULE_CATEGORIES: Array<{ value: BrandRuleCategory; label: string }> = [
  { value: 'copy', label: 'On-screen copy' },
  { value: 'type', label: 'Typography' },
  { value: 'colour', label: 'Colour' },
  { value: 'logo', label: 'Logo' },
  { value: 'layout', label: 'Layout' },
  { value: 'motion', label: 'Motion' },
  { value: 'audio', label: 'Music and sound' },
  { value: 'devices', label: 'Device mockups' },
  { value: 'backgrounds', label: 'Backgrounds' },
  { value: 'delivery', label: 'Delivery' },
]

export interface BrandColour {
  hex: string
  role?: string
}

export interface ClientBrandRule {
  id: string
  client_id: string | null
  priority: BrandRulePriority
  category: BrandRuleCategory
  rule: string
  source: string | null
  created_at: string
  retired_at: string | null
}

const HEX = /^#[0-9a-f]{6}$/
const KIT_ID = /^[A-Za-z0-9_-]{6,40}$/

export function normaliseHex(value: string): string | null {
  const trimmed = value.trim().toLowerCase()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (/^#[0-9a-f]{3}$/.test(withHash)) {
    return `#${withHash.slice(1).split('').map(char => char + char).join('')}`
  }
  return HEX.test(withHash) ? withHash : null
}

// Parses free text such as "#9b4f1b orange, 0a2f37 teal" into colours. Unknown
// fragments are reported back so the form can say exactly what it rejected.
export function parseColourList(input: string): { colours: BrandColour[]; rejected: string[] } {
  const colours: BrandColour[] = []
  const rejected: string[] = []
  const seen = new Set<string>()
  for (const part of input.split(/[,\n;]+/).map(entry => entry.trim()).filter(Boolean)) {
    const [first, ...rest] = part.split(/\s+/)
    const hex = normaliseHex(first)
    if (!hex) { rejected.push(part); continue }
    if (seen.has(hex)) continue
    seen.add(hex)
    const role = rest.join(' ').trim()
    colours.push(role ? { hex, role } : { hex })
  }
  return { colours, rejected }
}

export function formatColourList(colours: BrandColour[]): string {
  return colours.map(colour => (colour.role ? `${colour.hex} ${colour.role}` : colour.hex)).join(', ')
}

// Accepts a bare Canva brand kit id or a canva.com/brand/<id> link.
export function parseCanvaBrandKitId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const fromUrl = trimmed.match(/canva\.com\/brand\/([A-Za-z0-9_-]+)/)
  const id = fromUrl ? fromUrl[1] : trimmed
  return KIT_ID.test(id) ? id : null
}

export function canvaBrandKitUrl(kitId: string | null | undefined): string | null {
  return kitId && KIT_ID.test(kitId) ? `https://www.canva.com/brand/${kitId}` : null
}

export function validateRuleText(rule: string): string | null {
  const length = rule.trim().length
  if (length < 3) return 'Write the rule in a few words'
  if (length > 500) return 'Keep the rule under 500 characters'
  return null
}

// Active rules that apply to one client: its own rules plus house rules.
// "Must" before "should", then client rules before house rules, then oldest
// first so the order editors see stays stable.
export function rulesForClient(rules: ClientBrandRule[], clientId: string): ClientBrandRule[] {
  return rules
    .filter(rule => !rule.retired_at && (rule.client_id === clientId || rule.client_id === null))
    .sort((a, b) =>
      (a.priority === b.priority ? 0 : a.priority === 'must' ? -1 : 1)
      || (a.client_id === b.client_id ? 0 : a.client_id === null ? 1 : -1)
      || a.created_at.localeCompare(b.created_at))
}

export function categoryLabel(category: BrandRuleCategory): string {
  return BRAND_RULE_CATEGORIES.find(entry => entry.value === category)?.label ?? category
}

// Plain-text block for pasting into an editing chat or brief.
export function brandBriefText(input: {
  clientName: string
  colours: BrandColour[]
  fonts: string[]
  toneVoice: string | null
  canvaKitId: string | null
  rules: ClientBrandRule[]
}): string {
  const lines = [`Brand rules: ${input.clientName}`]
  const kit = canvaBrandKitUrl(input.canvaKitId)
  if (kit) lines.push(`Canva brand kit: ${kit}`)
  if (input.colours.length) lines.push(`Colours: ${formatColourList(input.colours)}`)
  if (input.fonts.length) lines.push(`Fonts: ${input.fonts.join(', ')}`)
  if (input.toneVoice) lines.push(`Voice: ${input.toneVoice}`)
  for (const rule of input.rules) {
    lines.push(`${rule.priority === 'must' ? 'MUST' : 'SHOULD'} (${rule.client_id ? 'client' : 'house'}, ${categoryLabel(rule.category)}): ${rule.rule}`)
  }
  return lines.join('\n')
}
