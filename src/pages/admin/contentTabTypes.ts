export type ContentTab = 'overview' | 'runs' | 'guidelines' | 'pipeline' | 'library'

export function resolveContentTab(value: string | null, fallback: ContentTab): ContentTab {
  if (value === 'guides') return 'library'
  if (value === 'overview' || value === 'runs' || value === 'guidelines' || value === 'pipeline' || value === 'library') return value
  return fallback
}
