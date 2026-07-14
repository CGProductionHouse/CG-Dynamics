import type { CompanyEventType } from './companyCalendar'

export type MicrosoftImportTarget = 'planner' | 'client_schedule' | 'cg_calendar' | 'review'

export interface MicrosoftPlanMapping {
  sourcePlan: string
  target: Exclude<MicrosoftImportTarget, 'cg_calendar'>
  targetBoardSlug: string | null
  monthly: boolean
}

export interface MicrosoftBucketMapping {
  sourceBucket: string
  targetBucket: string
  requiresClientReview: boolean
}

const EXACT_PLAN_MAPPINGS: Record<string, Omit<MicrosoftPlanMapping, 'sourcePlan'>> = {
  'to do': {
    target: 'planner',
    targetBoardSlug: 'operations-todo',
    monthly: false,
  },
  'master client to do': {
    target: 'planner',
    targetBoardSlug: 'operations-todo',
    monthly: false,
  },
  'cg socials': {
    target: 'planner',
    targetBoardSlug: 'cg-socials',
    monthly: false,
  },
  '2025 clients schedule': {
    target: 'client_schedule',
    targetBoardSlug: 'client-schedule',
    monthly: true,
  },
}

const TODO_BUCKETS: Record<string, string> = {
  'once-off': 'Once-off',
  'content guides': 'Content Guides',
  websites: 'Websites',
  'admin / to do': 'Admin / To Do',
  'graphic design': 'Graphic Design',
  'client requests': 'Client Requests',
  'cg admin - recurring': 'Recurring',
}

function normalizeMicrosoftLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function resolveMicrosoftPlanMapping(planName: string): MicrosoftPlanMapping {
  const normalized = normalizeMicrosoftLabel(planName)
  const exact = EXACT_PLAN_MAPPINGS[normalized]
  if (exact) return { sourcePlan: planName.trim(), ...exact }

  if (normalized.startsWith('client socials - ')) {
    return {
      sourcePlan: planName.trim(),
      target: 'client_schedule',
      targetBoardSlug: 'client-schedule',
      monthly: true,
    }
  }

  return {
    sourcePlan: planName.trim(),
    target: 'review',
    targetBoardSlug: null,
    monthly: false,
  }
}

export function resolveMicrosoftBucketMapping(
  planName: string,
  bucketName: string,
): MicrosoftBucketMapping {
  const plan = normalizeMicrosoftLabel(planName)
  const sourceBucket = bucketName.trim()
  const normalizedBucket = normalizeMicrosoftLabel(sourceBucket)

  if (plan === 'to do') {
    return {
      sourceBucket,
      targetBucket: TODO_BUCKETS[normalizedBucket] ?? sourceBucket,
      requiresClientReview: false,
    }
  }

  const planMapping = resolveMicrosoftPlanMapping(planName)
  const usesClientBuckets = plan === 'master client to do' || planMapping.target === 'client_schedule'
  return {
    sourceBucket,
    targetBucket: sourceBucket,
    requiresClientReview: usesClientBuckets,
  }
}

export function inferMicrosoftEventType(subject: string): CompanyEventType {
  const normalized = normalizeMicrosoftLabel(subject)
  if (normalized.includes('content run')) return 'content_run'
  if (normalized.includes('shoot')) return 'shoot'
  if (normalized.includes('meeting')) return 'meeting'
  if (normalized.includes('deadline') || normalized.includes('due')) return 'deadline'
  if (normalized.includes('client event')) return 'client_event'
  return 'internal'
}

export function microsoftPlannerSourceKey(planId: string, taskId: string): string | null {
  const plan = planId.trim()
  const task = taskId.trim()
  return plan && task ? `${plan}:${task}` : null
}

export function microsoftOutlookSourceKey(calendarId: string, eventId: string): string | null {
  const calendar = calendarId.trim()
  const event = eventId.trim()
  return calendar && event ? `${calendar}:${event}` : null
}
