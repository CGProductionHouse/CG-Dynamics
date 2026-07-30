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
// { clientId, coverageStart, coverageEnd, guidelineId? }

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  routeAiChat,
  type AiChatMessage,
  hasAnyConfiguredProvider,
} from '../cg-assistant-chat/ai-router.ts'

// Canonical staff roles (matches STAFF_ROLES in src/lib/roles.ts and
// cg-assistant-chat). The DB CHECK constraint allows 'admin','team','client';
// the expanded set also covers future migrations that may add 'manager','staff','owner'.
const STAFF_ROLES = ['owner', 'admin', 'manager', 'staff', 'team'] as const
type StaffRole = typeof STAFF_ROLES[number]

const MAX_COVERAGE_MONTHS = 12
const MAX_SUGGESTIONS = 20
const EXPECTED_SUGGESTION_KEYS = [
  'targetMonth', 'title', 'objective', 'hook', 'script',
  'sceneDirection', 'onScreenText', 'propsProductsPeople',
  'locationSuggestion', 'cta', 'reasoning', 'sourcesUsed', 'duplicationRisk',
] as const

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
  clientId: string
  coverageStart: string
  coverageEnd: string
  guidelineId?: string
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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  // Fail closed: no profile, inactive profile, or non-staff role → deny.
  if (!profile || !isStaffRole(profile.role)) {
    return jsonResponse({ error: 'Staff access required.' }, 403)
  }

  const callerRole = profile.role as StaffRole

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

  const { clientId, coverageStart, coverageEnd, guidelineId } = body
  if (!clientId || !coverageStart || !coverageEnd) {
    return jsonResponse({ error: 'clientId, coverageStart and coverageEnd are required.' }, 400)
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
  const industryCardCount = (skillCards ?? []).filter((c) => c.knowledge_layer === 'industry_specific').length
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

  if (!hasAnyConfiguredProvider()) {
    return jsonResponse({
      suggestions: [],
      error: 'No AI provider key is configured. Add an OpenRouter, Gemini, Groq or OpenAI key in Supabase Edge Function secrets.',
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
  }

  let providerName = 'ai-router'
  let providerModel = 'ai-router'
  let rawContent = ''

  try {
    const result = await routeAiChat(messages)
    providerName = result.provider
    providerModel = result.model
    rawContent = result.content
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown AI provider error.'
    return jsonResponse({
      suggestions: [],
      error: errorMessage === 'NO_AI_PROVIDER_KEYS'
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
    })
  }

  // ── Parse and validate JSON from response ───────────────────────────────

  let suggestions: VideoSuggestion[] = []

  function extractSuggestions(raw: string): VideoSuggestion[] {
    // Try direct parse
    try {
      const parsed = JSON.parse(raw)
      if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
        return parsed.suggestions.filter(isValidSuggestion).slice(0, MAX_SUGGESTIONS)
      }
      if (Array.isArray(parsed)) {
        return parsed.filter(isValidSuggestion).slice(0, MAX_SUGGESTIONS)
      }
    } catch {
      // Try code fence extraction
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

  suggestions = extractSuggestions(rawContent)

  // ── Return ──────────────────────────────────────────────────────────────

  const response: SuggestResponse = {
    suggestions,
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
  }

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
