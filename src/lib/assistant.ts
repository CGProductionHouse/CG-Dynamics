import { supabase } from './supabase'
import { sourceLabel, type MyDayContext } from './workforceMyDay'

export type AssistantRole = 'user' | 'assistant'

export interface AssistantChatMessage {
  role: AssistantRole
  content: string
  createdAt?: string
}

export interface AssistantToolStatus {
  key: string
  name: string
  status: 'planned' | 'protected' | 'available'
  description: string
}

export interface AssistantCitation {
  id: number
  cardId: string
  cite: string
  status: string
}

export interface AssistantSourceUsed {
  title: string | null
  author: string | null
  year: number | null
  url: string | null
}

export interface AssistantCardUsed {
  id: string
  title: string
  status: string
}

export interface AssistantChatResponse {
  ok: boolean
  answer: string
  setupRequired?: boolean
  restricted?: boolean
  model?: string
  tools?: AssistantToolStatus[]
  error?: string
  // Skilled-agent fields (present when an agentKey was sent).
  agent?: string
  agentName?: string
  mode?: 'production' | 'admin_research'
  cardsUsed?: AssistantCardUsed[]
  sourcesUsed?: AssistantSourceUsed[]
  citations?: AssistantCitation[]
  insufficientEvidence?: boolean
  providerUnavailable?: boolean
  reviewWarning?: string
  platformSlug?: string | null
  surfaceKey?: string | null
  platformKnowledgeUsed?: AssistantPlatformKnowledgeUsed[]
}

// The nine skilled AI Workforce agents, plus which need an active client.
// Mirrors supabase/functions/cg-assistant-chat/skilledAgents.ts.
export interface SkilledAgentOption {
  key: string
  name: string
  needsClient: boolean
  blurb: string
}

export const SKILLED_AGENTS: SkilledAgentOption[] = [
  { key: 'social_media_strategist', name: 'Social Media Strategist', needsClient: true, blurb: 'Platform-native social strategy: objective, audience, pillars, format mix, organic/paid, testing, measurement.' },
  { key: 'research_librarian', name: 'Research Librarian', needsClient: false, blurb: 'Find, classify and assess sources. Never activates cards.' },
  { key: 'marketing_strategist', name: 'Marketing Strategist', needsClient: true, blurb: 'Connect verified evidence to campaign direction.' },
  { key: 'copywriting_agent', name: 'Copywriting Agent', needsClient: true, blurb: 'Draft copy grounded in cited principles.' },
  { key: 'creative_director', name: 'Creative Director', needsClient: true, blurb: 'Concepts and creative direction.' },
  { key: 'brand_guardian', name: 'Brand Guardian', needsClient: true, blurb: 'Tone, claim safety and brand consistency.' },
  { key: 'paid_ads_agent', name: 'Paid Ads Agent', needsClient: true, blurb: 'Campaign structure and verified-metric interpretation.' },
  { key: 'content_planner', name: 'Content Planner', needsClient: true, blurb: 'Pillars, monthly plans and sequencing.' },
  { key: 'client_report_agent', name: 'Client Report Agent', needsClient: true, blurb: 'Explain verified results; never invents metrics.' },
  { key: 'historical_advertising_analyst', name: 'Historical Advertising Analyst', needsClient: false, blurb: 'Persuasion structure from historic ads.' },
]

export interface ActiveClientOption {
  id: string
  name: string
}

export async function fetchActiveClients(): Promise<ActiveClientOption[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name')
    .eq('active', true)
    .order('name')
  if (error || !data) return []
  return data as ActiveClientOption[]
}

export interface SkilledChatOptions {
  agentKey: string
  activeClientId?: string | null
  mode?: 'production' | 'admin_research'
  platformSlug?: string | null
  surfaceKey?: string | null
  channel?: 'organic' | 'paid' | 'both' | null
}

export interface AssistantPlatformKnowledgeUsed {
  platform: string
  surface: string | null
  title: string
  state: string
  channel: string
  evidenceStrength: string
  lastVerified: string | null
  sourceUrl: string | null
}

// The priority social platforms + their surfaces for the assistant selector.
// Mirrors phase-25c seed; surfaces are structural facts.
export const SOCIAL_PLATFORMS: { slug: string; name: string; surfaces: { key: string; name: string }[] }[] = [
  { slug: 'instagram', name: 'Instagram', surfaces: [
    { key: 'feed', name: 'Feed' }, { key: 'reels', name: 'Reels' }, { key: 'stories', name: 'Stories' },
    { key: 'explore-search', name: 'Explore & Search' }, { key: 'profile', name: 'Profile' } ] },
  { slug: 'facebook', name: 'Facebook', surfaces: [
    { key: 'feed', name: 'Feed' }, { key: 'reels', name: 'Reels' }, { key: 'stories', name: 'Stories' },
    { key: 'groups', name: 'Groups' }, { key: 'video', name: 'Video / Watch' }, { key: 'page', name: 'Page' } ] },
  { slug: 'tiktok', name: 'TikTok', surfaces: [
    { key: 'for-you', name: 'For You feed' }, { key: 'search', name: 'Search' },
    { key: 'profile', name: 'Profile' }, { key: 'live', name: 'LIVE' } ] },
  { slug: 'youtube', name: 'YouTube', surfaces: [
    { key: 'shorts', name: 'Shorts' }, { key: 'watch-long', name: 'Long-form' }, { key: 'search', name: 'Search' },
    { key: 'home', name: 'Home & Recommendations' }, { key: 'community', name: 'Community' } ] },
  { slug: 'linkedin', name: 'LinkedIn', surfaces: [
    { key: 'feed', name: 'Feed' }, { key: 'company-page', name: 'Company Page' },
    { key: 'documents-carousels', name: 'Documents / Carousels' }, { key: 'video', name: 'Video' }, { key: 'newsletter', name: 'Newsletter' } ] },
]

