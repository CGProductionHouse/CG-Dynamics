// Suggest Content Videos — AI-assisted Content Guideline planning
//
// Staff select a client and coverage window; the function assembles canonical
// internal context and asks the AI provider to return structured video
// suggestions. Suggestions are drafts — never silently written into a guideline.
//
// Context sources used (each clearly labelled):
//   - canonical internal: client profile, industry profile, schedule slots,
//     existing guideline videos, historical concepts (current client only)
//   - approved Marketing Library: active skill cards (industry-specific,
//     universal, South African market layers)
//   - stable SA calendar context: public holidays, seasons, campaign moments
//   - live external research: NOT PERFORMED — the LLM may use its training data
//     for general marketing knowledge but must not label it as research
//
// Client-access policy (matches RLS "clients: staff reads all"):
//   - Admin/owner: permitted per global policy
//   - Manager/Staff/Team: permitted (all staff may access all active clients)
//   - Client role: always denied
//   - Inactive/deleted profile: denied
//
// POST /suggest-content-videos
// { requestId, clientId, coverageStart, coverageEnd, guidelineId? }

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  AiDuplicateRequestError,
  routeAiChat,
  type AiChatMessage,
} from '../cg-assistant-chat/ai-router.ts'
import { fetchAiUsageReplay, type AiUsageClient } from '../_shared/aiUsage.ts'
import {
  buildDevelopPrompt,
  buildIdeasPrompt,
  buildResearchPrompt,
  clientGuideExcerpt,
  DEVELOP_MAX_OUTPUT_TOKENS,
  IDEAS_MAX_OUTPUT_TOKENS,
  isDirectorMode,
  MAX_DEVELOP_VIDEOS,
  parseDevelopments,
  parseIdeas,
  parseResearchFindings,
  RESEARCH_MAX_OUTPUT_TOKENS,
  type DevelopTarget,
  type DirectorMode,
  type ResearchInput,
  type ScheduleSlot,
} from './directorModes.ts'

// Canonical staff roles (matches STAFF_ROLES in src/lib/roles.ts and
// cg-assistant-chat). The DB CHECK constraint allows 'admin','team','client';
// the expanded set also covers future migrations that may add 'manager','staff','owner'.
const STAFF_ROLES = ['owner', 'admin', 'manager', 'staff', 'team'] as const
type StaffRole = typeof STAFF_ROLES[number]

const MAX_COVERAGE_MONTHS = 12
const MAX_SUGGESTIONS = 20
const SUGGESTION_MAX_OUTPUT_TOKENS = 4000
// ── Stable SA calendar context (canonical, NOT live research) ────────────────
// These are public-holiday and seasonal anchor dates that shift yearly. The
// LLM should use them as stable calendar anchors, never as "research-backed".
const SA_CALENDAR: Array<{ month: number; label: string; type: string }> = [
  { month: 1, label: 'New Year (1 Jan)', type: 'public_holiday' },
  { month: 3, label: 'Human Rights Day (21 Mar)', type: 'public_holiday' },
  { month: 3, label: 'Autumn equinox / harvest season', type: 'seasonal' },
  { month: 4, label: 'Good Friday (varies)', type: 'public_holiday' },
  { month: 4, label: 'Family Day (varies)', type: 'public_holiday' },
  { month: 4, label: 'Freedom Day (27 Apr)', type: 'public_holiday' },
  { month: 5, label: 'Workers Day (1 May)', type: 'public_holiday' },
  { month: 5, label: "Mother's Day (varies)", type: 'observance' },
  { month: 6, label: 'Youth Day (16 Jun)', type: 'public_holiday' },
  { month: 6, label: "Father's Day (varies)", type: 'observance' },
  { month: 6, label: 'Winter solstice', type: 'seasonal' },
  { month: 7, label: 'Mandela Day (18 Jul)', type: 'observance' },
  { month: 8, label: "Women's Day (9 Aug)", type: 'public_holiday' },
  { month: 9, label: 'Heritage Day (24 Sep)', type: 'public_holiday' },
  { month: 9, label: 'Spring equinox', type: 'seasonal' },
  { month: 10, label: 'Halloween (31 Oct)', type: 'observance' },
  { month: 11, label: 'Black Friday (varies)', type: 'retail_event' },
  { month: 12, label: 'Day of Reconciliation (16 Dec)', type: 'public_holiday' },
  { month: 12, label: 'Christmas Day (25 Dec)', type: 'public_holiday' },
  { month: 12, label: 'Day of Goodwill (26 Dec)', type: 'public_holiday' },
  { month: 12, label: 'December holiday / summer peak', type: 'seasonal' },
]

// ── Types ────────────────────────────────────────────────────────────────────

interface SuggestRequest {
  requestId: string
  clientId: string
  coverageStart: string
  coverageEnd: string
  guidelineId?: string
  /** 'suggest' (shipped single-pass), 'ideas' (plan only) or 'develop' (#224). */
  mode?: string
  /** 'develop' only: a subset of the guideline's saved videos. */
  videoIds?: string[]
}

