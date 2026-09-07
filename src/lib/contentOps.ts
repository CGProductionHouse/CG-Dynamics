import { supabase } from './supabase'
import { listMonthlyDeliverablesByMonth, type MonthlyDeliverable, type ProductionStatus } from './planner'

// ── #220 Content operations dashboard (cross-client monitoring) ──────────────
//
// A read-only operational view over the canonical Client Schedule
// (`monthly_deliverables`) plus the approval foundation (creative sources +
// review versions). It never creates a second schedule or content store: it
// aggregates existing truth so approved work does not silently slip past
// scheduling/posting. Staff see only the clients RLS already permits.

export type OpsBucket =
  | 'in_progress' | 'awaiting_internal' | 'awaiting_client' | 'changes'
  | 'ready_to_schedule' | 'scheduled' | 'posted' | 'future_draft'

export const OPS_BUCKET_LABELS: Record<OpsBucket, string> = {
  in_progress: 'In progress',
  awaiting_internal: 'Awaiting internal review',
  awaiting_client: 'Awaiting client approval',
  changes: 'Changes requested',
  ready_to_schedule: 'Ready to schedule',
  scheduled: 'Scheduled',
  posted: 'Posted',
  future_draft: 'Future drafts',
}

// Order the dashboard columns by operational urgency (what can slip first).
export const OPS_BUCKET_ORDER: OpsBucket[] = [
  'ready_to_schedule', 'awaiting_client', 'awaiting_internal', 'changes',
  'in_progress', 'scheduled', 'posted', 'future_draft',
]

export interface OpsItem {
  id: string
  clientName: string
  title: string
  deliverableType: string
  productionStatus: ProductionStatus
  scheduledDate: string | null
  assignee: string | null
  isVideo: boolean
  hasCreativeLink: boolean
  hasCurrentReview: boolean
  channels: string[]
  bucket: OpsBucket
  flags: { missingCreativeLink: boolean; missingSchedule: boolean; overdue: boolean }
}

export interface OpsSummary {
  items: OpsItem[]
  buckets: Record<OpsBucket, OpsItem[]>
  counts: Record<OpsBucket, number>
  risks: { missingCreativeLink: OpsItem[]; missingSchedule: OpsItem[]; overdue: OpsItem[] }
}

const VIDEO_TYPES = new Set(['video', 'reel'])

function bucketFor(status: ProductionStatus, scheduledDate: string | null, today: string): OpsBucket {
  switch (status) {
    case 'ready_internal_review': return 'awaiting_internal'
    case 'waiting_client':
    case 'ready_client_approval': return 'awaiting_client'
    case 'internal_changes':
    case 'client_changes': return 'changes'
    case 'approved': return 'ready_to_schedule'
    case 'scheduled': return 'scheduled'
    case 'posted': return 'posted'
    default:
      // to_do / in_progress / blocked / moved: a future-dated item that is not
      // yet in the approval flow is a deliberately-early "future draft".
      if (scheduledDate && scheduledDate.slice(0, 7) > today.slice(0, 7)) return 'future_draft'
      return 'in_progress'
  }
}

/**
 * Pure classifier — deliverables joined with their creative-source and current
 * review presence, grouped into operational buckets with slip-risk flags. Kept
 * pure so it is unit-tested without a database.
 */
