export type ContentTab = 'overview' | 'runs' | 'guidelines' | 'pipeline'

export function resolveContentTab(value: string | null, fallback: ContentTab): ContentTab {
  if (value === 'guides' || value === 'library') return 'guidelines'
  if (value === 'overview' || value === 'runs' || value === 'guidelines' || value === 'pipeline') return value
  return fallback
}