interface VideoSuggestion {
  targetMonth: string | null
  title: string
  objective: string
  hook: string
  script: string
  sceneDirection: string
  onScreenText: string
  propsProductsPeople: string
  locationSuggestion: string
  cta: string
  reasoning: string
  sourcesUsed: string[]
  duplicationRisk: string | null
}

interface SuggestResponse {
  suggestions: VideoSuggestion[]
  context: {
    clientName: string
    clientTier: string
    primaryIndustry: string | null
    secondaryIndustry: string | null
    coverageMonths: string[]
    totalDeliverableSlots: number
    existingVideoCount: number
  }
  sources: {
    canonicalInternal: string[]
    marketingLibraryKnowledge: string[]
    saCalendarContext: string[]
    liveExternalResearch: string[]
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateCoverageMonths(start: string, end: string): string[] {
  const months: string[] = []
  const s = new Date(start + 'T00:00:00Z')
  const e = new Date(end + 'T00:00:00Z')
  const cursor = new Date(s.getUTCFullYear(), s.getUTCMonth(), 1)
  while (cursor <= e && months.length < MAX_COVERAGE_MONTHS) {
    months.push(cursor.getUTCFullYear() + '-' + String(cursor.getUTCMonth() + 1).padStart(2, '0'))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return months
}

function isStaffRole(role: unknown): role is StaffRole {
  return typeof role === 'string' && (STAFF_ROLES as ReadonlyArray<string>).includes(role)
}

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}

// Validate that a parsed suggestion has all required fields with correct types.
function isValidSuggestion(value: unknown): value is VideoSuggestion {
  if (!value || typeof value !== 'object') return false
  const s = value as Record<string, unknown>
  if (typeof s.title !== 'string' || s.title.trim().length === 0) return false
  if (typeof s.script !== 'string' || s.script.trim().length === 0) return false
  if (s.targetMonth !== null && s.targetMonth !== undefined && typeof s.targetMonth !== 'string') return false
  if (typeof s.objective !== 'string') return false
  if (typeof s.hook !== 'string') return false
  if (typeof s.sceneDirection !== 'string') return false
  if (typeof s.onScreenText !== 'string') return false
  if (typeof s.propsProductsPeople !== 'string') return false
  if (typeof s.locationSuggestion !== 'string') return false
  if (typeof s.cta !== 'string') return false
  if (typeof s.reasoning !== 'string') return false
  if (!Array.isArray(s.sourcesUsed)) return false
  if (s.duplicationRisk !== null && s.duplicationRisk !== undefined && typeof s.duplicationRisk !== 'string') return false
  return true
}

function extractSuggestions(raw: string): VideoSuggestion[] {
  try {
    const parsed = JSON.parse(raw)
    if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
      return parsed.suggestions.filter(isValidSuggestion).slice(0, MAX_SUGGESTIONS)
    }
    if (Array.isArray(parsed)) {
      return parsed.filter(isValidSuggestion).slice(0, MAX_SUGGESTIONS)
    }
  } catch {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1])
        if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
          return parsed.suggestions.filter(isValidSuggestion).slice(0, MAX_SUGGESTIONS)
        }
        if (Array.isArray(parsed)) {
          return parsed.filter(isValidSuggestion).slice(0, MAX_SUGGESTIONS)
        }
      } catch {
        return []
      }
    }
  }
  return []
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const startTime = Date.now()

  // ── CORS ──
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  // ── Environment ──
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Server configuration error.' }, 500)
  }

  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── Auth and caller authorisation ──────────────────────────────────────────
  // Uses service-role client (bypasses RLS), so we manually enforce access.

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) {
    return jsonResponse({ error: 'Authentication required.' }, 401)
  }

  const { data: { user }, error: authError } = await sb.auth.getUser(token)
  if (authError || !user) {
    return jsonResponse({ error: 'Authentication required.' }, 401)
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  // Fail closed: no profile, inactive profile, or non-staff role → deny.
  if (!profile || profile.is_active !== true || !isStaffRole(profile.role)) {
    return jsonResponse({ error: 'Staff access required.' }, 403)
  }


  // Client-access policy: all staff roles (admin, manager, staff, team, owner)
  // may access any active client. This matches the RLS policy
  // "clients: staff reads all" which grants is_staff() full read access.
  // Client-role users are already rejected above.
  // No per-client scoping exists in the current model — staff are global.

  // ── Parse body ──
  let body: SuggestRequest
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid request body.' }, 400)
  }

  const { requestId, clientId, coverageStart, coverageEnd, guidelineId } = body
  const mode: DirectorMode = isDirectorMode(body.mode) ? body.mode : 'suggest'
  if (!requestId || !clientId || !coverageStart || !coverageEnd) {
    return jsonResponse({ error: 'requestId, clientId, coverageStart and coverageEnd are required.' }, 400)
  }
  if (!/^[a-zA-Z0-9:_-]{8,200}$/.test(requestId)) {
    return jsonResponse({ error: 'requestId must be a valid client-generated identifier.' }, 400)
  }

  const uuidRE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRE.test(clientId)) {
    return jsonResponse({ error: 'clientId must be a valid UUID.' }, 400)
  }
  if (guidelineId && !uuidRE.test(guidelineId)) {
    return jsonResponse({ error: 'guidelineId must be a valid UUID.' }, 400)
  }

  const startDate = new Date(coverageStart + 'T00:00:00Z')
  const endDate = new Date(coverageEnd + 'T00:00:00Z')
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return jsonResponse({ error: 'coverageStart and coverageEnd must be valid dates (YYYY-MM-DD).' }, 400)
  }
  if (endDate < startDate) {
    return jsonResponse({ error: 'coverageEnd must be on or after coverageStart.' }, 400)
  }
  const coverageMonths = generateCoverageMonths(coverageStart, coverageEnd)
  if (coverageMonths.length === 0) {
    return jsonResponse({ error: 'Coverage window must include at least one month.' }, 400)
  }

  // ── Client access verification ──
  const { data: client } = await sb
    .from('clients')
    .select('id, name, tier, active')
    .eq('id', clientId)
    .maybeSingle()

  if (!client || client.active !== true) {
    return jsonResponse({ error: 'Client not found or inactive.' }, 404)
  }

  // Fetch industry profile (may be null if not yet researched)
  const { data: industryProfile } = await sb
    .from('client_industry_profiles')
    .select('primary_industry, secondary_industry, confidence, review_state')
    .eq('client_id', clientId)
    .maybeSingle()

  // ── Validate guidelineId belongs to this client ──────────────────────────
  if (guidelineId) {
    const { data: guideline } = await sb
      .from('content_guidelines')
      .select('id, client_id')
      .eq('id', guidelineId)
      .maybeSingle()

    if (!guideline) {
      return jsonResponse({ error: 'Guideline not found.' }, 404)
    }
    if (guideline.client_id !== clientId) {
      return jsonResponse({ error: 'Guideline does not belong to this client.' }, 403)
    }
  }

  // ── Context assembly ────────────────────────────────────────────────────────
  // All data queries are scoped to the authorised clientId.

  // 1. Schedule deliverable slots in coverage window
  const { data: deliverableSlots } = await sb
    .from('monthly_deliverables')
    .select('id, month, title, deliverable_type, code')
    .eq('client_id', clientId)
    .in('deliverable_type', ['video', 'reel'])
    .gte('month', coverageStart)
    .lte('month', coverageEnd)

  const totalDeliverableSlots = deliverableSlots?.length ?? 0

  // 2. Existing videos in current guideline (if guidelineId provided)
  //    Safe: guidelineId already verified against clientId above.
  let existingVideos: Array<{ title: string; targetMonth: string | null; status: string }> = []
  if (guidelineId) {
    const { data: guideVideos } = await sb
      .from('content_guide_ideas')
      .select('title, month, status')
      .eq('content_guideline_id', guidelineId)
    existingVideos = (guideVideos ?? []).map((v) => ({
      title: v.title,
      targetMonth: v.month as string | null,
      status: v.status,
    }))
  }

  // 3. Historical approved/completed concepts for this client
  const { data: historicalConcepts } = await sb
    .from('content_guide_ideas')
    .select('title, month, status, created_at')
    .eq('client_id', clientId)
    .in('status', ['approved', 'in_production', 'completed'])
    .order('created_at', { ascending: false })
    .limit(50)

  // 4. Cross-client duplicate detection — safe signals only.
  //    We count matches but NEVER send another client's titles, scripts or
  //    campaign details to the AI provider.
  let crossClientDuplicateCount = 0
  let crossClientSimilarityCategory: 'none' | 'low' | 'medium' | 'high' = 'none'
  const existingTitles = new Set(
    (historicalConcepts ?? []).map((c) => c.title.trim().toLowerCase()),
  )
  if (existingTitles.size > 0) {
    const sampleTitles = [...existingTitles].slice(0, 5)
    const { count: dupCount } = await sb
      .from('content_guide_ideas')
      .select('title', { count: 'exact', head: true })
      .neq('client_id', clientId)
      .in('title', sampleTitles)
    crossClientDuplicateCount = dupCount ?? 0
    crossClientSimilarityCategory = crossClientDuplicateCount === 0 ? 'none'
      : crossClientDuplicateCount <= 2 ? 'low'
      : crossClientDuplicateCount <= 4 ? 'medium'
      : 'high'
  }

  // 5. Marketing Library: active skill cards — industry-specific (matching
  //    the client's industry), universal principles, and SA market knowledge.
  const kbLayers: string[] = ['universal_principle', 'south_african_market']
  if (industryProfile?.primary_industry) {
    kbLayers.push('industry_specific')
  }
  const { data: skillCards } = await sb
    .from('skill_cards')
    .select('title, principle, summary, knowledge_layer')
    .eq('status', 'active')
    .in('knowledge_layer', kbLayers)
    .limit(30)

  // 6. SA calendar context for coverage months
  const coverageMonthNums = new Set(coverageMonths.map((m) => parseInt(m.slice(5, 7), 10)))
  const relevantCalendar = SA_CALENDAR.filter((e) => coverageMonthNums.has(e.month))

  // 7. Build source manifest
  const industryLabel = industryProfile?.primary_industry
    ? `${industryProfile.primary_industry}${industryProfile?.secondary_industry ? ' / ' + industryProfile.secondary_industry : ''} (confidence: ${industryProfile?.confidence ?? 'unknown'})`
    : 'not yet researched'

  const canonicalInternal = [
    `Client: ${client.name} (tier: ${client.tier})`,
    `Industry: ${industryLabel}`,
    `Coverage: ${coverageMonths.length} month(s) (${coverageMonths.join(', ')})`,
    `${totalDeliverableSlots} schedule deliverable slots (video/reel) in coverage window`,
    `${existingVideos.length} existing videos in current guideline`,
    `${historicalConcepts?.length ?? 0} historical approved/completed concepts for this client`,
  ]

  const marketingLibraryKnowledge = (skillCards ?? []).map(
    (c) => `[${c.knowledge_layer}] ${c.title}: ${c.principle}`,
  )

  // Record which knowledge layers were actually used.
  const usedLayers = new Set((skillCards ?? []).map((c) => c.knowledge_layer))
  const knowledgeLayersRecorded = Array.from(usedLayers)

  const saCalendarContext = relevantCalendar.map(
    (e) => `[${e.type}] ${e.label}`,
  )

  const liveExternalResearch: string[] = [
    'Live web research was not performed for this session.',
    'The AI provider may draw on its training data for general marketing knowledge, but that is not labelled as research.',
  ]

  // ── AI Content Director modes (#224) ────────────────────────────────────────
  // Handled below, so the shipped single-pass flow that follows is unchanged.
  if (mode === 'ideas' || mode === 'develop') {
    const requestedVideoIds = Array.isArray(body.videoIds)
      ? body.videoIds.filter(id => typeof id === 'string' && uuidRE.test(id)).slice(0, MAX_DEVELOP_VIDEOS)
      : []
    const directorContext: DirectorContext = {
      sb,
      userId: user.id,
      requestId,
      client: { id: client.id, name: client.name, tier: client.tier },
      guidelineId: guidelineId ?? null,
      coverageStart,
      coverageEnd,
      coverageMonths,
      slots: (deliverableSlots ?? []).map(slot => ({
        id: slot.id as string,
        code: (slot.code as string | null) ?? null,
        title: (slot.title as string | null) ?? null,
        month: String(slot.month),
        deliverableType: String(slot.deliverable_type),
      })),
      marketingKnowledge: marketingLibraryKnowledge,
      calendar: saCalendarContext,
      canonicalInternal,
      existingTitles: existingVideos.map(video => video.title),
      historicalTitles: (historicalConcepts ?? []).slice(0, 20).map(concept => concept.title as string),
    }
    return mode === 'ideas'
      ? await handleIdeasMode(directorContext)
      : await handleDevelopMode(directorContext, requestedVideoIds)
  }

  // ── Build system prompt ──────────────────────────────────────────────────────

  const systemPrompt = [
    'You are a Content Planning Assistant inside CG Dynamics, a CG Production House operating system.',
    'Your task is to suggest video content ideas for a specific client based on the context provided below.',
    '',
    'RULES:',
    '- Return ONLY a JSON object. No markdown, no code fences, no explanation outside the JSON.',
    '- The JSON must have a single key "suggestions" containing an array of suggestion objects.',
    '- Each suggestion object must have these exact keys:',
    '  targetMonth, title, objective, hook, script, sceneDirection, onScreenText,',
    '  propsProductsPeople, locationSuggestion, cta, reasoning, sourcesUsed, duplicationRisk',
    '- targetMonth: one of the coverage months (YYYY-MM) or null for evergreen.',
    '- title: clear video title.',
    '- objective: what this video achieves for the client.',
    '- hook: the opening hook that grabs attention.',
    '- script: COMPLETE draft script (60-90 seconds spoken word, not placeholders).',
    '- sceneDirection: scene-by-scene filming direction (camera angle, cuts, B-roll).',
    '- onScreenText: text/text overlay appearing on screen.',
    '- propsProductsPeople: specific props, products, and people needed.',
    '- locationSuggestion: suggested filming location.',
    '- cta: call to action.',
    '- reasoning: why this suggestion fits, referencing specific context.',
    '- sourcesUsed: list of source labels that informed this suggestion.',
    '- duplicationRisk: null if no conflict, or string describing similarity.',
    '',
    'CONSTRAINTS:',
    '- Do NOT invent client facts, performance data, trends, or events not provided.',
    '- If you do not know something, say so via reasoning rather than guessing.',
    '- Do NOT expose or reference another client\'s confidential information.',
    '- Generate 1-8 suggestions depending on coverage window size.',
    '- For 1-month windows generate 2-3 suggestions.',
    '- Vary formats: some educational, some promotional, some entertaining.',
    '- Suggestions are drafts and must NEVER be silently written into the guideline.',
    '',
    'CONTEXT SOURCES (label each source clearly):',
    '- canonical_internal: client profile, industry profile, schedule, existing guideline',
    '- marketing_library: approved Marketing Library knowledge cards',
    '- sa_calendar: stable SA public holidays, seasons and observances',
    '- live_research: NOT PERFORMED — training knowledge is not research',
    '',
    'Keep responses practical, production-ready, and specific to the client.',
  ].join('\n')

  // ── Build user message with assembled context ──────────────────────────────
  // NOTE: cross-client information is limited to a count and category label.
  // No other client's titles, scripts, or campaign details are included.

  const industryContext = industryProfile
    ? `Primary industry: ${industryProfile.primary_industry ?? 'not set'}\nSecondary industry: ${industryProfile.secondary_industry ?? 'not set'}\nConfidence: ${industryProfile.confidence}\nReview state: ${industryProfile.review_state}`
    : 'Industry profile: not yet researched (no industry data available).'

  const deliverableContext = deliverableSlots && deliverableSlots.length > 0
    ? deliverableSlots.map((d) => `  - ${d.code ?? d.title} (${d.deliverable_type}, month: ${d.month})`).join('\n')
    : '  No video/reel schedule slots found in the coverage window.'

  const existingVideosContext = existingVideos.length > 0
    ? existingVideos.map((v) => `  - "${v.title}" (month: ${v.targetMonth ?? 'unallocated'}, status: ${v.status})`).join('\n')
    : '  No existing videos in the current guideline.'

  const historicalContext = historicalConcepts && historicalConcepts.length > 0
    ? historicalConcepts.slice(0, 20).map((c) => `  - "${c.title}" (month: ${c.month ?? 'unknown'}, status: ${c.status})`).join('\n')
    : '  No historical approved concepts found for this client.'

  // Safe cross-client signal: count + category only. Never titles or scripts.
  const crossClientContext = crossClientDuplicateCount > 0
    ? `NOTE: ${crossClientDuplicateCount} similar concept(s) found across other clients (similarity: ${crossClientSimilarityCategory}). Avoid reusing concepts verbatim.`
    : 'No cross-client duplication detected.'

  const marketingLibraryContext = (skillCards ?? []).length > 0
    ? skillCards.map((c) => `  - [${c.knowledge_layer}] ${c.title}: ${c.summary ?? c.principle}`).join('\n')
    : '  No active Marketing Library skill cards found for the relevant layers.'

  const calendarContext = relevantCalendar.length > 0
    ? relevantCalendar.map((e) => `  - [${e.type}] ${e.label}`).join('\n')
    : '  No specific SA calendar events in the coverage months.'

  const userMessage = [
    '# CONTEXT FOR VIDEO SUGGESTIONS',
    '',
    `## Client: ${client.name}`,
    `Tier: ${client.tier}`,
    '',
    industryContext,
    '',
    `## Coverage window: ${coverageStart} to ${coverageEnd} (${coverageMonths.length} months: ${coverageMonths.join(', ')})`,
    '',
    `## Schedule deliverable slots (${totalDeliverableSlots} total)`,
    deliverableContext,
    '',
    `## Existing guideline videos (${existingVideos.length})`,
    existingVideosContext,
    '',
    `## Historical approved concepts (${historicalConcepts?.length ?? 0})`,
    historicalContext,
    '',
    '## Cross-client duplication (safe signal)',
    crossClientContext,
    '',
    `## Marketing Library knowledge (layers: ${knowledgeLayersRecorded.join(', ')})`,
    marketingLibraryContext,
    '',
    '## SA calendar context',
    calendarContext,
    '',
    '## Live external research',
    '  - NOT PERFORMED. Do not label any suggestion as "research-backed".',
    '  - The AI provider may use general training knowledge but must not present it as research.',
    '',
    'Generate structured video suggestions as JSON.',
  ].join('\n')

  const messages: AiChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]

  // ── Call AI provider ─────────────────────────────────────────────────────

  let aiResult: Awaited<ReturnType<typeof routeAiChat>>
  const fingerprint = await sha256(JSON.stringify({
    actorId: user.id,
    clientId,
    coverageStart,
    coverageEnd,
    guidelineId: guidelineId ?? null,
  }))
  const responseFor = (suggestions: VideoSuggestion[]): SuggestResponse => ({
    suggestions: suggestions.slice(0, MAX_SUGGESTIONS),
    context: {
      clientName: client.name,
      clientTier: client.tier,
      primaryIndustry: industryProfile?.primary_industry ?? null,
      secondaryIndustry: industryProfile?.secondary_industry ?? null,
      coverageMonths,
      totalDeliverableSlots,
      existingVideoCount: existingVideos.length,
    },
    sources: {
      canonicalInternal,
      marketingLibraryKnowledge,
      saCalendarContext,
      liveExternalResearch,
    },
  })

  try {
    aiResult = await routeAiChat(messages, {
      usageClient: sb as unknown as AiUsageClient,
      feature: 'content_video_suggestions',
      action: 'generate',
      actorId: user.id,
      idempotencyKey: requestId,
      fingerprint,
      complexity: 'complex',
      maxOutputTokens: SUGGESTION_MAX_OUTPUT_TOKENS,
      validateContent: content => extractSuggestions(content).length > 0,
      replayKind: 'suggestion_response',
      buildReplayPayload: routed => responseFor(extractSuggestions(routed.content)) as unknown as Record<string, unknown>,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown AI provider error.'
    const duplicate = errorMessage === 'AI_DUPLICATE_REQUEST'
    const budgetDenied = errorMessage === 'AI_HARD_BUDGET'
    if (duplicate && error instanceof AiDuplicateRequestError) {
      const replay = await fetchAiUsageReplay<SuggestResponse>(
        sb as unknown as AiUsageClient,
        error.requestId,
        fingerprint,
        'suggestion_response',
        user.id,
      )
      if (replay && Array.isArray(replay.suggestions) && replay.suggestions.length > 0 &&
        replay.suggestions.every(isValidSuggestion) && replay.context && replay.sources) {
        return jsonResponse({ ...replay, suggestions: replay.suggestions.slice(0, MAX_SUGGESTIONS), deduplicated: true })
      }
    }
    return jsonResponse({
      suggestions: [],
      error: duplicate
        ? 'This suggestion request was already submitted. No duplicate provider request was sent.'
        : budgetDenied
        ? 'The monthly AI budget has been reached. No provider request was sent.'
        : errorMessage === 'NO_AI_PROVIDER_KEYS'
        ? 'No AI provider key is configured.'
        : 'AI provider is currently unavailable.',
      context: {
        clientName: client.name,
        clientTier: client.tier,
        primaryIndustry: industryProfile?.primary_industry ?? null,
        secondaryIndustry: industryProfile?.secondary_industry ?? null,
        coverageMonths,
        totalDeliverableSlots,
        existingVideoCount: existingVideos.length,
      },
      sources: {
        canonicalInternal,
        marketingLibraryKnowledge,
        saCalendarContext,
        liveExternalResearch,
      },
    }, duplicate ? 425 : budgetDenied ? 429 : 503)
  }

  // ── Parse and validate JSON from response ───────────────────────────────

  const { provider: providerName, model: providerModel, content: rawContent } = aiResult

  const suggestions = extractSuggestions(rawContent)

  if (suggestions.length === 0) {
    return jsonResponse({
      suggestions: [],
      error: 'The AI provider returned an incomplete response. Please try again.',
      context: {
        clientName: client.name,
        clientTier: client.tier,
        primaryIndustry: industryProfile?.primary_industry ?? null,
        secondaryIndustry: industryProfile?.secondary_industry ?? null,
        coverageMonths,
        totalDeliverableSlots,
        existingVideoCount: existingVideos.length,
      },
      sources: {
        canonicalInternal,
        marketingLibraryKnowledge,
        saCalendarContext,
        liveExternalResearch,
      },
    }, 502)
  }

  // ── Return ──────────────────────────────────────────────────────────────

  const response = responseFor(suggestions)
  if (!aiResult.usageRequestId) throw new Error('AI usage request identity was not returned.')

  // Safe operational log (no prompts, scripts, credentials or secrets)
  const elapsed = Date.now() - startTime
  console.info(
    `[suggest-content-videos] user=${user.id} client=${clientId} ` +
    `months=${coverageMonths.length} slots=${totalDeliverableSlots} ` +
    `existing=${existingVideos.length} suggestions=${suggestions.length} ` +
    `provider=${providerName} model=${providerModel} elapsed=${elapsed}ms`,
  )

  return jsonResponse(response)
})