export function classifyContentOps(
  deliverables: Array<Pick<MonthlyDeliverable, 'id' | 'title' | 'deliverable_type' | 'production_status' | 'assigned_to_name' | 'scheduled_date'> & { client_name?: string | null }>,
  creativeSourceDeliverableIds: Set<string>,
  currentReviews: Map<string, { channels: string[] }>,
  today: string,
): OpsSummary {
  const empty = (): Record<OpsBucket, OpsItem[]> => ({
    in_progress: [], awaiting_internal: [], awaiting_client: [], changes: [],
    ready_to_schedule: [], scheduled: [], posted: [], future_draft: [],
  })
  const buckets = empty()
  const items: OpsItem[] = []
  for (const d of deliverables) {
    const isVideo = VIDEO_TYPES.has(d.deliverable_type)
    const hasCreativeLink = creativeSourceDeliverableIds.has(d.id)
    const review = currentReviews.get(d.id)
    const bucket = bucketFor(d.production_status, d.scheduled_date, today)
    const settled = bucket === 'posted' || bucket === 'scheduled'
    // A poster needs a linked Canva page; a video's creative link is its
    // guideline video (tracked separately), so only flag posters here.
    const missingCreativeLink = !isVideo && !hasCreativeLink && !settled && bucket !== 'future_draft'
    const missingSchedule = !d.scheduled_date && !settled
    const overdue = Boolean(d.scheduled_date && d.scheduled_date < today && !settled && d.production_status !== 'moved')
    const item: OpsItem = {
      id: d.id,
      clientName: d.client_name ?? 'Unassigned client',
      title: d.title,
      deliverableType: d.deliverable_type,
      productionStatus: d.production_status,
      scheduledDate: d.scheduled_date,
      assignee: d.assigned_to_name,
      isVideo,
      hasCreativeLink,
      hasCurrentReview: Boolean(review),
      channels: review?.channels ?? [],
      bucket,
      flags: { missingCreativeLink, missingSchedule, overdue },
    }
    items.push(item)
    buckets[bucket].push(item)
  }
  const counts = Object.fromEntries(OPS_BUCKET_ORDER.map(b => [b, buckets[b].length])) as Record<OpsBucket, number>
  return {
    items,
    buckets,
    counts,
    risks: {
      missingCreativeLink: items.filter(i => i.flags.missingCreativeLink),
      missingSchedule: items.filter(i => i.flags.missingSchedule),
      overdue: items.filter(i => i.flags.overdue),
    },
  }
}

function monthKey(offset: number): string {
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + offset)
  return d.toISOString().slice(0, 7)
}

/**
 * Fetch the operational picture for a window around the current month
 * (previous month through three months ahead), non-archived only. Reuses the
 * canonical deliverable list + the approval foundation tables under existing RLS.
 */
export async function fetchContentOps(today = new Date().toISOString().slice(0, 10)): Promise<{ data: OpsSummary | null; error: string | null }> {
  const months = [monthKey(-1), monthKey(0), monthKey(1), monthKey(2), monthKey(3)]
  const deliverables: MonthlyDeliverable[] = []
  for (const month of months) {
    const result = await listMonthlyDeliverablesByMonth(month)
    if (result.error) return { data: null, error: result.error.message }
    deliverables.push(...((result.data ?? []) as MonthlyDeliverable[]))
  }
  const active = deliverables.filter(d => !d.archived_at)
  const ids = active.map(d => d.id)

  // Resolve client names once (staff-readable under RLS); a deliverable only
  // carries client_id.
  const clientNames = new Map<string, string>()
  const clientsResult = await supabase.from('clients').select('id,name')
  if (clientsResult.error) return { data: null, error: clientsResult.error.message }
  for (const c of clientsResult.data ?? []) clientNames.set((c as { id: string }).id, (c as { name: string }).name)

  const creativeIds = new Set<string>()
  const reviews = new Map<string, { channels: string[] }>()
  if (ids.length > 0) {
    const [sources, currentReviews] = await Promise.all([
      supabase.from('deliverable_creative_sources').select('deliverable_id').in('deliverable_id', ids),
      supabase.from('content_review_versions').select('deliverable_id,channels,state')
        .in('deliverable_id', ids).in('state', ['internal_review', 'client_review', 'approved', 'changes_requested']),
    ])
    if (sources.error) return { data: null, error: sources.error.message }
    if (currentReviews.error) return { data: null, error: currentReviews.error.message }
    for (const row of sources.data ?? []) creativeIds.add((row as { deliverable_id: string }).deliverable_id)
    for (const row of currentReviews.data ?? []) {
      const r = row as { deliverable_id: string; channels: string[] }
      reviews.set(r.deliverable_id, { channels: r.channels ?? [] })
    }
  }
  const rows = active.map(d => ({
    id: d.id, title: d.title, deliverable_type: d.deliverable_type, production_status: d.production_status,
    assigned_to_name: d.assigned_to_name, scheduled_date: d.scheduled_date,
    client_name: clientNames.get(d.client_id) ?? null,
  }))
  return { data: classifyContentOps(rows, creativeIds, reviews, today), error: null }
}
