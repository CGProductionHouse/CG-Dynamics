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
  clientAliases: string[]
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
  'once off': 'ONCE-OFF',
  'once offs': 'ONCE-OFF',
  'content guide': 'CONTENT GUIDES',
  'content guides': 'CONTENT GUIDES',
  website: 'WEBSITES',
  websites: 'WEBSITES',
  'admin to do': 'ADMIN / TO DO',
  'admin todo': 'ADMIN / TO DO',
  'graphic design': 'GRAPHIC DESIGN',
  'graphic designs': 'GRAPHIC DESIGN',
  'client request': 'CLIENT REQUESTS',
  'client requests': 'CLIENT REQUESTS',
  'cg admin recurring': 'CG ADMIN - RECURRING',
  recurring: 'CG ADMIN - RECURRING',
}

const CG_SOCIAL_BUCKETS: Record<string, string> = {
  'cg studio schedule': 'CG Studio Schedule',
  'cg sechedule new': 'CG Schedule',
  'cg schedule new': 'CG Schedule',
  'cg schedule': 'CG Schedule',
}

const MASTER_CLIENT_ALIASES: Record<string, string[]> = {
  'ehrlich park': ['Ehrlich Park Butchery'],
  'supa quick': ['Supa Quick BFN', 'Supa Quick Centurion'],
}

export function normalizeMicrosoftLabel(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2010-\u2015]/g, '-')
    .trim()
    .toLocaleLowerCase('en-ZA')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function resolveMicrosoftPlanMapping(planName: string): MicrosoftPlanMapping {
  const normalized = normalizeMicrosoftLabel(planName)
  const exact = EXACT_PLAN_MAPPINGS[normalized]
  if (exact) return { sourcePlan: planName.trim(), ...exact }

  if (normalized.startsWith('client socials ')) {
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
      targetBucket: TODO_BUCKETS[normalizedBucket] ?? '',
      requiresClientReview: false,
      clientAliases: [],
    }
  }

  if (plan === 'master client to do') {
    return {
      sourceBucket,
      targetBucket: 'CLIENT REQUESTS',
      requiresClientReview: true,
      clientAliases: MASTER_CLIENT_ALIASES[normalizedBucket] ?? [],
    }
  }

  if (plan === 'cg socials') {
    return {
      sourceBucket,
      targetBucket: CG_SOCIAL_BUCKETS[normalizedBucket] ?? '',
      requiresClientReview: false,
      clientAliases: [],
    }
  }

  const planMapping = resolveMicrosoftPlanMapping(planName)
  const usesClientBuckets = planMapping.target === 'client_schedule'
  return {
    sourceBucket,
    targetBucket: sourceBucket,
    requiresClientReview: usesClientBuckets,
    clientAliases: [],
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