// ── AI Content Director (#224) ───────────────────────────────────────────────
// Two reviewable steps around the staff's own editing:
//   ideas   → ordered, client-specific ideas with no scripts; staff accept/edit/reorder them
//   develop → scripts, shot plans, requirements, visual direction and CTAs for the SAVED videos,
//             in their saved order, keeping the staff titles and edits
// Both refuse to run for a client whose exact-client intelligence projection is not ready, and
// both return drafts: nothing here writes into a guideline.

interface DirectorContext {
  sb: ReturnType<typeof createClient>
  userId: string
  requestId: string
  client: { id: string; name: string; tier: string }
  guidelineId: string | null
  coverageStart: string
  coverageEnd: string
  coverageMonths: string[]
  slots: ScheduleSlot[]
  marketingKnowledge: string[]
  calendar: string[]
  canonicalInternal: string[]
  existingTitles: string[]
  historicalTitles: string[]
}

type ReadyGuide = { markdown: string } | { notReady: { reason: string } }

async function loadReadyClientGuide(sb: ReturnType<typeof createClient>, clientId: string): Promise<ReadyGuide> {
  const { data } = await sb
    .from('client_guides')
    .select('client_id, guide_markdown, runtime_readiness, readiness_reason')
    .eq('client_id', clientId)
    .maybeSingle()
  const markdown = String((data?.guide_markdown as string | null) ?? '').trim()
  if (!data || data.client_id !== clientId || data.runtime_readiness !== 'ready' || !markdown) {
    return { notReady: { reason: (data?.readiness_reason as string | null) ?? 'No reviewed exact-client intelligence projection is ready.' } }
  }
  return { markdown }
}

