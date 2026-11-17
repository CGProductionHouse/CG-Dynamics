import type { MonthlyDeliverable } from '../../lib/planner'

type ScheduleEvidence = Pick<MonthlyDeliverable,
  'scheduled_date' | 'posted_at' | 'internal_approved_at' | 'sent_to_client_at' | 'client_approved_at'>

function timestamp(value: string | null): string {
  if (!value) return 'Not recorded'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Invalid source timestamp'
  return parsed.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' }) + ' SAST'
}

/** Read-only source fields, deliberately not provider publication verification. */
export function NolanScheduleEvidence({ deliverable }: { deliverable: ScheduleEvidence }) {
  return <section aria-label="Schedule and approval evidence" className="nolan-schedule-evidence">
    <h4>Schedule and approval evidence</h4>
    <dl>
      <dt>Scheduled date recorded</dt><dd>{deliverable.scheduled_date || 'Not recorded'}</dd>
      <dt>Posted timestamp recorded</dt><dd>{timestamp(deliverable.posted_at)}</dd>
      <dt>Internal approval recorded</dt><dd>{timestamp(deliverable.internal_approved_at)}</dd>
      <dt>Sent to client recorded</dt><dd>{timestamp(deliverable.sent_to_client_at)}</dd>
      <dt>Client approval recorded</dt><dd>{timestamp(deliverable.client_approved_at)}</dd>
    </dl>
    <p>These are Dynamics record fields, not verified live posts or approval provenance.
      A scheduled date or production status does not establish publication.
      No platform post, exact final revision or reviewer evidence is verified by this view.</p>
  </section>
}
