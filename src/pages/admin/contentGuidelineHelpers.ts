import type { ClientOption } from '../../lib/commandCentre'
import type { DeliverableLabel } from '../../lib/contentWorkflow'
import type { ContentGuideStatus } from '../../lib/contentWorkflowRules'
import type { VideoProductionStatus } from '../../lib/videoPipelineRules'

// ── Shared Content Guideline helpers (no JSX) ────────────────────────────────
// Kept in a plain module so the component file can export only components
// (react-refresh). Shared by the Content Guidelines tab, the Video Pipeline
// board and the Content Run linked-guideline cards.

export const INPUT_CLS = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-teal/50'
export const LABEL_CLS = 'block text-[11px] font-black uppercase tracking-[0.12em] text-white/40'

export function clientName(clients: ClientOption[], id: string | null): string {
  if (!id) return 'No client'
  return clients.find(client => client.id === id)?.name ?? 'Unknown client'
}

export function copyToClipboard(text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) void navigator.clipboard.writeText(text)
}

export function deliverableLabelText(label: DeliverableLabel | undefined): string | null {
  if (!label) return null
  return `${label.code} ${label.instance_number} · ${label.title}`
}

export function videoStatusTone(status: VideoProductionStatus): 'teal' | 'amber' | 'neutral' {
  if (status === 'client_approved' || status === 'ready_for_client') return 'teal'
  if (status === 'not_shot') return 'neutral'
  return 'amber'
}

export function guideStatusTone(status: ContentGuideStatus): 'teal' | 'amber' | 'neutral' {
  if (status === 'approved' || status === 'completed') return 'teal'
  if (status === 'needs_review' || status === 'in_production' || status === 'added_to_run') return 'amber'
  return 'neutral'
}

export function humanizeStatus(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}