function clientContextNotReady(clientName: string, reason: string): Response {
  return jsonResponse({
    error: 'CLIENT CONTEXT NOT READY',
    code: 'CLIENT_CONTEXT_NOT_READY',
    reason,
    instruction: `Complete the exact-client intelligence projection for ${clientName} before planning its content. Do not borrow another client.`,
  }, 409)
}

function directorSources(context: DirectorContext, research: { findings: string[]; sources: Array<{ title: string; uri: string }>; note: string }) {
  return {
    canonicalInternal: context.canonicalInternal,
    marketingLibraryKnowledge: context.marketingKnowledge,
    saCalendarContext: context.calendar,
    liveExternalResearch: [research.note, ...research.findings],
    researchSources: research.sources,
  }
}

function directorProviderError(error: unknown): { body: Record<string, unknown>; status: number } {
  const message = error instanceof Error ? error.message : 'Unknown AI provider error.'
  if (message === 'AI_DUPLICATE_REQUEST') {
    return { body: { error: 'This request was already submitted. No duplicate provider request was sent.' }, status: 425 }
  }
  if (message === 'AI_HARD_BUDGET') {
    return { body: { error: 'The monthly AI budget has been reached. No provider request was sent.' }, status: 429 }
  }
  if (message === 'NO_AI_PROVIDER_KEYS') {
    return { body: { error: 'No AI provider key is configured.' }, status: 503 }
  }
  return { body: { error: 'AI provider is currently unavailable.' }, status: 503 }
}

