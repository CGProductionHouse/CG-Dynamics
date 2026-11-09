export const REVIEW_ACTIONS = ['approved', 'changes_requested', 'declined', 'comment'] as const
export type GuidelineReviewAction = typeof REVIEW_ACTIONS[number]
export type GuidelineDecision = Exclude<GuidelineReviewAction, 'comment'> | 'pending'
export const REVIEW_LABELS: Record<GuidelineDecision | 'comment', string> = {
  pending: 'Awaiting review', approved: 'Idea approved', changes_requested: 'Changes requested', declined: 'Idea declined', comment: 'Comment',
}
export interface GuidelineResponse { id: string; action: GuidelineReviewAction; reviewer_name: string; message: string; created_at: string }
export interface GuidelineVideoReview { position: number; revision: string | null; decision: GuidelineDecision; responses: GuidelineResponse[] }
export interface GuidelineReviews { published_at: string; videos: GuidelineVideoReview[] }
export interface StaffGuidelineResponse extends GuidelineResponse { position: number; title: string; published_at: string; current_publication: boolean; matches_current_video: boolean }
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const obj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const stamp = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v))
export function projectGuidelineResponse(v: unknown): GuidelineResponse | null {
  if (!obj(v) || typeof v.id !== 'string' || !UUID.test(v.id) || !REVIEW_ACTIONS.includes(v.action as GuidelineReviewAction)
    || typeof v.reviewer_name !== 'string' || !v.reviewer_name.trim() || v.reviewer_name.length > 80
    || typeof v.message !== 'string' || v.message.length > 3000 || (v.action !== 'approved' && !v.message.trim()) || !stamp(v.created_at)) return null
  return { id: v.id, action: v.action as GuidelineReviewAction, reviewer_name: v.reviewer_name, message: v.message, created_at: v.created_at }
}
export function projectGuidelineReviews(v: unknown): GuidelineReviews | null {
  if (!obj(v) || !stamp(v.published_at) || !Array.isArray(v.videos)) return null
  const videos: GuidelineVideoReview[] = []
  for (const row of v.videos) {
    if (!obj(row) || !Number.isSafeInteger(row.position) || Number(row.position) < 1
      || !(row.revision === null || (typeof row.revision === 'string' && UUID.test(row.revision)))
      || !['pending', 'approved', 'changes_requested', 'declined'].includes(String(row.decision)) || !Array.isArray(row.responses) || row.responses.length > 20) return null
    const responses = row.responses.map(projectGuidelineResponse)
    if (responses.some(r => !r) || (row.revision === null && (row.decision !== 'pending' || responses.length))) return null
    videos.push({ position: Number(row.position), revision: row.revision, decision: row.decision as GuidelineDecision, responses: responses as GuidelineResponse[] })
  }
  if (new Set(videos.map(r => r.position)).size !== videos.length) return null
  return { published_at: v.published_at, videos }
}
export function reviewInputError(name: string, message: string, action: GuidelineReviewAction): string | null {
  if (!name.trim() || name.trim().length > 80) return 'Please add your name.'
  if (message.trim().length > 3000) return 'Please keep your comment under 3,000 characters.'
  if (action !== 'approved' && !message.trim()) return 'Please add a comment so the team knows what to change.'
  return null
}