export interface AssistantProviderDiagnostic {
  provider: string
  model: string
  configured: boolean
  keyStatus: string
}

export interface AssistantDiagnostics {
  assistantStatus: 'ready' | 'setup_required' | string
  setupStatus: string
  providers: AssistantProviderDiagnostic[]
  providerOrder: string[]
  auditLogging: 'available' | 'pending' | string
  functionStatus: string
}

export interface AssistantDiagnosticsResponse {
  ok: boolean
  diagnostics?: AssistantDiagnostics
  error?: string
}

export interface AssistantProviderTestResponse {
  ok: boolean
  result?: {
    success: boolean
    provider?: string
    model?: string
    message?: string
    error?: string
  }
  error?: string
}

export interface AssistantLocalWorkContext {
  today: string
  userName: string | null
  focusCount: number
  overdueCount: number
  dueTodayCount: number
  upcomingCount: number
  connectedSources: {
    plannerTasks: number
    calendarEvents: number
    clientScheduleItems: number
  }
  todayCalendarEvents: number
  nextFocusTitle: string | null
  currentTaskTitle: string | null
  currentTaskSource: string | null
  nextTaskTitle: string | null
  nextTaskSource: string | null
  suggestedNextAction: string
  workloadWarning: string | null
  setupNotes: string[]
}

export function buildAssistantLocalWorkContext(context: MyDayContext | null): AssistantLocalWorkContext | null {
  if (!context) return null
  const nextFocus = [...context.overdue, ...context.dueToday, ...context.upcoming][0] ?? null
  return {
    today: context.today,
    userName: context.userName,
    focusCount: context.overdue.length + context.dueToday.length,
    overdueCount: context.overdue.length,
    dueTodayCount: context.dueToday.length,
    upcomingCount: context.upcoming.length,
    connectedSources: {
      plannerTasks: context.tasks.length,
      calendarEvents: context.events.length,
      clientScheduleItems: context.deliverables.length,
    },
    todayCalendarEvents: context.events.filter(item => item.date === context.today).length,
    nextFocusTitle: nextFocus?.title ?? null,
    currentTaskTitle: context.summary.currentTask?.title ?? null,
    currentTaskSource: context.summary.currentTask ? sourceLabel(context.summary.currentTask.source) : null,
    nextTaskTitle: context.summary.nextTask?.title ?? null,
    nextTaskSource: context.summary.nextTask ? sourceLabel(context.summary.nextTask.source) : null,
    suggestedNextAction: context.summary.suggestedNextAction,
    workloadWarning: context.summary.workloadWarning,
    setupNotes: [
      context.diagnostics.profileNameMissing ? 'Profile full name is missing. User-ID assignments can still match, but name/helper-based imported work may be incomplete.' : null,
      context.diagnostics.companyEventsMissing ? 'CG Calendar events table is not available yet.' : null,
      ...context.diagnostics.errors,
    ].filter((note): note is string => Boolean(note)),
  }
}

export async function sendAssistantMessage(
  message: string,
  history: AssistantChatMessage[],
  localWorkContext?: AssistantLocalWorkContext | null,
  skilled?: SkilledChatOptions | null
): Promise<AssistantChatResponse> {
  const { data, error } = await supabase.functions.invoke<AssistantChatResponse>('cg-assistant-chat', {
    body: {
      message,
      history: history.slice(-8),
      localWorkContext,
      ...(skilled?.agentKey
        ? {
            agentKey: skilled.agentKey,
            activeClientId: skilled.activeClientId ?? null,
            mode: skilled.mode ?? 'production',
            platformSlug: skilled.platformSlug ?? null,
            surfaceKey: skilled.surfaceKey ?? null,
            channel: skilled.channel ?? null,
          }
        : {}),
    },
  })

  if (error) {
    return {
      ok: false,
      answer: 'CG Assistant could not be reached. Please check the server function setup and try again.',
      error: error.message,
    }
  }

  if (!data) {
    return {
      ok: false,
      answer: 'CG Assistant did not return a response. Please try again.',
    }
  }

  return data
}

export async function getAssistantDiagnostics(): Promise<AssistantDiagnosticsResponse> {
  const { data, error } = await supabase.functions.invoke<AssistantDiagnosticsResponse>('cg-assistant-chat', {
    body: {
      action: 'diagnostics',
    },
  })

  if (error) {
    return {
      ok: false,
      error: error.message,
    }
  }

  return data ?? { ok: false, error: 'CG Assistant diagnostics did not return a response.' }
}

export async function testAssistantProvider(): Promise<AssistantProviderTestResponse> {
  const { data, error } = await supabase.functions.invoke<AssistantProviderTestResponse>('cg-assistant-chat', {
    body: {
      action: 'test_provider',
    },
  })

  if (error) {
    return {
      ok: false,
      error: error.message,
    }
  }

  return data ?? { ok: false, error: 'CG Assistant provider test did not return a response.' }
}