/**
 * Fresh external research, when a web-grounded provider is configured. Findings are INPUT for the
 * planner, never truth: each one keeps its source, and ideas may only cite a listed source.
 */
async function runClientResearch(
  context: DirectorContext,
  guideExcerpt: string,
): Promise<{ findings: string[]; sources: Array<{ title: string; uri: string }>; note: string }> {
  const prompt = buildResearchPrompt({
    clientName: context.client.name,
    guideExcerpt,
    coverageMonths: context.coverageMonths,
  })
  try {
    const routed = await routeAiChat(
      [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
      {
        usageClient: context.sb as unknown as AiUsageClient,
        feature: 'content_video_research',
        action: 'research',
        actorId: context.userId,
        idempotencyKey: `${context.requestId}:research`,
        fingerprint: await sha256(JSON.stringify({
          actorId: context.userId,
          clientId: context.client.id,
          coverageStart: context.coverageStart,
          coverageEnd: context.coverageEnd,
          kind: 'research',
        })),
        complexity: 'simple',
        maxOutputTokens: RESEARCH_MAX_OUTPUT_TOKENS,
        webSearch: true,
      },
    )
    const findings = parseResearchFindings(routed.content)
    const sources = routed.groundingSources ?? []
    if (findings.length === 0 || sources.length === 0) {
      return { findings: [], sources: [], note: 'Live external research: NOT PERFORMED — the web-grounded provider returned nothing citable.' }
    }
    return {
      findings,
      sources,
      note: `Live external research: performed this session via ${routed.provider} with ${sources.length} cited source${sources.length === 1 ? '' : 's'}.`,
    }
  } catch {
    return { findings: [], sources: [], note: 'Live external research: NOT PERFORMED — no web-grounded AI provider is configured.' }
  }
}

async function handleIdeasMode(context: DirectorContext): Promise<Response> {
  const guide = await loadReadyClientGuide(context.sb, context.client.id)
  if ('notReady' in guide) return clientContextNotReady(context.client.name, guide.notReady.reason)
  const guideExcerpt = clientGuideExcerpt(guide.markdown)
  const research = await runClientResearch(context, guideExcerpt)
  const researchInput: ResearchInput | null = research.findings.length > 0
    ? { findings: research.findings, sources: research.sources }
    : null
  const prompt = buildIdeasPrompt({
    clientName: context.client.name,
    guideExcerpt,
    coverageMonths: context.coverageMonths,
    slots: context.slots,
    existingTitles: context.existingTitles,
    historicalTitles: context.historicalTitles,
    marketingKnowledge: context.marketingKnowledge,
    calendar: context.calendar,
    research: researchInput,
  })
  const allowed = {
    deliverableIds: new Set(context.slots.map(slot => slot.id)),
    months: new Set(context.coverageMonths),
    researchUris: new Set(research.sources.map(source => source.uri)),
  }
  const sources = directorSources(context, research)
  const baseContext = {
    clientName: context.client.name,
    coverageMonths: context.coverageMonths,
    totalDeliverableSlots: context.slots.length,
    existingVideoCount: context.existingTitles.length,
  }
  let routed: Awaited<ReturnType<typeof routeAiChat>>
  try {
    routed = await routeAiChat(
      [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
      {
        usageClient: context.sb as unknown as AiUsageClient,
        feature: 'content_video_ideas',
        action: 'generate',
        actorId: context.userId,
        idempotencyKey: context.requestId,
        fingerprint: await sha256(JSON.stringify({
          actorId: context.userId,
          clientId: context.client.id,
          coverageStart: context.coverageStart,
          coverageEnd: context.coverageEnd,
          guidelineId: context.guidelineId,
          kind: 'ideas',
        })),
        complexity: 'complex',
        maxOutputTokens: IDEAS_MAX_OUTPUT_TOKENS,
        validateContent: content => parseIdeas(content, allowed).length > 0,
      },
    )
  } catch (error) {
    const mapped = directorProviderError(error)
    return jsonResponse({ mode: 'ideas', ideas: [], context: baseContext, sources, ...mapped.body }, mapped.status)
  }
  const ideas = parseIdeas(routed.content, allowed)
  if (ideas.length === 0) {
    return jsonResponse({
      mode: 'ideas',
      ideas: [],
      error: 'The AI provider returned an incomplete response. Please try again.',
      context: baseContext,
      sources,
    }, 502)
  }
  console.info(
    `[content-director] mode=ideas user=${context.userId} client=${context.client.id} ` +
    `months=${context.coverageMonths.length} slots=${context.slots.length} ideas=${ideas.length} ` +
    `research=${research.sources.length} provider=${routed.provider}`,
  )
  return jsonResponse({ mode: 'ideas', ideas, context: baseContext, sources })
}

async function handleDevelopMode(context: DirectorContext, requestedVideoIds: string[]): Promise<Response> {
  if (!context.guidelineId) return jsonResponse({ error: 'guidelineId is required to develop saved videos.' }, 400)
  const guide = await loadReadyClientGuide(context.sb, context.client.id)
  if ('notReady' in guide) return clientContextNotReady(context.client.name, guide.notReady.reason)

  // The guideline's SAVED rows are the authority: staff order and staff edits win.
  const { data: savedVideos } = await context.sb
    .from('content_guide_ideas')
    .select('id, position, title, objective, hook, notes, month, deliverable_id')
    .eq('content_guideline_id', context.guidelineId)
    .neq('status', 'archived')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  const slotLabels = new Map(context.slots.map(slot => [slot.id, `${slot.code ?? slot.deliverableType}${slot.title ? ` — ${slot.title}` : ''} (${slot.month.slice(0, 7)})`]))
  const wanted = new Set(requestedVideoIds)
  const targets: DevelopTarget[] = (savedVideos ?? [])
    .filter(video => wanted.size === 0 || wanted.has(video.id as string))
    .slice(0, MAX_DEVELOP_VIDEOS)
    .map((video, index) => ({
      id: video.id as string,
      position: (video.position as number | null) ?? index + 1,
      title: String(video.title ?? ''),
      objective: (video.objective as string | null) ?? null,
      hook: (video.hook as string | null) ?? null,
      notes: (video.notes as string | null) ?? null,
      targetMonth: video.month ? String(video.month).slice(0, 7) : null,
      deliverableLabel: video.deliverable_id ? (slotLabels.get(video.deliverable_id as string) ?? 'linked to Client Schedule') : null,
    }))

  if (targets.length === 0) {
    return jsonResponse({ error: 'There are no saved videos to develop yet. Accept ideas into the guideline first.' }, 409)
  }

  const guideExcerpt = clientGuideExcerpt(guide.markdown)
  const research = { findings: [], sources: [], note: 'Live external research: NOT PERFORMED for this step — development follows the saved plan.' }
  const sources = directorSources(context, research)
  const baseContext = { clientName: context.client.name, developedCount: 0, requestedCount: targets.length }
  const prompt = buildDevelopPrompt({
    clientName: context.client.name,
    guideExcerpt,
    targets,
    marketingKnowledge: context.marketingKnowledge,
  })
  let routed: Awaited<ReturnType<typeof routeAiChat>>
  try {
    routed = await routeAiChat(
      [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
      {
        usageClient: context.sb as unknown as AiUsageClient,
        feature: 'content_video_development',
        action: 'generate',
        actorId: context.userId,
        idempotencyKey: context.requestId,
        fingerprint: await sha256(JSON.stringify({
          actorId: context.userId,
          clientId: context.client.id,
          guidelineId: context.guidelineId,
          videoIds: targets.map(target => target.id),
          kind: 'develop',
        })),
        complexity: 'complex',
        maxOutputTokens: DEVELOP_MAX_OUTPUT_TOKENS,
        validateContent: content => parseDevelopments(content, targets).length > 0,
      },
    )
  } catch (error) {
    const mapped = directorProviderError(error)
    return jsonResponse({ mode: 'develop', developments: [], context: baseContext, sources, ...mapped.body }, mapped.status)
  }
  const developments = parseDevelopments(routed.content, targets)
  if (developments.length === 0) {
    return jsonResponse({
      mode: 'develop',
      developments: [],
      error: 'The AI provider returned an incomplete response. Please try again.',
      context: baseContext,
      sources,
    }, 502)
  }
  console.info(
    `[content-director] mode=develop user=${context.userId} client=${context.client.id} ` +
    `requested=${targets.length} developed=${developments.length} provider=${routed.provider}`,
  )
  return jsonResponse({
    mode: 'develop',
    developments,
    context: { ...baseContext, developedCount: developments.length },
    sources,
  })
}
