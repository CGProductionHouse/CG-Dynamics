import type { ContentGuideIdea } from '../../lib/contentWorkflow'
import { nolanHandoffHref } from '../../lib/nolanHandoffLinks'

type HandoffEvidence = Pick<ContentGuideIdea,
  'deliverable_id' | 'production_status_updated_at' | 'onedrive_footage_url' |
  'onedrive_internal_review_url' | 'onedrive_client_approval_url' | 'onedrive_final_url'>

export function NolanVideoHandoffEvidence({ video }: { video: HandoffEvidence }) {
  const links: [string, string | null][] = [
    ['Footage', video.onedrive_footage_url],
    ['Internal review', video.onedrive_internal_review_url],
    ['Client approval review', video.onedrive_client_approval_url],
    ['Final asset', video.onedrive_final_url],
  ]
  return <section aria-label="Recorded video handoff evidence">
    <h4>Recorded video handoffs</h4>
    <p>Linked monthly deliverable ID: {video.deliverable_id || 'Not recorded'}</p>
    <p>Production-status source timestamp: {video.production_status_updated_at || 'Not recorded'}</p>
    <ul>{links.map(([label, value]) => {
      const href = nolanHandoffHref(value)
      return <li key={label}>{label}: {href
        ? <a href={href} target="_blank" rel="noopener noreferrer">Open recorded {label.toLowerCase()} link ↗</a>
        : value?.trim() ? 'Invalid or unsupported recorded link' : 'Not recorded'}</li>
    })}</ul>
    <p>These links have not been opened or verified by this view. A review link is not approval,
      and a final-asset link is not proof of the approved final revision, correct client or delivery.
      Reviewer, approval provenance and actual asset inspection remain required.</p>
  </section>
}
