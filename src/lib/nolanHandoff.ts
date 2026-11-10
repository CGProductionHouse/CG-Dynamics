import type { ContentGuideIdea, ContentGuidelineDocument } from './contentWorkflow'

export const NOLAN_START_GUIDE = 'https://github.com/CGProductionHouse/CG-Dynamics/blob/codex/nolan-office-research-874/NOLAN-START-HERE.md'

export function videoPipelinePath(videoId: string): string {
  return `/admin/content?${new URLSearchParams({ tab: 'pipeline', video: videoId })}`
}

export function buildNolanHandoff(
  video: ContentGuideIdea,
  documents: ContentGuidelineDocument[],
  origin: string,
): string | null {
  const document = documents.find(({ guideline }) => guideline.id === video.content_guideline_id)
  if (!video.client_id || !document) return null
  const { guideline, run, videos } = document
  if (
    guideline.status === 'archived'
    || run.status === 'cancelled'
    || guideline.client_id !== video.client_id
    || guideline.content_run_id !== run.id
    || run.client_id !== video.client_id
    || !videos.some(item => item.id === video.id && item.client_id === video.client_id)
  ) return null

  const url = new URL(videoPipelinePath(video.id), origin)
  return [
    'Prepare this exact Nolan edit from the CG Dynamics staff record.',
    `Staff link: ${url.href}`,
    `Client ID: ${video.client_id} | Content Run ID: ${run.id} | Video ID: ${video.id}`,
    'Resolve this client in CG Dynamics and read the saved guideline video and current feedback. Verify the active editor and latest revision.',
    `Read the Nolan start guide (${NOLAN_START_GUIDE}) and this client’s existing OneDrive video kit before asking for brand details. Use Canva to verify missing or changed assets.`,
    'Prepare the hook, timed scenes, verified sources and motion approach. Show key frames and retain editable source for a protected revision. Keep picture, sound and approval checks separate.',
    'Report any missing evidence. This handoff prepares the edit for internal review. Get explicit approval before publishing or sending.',
  ].join('\n')
}
